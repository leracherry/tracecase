import "./style.css";
const root = document.querySelector("#app")!;
root.innerHTML = `<div class="identity"><img src="/tracecase-logo.png" width="36" height="36" alt=""><small>TraceCase</small></div><h1>Record a runnable bug.</h1><p>Capture stays on this device. Passwords and private fields are excluded.</p><label><input type="checkbox" id="enhanced"> Enhanced network capture</label><p class="hint">Uses Chrome’s debugger permission. Chrome displays a debugging banner.</p><label><input type="checkbox" id="screenshots"> Include screenshots</label><p class="hint">Inputs are masked; other visible content may still be sensitive. Review before exporting.</p><button id="start">Start recording</button><button id="mark" hidden>Mark bug</button><button id="stop" hidden>Stop & review</button><button id="review">Review last recording</button><p id="status" role="status"></p><button id="privacy">Privacy settings</button>`;
const status = document.querySelector<HTMLElement>("#status")!;
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
  for (const id of ["enhanced", "screenshots"])
    document.querySelector<HTMLInputElement>("#" + id)!.disabled =
      !!state?.active;
  if (state?.active) {
    document.querySelector<HTMLInputElement>("#enhanced")!.checked =
      state.mode === "enhanced";
    document.querySelector<HTMLInputElement>("#screenshots")!.checked =
      !!state.screenshots;
  }
  status.dataset.error = "false";
  status.textContent = state?.active
    ? `Recording · ${state.mode}. ${state.warnings.join(" ")}`
    : "";
}
document.querySelector("#start")!.addEventListener("click", async () => {
  const button = document.querySelector<HTMLButtonElement>("#start")!;
  button.disabled = true;
  button.textContent = "Starting…";
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
    status.dataset.error = "true";
    status.textContent = String(error);
  } finally {
    button.disabled = false;
    button.textContent = "Start recording";
  }
});
for (const id of ["mark", "stop"])
  document.querySelector("#" + id)!.addEventListener("click", async () => {
    const button = document.querySelector<HTMLButtonElement>("#" + id)!;
    button.disabled = true;
    try {
      await send({ type: id });
      await refresh();
      if (id === "mark")
        status.textContent = "Bug marked. Keep recording or stop to review.";
    } catch (error) {
      status.dataset.error = "true";
      status.textContent = String(error);
    } finally {
      button.disabled = false;
    }
  });
document
  .querySelector("#review")!
  .addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("/review.html") }),
  );
void refresh().catch((error) => {
  status.dataset.error = "true";
  status.textContent = String(error);
});

document
  .querySelector("#privacy")!
  .addEventListener("click", () =>
    chrome.tabs.create({ url: chrome.runtime.getURL("/privacy.html") }),
  );
