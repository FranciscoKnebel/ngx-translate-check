# ngx-translate-check

A command-line tool for checking missing and unused translation keys in Angular projects that use ngx-translate.

## Requirements

- Node.js 24 or newer.
- Translation files in JSON format.

## Install

~~~sh
npm install --global ngx-translate-check
~~~

## Usage

### Scan project and translation files

~~~sh
ngx-translate-check files ./my-angular-project --json translations-report.json
~~~

By default, project files are scanned for `ts`, `html`, and `js` files, and translations are read from `src/assets/i18n` inside the project. The scanner skips `node_modules`.

When the translations are elsewhere, pass `--i18nPath`. Use `--i18nTypes` and `--inputTypes` to change the comma-separated file extensions.

~~~sh
ngx-translate-check files ./my-angular-project --i18nPath ./translations --inputTypes ts,html --translateService i18n --json translations-report.json
~~~

The scanner recognizes ngx-translate pipes across line breaks, such as a key on one line and `| translate` on the next. It also recognizes literal keys passed to the TranslateService methods `instant`, `get`, `stream`, and `getStreamOnTranslationChange`. The service variable defaults to `translateService`; use `--translateService` if your project injects it under another name.

Only literal string keys are extracted. Dynamically constructed keys cannot be inferred.

The report contains:

~~~json
{
  "input": {
    "PAGE.TITLE": {
      "amount": 1,
      "files": ["src/app/page.component.ts"]
    }
  },
  "translations": {
    "src/assets/i18n/en.json": {
      "PAGE.TITLE": 1,
      "PAGE.SAVE": 1
    }
  }
}
~~~

### Compare translation files

Compare the first translation file with the others:

~~~sh
ngx-translate-check diff translations-report.json --base 0 --json translation-diff.json
~~~

Use a negative base index to compare every language with every other language:

~~~sh
ngx-translate-check diff translations-report.json --base -1 --json all-language-diffs.json
~~~

### Compare project usage with translations

~~~sh
ngx-translate-check diff-input translations-report.json --json input-diff.json
~~~

Use `--help` on the root command or any subcommand to see all options.

## Development

~~~sh
npm install
npm run build
npm run typecheck
npm run lint
npm test
~~~

The test command builds the TypeScript source and runs the Node.js test suite.

## Versioning

Releases are built and published by [GitHub Actions](.github/workflows/release.yml), using npm trusted publishing (OIDC) and npm provenance. No long-lived npm token is needed.

One-time setup for the package maintainer:

1. In the `ngx-translate-check` package settings on npmjs.com, add GitHub Actions trusted publishers for repository `FranciscoKnebel/ngx-translate-check` and workflow files `release.yml` and `promote.yml`. Set their environment to `npm`. Enable **Allow npm dist-tag** for `promote.yml`.
2. In the GitHub repository settings, protect the `npm` Actions environment with required reviewers if releases should require approval.

To publish a new version:

1. Change the version in `package.json` and `package-lock.json` in a PR, and merge it into `master`.
2. Create a matching version tag **on the merged commit** (for example, `git tag v2.0.0 && git push origin v2.0.0`).
3. The `Release` workflow verifies that the tag matches the package version and that the commit is on `master`, runs lint, typecheck, tests, and packaging checks, then publishes to npm and creates GitHub release notes.

To retry a failed release, run the `Release` workflow manually from GitHub Actions and supply the existing tag. Publishing an already published npm version will fail, so do not rerun a successful publication.

To point `latest`, `next`, or `beta` at an already published version without republishing it, manually run **Promote npm version** from GitHub Actions with a version and destination dist-tag.

The `CI` workflow tests Node.js 24 and 26 for all PRs. See the [release tags](https://github.com/FranciscoKnebel/ngx-translate-check/tags) for published versions. Version 2 requires Node.js 24 or newer.

## Authors

Initial implementation by [Francisco Knebel](https://github.com/FranciscoKnebel). Project idea credits to [Arthur Jacobs](https://github.com/asjacobs92).

## License

MIT. See [LICENSE](LICENSE).
