# Extension permissions

- `storage`: persist session metadata and custom privacy settings locally. Evidence batches are stored in IndexedDB.
- `activeTab`: inspect the selected tab and capture opt-in standard-mode screenshots after the extension is invoked.
- `scripting`: install the console-error bridge into the recorded page’s main world. No remote code is loaded.
- HTTP(S) host access: install the idle content script and resume capture after document navigation. It records only when the user starts a session; browser-internal pages are excluded.
- Optional `debugger`: requested when the user enables enhanced capture. The debugger is attached only during a recording, with network capture enabled, and detached on stop. Chrome displays its own debugging banner. If unavailable or detached, capture continues in standard mode with visible warnings.

Standard mode captures semantic actions, visual events, console errors, and environment information. API metadata and bodies require enhanced mode. Screenshots are separately opt-in and are skipped with warnings when the recorded tab is not visible or permissions are unavailable.

The build is Chromium Manifest V3 only. Firefox and Safari are not supported.
