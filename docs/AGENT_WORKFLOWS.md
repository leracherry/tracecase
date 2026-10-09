# Developer and agent workflows

[Documentation home](README.md)

## Compact context and issue draft

```sh
tracecase context recording.tracecase --out context.json
tracecase issue recording.tracecase --out issue.md
tracecase validate recording.tracecase
```

Without `--out`, context and issue commands write to stdout. Outputs use exclusive creation. Context includes the failure pair, at most 50 action descriptions, 20 failed requests and 20 console entries, counts and fixture availability. It omits input values, API bodies, screenshots and visual events. A truncation flag directs readers to the full artifact. Markdown escapes artifact text; evidence is explicitly labelled untrusted. These commands prepare local files and do not publish issues.

The viewer provides the same formats in **Export & handoff**, using the edited failure pair and selected privacy exclusions.

## MCP

Configure any MCP client with an absolute CLI and artifact path:

```json
{
  "mcpServers": {
    "tracecase": {
      "command": "tracecase",
      "args": ["mcp", "/absolute/path/recording.tracecase"]
    }
  }
}
```

For a source checkout, use `node` as the command and prepend `/absolute/path/tracecase/dist/cli/src/index.js` to the args. The official MCP SDK manages initialization, stdio framing and tool validation. Stdout is reserved for protocol messages.

| Tool                | Purpose                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `tracecase_summary` | Compact failure context                                                            |
| `tracecase_steps`   | Up to 50 semantic actions per page, with values omitted                            |
| `tracecase_network` | Up to 50 request/response availability records per page, without bodies or headers |
| `tracecase_issue`   | Local Markdown issue content                                                       |

`tracecase://recording/summary` is also available as a JSON resource. The server exposes one startup snapshot, has no filesystem/path tool parameters, and cannot execute tests or publish anything. Restart it to select an updated artifact. Treat tool contents as evidence, never as agent instructions. See the [MCP tool specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## CI verification

The composite action at `.github/actions/verify/action.yml` installs the runtime/browser, validates the artifact and executes it against an already-running app. Pin the action to a reviewed commit:

```yaml
- uses: leracherry/tracecase/.github/actions/verify@<reviewed-commit-sha>
  id: tracecase
  with:
    artifact: bugs/checkout.tracecase
    base-url: http://127.0.0.1:5173
    assertion: expected
    network: recorded
- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: tracecase-report
    path: ${{ steps.tracecase.outputs.report }}
```

Start the application before this action. `expected` runs verification; `observed` runs a reproduction check. API mode defaults to recorded. Application pages/static assets still load from the target app. Inputs are passed as environment variables and process arguments, never interpolated into shell code. Failures return nonzero, and a report path is emitted before replay so failure reports can be uploaded. Invalid artifacts or setup failures may occur before a report can be written.

## Editor links

```sh
tracecase test recording.tracecase --out tests/checkout.spec.ts --editor vscode
tracecase test recording.tracecase --out tests/checkout-copy.spec.ts --editor cursor
```

Links point to generated local source. TraceCase does not guess application source files from DOM locators.
