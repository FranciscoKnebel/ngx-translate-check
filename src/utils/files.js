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
      ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'of', 'yield', 'await', 'else', 'do'].includes(previous.value)
    ) {
      return true;
    }

    if (previous.type === 'punctuator' && previous.value === ')') {
      let parenthesisDepth = 0;

      for (let index = tokens.length - 1; index >= 0; index--) {
        if (tokens[index].value === ')') parenthesisDepth++;
        if (tokens[index].value === '(') parenthesisDepth--;

        if (parenthesisDepth === 0) {
          const condition = tokens[index - 1];
          return condition && condition.type === 'identifier' &&
            ['if', 'while', 'for', 'with', 'switch', 'catch'].includes(condition.value);
        }
      }
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

    if (!matchesServicePath) continue;

    let methodIndex = cursor;
    if (tokens[methodIndex] && tokens[methodIndex].value === '?' &&
      tokens[methodIndex + 1] && tokens[methodIndex + 1].value === '.') {
      methodIndex += 2;
    } else if (tokens[methodIndex] && tokens[methodIndex].value === '!' &&
      tokens[methodIndex + 1] && tokens[methodIndex + 1].value === '.') {
      methodIndex += 2;
    } else if (tokens[methodIndex] && tokens[methodIndex].value === '.') {
      methodIndex++;
    } else {
      continue;
    }

    const method = tokens[methodIndex];
    if (!method || method.type !== 'identifier' || !methods.includes(method.value)) continue;

    let callParenthesisIndex = methodIndex + 1;
    if (tokens[callParenthesisIndex] && tokens[callParenthesisIndex].value === '<') {
      let typeArgumentDepth = 0;
      let typeArgumentsClosed = false;

      for (let typeIndex = callParenthesisIndex; typeIndex < tokens.length; typeIndex++) {
        if (tokens[typeIndex].value === '<') typeArgumentDepth++;
        if (tokens[typeIndex].value === '>') {
          typeArgumentDepth--;
          if (typeArgumentDepth === 0) {
            callParenthesisIndex = typeIndex + 1;
            typeArgumentsClosed = true;
            break;
          }
        }
      }

      if (!typeArgumentsClosed) continue;
    }

    if (!tokens[callParenthesisIndex] || tokens[callParenthesisIndex].value !== '(') continue;
    const argumentStart = callParenthesisIndex + 1;
    const argument = tokens[argumentStart];
    if (argument && argument.type === 'string' && keyPattern.test(argument.value)) {
      foundStrings.push(argument.value);
    } else if (argument && argument.value === '[') {
      let arrayDepth = 0;
      let objectDepth = 0;
      let parenthesisDepth = 0;

      for (let argumentIndex = argumentStart; argumentIndex < tokens.length; argumentIndex++) {
        const token = tokens[argumentIndex];

        if (token.value === '[') arrayDepth++;
        if (token.value === ']') {
          arrayDepth--;
          if (arrayDepth === 0) break;
          continue;
        }

        if (arrayDepth === 1 && objectDepth === 0 && parenthesisDepth === 0 &&
          token.type === 'string' && keyPattern.test(token.value) &&
          (tokens[argumentIndex - 1].value === '[' || tokens[argumentIndex - 1].value === ',')) {
          foundStrings.push(token.value);
        }

        if (token.value === '{') objectDepth++;
        if (token.value === '}' && objectDepth > 0) objectDepth--;
        if (token.value === '(') parenthesisDepth++;
        if (token.value === ')' && parenthesisDepth > 0) parenthesisDepth--;
      }
    }
  }

  return foundStrings;
}

function extractInlineAngularTemplates(source) {
  const tokens = tokenizeCode(source);
  const templates = [];

  for (let index = 0; index < tokens.length; index++) {
    if (
      tokens[index].type === 'identifier' &&
      tokens[index].value === 'template' &&
      tokens[index + 1] &&
      tokens[index + 1].value === ':' &&
      tokens[index + 2] &&
      tokens[index + 2].type === 'string'
    ) {
      templates.push(tokens[index + 2].value);
    }
  }

  return templates;
}

