import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import type { InputUsage } from "./dictionary.js";
export { parseFile } from "./parser.js";

export interface FilesOutput {
  input: Record<string, InputUsage>;
  translations: Record<string, Record<string, number>>;
}

export async function getTranslationFiles(
  i18nFolderPath: string,
  fileTypes: string[] = ["json"],
): Promise<string[]> {
  return readMatchingFiles(i18nFolderPath, fileTypes);
}

export async function getProjectFiles(
  projectPath: string,
  fileTypes: string[] = ["ts", "html"],
): Promise<string[]> {
  return readMatchingFiles(projectPath, fileTypes);
}

async function readMatchingFiles(inputPath: string, fileTypes: string[]): Promise<string[]> {
  const allowedExtensions = new Set(
    fileTypes
      .map((type) => type.trim().replace(/^\./, "").toLowerCase())
      .filter(Boolean),
  );
  const pendingDirectories = [inputPath];
  const matchingFiles: string[] = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();
    if (currentDirectory === undefined) {
      continue;
    }

    const entries = await readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== ".git") {
          pendingDirectories.push(entryPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).slice(1).toLowerCase();
      if (allowedExtensions.has(extension)) {
        matchingFiles.push(entryPath);
      }
    }
  }

  return matchingFiles.sort();
}

export async function parseTranslation(fileName: string): Promise<Record<string, unknown>> {
  const contents = await readFile(fileName, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error("Invalid JSON in translation file: " + fileName, { cause: error });
  }

  if (!isRecord(parsed)) {
    throw new Error("Translation file must contain a JSON object: " + fileName);
  }

  return flattenObject(parsed);
}

function flattenObject(
  object: Record<string, unknown>,
  parent = "",
  result: Record<string, unknown> = Object.create(null) as Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(object)) {
    const propertyName = parent ? parent + "." + key : key;
    flattenValue(value, propertyName, result);
  }

  return result;
}

function flattenValue(
  value: unknown,
  propertyName: string,
  result: Record<string, unknown>,
): void {
  if (isRecord(value)) {
    flattenObject(value, propertyName, result);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenValue(item, propertyName + "." + index, result));
    return;
  }

  result[propertyName] = value;
}

export async function writeJsonOrStdout(jsonPath: string | undefined, data: unknown): Promise<void> {
  const serialized = JSON.stringify(data, null, 2);
  if (serialized === undefined) {
    throw new Error("The command produced a value that cannot be serialized as JSON.");
  }

  if (!jsonPath) {
    console.log(serialized);
    return;
  }

  const outputPath = jsonPath.endsWith(".json") ? jsonPath : jsonPath + ".json";
  await writeFile(outputPath, serialized + "\n", "utf8");
  console.log('Results were written to "' + outputPath + '" file.');
}

export async function readFilesOutput(fileName: string): Promise<FilesOutput> {
  const contents = await readFile(fileName, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error("Invalid JSON report: " + fileName, { cause: error });
  }

  if (!isRecord(parsed) || !isRecord(parsed.input) || !isRecord(parsed.translations)) {
    throw new Error("Report must contain input and translations objects: " + fileName);
  }

  return parsed as unknown as FilesOutput;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
