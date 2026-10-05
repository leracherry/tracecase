# Baseline redaction

Redaction happens before evidence is persisted.

Semantic capture excludes password/hidden fields, `[data-private]` descendants, and fields whose identifiers indicate passwords, tokens, secrets, API keys, payment data, SSNs, email, or phone numbers. rrweb masks all input values and blocks private elements, frames, media, and canvas. Visual URL metadata and DOM attributes are also scrubbed for recognizable credential fields.

Authorization, Proxy-Authorization, Cookie, and Set-Cookie headers are replaced with `[REDACTED]`. Sensitive JSON/form keys are replaced recursively. URL query keys for common credentials are masked and URL credentials/fragments are removed. Recognizable Bearer tokens, JWTs and credential assignments in text are masked.

Only JSON and URL-encoded body formats within 256 KiB are stored. Free-form text and binary bodies are omitted. Console capture forwards string arguments only; objects and rejection objects are omitted.

Screenshots are opt-in. Before capture, input text is hidden and private/payment elements are hidden. This temporarily changes the recorded page’s appearance and can affect timing. Other visible text may still contain sensitive information.

The viewer requires an explicit privacy-review check before export and can exclude visual replay, screenshots, network, or console evidence. Public text inputs, labels, arbitrary page text, URL paths, and nonstandard payload fields can still contain sensitive values. Redaction is a baseline rather than a guarantee. Authentication cookies/storage are never exported as replay profiles.
