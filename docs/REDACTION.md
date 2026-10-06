# Baseline redaction

Redaction happens before evidence is persisted.

Semantic capture excludes password/hidden fields, `[data-private]` descendants, and fields whose identifiers indicate passwords, tokens, secrets, API keys, payment data, SSNs, email, or phone numbers. rrweb masks all input values and blocks private elements, frames, media, and canvas. Visual URL metadata and DOM attributes are also scrubbed for recognizable credential fields.

Authorization, Proxy-Authorization, Cookie, and Set-Cookie headers are replaced with `[REDACTED]`. Sensitive JSON/form keys are replaced recursively. URL query keys for common credentials are masked and URL credentials/fragments are removed. Recognizable Bearer tokens, JWTs and credential assignments in text are masked.

Only JSON and URL-encoded body formats within 256 KiB are stored. Free-form text and binary bodies are omitted. Console capture forwards string arguments only; objects and rejection objects are omitted.

Screenshots are opt-in. Before capture, input text is hidden and private/payment elements are hidden. This temporarily changes the recorded page’s appearance and can affect timing. Other visible text may still contain sensitive information.

The viewer requires an explicit privacy-review check before export and can exclude visual replay, screenshots, network, or console evidence. Public text inputs, labels, arbitrary page text, URL paths, and nonstandard payload fields can still contain sensitive values. Redaction is a baseline rather than a guarantee. Authentication cookies/storage are never exported as replay profiles.

## Custom browser privacy rules

Open **Privacy settings** in the extension popup before recording. Rules are local to this browser profile, apply to every recorded site and add to built-in protections. They are declarative lists, not executable plugins.

**Additional sensitive fields** accepts up to 50 exact, case-insensitive names (64 characters each). For example, `customer_id` redacts that key in captured JSON/form bodies, request/response headers and URL query parameters, and excludes interactions with elements whose `name` or `id` matches it. Recognizable `customer_id=value` assignments in captured text are masked too. Field names may contain letters, numbers, underscores, dots and hyphens, starting with a letter or underscore.

**Private page elements** accepts up to 50 simple selectors (160 characters each): `.class`, `#id`, `[data-attribute]`, `[data-attribute="value"]`, `[name="field"]`, or `[id="value"]`. Matching elements and descendants are blocked from semantic/rrweb capture and hidden with opacity during opt-in screenshots. Compound selectors, regular expressions, arbitrary CSS and JavaScript are rejected. Selectors apply to the supported top-frame light DOM; frames and shadow-DOM capture remain outside the supported action scope.

Click **Save privacy rules** to apply changes to the next recording. **Clear custom rules** edits the form; save to confirm the cleared settings. Each recording uses a snapshot of its rules, including after document navigation, so editing settings during capture cannot silently weaken an active session. Existing recordings are not rewritten. Artifacts disclose the number of custom rules in capability warnings without embedding the rules themselves.

Custom rules run before evidence is written to local session storage and IndexedDB. Tests inspect both stores as well as the exported artifact, exercise navigation and changed defaults during recording, and confirm screenshot masking. This is not a complete secret detector: field names do not locate arbitrary copies of a value, URL paths are not scrubbed by field rules, and arbitrary visible text needs an element rule and review. Redacted API bodies and excluded steps may be insufficient for deterministic replay.
