import commander from 'commander';
import path from 'path';

import pkg from '../package.json';
import { getProjectFiles, getTranslationFiles, parseFile, parseTranslation } from './files';
import { inputFilesMap, translationsMap, mapAddString } from './dictionary';

const program = new commander.Command();

program.version(pkg.version);
program.description(pkg.description);

program
  .command('files <path>')
  .option('--i18n <folder>', 'i18n translation files folder inside project.', 'assets/i18n')
  .option('--i18nPath <path>', 'Path to translation folder if files are outside project.')
  .action((projectPath, cmd) => {
    const options = {
      projectPath,
      i18nPath: cmd.i18nPath ? cmd.i18nPath : path.join(projectPath, cmd.i18n)
    }

    console.log(`Project path: "${options.projectPath}".`);
    console.log(`i18n folder: "${options.i18nPath}".`);

    const filePromises = [
      getProjectFiles(options.projectPath),
      getTranslationFiles(options.i18nPath)
    ];

    Promise.all(filePromises).then(([projectFiles, translationFiles]) => {
      console.log(`Total project files: ${projectFiles.length}`);
      console.log(`Total translation files: ${translationFiles.length}`);

      parseProjectFiles(projectFiles);
      console.log('');
      parseTranslationFiles(translationFiles);
    })
  });

function parseProjectFiles(projectFiles) {
  console.log('Starting to parse project files...');
  projectFiles.forEach(name => {
    const foundStrings = parseFile(name);
    // console.log(`Parsed '${name}' for ${foundStrings.length} keys.`);
    foundStrings.forEach(str => mapAddString(inputFilesMap, str));
  });
  console.log('Finished parsing project files.');
  console.log(`Total keys used: ${inputFilesMap.size}`)
}

function parseTranslationFiles(projectFiles) {
  console.log('Starting to parse translation files...');
  projectFiles.forEach(name => {
    const foundTranslations = parseTranslation(name);
    console.log(`Parsed '${name}' for ${Object.keys(foundTranslations).length} translation strings.`);
    
    const keys = Object.keys(foundTranslations);
    keys.forEach(key => mapAddString(translationsMap, key));
  });
  console.log('Finished parsing translation files.');
}

program
  .parse(process.argv);

