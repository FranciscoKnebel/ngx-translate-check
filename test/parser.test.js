import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { getProjectFiles, getTranslationFiles, parseFile, parseTranslation } from "../dist/utils/files.js";

test("finds ngx-translate pipe keys across line breaks", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-parser-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const htmlFile = join(directory, "template.html");
  await writeFile(
    htmlFile,
    "<div>{{ 'MULTILINE.PIPE'\n |\n translate }}</div>",
    "utf8",
  );

  assert.deepEqual(parseFile(htmlFile), ["MULTILINE.PIPE"]);
});

test("finds TranslateService calls using the default and custom variable names", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-service-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const typescriptFile = join(directory, "component.ts");
  const source = [
    "this.translateService.instant('ERROR_UNKNOWN');",
    "this.i18n.get(",
    '  "PROFILE.TITLE",',
    "  { name: 'Ada' }",
    ");",
    "this.i18n.stream('STATUS.ACTIVE');",
    "this.i18n.getStreamOnTranslationChange('WELCOME');",
    "otherService.instant('NOT_A_TRANSLATION');",
  ].join("\n");
  await writeFile(typescriptFile, source, "utf8");

  assert.deepEqual(
    parseFile(typescriptFile, "i18n").sort(),
    ["PROFILE.TITLE", "STATUS.ACTIVE", "WELCOME"].sort(),
  );
  assert.deepEqual(parseFile(typescriptFile).sort(), ["ERROR_UNKNOWN"].sort());
});

test("lists supported project files but skips dependencies and hidden caches", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-files-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  await writeFile(join(directory, "component.ts"), "", "utf8");
  await writeFile(join(directory, "template.html"), "", "utf8");
  await writeFile(join(directory, "ignored.js"), "", "utf8");
  await mkdir(join(directory, "node_modules"));
  await writeFile(join(directory, "node_modules", "ignored.ts"), "", "utf8");
  await mkdir(join(directory, ".angular"));
  await writeFile(join(directory, ".angular", "cached.ts"), "", "utf8");
  await mkdir(join(directory, ".cache"));
  await writeFile(join(directory, ".cache", "cached.html"), "", "utf8");
  await writeFile(join(directory, ".hidden.ts"), "", "utf8");

  assert.deepEqual(
    await getProjectFiles(directory, ["ts", "html"]),
    [join(directory, "component.ts"), join(directory, "template.html")],
  );
});

test("follows symlinked files and directories without looping", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-links-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const project = join(directory, "project");
  const externalSource = join(directory, "external-source");
  await mkdir(project);
  await mkdir(externalSource);
  await writeFile(join(externalSource, "feature.ts"), "", "utf8");
  await writeFile(join(directory, "standalone.html"), "", "utf8");
  await symlink(externalSource, join(project, "linked-source"), "dir");
  await symlink(join(directory, "standalone.html"), join(project, "linked.html"), "file");
  await symlink(project, join(externalSource, "cycle"), "dir");
  await symlink(join(project, "missing.ts"), join(project, "broken.ts"), "file");

  assert.deepEqual(await getProjectFiles(project), [
    join(project, "linked-source", "feature.ts"),
    join(project, "linked.html"),
  ].sort());

  const translations = join(directory, "translations");
  await mkdir(translations);
  await writeFile(join(directory, "en.json"), "{}", "utf8");
  await symlink(join(directory, "en.json"), join(translations, "en.json"), "file");
  assert.deepEqual(await getTranslationFiles(translations), [join(translations, "en.json")]);
});

test("flattens nested translation keys", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ngx-translate-check-json-"));
  context.after(() => rm(directory, { recursive: true, force: true }));

  const translationFile = join(directory, "en.json");
  await writeFile(
    translationFile,
    JSON.stringify({ PAGE: { TITLE: "Title", SAVE: "Save" }, COMMON: { OK: "OK" } }),
    "utf8",
  );

  assert.deepEqual({ ...(await parseTranslation(translationFile)) }, {
    "PAGE.TITLE": "Title",
    "PAGE.SAVE": "Save",
    "COMMON.OK": "OK",
  });
});
