# Troubleshooting

[Documentation home](README.md) · [CLI reference](CLI.md)

## The extension will not start recording

Use an HTTP(S) page. Reload the tab after installing or rebuilding the extension, then retry. Browser-internal pages such as `chrome://extensions` are not recordable. Check the popup status for the specific failure.

## Enhanced capture falls back to standard mode

Enable **Enhanced network capture** and accept Chrome’s optional debugger permission. Another debugger attachment or detachment can prevent capture. The popup and artifact warnings report the fallback. Standard mode continues recording actions and visual evidence but cannot provide captured API bodies.

## Screenshots are missing

Enable screenshots before starting and keep the recorded tab visible. Permissions, browser restrictions, or the screenshot limit may prevent a frame from being saved. Look for a capture warning. Visual replay and screenshot capture are separate features.

## The viewer looks different from the original page

The viewer blocks remote assets and active content. External stylesheets, images, fonts, and unsupported page content may not reproduce visually. The timeline and executable replay are separate evidence channels; a visual difference does not necessarily mean an action cannot replay.

## Export is disabled

Complete the privacy review first. Test export also needs both the observed and expected visible text. Recorded-response export needs usable captured fixtures. The preview explains unavailable exports; switch formats or correct the recording rather than bypassing review.

## A report does not open

Reports belong to an exact artifact fingerprint. Open the recording used for that replay. An edited or privacy-filtered copy is a different artifact. The viewer accepts supported recorded-network reports up to 4 MiB.

## A command refuses to write a file

Exports and reports use exclusive creation. Choose a new output filename or deliberately move your existing output before retrying. This protects prior evidence from accidental overwrite.

## Replay cannot start

Keep the target app running and verify the URL. Install the chosen Playwright engine:

```sh
npx playwright install chromium
# Or install the additional supported engines:
npx playwright install firefox webkit
```

On Linux, add `--with-deps` if system libraries are missing. Check Node.js is 22.12 or newer. Use `--headed` to watch the run and `--report replay.json` to keep diagnostics. Increase `--timeout-ms` when a real application needs more time to load.

## Replay diverges or cannot log in

TraceCase uses a fresh browser context and does not import recorded cookies or local storage. Start from a reproducible state. Unsupported targets and redacted input values may require manual work. For changed semantic locators, use explicit [interactive repair](REPLAY.md#explicit-repair); TraceCase does not guess replacements silently.

## Recorded APIs are blocked

A missing, redacted, unsupported, or exhausted fixture can cause a mismatch. Inspect the coverage report. Matching uses URL, method, body signature, and occurrence; it does not recreate every server behavior. Use a narrowly scoped `--passthrough` only when that traffic should be live. [Matching and supported bodies →](NETWORK_REPLAY.md)

## Custom privacy rules did not change an existing recording

Rules apply when a new recording starts. An active recording retains its original rules through navigation, and saved recordings are not rewritten. Field rules match names rather than arbitrary copies of a value; use private-element selectors for visible page content. [Privacy rules →](REDACTION.md#custom-browser-privacy-rules)

## Report a reproducible problem

Include the TraceCase version/commit, OS, browser, capture mode, exact steps, and expected versus actual behavior. Prefer the synthetic demo or a minimal fixture. Review logs and screenshots before attaching them; do not attach real private recordings. Use the [bug-report template](../.github/ISSUE_TEMPLATE/bug_report.yml). Security findings should follow the [security policy](../SECURITY.md).
