# Changelog

## 0.1.0-alpha.2 — unreleased

- Align product and examples with official OpenAI foundation tokens; improve readability, control states, spacing, validation, event labels and responsive layouts. Add automated accessibility checks and refresh documentation screenshots.

- Add Firefox standard capture, explicit capability messaging, temporary-install release bundles, and real Firefox extension validation in CI.
- Preserve native form-value readers across visual recording sessions so Firefox batches retain actions and console evidence.

- Share semantic capture and baseline privacy protection between CLI and extension recording.
- Capture native input buttons, unmodified keyboard actions, SPA changes and document navigation in CLI recordings, preserving the session timeline across documents.
- Avoid duplicate submission clicks after a recorded Enter key and exclude unsupported modified key chords.
- Report skipped file/range/color inputs and multiple selections instead of storing incomplete replay actions.
- Validate a synthetic project-settings workflow through actual extension capture, CLI capture and Chromium/Firefox/WebKit replay.

## 0.1.0-alpha.1 — released 2026-10-07

- Add safe colorful code previews with copy/wrap controls and companion-file selection, consistent dropdown arrow spacing, and a larger-looking transparent logo without increasing README spacing.

- Restructure the README and docs around first use, add five real workflow screenshots, contribution templates, and CI checks for local documentation links.

- Add local browser privacy settings for sensitive fields and private page elements, applied before storage and retained across navigation for each recording.
- Refine shared spacing, typography, panel/control radii, input contrast and 44px controls across the viewer and popup.
- Improve empty states, drag-and-drop feedback, keyboard navigation, privacy links, filter resets and recording-action feedback; verify responsive layouts from 320px to 1440px.

- Add standalone Playwright test bundles, expected/observed assertions, formatting and editor links.
- Add compact agent context, Markdown issue drafts, read-only MCP, artifact validation and a composite CI verification action.
- Add viewer export previews/downloads using edited outcomes and privacy exclusions, with responsive section navigation.
- Publish versioned specification and explicit plugin/reader APIs; validate replay on Chromium, Firefox and WebKit.
- Fix origin remapping for recorded paths beginning with two slashes.

- Add structured replay reports, locator attempt diagnostics, console output, and explicit interactive locator repair with saved copies.
- Validate replay behavior against actual React, Vue and Svelte fixtures.
- Match the interface to the teal squircle/mint dot logo with shared tokens, native typography, responsive panels and keyboard focus.
- Add recorded API replay with normalized URL/body-hash/occurrence matching, explicit live exceptions, blocked mismatches and viewer coverage reports.
- Add release metadata checks, clean-install package smoke tests, Node 22/24 CI, downloadable CLI/extension/viewer bundles, SHA-256 checksums, and draft GitHub Releases.
- Make test screenshot output portable across macOS and Linux and pin Ubuntu 24.04 runners.

Includes the previous Chromium capture, local viewer, bounded ZIP artifact, redaction, and live replay prototypes. Firefox/Safari extension capture and public distribution remain future work.