function extractAngularControlFlowSources(source) {
  const expressions = [];
  const controlFlowRegex = /@(?:if|for|switch|case)\s*\(/g;
  let matched;

  while ((matched = controlFlowRegex.exec(source)) !== null) {
    const expressionStart = controlFlowRegex.lastIndex;
    let expressionEnd = expressionStart;
    let parenthesisDepth = 1;

    while (expressionEnd < source.length && parenthesisDepth > 0) {
      const character = source[expressionEnd];
      const nextCharacter = source[expressionEnd + 1];

      if (character === "'" || character === '"' || character === String.fromCharCode(96)) {
        const quote = character;
        expressionEnd++;
        while (expressionEnd < source.length) {
          if (source[expressionEnd] === '\\') {
            expressionEnd += 2;
          } else if (source[expressionEnd] === quote) {
            expressionEnd++;
            break;
          } else {
            expressionEnd++;
          }
        }
      } else if (character === '/' && nextCharacter === '/') {
        expressionEnd += 2;
        while (expressionEnd < source.length && source[expressionEnd] !== '\n' && source[expressionEnd] !== '\r') expressionEnd++;
      } else if (character === '/' && nextCharacter === '*') {
        expressionEnd += 2;
        while (expressionEnd < source.length && !(source[expressionEnd] === '*' && source[expressionEnd + 1] === '/')) expressionEnd++;
        expressionEnd = Math.min(expressionEnd + 2, source.length);
      } else {
        if (character === '(') parenthesisDepth++;
        if (character === ')') parenthesisDepth--;
        expressionEnd++;
      }
    }

    if (parenthesisDepth === 0) {
      expressions.push(source.slice(expressionStart, expressionEnd - 1));
    }
  }

  return expressions;
}

function extractAngularExpressionSources(source) {
  const uncommentedSource = source.replace(/<!--[\s\S]*?-->/g, '');
  const expressions = extractAngularControlFlowSources(uncommentedSource);
  const interpolationRegex = /{{([\s\S]*?)}}/g;
  const bindingAttributeRegex = /(?:\[\([^)]+\)\]|\[[^\]]+\]|\([^)]*\)|\*[\w-]+|bind-[\w-]+|on-[\w-]+)\s*=\s*(["'])([\s\S]*?)\1/g;
  let matched;

  while ((matched = interpolationRegex.exec(uncommentedSource)) !== null) {
    expressions.push(matched[1]);
  }
  while ((matched = bindingAttributeRegex.exec(uncommentedSource)) !== null) {
    expressions.push(matched[2]);
  }

  return expressions;
}

function parseFile(fileName, translateServiceName = 'translateService') {
  const file = readFileSync(fileName, { encoding: 'utf8' });
  const foundStrings = [];

  const isHtmlFile = /\.html?$/i.test(fileName);
  const inlineTemplateExpressions = isHtmlFile
    ? []
    : extractInlineAngularTemplates(file).flatMap(template => extractAngularExpressionSources(template));
  const angularExpressionSources = isHtmlFile
    ? extractAngularExpressionSources(file)
    : inlineTemplateExpressions;

  // Find translate pipes only in active Angular expressions, not comments or string examples.
  const pipeRegex = /(['"])([\w-]+(?:\.[\w-]+)*)\1\s*\|\s*translate\b/g;
  angularExpressionSources.forEach(expression => {
    let matched;
    while ((matched = pipeRegex.exec(expression)) !== null) {
      foundStrings.push(matched[2]);
    }
  });

  if (translateServiceName) {
    const serviceCallSource = isHtmlFile ? angularExpressionSources.join('\n') : [file, ...angularExpressionSources].join('\n');
    foundStrings.push(...extractServiceStrings(serviceCallSource, translateServiceName));
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
