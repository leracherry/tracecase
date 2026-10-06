import "./style.css";
const root = document.querySelector("#app")!;
root.innerHTML = `<div class="identity"><img src="/tracecase-logo.png" width="36" height="36" alt=""><small>TRACECASE</small></div><h1>Record a runnable bug.</h1><p>Capture stays on this device. Passwords and private fields are excluded.</p><label><input type="checkbox" id="enhanced"> Enhanced network capture</label><p class="hint">Uses Chrome’s debugger permission. Chrome displays a debugging banner.</p><label><input type="checkbox" id="screenshots"> Include screenshots</label><p class="hint">Inputs are masked; other visible content may still be sensitive. Review before exporting.</p><button id="start">Start recording</button><button id="mark" hidden>Mark bug</button><button id="stop" hidden>Stop & review</button><button id="review">Review last recording</button><p id="status" role="status"></p>`;
const status = document.querySelector("#status")!;
const send = async (message: unknown) => {
  const reply = await chrome.runtime.sendMessage(message);
  if (reply?.error) throw new Error(reply.error);
  return reply?.value;
};
async function refresh() {
  const state = await send({ type: "status" });
  for (const id of ["mark", "stop"])
    document.querySelector<HTMLButtonElement>("#" + id)!.hidden =
      !state?.active;
  document.querySelector<HTMLButtonElement>("#start")!.hidden = !!state?.active;
  status.textContent = state?.active
    ? `Recording · ${state.mode}. ${state.warnings.join(" ")}`
    : "";
}
document.querySelector("#start")!.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const enhanced =
      document.querySelector<HTMLInputElement>("#enhanced")!.checked;
    if (enhanced)
      await chrome.permissions.request({ permissions: ["debugger"] });
    await send({
      type: "start",
      tabId: tab?.id,
      enhanced: enhanced,
      screenshots:
        document.querySelector<HTMLInputElement>("#screenshots")!.checked,
    });
    await refresh();
  } catch (error) {
    status.textContent = String(error);
  }
});
for (const id of ["mark", "stop"])
  document.querySelector("#" + id)!.addEventListener("click", async () => {
    try {
      await send({ type: id });
      await refresh();
    } catch (error) {
      status.textContent = String(error);
    }
  });
document
  .querySelector("#review")!
  .addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("/review.html") }),
  );
void refresh();
