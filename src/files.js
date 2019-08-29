import glob from 'fast-glob';
import path from 'path';

function readGlob(inputPath, types = ['ts', 'html']) {
  const inputGlob = `${inputPath}/**/*.(${types.join('|')})`
  console.log('glob', inputGlob);
  
  return glob(inputGlob);
}

function getTranslationFiles(i18nFolderPath) {
  return readGlob(i18nFolderPath, ['json']);
}

function getProjectFiles(projectPath) {
  return readGlob(projectPath, ['ts', 'html']);
}

export { getTranslationFiles, getProjectFiles };
