import { defineContentScript } from "wxt/utils/define-content-script";
import { record } from "rrweb";
import { startCapture } from "../../../packages/capture/src/index.js";
import {
  PRIVATE_SELECTOR,
  parsePrivacyRules,
  defaultPrivacyRules,
  customPrivateSelector,
  type PrivacyRules,
  redactText,
  redactVisual,
} from "../../../packages/redaction/src/index.js";
export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main() {
    if (window.top !== window) return;
    let stopActions: (() => void) | undefined,
      stopVisual: (() => void) | undefined,
      overlay: HTMLElement | undefined,
      timer: ReturnType<typeof setInterval> | undefined;
    let rows: { kind: string; value: unknown }[] = [],
      excludedInputs = 0,
      started = 0;
    let rules: PrivacyRules = defaultPrivacyRules;
    let sending = Promise.resolve();
    const send = (message: unknown) =>
      chrome.runtime.sendMessage(message).then((reply) => {
        if (reply?.error) throw new Error(reply.error);
        return reply?.value;
      });
    const flush = () => {
      const batch = rows.splice(0, 50);
      const excluded = excludedInputs;
      excludedInputs = 0;
      if (!batch.length && !excluded) return sending;
      sending = sending
        .then(() =>
          send({ type: "batch", rows: batch, excludedInputs: excluded }),
        )
        .catch(() => {
          if (overlay)
            overlay.dataset.captureWarning = "Evidence persistence failed";
        });
      return sending;
    };
    const event = (type: string, message: string) =>
      rows.push({
        kind: "event",
        value: {
          type,
          time: Math.max(0, Date.now() - started),
          message: redactText(message, rules).slice(0, 8192),
        },
      });
    const consoleEvent = (raw: Event) => {
      if (!stopActions) return;
      const detail = (raw as CustomEvent).detail;
      if (
        detail &&
        ["console", "error"].includes(detail.type) &&
        typeof detail.message === "string"
      )
        event(detail.type, detail.message);
    };
    window.addEventListener("tracecase-console", consoleEvent);
    const stop = async () => {
      stopActions?.();
      stopVisual?.();
      stopActions = undefined;
      stopVisual = undefined;
      if (timer) clearInterval(timer);
      overlay?.remove();
      while (rows.length) await flush();
      await flush();
    };
    function begin(time: number, policy: unknown) {
      if (stopActions) return;
      rules = parsePrivacyRules(policy);
      started = time;
      stopActions = startCapture(
        (step) => rows.push({ kind: "step", value: step }),
        (message) => event("gap", message),
        () => excludedInputs++,
        started,
        rules,
      );
      stopVisual = record({
        emit: (visual) =>
          rows.push({ kind: "visual", value: redactVisual(visual, 0, rules) }),
        blockSelector: [
          PRIVATE_SELECTOR,
          "[data-tracecase-ignore],iframe,video,audio,canvas",
          customPrivateSelector(rules),
        ]
          .filter(Boolean)
          .join(","),
        maskAllInputs: true,
        maskTextSelector: "[data-private]",
        inlineStylesheet: false,
        collectFonts: false,
        recordCanvas: false,
        recordCrossOriginIframes: false,
        sampling: { mousemove: false, scroll: 250 },
      });
      void send({
        type: "environment",
        environment: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        width: innerWidth,
        height: innerHeight,
      });
      overlay = document.createElement("div");
      overlay.dataset.tracecaseIgnore = "";
      overlay.style.cssText =
        "position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#0d252b;color:#49dcbc;padding:12px;border-radius:12px;font:14px system-ui;display:flex;gap:12px;box-shadow:0 4px 24px #0004;";
      const label = document.createElement("span");
      label.textContent = "● Recording";
      overlay.append(label);
      for (const [name, type] of [
        ["Mark bug", "mark"],
        ["Stop", "stop"],
      ]) {
        const button = document.createElement("button");
        button.textContent = name || "";
        button.style.cssText =
          "font:inherit;cursor:pointer;padding:6px 10px;border:1px solid #49dcbc55;border-radius:8px;background:#163940;color:#49dcbc";
        button.onclick = async () => {
          if (type === "stop") {
            await stop();
            await send({ type });
          } else {
            await flush();
            await send({ type });
          }
        };
        overlay.append(button);
      }
      document.documentElement.append(overlay);
      timer = setInterval(() => {
        label.textContent = `● REC ${Math.floor((Date.now() - started) / 1000)}s`;
        void flush();
      }, 250);
    }
    let mask: HTMLStyleElement | undefined;
    chrome.runtime.onMessage.addListener((message, _sender, reply) => {
      if (message.type === "start") {
        try {
          begin(message.started, message.rules);
          reply({ ok: true });
        } catch {
          reply({
            error:
              "Privacy rules could not be applied. Recording was not started.",
          });
        }
      } else if (message.type === "stop") {
        void stop().then(() => reply({ ok: true }));
        return true;
      } else if (message.type === "mask") {
        mask = document.createElement("style");
        mask.dataset.tracecaseIgnore = "";
        mask.textContent =
          'input,textarea,select{color:transparent!important;text-shadow:none!important} [data-private],input[type=password],input[autocomplete^="cc-"]{visibility:hidden!important}' +
          (customPrivateSelector(rules)
            ? `${customPrivateSelector(rules)}{opacity:0!important}`
            : "");
        document.documentElement.append(mask);
        reply({ ok: true });
      } else if (message.type === "unmask") {
        mask?.remove();
        reply({ ok: true });
      }
    });
    void send({ type: "resume" })
      .then((result) => {
        if (result?.started) begin(result.started, result.rules);
      })
      .catch(() => {});
    window.addEventListener("pagehide", () => {
      void flush();
    });
  },
});
