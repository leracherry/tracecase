# TraceCase 0.1.0-alpha.2

[Documentation home](README.md)

Next alpha, prepared from source; not yet published. Builds on the first public alpha with shared capture and broader workflow reliability.

## Included

- Firefox standard capture with browser-specific capability messaging, temporary-install bundle, and real-extension CI validation.

- Shared CLI/extension semantic capture and baseline privacy policy.
- Native input buttons, keyboard submission without duplicate clicks, and CLI SPA/document navigation with a consistent session timeline.
- Clear skipped-control warnings and realistic project-settings capture/replay checks across three engines.

- Add local browser privacy settings for sensitive fields and private page elements, applied before storage and retained across navigation for each recording.
- Standalone Playwright regression/reproduction test exports with optional recorded fixtures.
- Compact agent context, Markdown issue drafts, single-artifact read-only MCP, and CI verification.
- Viewer export workbench with previews, privacy exclusions and updated failure semantics.
- Explicit plugin hooks, versioned artifact specification and a tested three-engine replay matrix.

- Chromium Manifest V3 extension with semantic actions, visual replay, console errors, screenshots, and optional redacted network evidence.
- Local React viewer with timeline search, evidence inspection and privacy review.
- CLI capture, inspect, open, run and verify commands.
- Structured replay reports, per-step locator diagnostics, explicit interactive locator repair and saved repaired copies.
- Recorded API replay, body/occurrence matching, explicit live exceptions and coverage/mismatch inspection.
- Shared teal/mint styling, neutral surfaces, native typography and responsive layouts.
- Tested checkout scenarios built with React, Vue and Svelte.
- TraceCase logo and documented permissions, artifact format and privacy limits.

## Downloads

- `tracecase-0.1.0-alpha.2.tgz`: installable Node CLI with the viewer bundled.
- `tracecase-chrome-0.1.0-alpha.2.zip`: unpack and load through Chrome’s extension developer mode.
- `tracecase-firefox-0.1.0-alpha.2.zip`: unzip and temporarily load `manifest.json` through Firefox’s `about:debugging`. Standard capture only.
- `tracecase-viewer-0.1.0-alpha.2.zip`: standalone local viewer assets.
- `SHA256SUMS` and `release-manifest.json`: asset integrity and source commit information.

Requires Node.js 22.12+ and Playwright Chromium. Run `npx playwright install chromium` after installing the CLI tarball.

## Alpha limits

Live replay and explicit live API exceptions can change target application state. Recorded mode supports captured JSON/form API responses; static frontend resources remain live. Authentication state, WebSockets and response timing are not included. Capture is top-frame only; enhanced networking is Chromium-only. Firefox installation is temporary and unsigned. Visual fidelity can differ because remote assets are blocked. Redaction cannot identify every secret; review before sharing. Installation is manual; this release does not publish to npm or the Chrome Web Store.
