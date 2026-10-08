# Capture coverage

CLI, Chromium and Firefox extension recording use the same semantic capture engine. Both record actions against test IDs, accessible roles/names, labels and placeholders. Private fields are excluded before actions reach storage. The extension additionally supports custom privacy rules and visual/network evidence.

| Interaction                                | Behavior                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Buttons, links, checkbox/radio controls    | Semantic click; label activation resolves to its control               |
| Native input buttons                       | Button role with accessible label or input value                       |
| Text inputs and textareas                  | Fill actions; successive edits are collapsed                           |
| Single select                              | Selected option value                                                  |
| Enter, Escape, Tab, arrow keys             | Unmodified keys; an Enter-generated submit click is not recorded twice |
| SPA navigation                             | URL changes sampled every 200ms                                        |
| Document navigation                        | Captured across documents; CLI timestamps use the session start        |
| File, range, color inputs; multiple select | Skipped with a capture warning                                         |
| Modifier chords and IME composition keys   | Excluded rather than replayed as a different unmodified key            |

Checkboxes and radio buttons are clicks, not saved checked-state assertions: replay requires compatible initial application state. Focus changes and key combinations are not a complete keyboard recording. Very brief SPA transitions can occur between samples. Capture remains top-frame only; frames, shadow DOM targeting, uploads and authentication-state transfer remain unsupported.

## Verification

`tests/capture-workflows.test.mjs` records a synthetic project-settings flow with delayed rendering, a native edit button, checkbox/radio labels, region selection, a private email field, mouse/Enter submission and navigation. It checks one submission, no recorded email value, and a monotonic timeline after document navigation. CI replays the form in Chromium, Firefox and WebKit. `tests/extension.test.mjs` also runs the native-button and Enter flow through the actual Chromium extension.

These repeatable fixtures complement React/Vue/Svelte checkout tests. They do not establish reliability on arbitrary production applications. Independent recordings are the next validation gate.

`tests/firefox-extension.test.mjs` validates a temporary MV3 add-on in standard Firefox: navigation, native form values while rrweb is active, console redaction, custom privacy fields, local review, ZIP validation and executable replay. Firefox standard capture does not include API metadata or response bodies.
