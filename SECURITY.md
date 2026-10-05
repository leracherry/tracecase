# Security

This is an experimental local development tool. Treat recordings as untrusted documents and use a disposable development environment for replay.

- Schema validation rejects arbitrary code, unsupported locators, unknown fields and credential-bearing entry URLs.
- Artifacts are JSON and never unpacked or evaluated. Reads and writes have a 4 MiB limit.
- Password and hidden inputs, common credential/payment identifiers, and descendants of `[data-private]` are excluded before their values reach recorder storage.
- No cookies, storage state, network bodies, or console logs are captured. No telemetry or hosted upload is implemented.
- Replay starts a fresh browser, uses live network, and executes actions against the chosen target. Actions may change application state.
- Generated recordings may contain sensitive public-input values, URL parameters, labels, and manually supplied failure descriptions. Inspect before sharing.
- The recorder does not yet support frames, multi-page flows, complete redaction, or adversarial target pages. It is not a sandbox for hostile applications.

Report security issues privately through the repository owner's GitHub contact rather than publishing secrets in an issue.
