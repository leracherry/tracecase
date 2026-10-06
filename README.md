<p align="center"><img src="docs/assets/tracecase-logo.png" width="150" alt="TraceCase teal squircle with mint dot logo" /></p>

# TraceCase

[![CI](https://github.com/leracherry/tracecase/actions/workflows/ci.yml/badge.svg)](https://github.com/leracherry/tracecase/actions/workflows/ci.yml)
[![Release](https://github.com/leracherry/tracecase/actions/workflows/release.yml/badge.svg)](https://github.com/leracherry/tracecase/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-0155AB.svg)](LICENSE)

**0.1.0-alpha.1 is being prepared.** Source builds are available now; release bundles are produced by GitHub Actions. This is an experimental Chromium developer tool.

Record a frontend bug once. Inspect it locally. Run it against your development build.

TraceCase is an experimental local-first Chromium recorder and evidence viewer. It captures semantic actions, visual replay, console errors, environment details, and optionally API context into a portable `.tracecase` file. No account, backend, app SDK, or telemetry.

## Build & install

Requires Node.js **22.12 or newer**.

```sh
npm ci
npx playwright install chromium
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select:

```text
apps/extension/.output/chrome-mv3
```

Reload any target tabs that were open during installation.

1. Open your local/staging app and click the TraceCase extension.
2. Optionally enable enhanced network capture or screenshots. Enhanced capture requests Chrome’s debugger permission and displays Chrome’s debugging banner.
3. Click **Start recording**, reproduce the bug, then use **Mark bug** and **Stop** in the page overlay.
4. Inspect the local review page. Select timeline events to seek visual replay and inspect requests, errors, and environment.
5. Enter the exact observed failure text and the text expected after the fix. Review privacy, optionally exclude evidence categories, and export the file.

Captures persist in local IndexedDB across popup closure and document navigation. The last recording remains available through **Review last recording**. Starting another recording replaces this temporary capture; exported files remain yours.

## Try the demo

```sh
npm run demo
```

Open `http://127.0.0.1:5173/checkout`, select Canada, enter a postal code, and click Continue. The page shows `Tax service unavailable`. Record this failure and use `Order summary is visible` as the expected outcome.

```sh
npm run tracecase -- open recording.tracecase
npm run tracecase -- inspect recording.tracecase
npm run tracecase -- run recording.tracecase --url http://127.0.0.1:5173
# FAILURE REPRODUCED
```

A checked-in prototype example is available without extension capture:

```sh
npm run tracecase -- run examples/checkout.tracecase --url http://127.0.0.1:5173
```

To check the fix, stop the demo and restart it with:

```sh
TRACECASE_DEMO_FIXED=1 npm run demo
npm run tracecase -- verify recording.tracecase --url http://127.0.0.1:5173
# VERIFIED
```

`run` checks observed failure text when present. `verify` checks the expected outcome. Failed actions/assertions return a nonzero status. Without a marker, `run` reports only completed actions. Networking during executable replay is currently **live**.

The original interactive Playwright recorder remains available:

```sh
npm run tracecase -- record http://127.0.0.1:5173/checkout --out checkout.local.tracecase
```

## Replay diagnostics and repair

```sh
npm run tracecase -- run recording.tracecase --url http://127.0.0.1:5173 --report replay.json
npm run tracecase -- run recording.tracecase --url http://127.0.0.1:5173 --repair --save-repaired repaired.tracecase
npm run tracecase -- verify recording.tracecase --url http://127.0.0.1:5173 --json
```

Reports distinguish missing/ambiguous locators, action divergence and failed assertions. Repair opens a visible browser and asks you to choose a semantic replacement; the original recording remains unchanged. See [replay behavior and report statuses](docs/REPLAY.md).

## Release packages

The [Release workflow](https://github.com/leracherry/tracecase/actions/workflows/release.yml) builds and tests an installable CLI tarball, unpacked Chrome extension ZIP, and local viewer ZIP with checksums. Manual runs rehearse packaging; matching version tags create draft releases after all checks pass. Publishing remains an explicit maintainer step.

See [release preparation and installation](docs/RELEASING.md), [release notes](docs/RELEASE_NOTES.md), and [changelog](CHANGELOG.md).

## Local viewer

`open` serves the built viewer on a random loopback port and opens your browser. It does not upload evidence. Press Ctrl+C to stop the server. Use `--no-browser` to print the URL without launching a browser. The viewer also accepts file selection and drag/drop.

```sh
npm run dev -w @tracecase/viewer
```

## Development

```sh
npm run check
npm test
npm run schema
```

Tests build the production extension/viewer, replay 20 captured checkout variations, exercise real MV3 standard/enhanced capture through navigation, export files and replay them, verify privacy and size limits, inspect malicious artifacts in the local viewer, and validate advanced replay/repair against actual React, Vue and Svelte fixtures. Enhanced-mode browser tests pregrant the optional debugger permission in a temporary test manifest; the shipped extension requests it interactively.

| Area               | Responsibility                                                   |
| ------------------ | ---------------------------------------------------------------- |
| apps/extension     | WXT Manifest V3 popup, overlay, persistent capture, review       |
| apps/viewer        | React/Vite inspector, timeline and sandboxed rrweb visual replay |
| packages/schema    | Runtime validation and published JSON Schema                     |
| packages/artifact  | Bounded ZIP packaging, integrity checks, legacy JSON support     |
| packages/capture   | Semantic click/fill/select/key and navigation capture            |
| packages/redaction | Private fields, credentials, JSON/form fields, URL redaction     |
| packages/recorder  | Original Playwright recorder                                     |
| packages/replay    | Executable playback, locator fallback, failure verification      |
| packages/cli       | Record, open, inspect, run, verify                               |

## Supported scope

Chromium top-frame HTTP(S) pages, including ordinary SPA history changes and document navigation. Locators use test IDs, accessible roles/names, labels, and placeholders. Unsupported targets are reported as capture gaps. The key recorder supports Enter, Escape, Tab, and arrow keys.

Enhanced mode captures fetch/XHR request metadata, response status/timing, and bounded JSON/form bodies. Other text, binary bodies, media, canvas, iframe capture, shadow-DOM action targeting, and full redirect chains are not supported. Screenshots are opt-in; inputs/private selectors are masked, but other visible data requires review. Styles referenced from external stylesheets are not fetched during replay, so visual fidelity can differ.

Automatic redaction is conservative but cannot identify every secret in arbitrary text. Use local/staging environments and review recordings before sharing. See [security](SECURITY.md), [permissions](docs/PERMISSIONS.md), [format](docs/TRACECASE_FORMAT.md), and [roadmap](docs/ROADMAP.md).

MIT licensed. See [contributing](CONTRIBUTING.md) and the [brand guide](docs/BRAND.md).
