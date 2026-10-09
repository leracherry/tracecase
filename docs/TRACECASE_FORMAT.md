# TraceCase artifact format

[Documentation home](README.md)

## Version 0.2

A `.tracecase` file is a ZIP container containing exactly:

```text
recording.json
checksums.json
```

`recording.json` includes the manifest fields, semantic steps, optional failure assertion, and evidence: environment, capabilities, events, rrweb visual data, screenshot data URLs, network records, and a privacy report. `checksums.json` maps `recording.json` to its SHA-256 digest. Checksums detect corruption; they are not signatures and do not authenticate a recording.

The container is intentionally small and extensible through versioning. Separate evidence/blob entries can be introduced in a future incompatible revision. The reader rejects unknown versions and archive members. See [JSON Schema](tracecase.schema.json).

Limits: 8 MiB packed, 16 MiB expanded, 10,000 actions, 10,000 console/marker/gap events, 20,000 visual events, 2,000 requests, 20 screenshots, and 256 KiB per request/response body. Extension capture stops at 12 MiB of persisted evidence and surfaces a warning. Oversized visual snapshots and unsupported bodies are omitted with capability warnings or omission reasons.

The reader does not extract archives to disk. It validates entry names, duplicates, incremental expanded size, checksums, and runtime schema. Compressed input is fed in small chunks to prevent forged ZIP sizes from forcing an unbounded expansion.

Steps have elapsed milliseconds and one of: click, fill, select, key, navigation. Interaction steps include ranked locator candidates: test ID, role/name, label, placeholder. A unique visible candidate is required for execution. History navigation is verified after the preceding application action; document navigation continues at the remapped destination. Only HTTP(S) destinations are supported. Timing is metadata; replay waits on browser actionability and URLs.

Failure markers distinguish `observedText` from `expectedText`. Both match exact visible text. `run` checks the observed failure; `verify` checks desired behavior. A completed action sequence without a marker does not establish reproduction.

Enhanced network evidence stores only fetch/XHR requests. Request and response headers are redacted. Body capture supports bounded JSON and URL-encoded forms; unsupported, failed, unavailable, or oversized response bodies include omission reasons. Requests still in flight at stop are retained as metadata.

## Version 0.1 compatibility

The original UTF-8 JSON artifact remains readable, with its original 4 MiB limit. The interactive Playwright recorder still writes this action-only format. The extension and viewer export the 0.2 ZIP container.

Version 0.x is experimental; incompatible revisions must change the version. Readers never execute scripts embedded in artifacts. Visual replay additionally strips active/resource-bearing nodes/attributes and runs through rrweb’s sandboxed iframe under a restrictive content security policy.
