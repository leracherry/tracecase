# Recorded API replay

[Documentation home](README.md)

Recorded mode serves captured API responses while the frontend code, documents, images, fonts and styles load from the development app. This lets an old frontend failure reproduce after the backend has changed.

```sh
tracecase run recording.tracecase --url http://localhost:5173 --network recorded --report replay.json
```

Record with **Enhanced network capture** and export the reviewed artifact. API responses are already stored in the bounded `.tracecase` ZIP; no separate HAR file or backend is required. Standard and legacy recordings have no usable response bodies. They can still run live, but recorded mode blocks their unmatched API requests.

## Request matching

Only HTTP(S) fetch/XHR traffic is intercepted. A match uses:

1. HTTP method.
2. Normalized URL, including query values. Query keys are sorted; duplicate-value order is retained. The captured application's origin is mapped to the replay destination. External API origins remain exact.
3. Media type, ignoring parameters such as charset.
4. SHA-256 of the redacted, canonical request body. JSON object keys and form field keys are sorted; array and duplicate form-value order matter. Credentials are redacted with the same rules used during capture and are not matching keys.
5. Occurrence within that exact method/URL/type/body signature. Captured start times determine order, with file order breaking ties. A response is consumed at most once; an omitted response reserves its occurrence rather than shifting later responses forward.

Changing a query, nonprivate body value, method or occurrence can therefore produce a mismatch. Request bodies and credentials are not included in coverage reports. Headers other than content type do not participate in matching.

## Supported responses

Captured JSON and URL-encoded responses are usable when their bodies are present. HEAD and 204/205 responses can be served without a body. Invalid JSON, redirects, transport failures, omitted bodies and executable/binary/free-form content are unavailable. POST/PUT/PATCH/DELETE-like requests require a captured request body; a missing body cannot safely be distinguished from omitted evidence.

Only content type and a no-store cache header are restored. Cookies, authorization, compression, redirects and other recorded headers are not restored. Response bodies retain capture-time redaction placeholders, which can affect application behavior. Request timing is not emulated. Each run uses a fresh context; recorded mode blocks service workers so they cannot bypass interception.

## Mismatch controls

Unmatched API requests are **aborted by default**, including writes. A blocked request or routing error makes the overall result `network-diverged` and exits 1, even if the visible assertion passes. Available fixtures that were not requested remain unused; they do not fail the run.

Allow specific live traffic with repeatable URL patterns (`*` matches any sequence; other characters are literal):

```sh
tracecase run recording.tracecase --network recorded \
  --passthrough '*/analytics/*' --passthrough 'https://flags.example.com/*' \
  --report hybrid.json
```

Exceptions take precedence over fixtures. Alternatively, `--unmatched live` sends every unmatched fetch/XHR request to the backend. This can change application state and makes the run hybrid; those requests are reported separately. `--network live` is the default and preserves ordinary replay behavior.

## Coverage and viewer

JSON report version `1.1` includes the artifact SHA-256 fingerprint and recorded-mode coverage:

- API requests matched, passed through live, unmatched and aborted.
- Eligible, used, unused and unavailable captured responses.
- Per-request outcome, occurrence, fixture index and mismatch reason.
- Routing errors and a truncation flag for more than 2,000 request details. Aggregate counts continue beyond that limit.

Open the artifact in the viewer, then select **Open replay report**. The report must belong to that exact artifact. The viewer shows actual request results and unavailable-response reasons. The fingerprint associates files; it is not a signature or proof of authenticity. Reports are bounded and rendered as text locally.

Coverage describes fetch/XHR observed during execution and a bounded quiet period after the outcome. It does not promise full offline isolation: frontend assets still load live, and WebSockets, workers, streams, browser protocols, authentication state and timing races are outside this milestone. Use a local or staging app and review explicit live exceptions.

## Validation

Tests exercise actual enhanced extension capture → reviewed ZIP → replay against a changed backend, body-sensitive repeated requests, query normalization, out-of-order response completion metadata, blocked writes, explicit live exceptions, missing and exhausted occurrences, CLI JSON/exit behavior, and safe report inspection on desktop/mobile.
