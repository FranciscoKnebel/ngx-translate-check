import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const execFileAsync = promisify(execFile);
const projectRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cliPath = join(projectRoot, "dist", "main.js");

test("files, diff, and diff-input commands produce the expected report", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const projectPath = join(directory, "project");
  const sourcePath = join(projectPath, "src");
  const i18nPath = join(directory, "i18n");
  const reportPath = join(directory, "report.json");
  const diffPath = join(directory, "diff.json");
  const diffInputPath = join(directory, "diff-input.json");

  await mkdir(sourcePath, { recursive: true });
  await mkdir(i18nPath, { recursive: true });
  await writeFile(
    join(sourcePath, "component.ts"),
    "this.i18n.instant('COMMON.OK');\nthis.i18n.get('PAGE.TITLE');",
    "utf8",
  );
  await writeFile(
    join(sourcePath, "template.html"),
    "<span>{{ 'PAGE.SAVE'\n | translate }}</span>",
    "utf8",
  );
  await writeFile(
    join(i18nPath, "en.json"),
    JSON.stringify({
      COMMON: { OK: "OK" },
      PAGE: { TITLE: "Title", SAVE: "Save", ONLY_EN: "English only" },
    }),
    "utf8",
  );
  await writeFile(
    join(i18nPath, "pt-BR.json"),
    JSON.stringify({
      COMMON: { OK: "Ok" },
      PAGE: { TITLE: "Título", SAVE: "Salvar", ONLY_PT: "Somente português" },
    }),
    "utf8",
  );

  await execFileAsync(process.execPath, [
    cliPath,
    "files",
    projectPath,
    "--i18nPath",
    i18nPath,
    "--translateService",
    "i18n",
    "--json",
    reportPath,
  ]);

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.deepEqual(Object.keys(report.input).sort(), ["COMMON.OK", "PAGE.SAVE", "PAGE.TITLE"].sort());
  assert.equal(report.input["COMMON.OK"].amount, 1);
  assert.deepEqual(report.translations[join(i18nPath, "en.json")]["PAGE.ONLY_EN"], 1);

  await execFileAsync(process.execPath, [
    cliPath,
    "diff",
    reportPath,
    "--base",
    "0",
    "--json",
    diffPath,
  ]);
  const languageDiff = JSON.parse(await readFile(diffPath, "utf8"));
  assert.deepEqual(languageDiff["base " + join(i18nPath, "en.json")], { "PAGE.ONLY_EN": 1 });
  assert.deepEqual(languageDiff["compare with " + join(i18nPath, "pt-BR.json")], {
    "PAGE.ONLY_PT": 1,
  });

  await execFileAsync(process.execPath, [cliPath, "diff-input", reportPath, "--json", diffInputPath]);
  const inputDiff = JSON.parse(await readFile(diffInputPath, "utf8"));
  assert.deepEqual(
    inputDiff[join(i18nPath, "en.json")]["in " + join(i18nPath, "en.json") + ", not in input files"],
    { "PAGE.ONLY_EN": 1 },
  );
});
