import { readFile } from 'fs';
import keysDiff from 'keys-diff';

import { writeJsonOrStdout } from '../utils/files';

export default function (program) {
  program
    .command('diff-input <path>')
    .option('--json <path>', 'Save output to <path> file.')
    .description('Receives a JSON file generated by the files command and shows difference between translation and input files.')
    .action((file, cmd) => {
      const options = {
        file
      };

      readFile(options.file, 'utf-8', (e, data) => {
        const inputObj = JSON.parse(data).input;
        const translationsObj = JSON.parse(data).translations;

        const languages = [];
        for (const lang in translationsObj) {
          if (translationsObj.hasOwnProperty(lang)) {
            languages.push(lang);
          }
        }
        
        const inputKeys = {};
        for (const lang in inputObj) {
          if (inputObj.hasOwnProperty(lang)) {
            inputKeys[lang] = inputObj[lang].amount;
          }
        }

        let response = {};
        languages.forEach(language => {
          console.log(`Getting difference between input files and ${language}.`);

          const diff = keysDiff(inputKeys, translationsObj[language]);
          response[language] = {};
          response[language][`in input files, not in language ${language}`] = diff[0];
          response[language][`in ${language}, not in input files`] = diff[1];
        });

        writeJsonOrStdout(cmd.json, response);
      })
    });
}