# TraceCase documentation

Record a browser failure, inspect its evidence, and verify the fix locally.

**New here?** Start with [Getting started](GETTING_STARTED.md), or see the [screenshot walkthrough](WORKFLOWS.md).

## Use TraceCase

| Guide                                              | What you will learn                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Getting started](GETTING_STARTED.md)              | Build, install, record the demo, reproduce the failure, and verify the fix.        |
| [Visual walkthrough](WORKFLOWS.md)                 | Follow capture, privacy settings, inspection, review, and export with screenshots. |
| [CLI reference](CLI.md)                            | Find commands, options, defaults, and exit behavior.                               |
| [Troubleshooting](TROUBLESHOOTING.md)              | Resolve common installation, capture, export, and replay problems.                 |
| [Replay diagnostics and repair](REPLAY.md)         | Understand reports and explicitly repair changed locators.                         |
| [Recorded API replay](NETWORK_REPLAY.md)           | Match captured responses and investigate coverage gaps.                            |
| [Playwright test export](TEST_EXPORT.md)           | Generate regression tests or historical reproduction checks.                       |
| [Agent, MCP, and CI workflows](AGENT_WORKFLOWS.md) | Prepare handoffs and integrate verification into development.                      |

## Understand the boundaries

- [Redaction and custom privacy rules](REDACTION.md)
- [Extension permissions](PERMISSIONS.md)
- [Browser compatibility](BROWSER_COMPATIBILITY.md)
- [Security policy](../SECURITY.md)

## Extend and contribute

- [Architecture and repository map](ARCHITECTURE.md)
- [Contributing and local checks](../CONTRIBUTING.md)
- [Plugin API](PLUGINS.md)
- [Artifact format overview](TRACECASE_FORMAT.md), [version 0.2 specification](spec/0.2.md), and [JSON Schema](tracecase.schema.json)
- [Interface design](DESIGN.md) and [brand guide](BRAND.md)

## Follow releases

- [Roadmap](ROADMAP.md)
- [Changelog](../CHANGELOG.md) and [release notes](RELEASE_NOTES.md)
- [Release preparation and package installation](RELEASING.md)

## Serve the standalone viewer

The release viewer ZIP is a static application. Serve its contents on localhost or a static HTTPS host. Evidence is processed on the user’s device; the app has no upload API or analytics. HTTPS or localhost is needed for Web Crypto and secure browser APIs. Opening the files directly with `file://` is unsupported.

Hosting is a separate deployment choice. Building TraceCase does not publish a website or change repository visibility. For local source development, use `npm run dev -w @tracecase/viewer`; for a recording, prefer `npm run tracecase -- open recording.tracecase`.

## Capture reliability

[Capture coverage](CAPTURE_COVERAGE.md) describes supported controls, navigation, privacy behavior and the workflow validation matrix.
