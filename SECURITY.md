# Security

TraceCase is experimental. Use disposable local/staging environments for capture and executable replay.

## Untrusted artifact handling

Versioned runtime schemas reject unknown fields, unsupported locators and executable actions. ZIP readers accept only two known entries, enforce packed/expanded limits incrementally, verify SHA-256 integrity, and never extract files to disk. The legacy JSON reader remains bounded. Checksums are not authenticity signatures.

The viewer renders evidence as React text. Visual replay strips active nodes, resource URLs, event handlers and external CSS references. rrweb reconstructs the DOM in an iframe sandboxed with `allow-same-origin` without scripts. Restrictive content security policies block remote resource loading. Artifacts never supply executable application code.

## Capture and privacy

Capture is user-initiated, persists locally, and does not send telemetry or upload recordings. Redaction precedes persistence. Password/private fields, common credential headers, and sensitive JSON/form keys are excluded or masked. Screenshots are opt-in and mask input/private elements. See [redaction](docs/REDACTION.md) and [permissions](docs/PERMISSIONS.md).

A privacy review is required before export, and evidence categories can be excluded. No automated system can identify every sensitive value in arbitrary page text, identifiers, URL paths, or payload fields. Review before sharing. Hostile target pages can spoof or interfere with capture; recordings are evidence rather than tamper-proof audit logs.

## Execution

Executable replay launches a fresh Playwright browser and runs the recorded actions against the selected target with live networking by default or explicit recorded API fixtures. It can modify application state. It does not import cookies/storage secrets from recordings. Authentication profiles remain unsupported. In recorded mode, unmatched API requests are blocked unless explicitly allowed; static frontend assets remain live. Trusted local plugins can alter routing and run with the CLI process’s permissions.

Report security issues privately through the repository owner’s GitHub contact. Do not publish recordings containing secrets in public issues.
