# TraceCase documentation

Start with [build, capture and replay](../README.md), then follow your task:

- [Turn a recording into a Playwright regression test](TEST_EXPORT.md)
- [Replay recorded API responses](NETWORK_REPLAY.md)
- [Inspect replay diagnostics and repair locators](REPLAY.md)
- [Prepare agent context, issue drafts, MCP and CI verification](AGENT_WORKFLOWS.md)
- [Add a trusted plugin or framework/API adapter](PLUGINS.md)
- [Artifact specification 0.2](spec/0.2.md) and [JSON Schema](tracecase.schema.json)
- [Browser compatibility and capture research](BROWSER_COMPATIBILITY.md)
- [Privacy](REDACTION.md), [permissions](PERMISSIONS.md), and [security](../SECURITY.md)
- [Design system](DESIGN.md), [brand assets](BRAND.md), and [release preparation](RELEASING.md)

## Standalone viewer distribution

The release viewer ZIP is a static application. Serve it locally, or deploy its contents to a static HTTPS host to provide a browser-only inspector. Evidence is processed on the user's device; the app has no upload API. The source bundle uses a same-origin CSP and includes no analytics. An HTTPS or localhost origin is required for Web Crypto and secure browser APIs. Hosting is a deployment choice; the build does not publish a site or change repository visibility.
