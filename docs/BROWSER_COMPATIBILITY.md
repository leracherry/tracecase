# Browser compatibility and capture research

| Capability                     | Chromium                              | Firefox                               | WebKit                                |
| ------------------------------ | ------------------------------------- | ------------------------------------- | ------------------------------------- |
| Executable live replay         | Tested                                | Tested                                | Tested                                |
| Recorded API replay            | Tested                                | Tested                                | Tested                                |
| Generated Playwright tests     | Supported through Playwright projects | Supported through Playwright projects | Supported through Playwright projects |
| Extension capture and review   | Tested MV3                            | Standard MV3 (temporary install)      | Not implemented                       |
| Enhanced debugger body capture | Tested                                | Unavailable in standard capture       | Not implemented                       |

The automated compatibility test executes the checkout scenario in all three engines, verifies a fixed live backend and reproduces the historical failure from recorded responses. This establishes compatibility for the supported scenario, not universal production-app coverage. Generated tests run in the browser projects chosen by the consuming application. [Playwright WebKit is not a guarantee of Safari behavior](https://playwright.dev/docs/browsers).

```sh
npx playwright install chromium firefox webkit
TRACECASE_CROSS_BROWSER=1 npm test
tracecase run recording.tracecase --browser firefox --network recorded --url http://localhost:5173
```

Local tests skip Firefox/WebKit when `TRACECASE_CROSS_BROWSER` is unset; CI installs and tests all engines on Node 22 and 24.

## Firefox standard capture

Build with `npm run build:extension`. The Firefox build is `apps/extension/.output/firefox-mv3`. In Firefox, open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select its `manifest.json`. Reload the target page, then open TraceCase from the extensions menu. Temporary installations end when Firefox closes; this milestone does not publish a signed Mozilla Add-ons package.

Firefox uses standard capture: semantic actions, navigation, visual evidence, console errors, privacy settings and local review/export. Enhanced network capture is disabled in the popup and omitted from the manifest. Artifacts explicitly report that API metadata and response bodies are unavailable. Screenshot availability depends on browser permissions and the recorded tab being active; review warnings if a screenshot cannot be taken.

The build declares Firefox 128+ for the required scripting API. Automated extension tests use the standard Firefox version pinned by Puppeteer in the lockfile, not every version back to that minimum. Playwright’s separate Firefox build remains the replay engine.

```sh
npm run test:firefox:install
TRACECASE_FIREFOX_CAPTURE=1 npm run test:built
```

CI installs the pinned standard Firefox and runs real temporary-add-on capture, navigation, privacy, console, review, ZIP and replay checks on Node 22 and 24. The test-only `--remote-allow-system-access` flag permits automation of extension pages in a disposable profile; it is not required for normal installation. Firefox’s BiDi extension-page load events are inconsistent, so the harness validates the rendered document after navigation.

Implementation references: [WXT browser APIs](https://wxt.dev/guide/essentials/extension-apis), [browser targets](https://wxt.dev/guide/essentials/target-different-browsers.html), and [Firefox CustomEvent boundaries](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).

Safari capture still requires packaging and platform testing. Service workers, frames, shadow DOM, authentication state and timing-sensitive apps require broader validation across engines.
