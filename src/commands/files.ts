import { performance } from "node:perf_hooks";
import { join } from "node:path";

import type { Command } from "commander";

import {
  addInputString,
  addTranslationString,
  mapToObj,
  translationMapToObj,
  type InputUsage,
  type TranslationUsageMap,
} from "../utils/dictionary.js";
import {
  getProjectFiles,
  getTranslationFiles,
  parseFile,
  parseTranslation,
  writeJsonOrStdout,
  type FilesOutput,
} from "../utils/files.js";

interface FilesCommandOptions {
  i18n: string;
  i18nPath?: string;
  i18nTypes: string;
  inputTypes: string;
  json?: string;
  translateService: string;
}

export function registerFilesCommand(program: Command): void {
  program
    .command("files <path>")
    .option("--i18n <folder>", "i18n translation files folder inside project.", "src/assets/i18n")
    .option("--i18nPath <path>", "Path to translation folder if files are outside project.")
    .option("--i18nTypes <types>", "Comma-separated file types for i18n files.", "json")
    .option("--inputTypes <types>", "Comma-separated file types for project files.", "ts,html,js")
    .option(
      "--translateService <name>",
      "Name of the ngx-translate service variable in project files.",
      "translateService",
    )
    .option("--json <path>", "Save output to <path> file.")
    .description(
      "Parses project files and i18n files to find usage of i18n strings.",
    )
    .action(async (projectPath: string, options: FilesCommandOptions) => {
      const i18nPath = options.i18nPath ?? join(projectPath, options.i18n);
      const projectFileTypes = splitTypes(options.inputTypes);
      const translationFileTypes = splitTypes(options.i18nTypes);

      console.log('Project path: "' + projectPath + '".');
      console.log("Project input file types: " + projectFileTypes.join());
      console.log('i18n folder: "' + i18nPath + '".');
      console.log("i18n file types: " + translationFileTypes.join());
      console.log("");

      const [projectFiles, translationFiles] = await Promise.all([
        getProjectFiles(projectPath, projectFileTypes),
        getTranslationFiles(i18nPath, translationFileTypes),
      ]);

      console.log("Total project files found: " + projectFiles.length);
      console.log("Total translation files found: " + translationFiles.length);

      const inputFilesMap = new Map<string, InputUsage>();
      const parseProjectStarted = performance.now();

      for (const file of projectFiles) {
        for (const translationKey of parseFile(file, options.translateService)) {
          addInputString(inputFilesMap, translationKey, file);
        }
      }

      console.log(
        "Finished parsing project files in " +
          (performance.now() - parseProjectStarted).toFixed(3) +
          "ms.",
      );
      console.log("Total unique translation keys used in project files: " + inputFilesMap.size);

      let totalTranslationsUsed = 0;
      for (const entry of inputFilesMap.values()) {
        totalTranslationsUsed += entry.amount;
      }
      console.log("Total translations used in project files: " + totalTranslationsUsed);

      const translationsMap: TranslationUsageMap = new Map();
      const parseTranslationsStarted = performance.now();

      for (const file of translationFiles) {
        const parsedTranslations = await parseTranslation(file);
        const keys = Object.keys(parsedTranslations);
        console.log(
          "Parsed '" + file + "' for " + keys.length + " translation strings.",
        );

        for (const key of keys) {
          addTranslationString(translationsMap, file, key);
        }
      }

      console.log(
        "Finished parsing translation files in " +
          (performance.now() - parseTranslationsStarted).toFixed(3) +
          "ms.",
      );

      const response: FilesOutput = {
        input: mapToObj(inputFilesMap),
        translations: translationMapToObj(translationsMap),
      };

      await writeJsonOrStdout(options.json, response);
    });
}

function splitTypes(types: string): string[] {
  return types
    .split(",")
    .map((type) => type.trim())
    .filter(Boolean);
}
