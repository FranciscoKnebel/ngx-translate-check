import path from 'path';
import marky from 'marky';
import { writeFile } from 'fs';

import { getProjectFiles, getTranslationFiles, parseFile, parseTranslation } from '../utils/files';
import { inputFilesMap, translationsMap, mapAddString, mapAddTranslationString, mapToJson, translationMapToObj, mapToObj } from '../utils/dictionary';

export default function(program) {
  program
    .command('files <path>')
    .option('--i18n <folder>', 'i18n translation files folder inside project.', 'src/assets/i18n')
    .option('--i18nPath <path>', 'Path to translation folder if files are outside project.')
    .option('--json <path>', 'Save output to <path> file.')
    .description('Parses project files and i18n files to find amount of usage of i18n strings, outputting to stdout or a json file.')
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
        console.log(`Total project files found: ${projectFiles.length}`);
        console.log(`Total translation files found: ${translationFiles.length}`);

        parseProjectFiles(projectFiles);
        console.log('');
        parseTranslationFiles(translationFiles);

        const response = {
          inputFiles: mapToObj(inputFilesMap),
          translationFiles: translationMapToObj(translationsMap)
        }

        console.log('');
        if (cmd.json) {
          let outputPath = cmd.json;
          if (!cmd.json.endsWith('.json')) {
            console.log("Appending .json to output file name.");
            outputPath = outputPath.concat('.json');
          }

          writeFile(outputPath, JSON.stringify(response, null, "\t"), e => {
            console.log(`Results were written to "${outputPath}" file.`);
          });
        } else {
          console.log(response);
        }
      })
    });
}

function parseProjectFiles(projectFiles) {
  console.log('\nStarting to parse project files...');

  marky.mark('parse-project-files');
  projectFiles.forEach(name => {
    const foundStrings = parseFile(name);
    // console.log(`Parsed '${name}' for ${foundStrings.length} keys.`);
    foundStrings.forEach(str => mapAddString(inputFilesMap, str));
  });
  const entry = marky.stop('parse-project-files');

  console.log(`Finished parsing project files in ${entry.duration.toFixed(3)}ms.`);
  console.log(`Total unique translation keys used in project files: ${inputFilesMap.size}`);

  let totalTranslationsUsed = 0;
  for (const entry of inputFilesMap.entries()) {
    totalTranslationsUsed += entry[1];
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

