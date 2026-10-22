import type { Command } from "commander";

import { registerDiffCommand } from "./diffLang.js";
import { registerDiffInputCommand } from "./diffInputLang.js";
import { registerFilesCommand } from "./files.js";

export function commandBuilder(program: Command): void {
  registerFilesCommand(program);
  registerDiffCommand(program);
  registerDiffInputCommand(program);
}
