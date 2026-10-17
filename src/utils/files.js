import glob from 'fast-glob';
import { readFileSync, writeFile } from 'fs';

function readGlob(inputPath, types = ['ts', 'html']) {
  const inputGlob = `${inputPath}/**/*.(${types.join('|')})`

  return glob(inputGlob, {
    ignore: [`!${inputPath}/**/node_modules/**`]
  });
}

function getTranslationFiles(i18nFolderPath, fileTypes) {
  return readGlob(i18nFolderPath, fileTypes);
}

function getProjectFiles(projectPath, fileTypes) {
  return readGlob(projectPath, fileTypes);
}

function tokenizeCode(source) {
  const tokens = [];

  function isIdentifierStart(character) {
    return /[A-Za-z_$]/.test(character);
  }

  function isIdentifierPart(character) {
    return /[\w$]/.test(character);
  }

  function canStartRegularExpression() {
    const previous = tokens[tokens.length - 1];
    if (!previous) return true;

    if (
      previous.type === 'identifier' &&
      ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'of', 'yield', 'await'].includes(previous.value)
    ) {
      return true;
    }

    return previous.type === 'punctuator' &&
      ['(', '{', '[', ',', ';', '=', '!', ':', '?', '&', '|', '+', '-', '*', '%', '^', '~', '<', '>'].includes(previous.value);
  }

  function skipRegularExpression(index) {
    let inCharacterClass = false;
    index++;

    while (index < source.length) {
      const character = source[index];

      if (character === '\\') {
        index += 2;
      } else if (character === '\n' || character === '\r') {
        return index;
      } else if (character === '[') {
        inCharacterClass = true;
        index++;
      } else if (character === ']') {
        inCharacterClass = false;
        index++;
      } else if (character === '/' && !inCharacterClass) {
        index++;
        while (index < source.length && isIdentifierPart(source[index])) index++;
        return index;
      } else {
        index++;
      }
    }

    return index;
  }

  function readQuotedString(index, quote) {
    const start = index + 1;
    index++;

    while (index < source.length) {
      const character = source[index];

      if (character === '\\') {
        index += 2;
      } else if (character === quote) {
        tokens.push({ type: 'string', value: source.slice(start, index) });
        return index + 1;
      } else if (character === '\n' || character === '\r') {
        return index;
      } else {
        index++;
      }
    }

    return index;
  }

  function readTemplate(index) {
    let contentStart = index + 1;
    let hasInterpolation = false;
    index++;

    while (index < source.length) {
      const character = source[index];

      if (character === '\\') {
        index += 2;
      } else if (character === String.fromCharCode(96)) {
        if (!hasInterpolation) {
          tokens.push({ type: 'string', value: source.slice(contentStart, index) });
        }
        return index + 1;
      } else if (character === '$' && source[index + 1] === '{') {
        if (!hasInterpolation) tokens.push({ type: 'template', value: null });
        hasInterpolation = true;
        tokens.push({ type: 'template-boundary' });
        index = readCode(index + 2, true);
        tokens.push({ type: 'template-boundary' });
        contentStart = index;
      } else {
        index++;
      }
    }

    if (!hasInterpolation) tokens.push({ type: 'template', value: null });
    return index;
  }

  function readCode(index, inTemplateExpression) {
    let nestedBraceDepth = 0;

    while (index < source.length) {
      const character = source[index];
      const nextCharacter = source[index + 1];

      if (inTemplateExpression && character === '}' && nestedBraceDepth === 0) {
        return index + 1;
      }

      if (/\s/.test(character)) {
        index++;
      } else if (character === '/' && nextCharacter === '/') {
        index += 2;
        while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index++;
      } else if (source.slice(index, index + 4) === '<!--') {
        index += 4;
        while (index < source.length && source.slice(index, index + 3) !== '-->') index++;
        index = Math.min(index + 3, source.length);
      } else if (character === '/' && nextCharacter === '*') {
        index += 2;
        while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index++;
        index = Math.min(index + 2, source.length);
      } else if (character === "'" || character === '"') {
        index = readQuotedString(index, character);
      } else if (character === String.fromCharCode(96)) {
        index = readTemplate(index);
      } else if (character === '/' && canStartRegularExpression()) {
        tokens.push({ type: 'regular-expression' });
        index = skipRegularExpression(index);
      } else if (isIdentifierStart(character)) {
        const start = index;
        index++;
        while (index < source.length && isIdentifierPart(source[index])) index++;
        tokens.push({ type: 'identifier', value: source.slice(start, index) });
      } else {
        if (character === '{') nestedBraceDepth++;
        if (character === '}' && nestedBraceDepth > 0) nestedBraceDepth--;
        tokens.push({ type: 'punctuator', value: character });
        index++;
      }
    }

    return index;
  }

  readCode(0, false);
  return tokens;
}

