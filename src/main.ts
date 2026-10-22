#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { Command } from "commander";

import { commandBuilder } from "./commands/builder.js";

interface PackageMetadata {
  version: string;
  description: string;
}

const packageMetadata = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageMetadata;

const program = new Command();
program
  .name("ngx-translate-check")
  .version(packageMetadata.version)
  .description(packageMetadata.description);

commandBuilder(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Error: " + message);
  process.exitCode = 1;
});
