# Executable replay

TraceCase runs semantic actions against a real app with live networking. A new isolated Chromium context is used for each run; cookies and storage from the recording are not imported.

## Run, verify, report

```sh
tracecase run recording.tracecase --url http://localhost:5173 --report replay.json
tracecase verify recording.tracecase --url http://localhost:5173 --report verification.json
tracecase run recording.tracecase --url http://localhost:5173 --json
```

From a source checkout, prefix commands with `npm run tracecase --`.

`run` looks for the observed failure. `verify` looks for expected behavior. A recording without an assertion reports completed actions only. Report files use exclusive creation to avoid overwriting existing evidence; choose a new filename for each run.

Reports include source title, target URL, execution mode, elapsed time, per-step locator attempts, selected locators, repair decisions, assertion result, and bounded console warnings/errors. Input values are not copied into reports. Recognizable credentials and control characters in diagnostic text are scrubbed, but reports still require review before sharing.

| Status             | Meaning                                             | Exit status |
| ------------------ | --------------------------------------------------- | ----------- |
| `completed`        | Actions finished; no assertion was supplied         | 0           |
| `reproduced`       | Recorded failure text is visible                    | 0           |
| `verified`         | Expected outcome text is visible                    | 0           |
| `diverged`         | An action or navigation could not complete          | 1           |
| `assertion-failed` | Actions completed; selected outcome was not visible | 1           |
| `error`            | Browser launch or initial navigation failed         | 1           |

Malformed artifacts, invalid options and file errors also exit nonzero. `--json` emits the report on stdout without progress messages. `--report` writes the same report, including failure outcomes.

## Locator behavior

The executor tries recorded test IDs, role/name pairs, labels, and placeholders in priority order. It accepts only a unique visible target and waits for dynamic elements within the timeout. Attempts distinguish missing, hidden and ambiguous targets. Playwright handles actionability checks.

`--timeout-ms` sets an action/navigation/assertion budget from 100 to 60,000 milliseconds, default 5,000. Entry paths and queries are remapped to `--url`’s origin. History transitions are verified after the preceding action; document transitions navigate to the recorded destination if needed.

Actions are never retried by TraceCase once execution starts: a click may already have changed application state.

## Explicit repair

```sh
tracecase run recording.tracecase --url http://localhost:5173 --repair --save-repaired repaired.tracecase
```

Repair requires an interactive terminal and opens a visible browser. When recorded locators fail, TraceCase lists unique visible semantic alternatives. Choose a number to continue or press Enter to stop. It never silently guesses a replacement.

`--save-repaired` saves a new validated artifact with the chosen locator first, retaining existing fallbacks. The original file is unchanged. Without that option, repair choices appear only in the report. There is no automatic repair after an action has started or for redacted private input values.

## Verification coverage

The suite covers recorded flows in actual React, Vue and Svelte checkout fixtures, delayed outcomes, removed primary locators, renamed buttons, explicit repair, saved repaired artifacts, failed assertions and navigation errors. These fixtures establish framework compatibility for the supported action subset; they do not guarantee arbitrary production-app reliability.
