# Browser compatibility and capture research

| Capability                     | Chromium                              | Firefox                               | WebKit                                |
| ------------------------------ | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| Executable live replay         | Tested                                | Tested                                | Tested                                |
| Recorded API replay            | Tested                                | Tested                                | Tested                                |
| Generated Playwright tests     | Supported through Playwright projects | Supported through Playwright projects | Supported through Playwright projects |
| Extension capture and review   | Tested MV3                            | Research only                         | Not implemented                       |
| Enhanced debugger body capture | Tested                                | Requires a different adapter          | Not implemented                       |

The automated compatibility test executes the checkout scenario in all three engines, verifies a fixed live backend and reproduces the historical failure from recorded responses. This establishes compatibility for the supported scenario, not universal production-app coverage. Generated tests run in the browser projects chosen by the consuming application. [Playwright WebKit is not a guarantee of Safari behavior](https://playwright.dev/docs/browsers).

```sh
npx playwright install chromium firefox webkit
TRACECASE_CROSS_BROWSER=1 npm test
tracecase run recording.tracecase --browser firefox --network recorded --url http://localhost:5173
```

Local tests skip Firefox/WebKit when `TRACECASE_CROSS_BROWSER` is unset; CI installs and tests all engines on Node 22 and 24.

## Firefox capture research

The browser-independent semantic recorder and validated artifact model can be reused. Firefox extension delivery needs manifest/background adaptation, permission UX testing, IndexedDB/navigation lifecycle checks, and a replacement for Chrome's debugger-based response capture. Porting the manifest alone would not provide enhanced capture. A first adapter should aim for standard actions/console/visual capture, explicitly report missing bodies, and pass the same real-extension export/replay tests before claiming support.

Safari capture additionally needs an extension packaging/distribution strategy and platform testing. Service workers, frames, shadow DOM, authentication state and timing-sensitive apps require broader validation across engines. Framework integrations can currently use explicit trusted replay plugins; browser capture adapters remain future work.
