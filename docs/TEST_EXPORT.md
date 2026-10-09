# Recording to regression test

[Documentation home](README.md)

```sh
tracecase test recording.tracecase --out tests/checkout.spec.ts --url http://localhost:5173
```

The default assertion checks **expected behavior**. The resulting Playwright test should fail before the fix and pass afterward. `--assertion observed` generates a separate reproduction check for the recorded failure. Both modes require an observed/expected failure pair; private input placeholders must be filled in a reviewed local copy first.

The output uses semantic locators, normal Playwright actions and retrying `expect` assertions. It selects the first recorded locator; review it before committing. History navigation uses `toHaveURL`; document navigation follows the replay behavior. Titles and input strings are escaped as JavaScript data. There are no coordinate actions or arbitrary action sleeps.

## Run it

In your application project:

```sh
npm install --save-dev @playwright/test
npx playwright install chromium
TRACECASE_BASE_URL=http://localhost:5173 npx playwright test tests/checkout.spec.ts
```

The development URL defaults to `http://localhost:5173`; `--url` sets a different default. `TRACECASE_BASE_URL` overrides it at run time. Paths and queries are retained while the origin is remapped. Tests use your Playwright project's browser selection and recorded viewport.

## Recorded responses

```sh
tracecase test recording.tracecase --out tests/checkout.spec.ts --network recorded
```

Four sibling files are written: the test, `.fixtures.json`, `.network.mjs`, and the helper's `.network.d.mts` types. Keep them together. The readable helper is built from the same matcher used by executable replay. It requires only Node built-ins and the Playwright browser context; TraceCase does not need to be installed to execute the generated test. Historical fixtures can preserve the failure, so review whether they represent the inputs your regression test needs.

Missing API matches and routing errors fail the generated test. The helper observes a bounded quiet period after the outcome; it does not emulate timing or every network protocol. See [network replay](NETWORK_REPLAY.md).

CLI output is formatted with Prettier. Every output is created exclusively; any existing sibling stops export and newly reserved files are removed. Existing files are never overwritten. `--editor vscode` or `--editor cursor` prints a link to the generated source.

## Viewer

Finish the observed/expected fields and privacy review, then use **Export & handoff**. Choose expected behavior or recorded failure, API mode and development URL. Preview the test and download it. Recorded mode downloads a ZIP containing the four files. Network exclusions apply to the export; when network evidence is excluded, recorded test export is unavailable. Private placeholders and missing assertions show a recovery message rather than producing a misleading passing test.

Generated tests follow [Playwright's retrying assertion model](https://playwright.dev/docs/test-assertions). Automated checks execute them against the broken and fixed demo and type-check recorded bundles with TypeScript strict mode.
