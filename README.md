# TraceCase

Record a frontend bug once. Run it against your local build.

Early feasibility prototype: capture semantic browser actions into a portable file, replay the scenario, and distinguish reproducing a bug from verifying its fix. Local files, no account, no backend.

## Quick start

Requires Node.js 22 or newer.

```sh
npm ci
npx playwright install chromium
npm run build
npm run demo
```

In another terminal:

```sh
npm run tracecase -- run examples/checkout.tracecase --url http://127.0.0.1:5173
# FAILURE REPRODUCED
npm run tracecase -- record http://127.0.0.1:5173/checkout --out checkout.local.tracecase
npm run tracecase -- inspect checkout.local.tracecase
```

During recording, choose Canada, fill a postal code, and click Continue. Press Enter in the terminal to stop. Enter `Tax service unavailable` as the observed failure and `Order summary is visible` as the expected behavior.

To verify the fix, stop the demo server and restart it with:

```sh
TRACECASE_DEMO_FIXED=1 npm run demo
npm run tracecase -- verify examples/checkout.tracecase --url http://127.0.0.1:5173
# VERIFIED
```

`run` checks the recorded failure when present. `verify` checks the desired outcome. Failed actions or assertions return a nonzero exit status. Without a failure marker, `run` reports only that actions completed.

## Development

```sh
npm run check
npm test
npm run schema
```

The browser suite records and replays 20 checkout variations and checks private-field exclusion, fallback locators, divergence, and both buggy and fixed behavior. GitHub Actions runs the same checks.

| Package | Responsibility |
| --- | --- |
| schema | Runtime validation and JSON Schema |
| recorder | Top-frame semantic actions and sensitive-input exclusion |
| replay | Playwright execution, locator fallback, failure verification |
| cli | Interactive capture, inspection, run, verify |

## Current scope

This starts milestone 0 of the research plan. V0.1 `.tracecase` files are bounded, schema-validated JSON; the future ZIP evidence container is not implemented. The recorder uses a headed Playwright browser rather than an extension. It captures top-frame click, fill, and select actions using test IDs, roles, labels, and placeholders. Unsupported targets are skipped.

Multi-page flows, SPA navigation capture, frames, shadow DOM, visual replay, network fixtures, console capture, authentication profiles, test export, and the viewer remain future work. Do not use this prototype to record sensitive production sessions: it excludes common private fields but does not provide complete redaction for URLs, labels, or public text inputs. Replay uses the live target application and may perform writes there.

See [format](docs/TRACECASE_FORMAT.md), [security](SECURITY.md), and [roadmap](docs/ROADMAP.md).

MIT licensed.
