# TraceCase format 0.1

A UTF-8 JSON document with a `.tracecase` extension. This feasibility format is intentionally not the ZIP container proposed for later milestones. Maximum encoded size: 4 MiB. Unknown properties, unsupported versions, executable scripts, arbitrary selectors, invalid URLs, and malformed actions are rejected. See [JSON Schema](tracecase.schema.json).

Each artifact contains a title, ISO creation date, HTTP(S) entry URL, viewport, and ordered steps. Steps contain elapsed milliseconds, semantic locator candidates, an action type, and a value for fill/select. Candidates are ranked in capture order: test ID, accessible role/name, label, placeholder. Replay requires a unique visible match and tries fallback candidates when needed. Recorded timing is metadata; replay waits for browser actionability rather than sleeping.

An optional failure marker separates `observedText` from `expectedText`. Both match exact visible text. Running checks the observed failure; verifying checks the expected behavior. A successful action sequence alone does not establish reproduction.

Replay URL remapping preserves the original entry path and query under the target origin. It does not remap application requests or subsequent navigation. Live networking is used. This format does not include secrets, storage state, DOM snapshots, or network response bodies as dedicated fields. Values in public inputs, labels and URLs can still contain sensitive data; review them before sharing.

Version 0.x is experimental. Incompatible revisions must change the version; this reader rejects versions it does not understand.
