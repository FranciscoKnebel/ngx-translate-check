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

function parseFile(fileName, translateServiceName = 'translateService') {
  const file = readFileSync(fileName, { encoding: 'utf8' });
  const foundStrings = [];

  // Match translate pipes even when whitespace (including line breaks) surrounds the pipe.
  const pipeRegex = /(['"])([\w-]+(?:\.[\w-]+)*)\1\s*\|\s*translate\b/g;
  let matched;
  while ((matched = pipeRegex.exec(file)) !== null) {
    foundStrings.push(matched[2]);
  }

  // TranslateService may be injected under a different variable name in each project.
  if (translateServiceName) {
    const escapedServiceName = translateServiceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const serviceCallRegex = new RegExp(
      "(?:^|[^$\\w])" + escapedServiceName +
      "\\s*\\.\\s*(?:instant|get|stream|getStreamOnTranslationChange)\\s*\\(\\s*(['\"])([\\w-]+(?:\\.[\\w-]+)*)\\1",
      'g'
    );

    while ((matched = serviceCallRegex.exec(file)) !== null) {
      foundStrings.push(matched[2]);
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
