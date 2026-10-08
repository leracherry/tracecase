# Getting started

[Documentation home](README.md) · [Visual walkthrough](WORKFLOWS.md) · [Troubleshooting](TROUBLESHOOTING.md)

This guide takes you from a source checkout to a recorded bug and a verified fix. TraceCase is an experimental alpha; source installation is the currently available path.

## 1. Build the tools

Install Git, Node.js **22.12 or newer**, and a Chromium browser. From a terminal:

```sh
git clone https://github.com/leracherry/tracecase.git
cd tracecase
npm ci
npx playwright install chromium
npm run build
```

The repository must be accessible to your GitHub account. On Linux, `npx playwright install --with-deps chromium` also installs browser system dependencies.

The build produces the extension in `apps/extension/.output/chrome-mv3`, the viewer in `apps/viewer/dist`, and the CLI in `dist/cli`. Run source-checkout commands as `npm run tracecase -- <command>`.

If you have a release bundle instead, follow [package installation](RELEASING.md#assets). A public npm package or browser-store listing is not required or assumed.

## 2. Load the extension

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Pin TraceCase for easy access. Reload tabs that were already open when you installed or rebuilt it.

Start the synthetic demo:

```sh
npm run demo
```

Open `http://127.0.0.1:5173/checkout`. Keep this terminal running while recording or replaying.

## 3. Record the failure

Open the TraceCase popup. Before starting, optionally configure [custom privacy rules](REDACTION.md#custom-browser-privacy-rules).

- **Standard capture** records semantic actions, visual events, console errors, and environment details.
- **Enhanced network capture** additionally records supported API evidence. It requests Chrome’s debugger permission and shows Chrome’s debugging banner.
- **Include screenshots** is separately opt-in. Visible non-input text still requires review.

Click **Start recording**, select **Canada**, enter `V7M 1A1`, and click **Continue**. Once `Tax service unavailable` appears, click **Mark bug**, then **Stop** in the recording overlay.

## 4. Review and export

The local inspector opens automatically. Select a timeline event to inspect it and seek the visual replay. Review any capture warnings and request details.

Enter this failure pair:

| Field             | Exact text                 |
| ----------------- | -------------------------- |
| Observed failure  | `Tax service unavailable`  |
| Expected behavior | `Order summary is visible` |

These are visible-text assertions used for reproduction and verification. Select the evidence categories to include, review sensitive content, and check **I reviewed the evidence for sensitive content**. Click **Export reviewed artifact** and save `recording.tracecase` in your repository root for the examples below.

You can reopen it later:

```sh
npm run tracecase -- open recording.tracecase
```

The viewer uses a loopback server and does not upload the recording. Stop it with **Ctrl+C**. The extension stores only its last temporary capture; export before starting another recording.

## 5. Reproduce, then verify

With the broken demo still running:

```sh
npm run tracecase -- run recording.tracecase --url http://127.0.0.1:5173
# FAILURE REPRODUCED
```

Stop the demo, then restart the fixed version:

```sh
# macOS/Linux
TRACECASE_DEMO_FIXED=1 npm run demo
```

```powershell
# PowerShell
$env:TRACECASE_DEMO_FIXED="1"
npm run demo
```

In another terminal:

```sh
npm run tracecase -- verify recording.tracecase --url http://127.0.0.1:5173
# VERIFIED
```

`run` checks that the observed failure is visible. `verify` checks that the expected outcome is visible. A failed action or assertion exits nonzero. Both use a fresh browser context without your recorded login session.

## 6. Keep a regression test

```sh
npm run tracecase -- test recording.tracecase --out tests/checkout.spec.ts --url http://127.0.0.1:5173
```

Run the generated file in a project with `@playwright/test` installed. The viewer’s **Export & handoff** panel also previews and downloads tests, issue drafts, and agent context. See [test export](TEST_EXPORT.md) for fixtures and assertions.

## Try it without recording

The checked-in examples are synthetic and ready to use:

```sh
npm run tracecase -- run examples/checkout.tracecase --url http://127.0.0.1:5173
```

Use the broken demo for that command. To reproduce the historical API failure against the **fixed** demo:

```sh
npm run tracecase -- run examples/checkout-recorded.tracecase --url http://127.0.0.1:5173 --network recorded
```

Recorded mode reuses captured API responses while the frontend still loads from your running application. [Learn about API matching and coverage →](NETWORK_REPLAY.md)

## Firefox standard capture

The source build includes `apps/extension/.output/firefox-mv3`. Open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose that folder’s `manifest.json`. Reload the app tab and open TraceCase. Firefox supports standard capture; enhanced API evidence is available in Chromium. Temporary installs last until Firefox closes. See [compatibility and validation](BROWSER_COMPATIBILITY.md).