function extractServiceStrings(source, translateServiceName) {
  const serviceName = translateServiceName.trim();
  const validServicePath = /^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*$/;
  if (!validServicePath.test(serviceName)) return [];

  const servicePath = serviceName.split(/\s*\.\s*/);
  const methods = ['instant', 'get', 'stream', 'getStreamOnTranslationChange'];
  const keyPattern = /^[\w-]+(?:\.[\w-]+)*$/;
  const tokens = tokenizeCode(source);
  const foundStrings = [];

  for (let index = 0; index < tokens.length; index++) {
    let cursor = index;
    let matchesServicePath = true;

    for (let pathIndex = 0; pathIndex < servicePath.length; pathIndex++) {
      if (
        !tokens[cursor] ||
        tokens[cursor].type !== 'identifier' ||
        tokens[cursor].value !== servicePath[pathIndex]
      ) {
        matchesServicePath = false;
        break;
      }

      cursor++;
      if (pathIndex < servicePath.length - 1) {
        if (!tokens[cursor] || tokens[cursor].value !== '.') {
          matchesServicePath = false;
          break;
        }
        cursor++;
      }
    }

    if (!matchesServicePath || !tokens[cursor] || tokens[cursor].value !== '.') continue;
    const method = tokens[cursor + 1];
    if (!method || method.type !== 'identifier' || !methods.includes(method.value)) continue;
    if (!tokens[cursor + 2] || tokens[cursor + 2].value !== '(') continue;

    const argument = tokens[cursor + 3];
    if (argument && argument.type === 'string' && keyPattern.test(argument.value)) {
      foundStrings.push(argument.value);
    }
  }

  return foundStrings;
}

function parseFile(fileName, translateServiceName = 'translateService') {
  const file = readFileSync(fileName, { encoding: 'utf8' });
  const foundStrings = [];

  // Match translate pipes even when whitespace (including line breaks) surrounds the pipe.
  const pipeRegex = /(['"])([\w-]+(?:\.[\w-]+)*)\1\s*\|\s*translate\b/g;
  let matched;
  while ((matched = pipeRegex.exec(file)) !== null) {
    foundStrings.push(matched[2]);
  }

  // Tokenize source code so service calls in comments or string contents are ignored.
  if (translateServiceName) {
    foundStrings.push(...extractServiceStrings(file, translateServiceName));
  }

  return foundStrings;
}
function parseTranslation(fileName) {
  const file = readFileSync(fileName, { encoding: 'utf8' });

  return flattenObject(JSON.parse(file));
}

function flattenObject(obj, parent, res = {}) {
  for (let key in obj) {
    let propName = parent ? parent + '.' + key : key;
    if (typeof obj[key] == 'object') {
      flattenObject(obj[key], propName, res);
    } else {
      res[propName] = obj[key];
    }
  }
  return res;
}

function writeJsonOrStdout(jsonpath, data) {
  console.log('');
  if (jsonpath) {
    let outputPath = jsonpath;
    if (!jsonpath.endsWith('.json')) {
      console.log("Appending .json to output file name.");
      outputPath = outputPath.concat('.json');
    }

    writeFile(outputPath, JSON.stringify(data, null, "\t"), e => {
      console.log(`Results were written to "${outputPath}" file.`);
    });
  } else {
    console.log(data);
  }
}

export { getTranslationFiles, getProjectFiles, parseFile, parseTranslation, writeJsonOrStdout };
