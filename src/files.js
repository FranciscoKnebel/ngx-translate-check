import glob from 'fast-glob';
import { readFileSync } from 'fs';

function readGlob(inputPath, types = ['ts', 'html']) {
  const inputGlob = `${inputPath}/**/*.(${types.join('|')})`
  return glob(inputGlob);
}

function getTranslationFiles(i18nFolderPath) {
  return readGlob(i18nFolderPath, ['json']);
}

function getProjectFiles(projectPath) {
  return readGlob(projectPath, ['ts', 'html']);
}

function parseFile(fileName) {
  const file = readFileSync(fileName, { encoding: 'utf8' });

  // May start with '{{' and end with '}}', but not necessary.
  // Internal string is separated by \' or \".
  // String is filled with multiple dot separated words.
  // After the string, whitespace with a pipe | separator.
  // After the operator, the translate pipe.
  // Ending the regex, whitespace and the optional '}}'.
  const matched = file.match(
    /({{)?( )*(\'|\")((\w|\-)\.?)*(\'|\")( )*\|( )*translate( )*(}})?/g
  );

  // Only return internal string of matches
  let foundStrings = [];
  if (matched && matched.length > 0) {
    foundStrings = matched.map(str => str.match(/(\'|\")(.*)?(\'|\")/)[2]);
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

export { getTranslationFiles, getProjectFiles, parseFile, parseTranslation };
