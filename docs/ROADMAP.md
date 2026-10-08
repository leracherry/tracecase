# Implementation roadmap

Based on the supplied research and product plan. TraceCase has a public experimental alpha on GitHub; broader adoption and store distribution remain future work.

## Milestone 0 — feasibility implemented

TypeScript workspace, semantic recorder, validated artifacts, Playwright execution, deterministic demo and 20 automated capture/replay scenarios. Broader independent real-world recordings remain an adoption/quality gate.

## Milestone 1 — Chrome capture implemented

WXT Manifest V3 extension, start/stop popup, recording overlay and marker, semantic click/fill/select/key capture, SPA and document navigation, environment, console errors, opt-in start/marker/stop screenshots, persistent local batches, baseline redaction, and reviewed artifact export.

Scope: top-frame Chromium HTTP(S) pages. Frames, shadow-DOM action targeting and arbitrary key chords are not covered. Screenshots depend on visibility and permissions and may affect timing while masking.

## Milestone 2 — inspection implemented

React/Vite local viewer, rrweb recording/replay, searchable/filterable correlated timeline, event/request/console inspection, environment/capability view, screenshots, failure/expected-outcome editing, category exclusion, and `tracecase open`. Visual playback seeks when selecting timeline events and updates the selected event during playback. Remote styles/assets are not loaded, so fidelity may differ.

## Milestone 3 — network and privacy foundation implemented

Explicit enhanced debugger capture, fetch/XHR metadata/status/timing, bounded JSON/form bodies, failed-request highlighting, credential/header/body redaction before persistence, size/count limits, capabilities/warnings, export privacy review and standard fallback. Tested with actual Chromium extension sessions in both modes, credential-bearing requests/responses and oversized bodies.

Limitations: no binary/free-form text bodies, full redirect-chain reconstruction, WebSocket replay or complete secret detection. Browser-side declarative privacy rules and explicit CLI transformation plugins are available. Independent security review remains future hardening.

## Milestone 4 — advanced replay implemented

Structured JSON replay reports, per-step progress and locator diagnostics, bounded console warnings/errors, configurable waits, explicit interactive semantic-locator repair, saved repaired artifacts, and actual React/Vue/Svelte capture/replay scenarios. Failure reproduction and expected-outcome verification remain separate.

Actions are not retried after they start. Repairs require an explicit selection, and reports distinguish action divergence from failed outcome assertions. Broader real-world application validation remains a release-quality gate.

## Milestone 5 — deterministic API replay implemented

Recorded fetch/XHR responses, normalized URL/media-type/body-hash matching, per-signature occurrence order, explicit live exceptions, blocked mismatch handling, structured coverage reports and viewer report inspection. Enhanced extension capture is tested against a changed backend: live replay no longer reproduces the historical failure, while recorded replay does.

Scope: captured JSON/form responses and bodyless HEAD/204/205 responses. Static frontend assets stay live; service workers are blocked. Redacted/omitted evidence, authentication, WebSockets and timing emulation remain limitations.

The interface now uses shared teal/mint tokens, neutral surfaces, native typography, keyboard focus and responsive evidence/report panels, guided by OpenAI’s public UI guidelines.

## Release preparation

Shared prerelease version, teal-squircle and mint-dot logo, version validation, Node 22/24 CI, packaged CLI/extension/viewer assets, checksum generation, clean-install smoke testing, and a tag-triggered draft-release workflow. npm and Chrome Web Store publication are separate future distribution steps.

## Milestone 6 — regression test generation implemented

Readable Playwright TypeScript with expected-behavior assertions by default, explicit recorded-failure mode, optional standalone API fixture bundles, Prettier formatting, exclusive writes and editor links. The viewer previews and downloads exports from the edited, privacy-filtered recording. Tests execute generated code before and after a fix and type-check recorded bundles.

## Milestone 7 — developer and agent workflows implemented

Bounded JSON context, escaped Markdown issue drafts, a read-only single-artifact MCP server using the official SDK, artifact validation and a tested composite CI verification action. MCP exposes no filesystem browsing, execution or publication tools. Viewer handoffs honor export exclusions.

## Milestone 8 — ecosystem foundations implemented

Versioned artifact specification, machine-readable schema, packaged reader/schema/plugin APIs, explicit validated redaction/enrichment hooks and trusted replay adapters. Chromium, Firefox and WebKit replay are exercised locally and in CI. Documentation covers contributors, standalone viewer hosting and browser capture research.

Remaining expansion: Firefox/Safari extension capture, browser-side third-party capture adapters, a plugin marketplace, broader real-world app coverage, and distribution decisions for public hosting/npm/store publication. The current extension remains Chromium-only. These are not represented as completed browser capture support.

## Milestone 9 — browser privacy controls implemented

Local settings for additional sensitive field names and simple private-element selectors, strict bounded validation, additive built-in protection and immutable per-recording rules. Custom redaction runs before persistence across actions, DOM evidence, console errors, URLs and enhanced API data; private elements are hidden for screenshots. Actual extension tests inspect storage, exercise navigation and verify that settings changes affect only new recordings. The settings page follows the shared responsive design system.

## Milestone 10 — shared capture and workflow reliability implemented

CLI and extension recording now share semantic capture and baseline privacy logic. Native input buttons and keyboard submission are supported without duplicate Enter-generated clicks. CLI sessions preserve navigation and a monotonic timeline across documents. Unsupported control changes surface warnings rather than incomplete actions.

A synthetic project-settings workflow covers delayed rendering, checkbox/radio labels, native submit buttons, Enter submission, private inputs, SPA changes and document navigation. Tests replay it across Chromium, Firefox and WebKit and exercise actual MV3 extension capture. This expands realistic workflow coverage; it is not independent production-app validation. See [capture coverage](CAPTURE_COVERAGE.md).

Next candidates: independent real-world app validation and Firefox standard capture. Public distribution and Safari packaging still require separate decisions and platform verification.

No accounts, hosted storage, analytics or AI service is required for the core workflow.
