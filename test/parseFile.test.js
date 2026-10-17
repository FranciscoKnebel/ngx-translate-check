const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const babel = require('@babel/core');

const projectRoot = path.resolve(__dirname, '..');
const sourceFile = path.join(projectRoot, 'src', 'utils', 'files.js');
const transformed = babel.transformFileSync(sourceFile, {
  babelrc: false,
  configFile: false,
  presets: ['@babel/preset-env']
});

const parsedModule = new Module(sourceFile, module);
parsedModule.filename = sourceFile;
parsedModule.paths = Module._nodeModulePaths(path.dirname(sourceFile));
parsedModule._compile(transformed.code, sourceFile);

const { parseFile } = parsedModule.exports;
const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ngx-translate-check-'));
const testFile = path.join(testDirectory, 'example.ts');
const htmlFile = path.join(testDirectory, 'template.html');
const fixture = [
  "this.translateService.instant('ERROR_UNKNOWN');",
  'this.i18n.get(',
  '  "PROFILE.TITLE",',
  '  params',
  ');',
  "this.i18n.stream('STATUS.ACTIVE');",
  "this.i18n.getStreamOnTranslationChange('WELCOME');",
  "this.i18n.get(`STATIC.TEMPLATE`);",
  "this.translateService.get(`DEFAULT.TEMPLATE`);",
  "// this.i18n.get('COMMENT.LINE');",
  "/* this.i18n.get('COMMENT.BLOCK'); */",
  "const example = \"this.i18n.get('STRING.CONTENT')\";",
  "const templateExample = `this.i18n.get('TEMPLATE.CONTENT')`;",
  'this.i18n.get(`DYNAMIC.${locale}`);',
  "const label = 'BUTTON.SAVE'",
  '  |',
  '  translate;',
  "otherService.instant('NOT_A_TRANSLATION');"
].join('\n');

try {
  fs.writeFileSync(testFile, fixture);
  assert.deepStrictEqual(
    parseFile(testFile, 'i18n').sort(),
    ['BUTTON.SAVE', 'PROFILE.TITLE', 'STATUS.ACTIVE', 'WELCOME', 'STATIC.TEMPLATE'].sort()
  );
  assert.deepStrictEqual(
    parseFile(testFile).sort(),
    ['BUTTON.SAVE', 'ERROR_UNKNOWN', 'DEFAULT.TEMPLATE'].sort()
  );

  fs.writeFileSync(htmlFile, "<!-- this.translateService.get('COMMENT.HTML'); -->");
  assert.deepStrictEqual(parseFile(htmlFile), []);
  fs.writeFileSync(htmlFile, "<div>{{ 'MULTILINE.PIPE'\n |\n translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['MULTILINE.PIPE']);
  console.log('parseFile tests passed');
} finally {
  fs.unlinkSync(testFile);
  fs.unlinkSync(htmlFile);
  fs.rmdirSync(testDirectory);
}
