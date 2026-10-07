# CLI reference

[Documentation home](README.md) · [Getting started](GETTING_STARTED.md)

Examples below use an installed `tracecase` command. From a source checkout, replace `tracecase` with `npm run tracecase --`. Run `tracecase --help` for the built-in synopsis.

## Commands

| Command    | Purpose                                                    | Example                                                          |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `record`   | Open the original interactive Playwright recorder          | `tracecase record http://localhost:5173 --out session.tracecase` |
| `open`     | Inspect a recording in the local viewer                    | `tracecase open session.tracecase`                               |
| `inspect`  | Print a recording summary                                  | `tracecase inspect session.tracecase`                            |
| `validate` | Validate artifact format and integrity                     | `tracecase validate session.tracecase`                           |
| `run`      | Execute actions and check the observed failure, if present | `tracecase run session.tracecase --url http://localhost:5173`    |
| `verify`   | Execute actions and check the expected outcome             | `tracecase verify session.tracecase --url http://localhost:5173` |
| `test`     | Write standalone Playwright TypeScript                     | `tracecase test session.tracecase --out tests/checkout.spec.ts`  |
| `context`  | Write bounded JSON context for an agent                    | `tracecase context session.tracecase --out context.json`         |
| `issue`    | Write a local Markdown issue draft                         | `tracecase issue session.tracecase --out issue.md`               |
| `mcp`      | Serve one recording through read-only MCP over stdio       | `tracecase mcp session.tracecase`                                |

The original `record` command captures top-frame click/fill/select actions; use the extension for visual evidence, console capture, custom browser privacy rules, and enhanced network capture. CLI `record` requires an interactive terminal; press Enter there to finish.

## Replay options

These options apply to `run` and `verify`:

| Option                                | Meaning                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| `--url <base-url>`                    | Remap recorded application URLs to a running app’s origin.                          |
| `--browser chromium\|firefox\|webkit` | Choose the installed Playwright engine; defaults to Chromium.                       |
| `--headed`                            | Show the replay browser.                                                            |
| `--timeout-ms <ms>`                   | Set the per-action/navigation/assertion budget, 100–60,000ms; defaults to 5,000.    |
| `--report <file>`                     | Save a structured report to a new file, including failed outcomes.                  |
| `--json`                              | Print the report as JSON without progress messages.                                 |
| `--network live\|recorded`            | Use live APIs by default or captured response fixtures.                             |
| `--unmatched abort\|live`             | Choose behavior for unmatched recorded-mode requests; defaults to abort.            |
| `--passthrough <URL-glob>`            | Allow a specific request pattern to stay live; repeatable.                          |
| `--repair`                            | Ask for an explicit replacement when a semantic locator fails. Requires a terminal. |
| `--save-repaired <new-file>`          | Save selected repairs to a new recording.                                           |

See [replay diagnostics](REPLAY.md) for status meanings and [network replay](NETWORK_REPLAY.md) for matching rules. A successful `run` can mean **the bug was reproduced**; use `verify` to check the fix.

## Export and integration options

`test` requires `--out <name.spec.ts>`. It accepts `--url`, `--assertion expected|observed`, `--network live|recorded`, and `--editor vscode|cursor`. Expected behavior and live networking are the defaults. Recorded mode writes companion fixture files beside the test. [Export details →](TEST_EXPORT.md)

`context` and `issue` write to stdout when `--out` is omitted. They do not submit issues or contact an AI service. `mcp` reserves stdout for its protocol. [Integration details →](AGENT_WORKFLOWS.md)

`--plugin <local-module.mjs>` explicitly loads a trusted plugin and can be repeated. Plugins have the CLI process’s permissions; recordings cannot enable them. [Plugin contract →](PLUGINS.md)

`open --no-browser` prints the local viewer URL without launching a browser. `record --title <title>` sets the recording title. Generated files and reports refuse to overwrite existing destinations; choose a new filename.

## Exit behavior

Successful validation, export, or replay returns zero. Malformed inputs, invalid options, file errors, replay divergence, and failed assertions return nonzero. Replay reports distinguish `completed`, `reproduced`, `verified`, `diverged`, `assertion-failed`, `network-diverged`, and `error`. See the [status table](REPLAY.md#run-verify-report).
