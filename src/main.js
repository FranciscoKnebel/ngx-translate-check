import commander from 'commander';
import path from 'path';

import pkg from '../package.json';
import { getProjectFiles, getTranslationFiles } from './files';

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
      // console.log({ projectFiles, translationFiles });
    })
  });

program
  .parse(process.argv);

