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
  "this.translateService.instant('errors/http:404');",
  "this.translateService.get(['ARRAY', ']', 'B', '[', 'C', '{', 'D', '(', 'E']);",
  "this.translateService.instant('QUOTE\\'KEY');",
  "this.translateService.instant('UNICODE\\u002fKEY');",
  "this.translateService.get(['ARRAY\\x2fESCAPE']);",
  "this.translateService.instant('OCTAL\\141B');",
  "this.translateService.instant('BACKTRACK\\777KEY');",
  "this.translateService.get(['NULL\\08ARRAY']);",
  "this.translateService.get(`TEMPLATE\\u002fKEY`);",
  "this.translateService.get('CRLF\\\r\nKEY');",
  "this.translateService.get(`TEMPLATE\r\nKEY`);",
  'this.i18n.get(',
  '  "PROFILE.TITLE",',
  '  params',
  ');',
  "this.i18n.stream('STATUS.ACTIVE');",
  "this.i18n.getStreamOnTranslationChange('WELCOME');",
  "this.i18n.get(`STATIC.TEMPLATE`);",
  "this.i18n.get(['ARRAY.ONE', `ARRAY.TWO`]);",
  "this.i18n.get<string>('GENERIC.KEY');",
  "this.translateService.get<'\\x3e'>('GENERIC.ESCAPED_CLOSING');",
  "this.translateService.get<'\\x3c'>('GENERIC.ESCAPED_OPENING');",
  "this.i18n?.instant('OPTIONAL.KEY');",
  "this.i18n!.get('ASSERTED.KEY');",
  "if (condition) /i18n.get('REGEX.CONTENT')/.test(source);",
  "if ('\\x29') /i18n.get('REGEX.STRING_PARENTHESIS')/.test(source);",
  "if (condition) { } else /i18n.get('REGEX.ELSE')/.test(source);",
  "do /i18n.get('REGEX.DO')/.test(source); while (condition);",
  'const component = { template: `<span>{{ this.i18n.instant("INLINE.KEY") }}</span>` };',
  "this.translateService.get(`DEFAULT.TEMPLATE`);",
  "this.translateService.get(['DEFAULT.ARRAY.ONE', `DEFAULT.ARRAY.TWO`, 'errors/http:405']);",
  "// this.i18n.get('COMMENT.LINE');",
  "/* this.i18n.get('COMMENT.BLOCK'); */",
  "const example = \"this.i18n.get('STRING.CONTENT')\";",
  "const templateExample = `this.i18n.get('TEMPLATE.CONTENT')`;",
  'this.i18n.get(`DYNAMIC.${locale}`);',
  "const label = 'BUTTON.SAVE'",
  "const pipeExample = \"'STRING.PIPE' | translate\";",
  '  |',
  '  translate;',
  "otherService.instant('NOT_A_TRANSLATION');"
].join('\n');

