#!/usr/bin/env node

import commander from 'commander';
import path from 'path';
import marky from 'marky';

import pkg from '../package.json';
import { getProjectFiles, getTranslationFiles, parseFile, parseTranslation } from './files';
import { inputFilesMap, translationsMap, mapAddString, mapAddTranslationString } from './dictionary';

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

program
  .parse(process.argv);
