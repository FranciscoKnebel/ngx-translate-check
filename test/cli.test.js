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
  const languageDiffs = JSON.parse(await readFile(diffPath, "utf8"));
  assert.equal(languageDiffs.length, 1);
  const [languageDiff] = languageDiffs;
  assert.deepEqual(languageDiff["base " + join(i18nPath, "en.json")], { "PAGE.ONLY_EN": 1 });
  assert.deepEqual(languageDiff["compare with " + join(i18nPath, "pt-BR.json")], {
    "PAGE.ONLY_PT": 1,
  });

  for (const invalidBase of [
    "1.5", "1junk", "1e2", "0x10", " 1", "1 ", "", "NaN", "9007199254740993",
  ]) {
    await assert.rejects(
      execFileAsync(process.execPath, [cliPath, "diff", reportPath, "--base", invalidBase]),
      { code: 1 },
      `Expected --base ${invalidBase} to be rejected`,
    );
  }

  await execFileAsync(process.execPath, [
    cliPath,
    "diff",
    reportPath,
    "--base",
    "-1",
    "--json",
    diffPath,
  ]);
  assert.equal((JSON.parse(await readFile(diffPath, "utf8"))).length, 2);

  await execFileAsync(process.execPath, [cliPath, "diff-input", reportPath, "--json", diffInputPath]);
  const inputDiff = JSON.parse(await readFile(diffInputPath, "utf8"));
  assert.deepEqual(
    inputDiff[join(i18nPath, "en.json")]["in " + join(i18nPath, "en.json") + ", not in input files"],
    { "PAGE.ONLY_EN": 1 },
  );
});

test("diff includes every comparison for the selected base language", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-diff-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const reportPath = join(directory, "report.json");
  const diffPath = join(directory, "diff.json");
  const translations = {
    "en.json": { COMMON: 1, EN_ONLY: 1 },
    "pt.json": { COMMON: 1, PT_ONLY: 1 },
    "es.json": { COMMON: 1, ES_ONLY: 1 },
  };
  await writeFile(reportPath, JSON.stringify({ input: {}, translations }), "utf8");

  const expected = [
    [
      { "base en.json": { EN_ONLY: 1 }, "compare with pt.json": { PT_ONLY: 1 } },
      { "base en.json": { EN_ONLY: 1 }, "compare with es.json": { ES_ONLY: 1 } },
    ],
    [
      { "base pt.json": { PT_ONLY: 1 }, "compare with en.json": { EN_ONLY: 1 } },
      { "base pt.json": { PT_ONLY: 1 }, "compare with es.json": { ES_ONLY: 1 } },
    ],
    [
      { "base es.json": { ES_ONLY: 1 }, "compare with en.json": { EN_ONLY: 1 } },
      { "base es.json": { ES_ONLY: 1 }, "compare with pt.json": { PT_ONLY: 1 } },
    ],
  ];
  for (const base of [0, 1, 2]) {
    await execFileAsync(process.execPath, [
      cliPath, "diff", reportPath, "--base", String(base), "--json", diffPath,
    ]);
    const comparisons = JSON.parse(await readFile(diffPath, "utf8"));
    assert.deepEqual(comparisons, expected[base]);
  }

  await writeFile(reportPath, JSON.stringify({
    input: {}, translations: { "en.json": translations["en.json"] },
  }), "utf8");
  await execFileAsync(process.execPath, [
    cliPath, "diff", reportPath, "--base", "0", "--json", diffPath,
  ]);
  assert.deepEqual(JSON.parse(await readFile(diffPath, "utf8")), []);
});