try {
  fs.writeFileSync(testFile, fixture);
  assert.deepStrictEqual(
    parseFile(testFile, 'i18n').sort(),
    ['PROFILE.TITLE', 'STATUS.ACTIVE', 'WELCOME', 'STATIC.TEMPLATE', 'ARRAY.ONE', 'ARRAY.TWO', 'GENERIC.KEY', 'GENERIC.ESCAPED_CLOSING', 'GENERIC.ESCAPED_OPENING', 'OPTIONAL.KEY', 'ASSERTED.KEY', 'INLINE.KEY'].sort()
  );
  assert.deepStrictEqual(
    parseFile(testFile).sort(),
    ['ERROR_UNKNOWN', 'errors/http:404', 'ARRAY', ']', 'B', '[', 'C', '{', 'D', '(', 'E', "QUOTE'KEY", 'UNICODE/KEY', 'ARRAY/ESCAPE', 'OCTALaB', 'BACKTRACK?7KEY', 'NULL\x008ARRAY', 'TEMPLATE/KEY', 'CRLFKEY', 'TEMPLATE\nKEY', 'DEFAULT.TEMPLATE', 'DEFAULT.ARRAY.ONE', 'DEFAULT.ARRAY.TWO', 'errors/http:405'].sort()
  );

  fs.writeFileSync(htmlFile, "<!-- this.translateService.get('COMMENT.HTML');\n 'COMMENT.PIPE'\n | translate -->");
  assert.deepStrictEqual(parseFile(htmlFile), []);
  fs.writeFileSync(htmlFile, "<div title=\"@if (translateService.get('EXAMPLE.KEY'))\"></div>");
  assert.deepStrictEqual(parseFile(htmlFile), []);
  fs.writeFileSync(htmlFile, "@let label = 'LABEL.PIPE' | translate; @let other = translateService.instant('LABEL.SERVICE');");
  assert.deepStrictEqual(parseFile(htmlFile).sort(), ['LABEL.PIPE', 'LABEL.SERVICE'].sort());
  fs.writeFileSync(htmlFile, '<span>{{ "example \'FAKE.KEY\' | translate" }}</span>');
  assert.deepStrictEqual(parseFile(htmlFile), []);
  fs.writeFileSync(htmlFile, "<button [title]=\"translateService.instant('BUTTON.TITLE')\" (click)=\"translateService.get('BUTTON.CLICK')\"></button><span>{{ translateService.instant('INTERPOLATION.TITLE') }}</span>");
  assert.deepStrictEqual(
    parseFile(htmlFile).sort(),
    ['BUTTON.CLICK', 'BUTTON.TITLE', 'INTERPOLATION.TITLE'].sort()
  );
  fs.writeFileSync(htmlFile, "@if (translateService.get('CONTROL.IF')) { } @else if (translateService.instant('CONTROL.ELSE_IF')) { } @for (item of items; track translateService.instant('CONTROL.FOR')) { } @switch (translateService.get('CONTROL.SWITCH')) { @case ('x') { } }");
  assert.deepStrictEqual(
    parseFile(htmlFile).sort(),
    ['CONTROL.IF', 'CONTROL.ELSE_IF', 'CONTROL.FOR', 'CONTROL.SWITCH'].sort()
  );

  fs.writeFileSync(htmlFile, "<div>{{ 'MULTILINE.PIPE'\n |\n translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['MULTILINE.PIPE']);

  fs.writeFileSync(htmlFile, "<div>{{ 'errors/http:404' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['errors/http:404']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A<B' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['A<B']);

  fs.writeFileSync(htmlFile, "<div>{{ translateService.instant('C<D') }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['C<D']);

  fs.writeFileSync(htmlFile, "<div>{{ 'UNICODE\\u002fPIPE' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['UNICODE/PIPE']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A&amp;B' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['A&B']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A&ouml;B' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['AöB']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A&NewLine;B' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['A\nB']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A\r\nB' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['A\nB']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A&#13;B' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['A\rB']);

  fs.writeFileSync(htmlFile, "<div>{{ 'ANGULAR\\x2fPIPE' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['ANGULARx2fPIPE']);

  fs.writeFileSync(htmlFile, "<div>{{ 'ANGULAR\\bPIPE' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['ANGULARbPIPE']);

  fs.writeFileSync(htmlFile, "<div>{{ translateService.instant('ANGULAR\\x2fSERVICE') }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['ANGULARx2fSERVICE']);

  fs.writeFileSync(htmlFile, "<div>{{ 'A&#0;B' | translate }}</div><div>{{ 'C&#xD800;D' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['A\x00B', 'C\uD800D']);

  fs.writeFileSync(htmlFile, "<div>{{ 'C&#x2f;D' | translate }}</div>");
  assert.deepStrictEqual(parseFile(htmlFile), ['C/D']);

  fs.writeFileSync(htmlFile, `<button [title]="translateService.instant('A&amp;B')"></button>`);
  assert.deepStrictEqual(parseFile(htmlFile), ['A&B']);
  console.log('parseFile tests passed');
} finally {
  fs.unlinkSync(testFile);
  fs.unlinkSync(htmlFile);
  fs.rmdirSync(testDirectory);
}

