import path from 'path';
import marky from 'marky';

import { getProjectFiles, getTranslationFiles, parseFile, parseTranslation, writeJsonOrStdout } from '../utils/files';
import { inputFilesMap, translationsMap, mapAddTranslationString, translationMapToObj, mapToObj } from '../utils/dictionary';

export default function(program) {
  program
    .command('files <path>')
    .option('--i18n <folder>', 'i18n translation files folder inside project.', 'src/assets/i18n')
    .option('--i18nPath <path>', 'Path to translation folder if files are outside project.')
    .option('--i18nTypes <types>', 'comma separated string list of file types for i18n translation files', 'json')
    .option('--inputTypes <types>', 'comma separated string list of file types for project input files', 'ts,html,js')
    .option('--json <path>', 'Save output to <path> file.')
    .description('Parses project files and i18n files to find amount of usage of i18n strings, outputting to stdout or a json file.')
    .action((projectPath, cmd) => {
      const options = {
        projectPath,
        i18nPath: cmd.i18nPath ? cmd.i18nPath : path.join(projectPath, cmd.i18n),
        projectFileTypes: cmd.inputTypes.split(',').map(type => type.trim()),
        translationFileTypes: cmd.i18nTypes.split(',').map(type => type.trim())
      }

      console.log(`Project path: "${options.projectPath}".`);
      console.log(`Project input file types: ${options.projectFileTypes.join()}`);
      console.log(`i18n folder: "${options.i18nPath}".`);
      console.log(`i18n file types: ${options.translationFileTypes.join()}`);
      console.log('');

      const filePromises = [
        getProjectFiles(options.projectPath, options.projectFileTypes),
        getTranslationFiles(options.i18nPath, options.translationFileTypes)
      ];

      Promise.all(filePromises).then(([projectFiles, translationFiles]) => {
        console.log(`Total project files found: ${projectFiles.length}`);
        console.log(`Total translation files found: ${translationFiles.length}`);

        parseProjectFiles(projectFiles);
        console.log('');
        parseTranslationFiles(translationFiles);

        const response = {
          input: mapToObj(inputFilesMap),
          translations: translationMapToObj(translationsMap)
        }

        console.log('');
        writeJsonOrStdout(cmd.json, response);
      })
    });
}

function parseProjectFiles(projectFiles) {
  console.log('\nStarting to parse project files...');

  marky.mark('parse-project-files');
  projectFiles.forEach(file => {
    const foundStrings = parseFile(file);
    foundStrings.forEach(str => {
      const found = inputFilesMap.get(str);

      if (found) {
        inputFilesMap.set(str, {
          amount: found.amount + 1,
          files: [...found.files, file]
        });
      } else {
        inputFilesMap.set(str, {
          amount: 1,
          files: [file]
        });
      }
    });
  });
  const entry = marky.stop('parse-project-files');

  console.log(`Finished parsing project files in ${entry.duration.toFixed(3)}ms.`);
  console.log(`Total unique translation keys used in project files: ${inputFilesMap.size}`);

  let totalTranslationsUsed = 0;
  for (const entry of inputFilesMap.entries()) {
    totalTranslationsUsed += entry[1].amount;
  }
  console.log(`Total translations used in project files: ${totalTranslationsUsed}`);
}

function parseTranslationFiles(translationFiles) {
  console.log('Starting to parse translation files...');
  marky.mark('parse-translation-files');
  translationFiles.forEach(name => {
    const foundTranslations = parseTranslation(name);
    console.log(`Parsed '${name}' for ${Object.keys(foundTranslations).length} translation strings.`);

    const keys = Object.keys(foundTranslations);
    keys.forEach(key => mapAddTranslationString(translationsMap, name, key));
  });
  const entry = marky.stop('parse-translation-files');

  console.log(`Finished parsing translation files in ${entry.duration.toFixed(3)}ms.`);
}

