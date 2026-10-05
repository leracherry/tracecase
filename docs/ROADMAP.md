# Implementation roadmap

Based on the supplied research and product plan. TraceCase remains a working name; this is an experimental implementation, not a public launch.

## Milestone 0 — feasibility implemented

TypeScript workspace, semantic recorder, validated artifacts, Playwright execution, deterministic demo and 20 automated capture/replay scenarios. Broader independent real-world recordings remain an adoption/quality gate.

## Milestone 1 — Chrome capture implemented

WXT Manifest V3 extension, start/stop popup, recording overlay and marker, semantic click/fill/select/key capture, SPA and document navigation, environment, console errors, opt-in start/marker/stop screenshots, persistent local batches, baseline redaction, and reviewed artifact export.

Scope: top-frame Chromium HTTP(S) pages. Frames, shadow-DOM action targeting and arbitrary key chords are not covered. Screenshots depend on visibility and permissions and may affect timing while masking.

## Milestone 2 — inspection implemented

React/Vite local viewer, rrweb recording/replay, searchable/filterable correlated timeline, event/request/console inspection, environment/capability view, screenshots, failure/expected-outcome editing, category exclusion, and `tracecase open`. Visual playback seeks when selecting timeline events and updates the selected event during playback. Remote styles/assets are not loaded, so fidelity may differ.

## Milestone 3 — network and privacy foundation implemented

Explicit enhanced debugger capture, fetch/XHR metadata/status/timing, bounded JSON/form bodies, failed-request highlighting, credential/header/body redaction before persistence, size/count limits, capabilities/warnings, export privacy review and standard fallback. Tested with actual Chromium extension sessions in both modes, credential-bearing requests/responses and oversized bodies.

Limitations: no binary/free-form text bodies, full redirect-chain reconstruction, WebSocket replay or complete secret detection. Custom redactors and independent security review remain future hardening.

## Next milestones

4. Replay reports, console output, locator repair, and a representative React/Vue/Svelte scenario suite. Basic executable replay already consumes extension artifacts and supports key/navigation actions.
5. Deterministic API fixtures, occurrence/body matching, divergence controls and coverage reports.
6. Playwright test export using expected behavior and optional fixtures.
7. Agent context export, MCP, issue Markdown and CI artifact verification.
8. Public specification/plugin ecosystem and cross-browser research.

No accounts, hosted storage, analytics or AI service is required for the core workflow.
