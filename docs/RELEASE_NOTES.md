# TraceCase 0.1.0-alpha.1

First release candidate for the local capture → inspect → replay workflow.

## Included

- Chromium Manifest V3 extension with semantic actions, visual replay, console errors, screenshots, and optional redacted network evidence.
- Local React viewer with timeline search, evidence inspection and privacy review.
- CLI capture, inspect, open, run and verify commands.
- Structured replay reports, per-step locator diagnostics, explicit interactive locator repair and saved repaired copies.
- Recorded API replay, body/occurrence matching, explicit live exceptions and coverage/mismatch inspection.
- Shared teal/mint styling, neutral surfaces, native typography and responsive layouts.
- Tested checkout scenarios built with React, Vue and Svelte.
- TraceCase logo and documented permissions, artifact format and privacy limits.

## Downloads

- `tracecase-0.1.0-alpha.1.tgz`: installable Node CLI with the viewer bundled.
- `tracecase-chrome-0.1.0-alpha.1.zip`: unpack and load through Chrome’s extension developer mode.
- `tracecase-viewer-0.1.0-alpha.1.zip`: standalone local viewer assets.
- `SHA256SUMS` and `release-manifest.json`: asset integrity and source commit information.

Requires Node.js 22.12+ and Playwright Chromium. Run `npx playwright install chromium` after installing the CLI tarball.

## Alpha limits

Live replay and explicit live API exceptions can change target application state. Recorded mode supports captured JSON/form API responses; static frontend resources remain live. Authentication state, WebSockets, response timing and Playwright test generation are not included. Capture is Chromium/top-frame only. Visual fidelity can differ because remote assets are blocked. Redaction cannot identify every secret; review before sharing. Installation is manual; this release does not publish to npm or the Chrome Web Store.
