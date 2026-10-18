import glob from 'fast-glob';
import { readFileSync, writeFile } from 'fs';
// Generated from Angular's WHATWG named-entity table, including its ngsp extension.
import namedEntities from './htmlEntities.json';

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

function tokenizeCode(source, stringEscapeMode = 'javascript') {
  const tokens = [];

  function isIdentifierStart(character) {
    return /[A-Za-z_$]/.test(character);
  }

  function isIdentifierPart(character) {
    return /[\w$]/.test(character);
  }

  function decodeStringValue(value, isTemplateLiteral = false, isAngularExpression = false) {
    if (isTemplateLiteral) value = value.replace(/\r\n?/g, '\n');
    let decoded = '';

    for (let index = 0; index < value.length; index++) {
      const character = value[index];
      if (character !== '\\' || index + 1 >= value.length) {
        decoded += character;
        continue;
      }

      const escaped = value[++index];
      if (isAngularExpression) {
        if (escaped === 'u') {
          const hex = value.slice(index + 1, index + 5);
          if (/^[\da-fA-F]{4}$/.test(hex)) {
            decoded += String.fromCharCode(parseInt(hex, 16));
            index += 4;
          } else {
            decoded += escaped;
          }
        } else {
          switch (escaped) {
            case 'n': decoded += '\n'; break;
            case 'f': decoded += '\f'; break;
            case 'r': decoded += '\r'; break;
            case 't': decoded += '\t'; break;
            case 'v': decoded += '\v'; break;
            default: decoded += escaped;
          }
        }
        continue;
      }

      switch (escaped) {
        case 'b': decoded += '\b'; break;
        case 'f': decoded += '\f'; break;
        case 'n': decoded += '\n'; break;
        case 'r': decoded += '\r'; break;
        case 't': decoded += '\t'; break;
        case 'v': decoded += '\v'; break;
        case '\n': break;
        case '\r':
          if (value[index + 1] === '\n') index++;
          break;
        case '\u2028':
        case '\u2029': break;
        case 'x': {
          const hex = value.slice(index + 1, index + 3);
          if (/^[\da-fA-F]{2}$/.test(hex)) {
            decoded += String.fromCharCode(parseInt(hex, 16));
            index += 2;
          } else {
            decoded += escaped;
          }
          break;
        }
        case 'u': {
          if (value[index + 1] === '{') {
            const braceEnd = value.indexOf('}', index + 2);
            const hex = braceEnd === -1 ? '' : value.slice(index + 2, braceEnd);
            const codePoint = /^[\da-fA-F]{1,6}$/.test(hex) ? parseInt(hex, 16) : -1;
            if (codePoint >= 0 && codePoint <= 0x10ffff) {
              decoded += String.fromCodePoint(codePoint);
              index = braceEnd;
            } else {
              decoded += escaped;
            }
          } else {
            const hex = value.slice(index + 1, index + 5);
            if (/^[\da-fA-F]{4}$/.test(hex)) {
              decoded += String.fromCharCode(parseInt(hex, 16));
              index += 4;
            } else {
              decoded += escaped;
            }
          }
          break;
        }
        default: {
          if (escaped >= '0' && escaped <= '7') {
            // Legacy octal escape from non-strict JavaScript: \0 through \377,
            // consuming the longest prefix of up to three octal digits that
            // stays within a single character code.
            let digits = escaped;
            while (digits.length < 3 && /^[0-7]$/.test(value[index + 1] || '')) {
              digits += value[++index];
            }

            let charCode = parseInt(digits, 8);
            while (charCode > 255 && digits.length > 1) {
              index--;
              digits = digits.slice(0, -1);
              charCode = parseInt(digits, 8);
            }

            decoded += String.fromCharCode(charCode);
            break;
          }

          decoded += escaped;
        }
      }
    }

    return decoded;
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
        if (tokens[index].type === 'punctuator' && tokens[index].value === ')') parenthesisDepth++;
        if (tokens[index].type === 'punctuator' && tokens[index].value === '(') parenthesisDepth--;

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
        index += source[index + 1] === '\r' && source[index + 2] === '\n' ? 3 : 2;
      } else if (character === quote) {
        tokens.push({ type: 'string', value: decodeStringValue(source.slice(start, index), false, stringEscapeMode === 'angular') });
        return index + 1;
      } else if ((character === '\n' || character === '\r') && stringEscapeMode !== 'angular') {
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
          tokens.push({ type: 'string', value: decodeStringValue(source.slice(contentStart, index), true, stringEscapeMode === 'angular') });
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

function extractServiceStrings(source, translateServiceName, stringEscapeMode = 'javascript') {
  const serviceName = translateServiceName.trim();
  const validServicePath = /^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*$/;
  if (!validServicePath.test(serviceName)) return [];

  const servicePath = serviceName.split(/\s*\.\s*/);
  const methods = ['instant', 'get', 'stream', 'getStreamOnTranslationChange'];
  const tokens = tokenizeCode(source, stringEscapeMode);
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
    if (tokens[callParenthesisIndex] && tokens[callParenthesisIndex].type === 'punctuator' &&
      tokens[callParenthesisIndex].value === '<') {
      let typeArgumentDepth = 0;
      let typeArgumentsClosed = false;

      for (let typeIndex = callParenthesisIndex; typeIndex < tokens.length; typeIndex++) {
        const token = tokens[typeIndex];
        if (token.type === 'punctuator' && token.value === '<') typeArgumentDepth++;
        if (token.type === 'punctuator' && token.value === '>') {
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
    if (argument && argument.type === 'string' && argument.value.length > 0) {
      foundStrings.push(argument.value);
    } else if (argument && argument.value === '[') {
      let arrayDepth = 0;
      let objectDepth = 0;
      let parenthesisDepth = 0;

      for (let argumentIndex = argumentStart; argumentIndex < tokens.length; argumentIndex++) {
        const token = tokens[argumentIndex];

        const isPunctuator = value => token.type === 'punctuator' && token.value === value;
        if (isPunctuator('[')) arrayDepth++;
        if (isPunctuator(']')) {
          arrayDepth--;
          if (arrayDepth === 0) break;
          continue;
        }

        if (arrayDepth === 1 && objectDepth === 0 && parenthesisDepth === 0 &&
          token.type === 'string' && token.value.length > 0 &&
          (tokens[argumentIndex - 1].type === 'punctuator' &&
            (tokens[argumentIndex - 1].value === '[' || tokens[argumentIndex - 1].value === ','))) {
          foundStrings.push(token.value);
        }

        if (token.type === 'punctuator') {
          if (token.value === '{') objectDepth++;
          if (token.value === '}' && objectDepth > 0) objectDepth--;
          if (token.value === '(') parenthesisDepth++;
          if (token.value === ')' && parenthesisDepth > 0) parenthesisDepth--;
        }
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

function extractAngularTemplateText(source) {
  const uncommentedSource = source.replace(/<!--[\s\S]*?-->/g, '');
  const text = [];
  let inTag = false;
  let tagQuote = null;

  for (let index = 0; index < uncommentedSource.length; index++) {
    const character = uncommentedSource[index];

    if (inTag) {
      if (tagQuote) {
        if (character === '\\') {
          index++;
        } else if (character === tagQuote) {
          tagQuote = null;
        }
      } else if (character === "'" || character === '"') {
        tagQuote = character;
      } else if (character === '>') {
        inTag = false;
        text.push(' ');
      }
      continue;
    }

    if (character === '<' && /^\/?[A-Za-z!?]/.test(uncommentedSource.slice(index + 1))) {
      inTag = true;
      text.push(' ');
    } else {
      text.push(character);
    }
  }

  return text.join('');
}

function extractAngularControlFlowSources(source) {
  const expressions = [];
  const controlFlowRegex = /@(?:(?:if|for|switch|case)|else\s+if)\s*\(/g;
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

function extractAngularLetSources(source) {
  const expressions = [];
  const letRegex = /@let\s+[\w$]+\s*=\s*/g;
  let matched;

  while ((matched = letRegex.exec(source)) !== null) {
    const expressionStart = letRegex.lastIndex;
    let expressionEnd = expressionStart;
    let nestingDepth = 0;

    while (expressionEnd < source.length) {
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
      } else if (character === '(' || character === '[' || character === '{') {
        nestingDepth++;
        expressionEnd++;
      } else if (character === ')' || character === ']' || character === '}') {
        nestingDepth = Math.max(0, nestingDepth - 1);
        expressionEnd++;
      } else if (character === ';' && nestingDepth === 0) {
        break;
      } else {
        expressionEnd++;
      }
    }

    if (expressionEnd > expressionStart) {
      expressions.push(source.slice(expressionStart, expressionEnd));
    }
    letRegex.lastIndex = expressionEnd + (source[expressionEnd] === ';' ? 1 : 0);
  }

  return expressions;
}

function extractInterpolations(source) {
  const expressions = [];
  const interpolationRegex = /{{([\s\S]*?)}}/g;
  let matched;

  while ((matched = interpolationRegex.exec(source)) !== null) {
    expressions.push(matched[1]);
  }

  return expressions;
}

function extractExpressionsFromText(source) {
  const interpolationRegex = /{{([\s\S]*?)}}/g;
  const plainText = source.replace(interpolationRegex, ' ');
  return [
    ...extractInterpolations(source),
    ...extractAngularControlFlowSources(plainText),
    ...extractAngularLetSources(plainText)
  ];
}

function findHtmlTagEnd(source, start) {
  let quote = null;

  for (let index = start; index < source.length; index++) {
    const character = source[index];

    if (quote) {
      if (character === '\\') {
        index++;
      } else if (character === quote) {
        quote = null;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '>') {
      return index;
    }
  }

  return source.length - 1;
}

function extractExpressionsFromTag(tag) {
  const expressions = [];
  let index = 1;

  if (tag[index] === '/') return expressions;
  while (index < tag.length && !/[\s/>]/.test(tag[index])) index++;

  while (index < tag.length) {
    while (index < tag.length && /[\s/]/.test(tag[index])) index++;
    if (index >= tag.length || tag[index] === '>') break;

    const nameStart = index;
    while (index < tag.length && !/[\s=/>]/.test(tag[index])) index++;
    const name = tag.slice(nameStart, index);
    if (!name) {
      index++;
      continue;
    }

    while (index < tag.length && /\s/.test(tag[index])) index++;
    if (tag[index] !== '=') continue;
    index++;
    while (index < tag.length && /\s/.test(tag[index])) index++;

    let value = '';
    if (tag[index] === '"' || tag[index] === "'") {
      const quote = tag[index++];
      const valueStart = index;
      while (index < tag.length && tag[index] !== quote) {
        if (tag[index] === '\\') index++;
        index++;
      }
      value = tag.slice(valueStart, index);
      if (tag[index] === quote) index++;
    } else {
      const valueStart = index;
      while (index < tag.length && !/[\s>]/.test(tag[index])) index++;
      value = tag.slice(valueStart, index);
    }

    const isAngularBinding = /^(?:\[\([^)]*\)\]|\[[^\]]+\]|\([^)]*\)|\*[\w-]+|bind-[\w-]+|on-[\w-]+)$/.test(name);
    if (isAngularBinding) {
      expressions.push(value);
    } else {
      expressions.push(...extractInterpolations(value));
    }
  }

  return expressions;
}

function decodeHtmlEntities(source) {
  return source.replace(/&(#(?:[xX][\da-fA-F]+|\d+)|[A-Za-z][A-Za-z0-9]+);/g, (entity, reference) => {
    if (reference[0] !== '#') return Object.prototype.hasOwnProperty.call(namedEntities, reference)
      ? namedEntities[reference]
      : entity;

    const isHexadecimal = reference[1] === 'x' || reference[1] === 'X';
    const codePoint = parseInt(reference.slice(isHexadecimal ? 2 : 1), isHexadecimal ? 16 : 10);
    if (codePoint > 0x10ffff) return entity;
    return String.fromCodePoint(codePoint);
  });
}

function extractAngularExpressionSources(source) {
  const expressions = [];
  let index = 0;
  let textStart = 0;

  while (index < source.length) {
    if (source.slice(index, index + 4) === '<!--') {
      expressions.push(...extractExpressionsFromText(source.slice(textStart, index)));
      const commentEnd = source.indexOf('-->', index + 4);
      index = commentEnd === -1 ? source.length : commentEnd + 3;
      textStart = index;
    } else if (
      source[index] === '<' &&
      index + 1 < source.length &&
      (/[A-Za-z/!]/.test(source[index + 1]))
    ) {
      expressions.push(...extractExpressionsFromText(source.slice(textStart, index)));
      const tagEnd = findHtmlTagEnd(source, index);
      const tag = source.slice(index, tagEnd + 1);
      if (source[index + 1] !== '!' && source[index + 1] !== '/') {
        expressions.push(...extractExpressionsFromTag(tag));
      }
      index = tagEnd + 1;
      textStart = index;
    } else {
      index++;
    }
  }

  expressions.push(...extractExpressionsFromText(source.slice(textStart)));
  return expressions.map(expression => decodeHtmlEntities(expression.replace(/\r\n?/g, '\n')));
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

  // Tokenize Angular expressions so pipe examples inside strings are ignored.
  angularExpressionSources.forEach(expression => {
    const tokens = tokenizeCode(expression, 'angular');
    for (let index = 0; index < tokens.length - 2; index++) {
      if (
        tokens[index].type === 'string' &&
        tokens[index].value.length > 0 &&
        tokens[index + 1].value === '|' &&
        tokens[index + 2].type === 'identifier' &&
        tokens[index + 2].value === 'translate'
      ) {
        foundStrings.push(tokens[index].value);
      }
    }
  });

  if (translateServiceName) {
    if (!isHtmlFile) {
      foundStrings.push(...extractServiceStrings(file, translateServiceName));
    }
    if (isHtmlFile || angularExpressionSources.length > 0) {
      foundStrings.push(...extractServiceStrings(
        angularExpressionSources.join('\n'),
        translateServiceName,
        'angular'
      ));
    }
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

