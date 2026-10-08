import { browser as chrome } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import {
  artifactSchema,
  stepSchema,
  evidenceSchema,
  type Artifact,
  type Evidence,
} from "../../../packages/schema/src/index.js";
import {
  redactBody,
  defaultPrivacyRules,
  parsePrivacyRules,
  type PrivacyRules,
  redactHeaders,
  redactText,
  redactUrl,
} from "../../../packages/redaction/src/index.js";
import { clearRows, appendRows, getRows, type Row } from "../lib/store";
import { installConsoleBridge } from "../lib/console";
type Session = {
  counts: Record<Row["kind"], number>;
  tabId: number;
  active: boolean;
  started: number;
  bytes: number;
  artifact: Extract<Artifact, { version: "0.2" }>;
  screenshots: boolean;
  rules: PrivacyRules;
  pending: Record<
    string,
    { request: Evidence["network"][number]; timestamp: number }
  >;
};
const emptyEvidence = (): Evidence => ({
  environment: { userAgent: "", platform: "", language: "", timezone: "" },
  capabilities: {
    visual: true,
    console: true,
    network: false,
    bodies: false,
    screenshots: false,
    mode: "standard",
    warnings: [],
  },
  events: [],
  visual: [],
  screenshots: [],
  network: [],
  privacy: { redactions: 0, excludedInputs: 0, reviewed: false },
});
export default defineBackground(() => {
  let queue = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const load = async (): Promise<Session | undefined> =>
    (await chrome.storage.local.get("session")).session as Session | undefined;
  const save = async (session: Session) =>
    chrome.storage.local.set({ session });
  const elapsed = (s: Session) => Math.max(0, Date.now() - s.started);
  async function append(s: Session, rows: Row[]) {
    const limits = {
      step: 10000,
      event: 10000,
      visual: 20000,
      network: 2000,
      screenshot: 20,
    };
    rows = rows.filter((row) => {
      if (s.counts[row.kind] >= limits[row.kind]) {
        const warning = `${row.kind} count limit reached; additional evidence omitted`;
        if (!s.artifact.evidence.capabilities.warnings.includes(warning))
          s.artifact.evidence.capabilities.warnings.push(warning);
        return false;
      }
      s.counts[row.kind]++;
      return true;
    });
    const bytes = new TextEncoder().encode(JSON.stringify(rows)).length;
    if (s.bytes + bytes > 12 * 1024 * 1024) {
      s.artifact.evidence.capabilities.warnings.push(
        "Recording reached the 12 MiB evidence limit; further evidence is omitted.",
      );
      s.active = false;
      await save(s);
      void chrome.tabs.sendMessage(s.tabId, { type: "stop" }).catch(() => {});
      await chrome.debugger?.detach({ tabId: s.tabId }).catch(() => {});
      return;
    }
    s.bytes += bytes;
    await appendRows(rows);
    await save(s);
  }
  async function screenshot(s: Session, reason: "start" | "marker" | "stop") {
    if (!s.screenshots) return;
    try {
      const tab = await chrome.tabs.get(s.tabId);
      const active = await chrome.tabs.query({
        active: true,
        windowId: tab.windowId,
      });
      if (active[0]?.id !== s.tabId)
        throw new Error("The recorded tab must be visible");
      await chrome.tabs.sendMessage(s.tabId, { type: "mask" });
      await new Promise((resolve) => setTimeout(resolve, 60));
      const data =
        s.artifact.evidence.capabilities.mode === "enhanced"
          ? "data:image/jpeg;base64," +
            (
              (await chrome.debugger.sendCommand(
                { tabId: s.tabId },
                "Page.captureScreenshot",
                { format: "jpeg", quality: 45 },
              )) as { data: string }
            ).data
          : await chrome.tabs.captureVisibleTab(tab.windowId, {
              format: "jpeg",
              quality: 45,
            });
      await append(s, [
        { kind: "screenshot", value: { time: elapsed(s), reason, data } },
      ]);
    } catch {
      s.artifact.evidence.capabilities.warnings.push(
        `Screenshot at ${reason} unavailable`,
      );
      await save(s);
    } finally {
      await chrome.tabs
        .sendMessage(s.tabId, { type: "unmask" })
        .catch(() => {});
    }
  }
  async function stop(s: Session) {
    await chrome.scripting
      .executeScript({
        target: { tabId: s.tabId },
        world: "MAIN",
        func: () => {
          (
            window as unknown as { __tracecaseConsoleEnabled: boolean }
          ).__tracecaseConsoleEnabled = false;
        },
      })
      .catch(() => {});
    const inFlight = Object.values(s.pending).map(({ request }) => ({
      kind: "network" as const,
      value: { ...request, bodyOmitted: "Request was still in flight at stop" },
    }));
    s.pending = {};
    if (inFlight.length) await append(s, inFlight);
    await screenshot(s, "stop");
    s.active = false;
    await save(s);
    await chrome.debugger?.detach({ tabId: s.tabId }).catch(() => {});
    await chrome.tabs.create({ url: chrome.runtime.getURL("/review.html") });
  }
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    const prepare =
      message.type === "stop" &&
      sender.url?.startsWith(chrome.runtime.getURL("/"))
        ? load().then(async (s) => {
            if (s?.active)
              await chrome.tabs
                .sendMessage(s.tabId, { type: "stop" })
                .catch(() => {});
          })
        : Promise.resolve();
    prepare
      .then(() =>
        serial(async () => {
          const s = await load();
          if (s)
            s.artifact.evidence.capabilities.warnings =
              s.artifact.evidence.capabilities.warnings.slice(-90);
          const internal =
            sender.id === chrome.runtime.id &&
            sender.url?.startsWith(chrome.runtime.getURL("/"));
          if (message.type === "privacy:get" && internal)
            return parsePrivacyRules(
              (await chrome.storage.local.get("privacyRules")).privacyRules ??
                defaultPrivacyRules,
            );
          if (message.type === "privacy:save" && internal) {
            const rules = parsePrivacyRules(message.rules);
            await chrome.storage.local.set({ privacyRules: rules });
            return rules;
          }
          if (message.type === "status")
            return s
              ? {
                  tabId: s.tabId,
                  active: s.active,
                  screenshots: s.screenshots,
                  privacyRuleCount:
                    (s.rules?.fields.length || 0) +
                    (s.rules?.selectors.length || 0),
                  mode: s.artifact.evidence.capabilities.mode,
                  warnings: s.artifact.evidence.capabilities.warnings,
                }
              : null;
          if (message.type === "start" && internal) {
            if (s?.active) throw new Error("A recording is already active");
            const tab = await chrome.tabs.get(message.tabId);
            if (!tab.url || !/^https?:/.test(tab.url))
              throw new Error("Recording supports HTTP(S) pages only");
            const rules = parsePrivacyRules(
              (await chrome.storage.local.get("privacyRules")).privacyRules ??
                defaultPrivacyRules,
            );
            await clearRows();
            const session: Session = {
              counts: {
                step: 0,
                event: 0,
                visual: 0,
                network: 0,
                screenshot: 0,
              },
              tabId: message.tabId,
              active: true,
              started: Date.now(),
              bytes: 0,
              screenshots: message.screenshots === true,
              pending: {},
              rules,
              artifact: {
                format: "tracecase",
                version: "0.2",
                title: "Browser reproduction",
                createdAt: new Date().toISOString(),
                entryUrl: redactUrl(tab.url, rules),
                viewport: { width: 1280, height: 800 },
                steps: [],
                evidence: emptyEvidence(),
              },
            };
            session.artifact.evidence.capabilities.screenshots =
              session.screenshots;

            const ruleCount = rules.fields.length + rules.selectors.length;
            if (ruleCount)
              session.artifact.evidence.capabilities.warnings.push(
                `${ruleCount} custom privacy rules applied before saving evidence. Excluded interactions may require manual reproduction.`,
              );
            if (import.meta.env.BROWSER === "firefox")
              session.artifact.evidence.capabilities.warnings.push(
                "Firefox standard capture: network metadata and response bodies are unavailable.",
              );
            if (message.enhanced && import.meta.env.BROWSER !== "firefox")
              try {
                await chrome.debugger.attach({ tabId: session.tabId }, "1.3");
                await chrome.debugger.sendCommand(
                  { tabId: session.tabId },
                  "Network.enable",
                  {
                    maxTotalBufferSize: 2097152,
                    maxResourceBufferSize: 262144,
                  },
                );
                session.artifact.evidence.capabilities.network = true;
                session.artifact.evidence.capabilities.bodies = true;
                session.artifact.evidence.capabilities.mode = "enhanced";
              } catch {
                session.artifact.evidence.capabilities.warnings.push(
                  "Debugger unavailable. Standard mode: no network metadata or bodies.",
                );
                await chrome.debugger
                  ?.detach({ tabId: session.tabId })
                  .catch(() => {});
              }
            await save(session);
            try {
              const started = await chrome.tabs.sendMessage(session.tabId, {
                type: "start",
                started: session.started,
                rules,
              });
              if (started?.error) throw new Error(started.error);
              await chrome.scripting.executeScript({
                target: { tabId: session.tabId },
                world: "MAIN",
                func: installConsoleBridge,
              });
            } catch {
              session.active = false;
              await save(session);
              await chrome.debugger
                ?.detach({ tabId: session.tabId })
                .catch(() => {});
              throw new Error(
                "Reload the target page once after installing the extension, then retry",
              );
            }
            await screenshot(session, "start");
            return { ok: true };
          }
          if (!s) return null;
          const recordingTab =
            sender.tab?.id === s.tabId && sender.frameId === 0;
          if (message.type === "resume" && recordingTab && s.active) {
            await chrome.scripting
              .executeScript({
                target: { tabId: s.tabId },
                world: "MAIN",
                func: installConsoleBridge,
              })
              .catch(() => {});
            await append(s, [
              {
                kind: "step",
                value: {
                  type: "navigation",
                  mode: "document",
                  url: redactUrl(sender.url || s.artifact.entryUrl, s.rules),
                  time: elapsed(s),
                },
              },
            ]);
            return {
              started: s.started,
              rules: s.rules ?? defaultPrivacyRules,
            };
          }
          if (message.type === "batch" && recordingTab && s.active) {
            if (!Array.isArray(message.rows) || message.rows.length > 100)
              throw new Error("Invalid event batch");
            const rows: Row[] = [];
            for (const row of message.rows) {
              if (row.kind === "step")
                rows.push({ kind: "step", value: stepSchema.parse(row.value) });
              else if (row.kind === "event")
                rows.push({
                  kind: "event",
                  value: evidenceSchema.shape.events.element.parse({
                    ...row.value,
                    message: redactText(String(row.value.message), s.rules),
                  }),
                });
              else if (row.kind === "visual") {
                const value = evidenceSchema.shape.visual.element.parse(
                  row.value,
                );
                if (
                  new TextEncoder().encode(JSON.stringify(value)).length >
                  2 * 1024 * 1024
                ) {
                  s.artifact.evidence.capabilities.warnings.push(
                    "An oversized visual snapshot was omitted",
                  );
                  continue;
                }
                rows.push({ kind: "visual", value });
              }
            }
            s.artifact.evidence.privacy.excludedInputs += Number.isSafeInteger(
              message.excludedInputs,
            )
              ? Math.max(0, message.excludedInputs)
              : 0;
            await append(s, rows);
            return { ok: true };
          }
          if (message.type === "environment" && recordingTab && s.active) {
            s.artifact.evidence.environment =
              evidenceSchema.shape.environment.parse(message.environment);
            s.artifact.viewport = {
              width: Math.min(10000, Math.max(1, message.width)),
              height: Math.min(10000, Math.max(1, message.height)),
            };
            await save(s);
            return { ok: true };
          }
          if (
            message.type === "mark" &&
            (internal || recordingTab) &&
            s.active
          ) {
            await append(s, [
              {
                kind: "event",
                value: {
                  type: "marker",
                  time: elapsed(s),
                  message: "Bug marked",
                },
              },
            ]);
            await screenshot(s, "marker");
            return { ok: true };
          }
          if (
            message.type === "stop" &&
            (internal || recordingTab) &&
            s.active
          ) {
            await stop(s);
            return { ok: true };
          }
          if (message.type === "artifact" && internal) {
            const rows = await getRows();
            const artifact = structuredClone(s.artifact);
            for (const row of rows) {
              if (row.kind === "step") {
                const step = stepSchema.parse(row.value);
                const previous = artifact.steps.at(-1);
                if (
                  step.type === "fill" &&
                  previous?.type === "fill" &&
                  JSON.stringify(previous.target) ===
                    JSON.stringify(step.target)
                )
                  artifact.steps[artifact.steps.length - 1] = step;
                else artifact.steps.push(step);
              } else {
                const key = (
                  {
                    event: "events",
                    visual: "visual",
                    network: "network",
                    screenshot: "screenshots",
                  } as const
                )[row.kind];
                (artifact.evidence[key] as unknown[]).push(row.value);
              }
            }
            artifact.evidence.capabilities.screenshots =
              artifact.evidence.screenshots.length > 0;
            artifact.evidence.capabilities.visual =
              artifact.evidence.visual.some((event) => event.type === 2);
            return artifactSchema.parse(artifact);
          }
          throw new Error("Unsupported capture operation");
        }),
      )
      .then(
        (value) => reply({ value }),
        (error) =>
          reply({
            error: error instanceof Error ? error.message : "Capture failed",
          }),
      );
    return true;
  });
  let debuggerRegistered = false;
  function registerDebugger() {
    if (!chrome.debugger || debuggerRegistered) return;
    debuggerRegistered = true;
    chrome.debugger.onEvent.addListener((source, method, params) => {
      void serial(async () => {
        const s = await load();
        if (!s?.active || source.tabId !== s.tabId) return;
        s.artifact.evidence.capabilities.warnings =
          s.artifact.evidence.capabilities.warnings.slice(-90);
        const p = params as Record<string, any>;
        const now = elapsed(s);
        if (
          method === "Network.requestWillBeSent" &&
          ["Fetch", "XHR"].includes(p.type)
        ) {
          if (Object.keys(s.pending).length >= 100) {
            s.artifact.evidence.capabilities.warnings.push(
              "Concurrent request limit reached",
            );
            await save(s);
            return;
          }
          const headers = redactHeaders(p.request.headers || {}, s.rules);
          const contentType =
            Object.entries(headers).find(
              ([key]) => key.toLowerCase() === "content-type",
            )?.[1] || "";
          const requestBody = p.request.postData
            ? redactBody(p.request.postData, contentType, s.rules)
            : undefined;
          s.pending[p.requestId] = {
            timestamp: p.timestamp,
            request: {
              id: p.requestId,
              time: now,
              url: redactUrl(p.request.url, s.rules),
              method: p.request.method,
              requestHeaders: headers,
              responseHeaders: {},
              status: 0,
              duration: 0,
              ...(requestBody === undefined ? {} : { requestBody }),
            },
          };
          s.artifact.evidence.privacy.redactions +=
            JSON.stringify(headers).split("[REDACTED]").length -
            1 +
            (requestBody?.split("[REDACTED]").length || 1) -
            1;
          await save(s);
        }
        const pending = s.pending[p.requestId];
        if (!pending) return;
        if (method === "Network.responseReceived") {
          pending.request.status = p.response.status;
          pending.request.responseHeaders = redactHeaders(
            p.response.headers || {},
            s.rules,
          );
          s.artifact.evidence.privacy.redactions +=
            JSON.stringify(pending.request.responseHeaders).split("[REDACTED]")
              .length - 1;
          await save(s);
        }
        if (
          method === "Network.loadingFinished" ||
          method === "Network.loadingFailed"
        ) {
          const request = pending.request;
          request.duration = Math.max(
            0,
            (p.timestamp - pending.timestamp) * 1000,
          );
          if (method === "Network.loadingFailed")
            request.bodyOmitted = "Request failed";
          else if (p.encodedDataLength > 262144)
            request.bodyOmitted = "Body exceeds 256 KiB";
          else
            try {
              const result = (await chrome.debugger.sendCommand(
                source,
                "Network.getResponseBody",
                { requestId: p.requestId },
              )) as { body: string; base64Encoded: boolean };
              const contentType =
                Object.entries(request.responseHeaders).find(
                  ([key]) => key.toLowerCase() === "content-type",
                )?.[1] || "";
              const body = result.base64Encoded
                ? undefined
                : redactBody(result.body, contentType, s.rules);
              if (body === undefined)
                request.bodyOmitted =
                  "Only bounded JSON and form bodies are persisted";
              else {
                request.responseBody = body;
                s.artifact.evidence.privacy.redactions +=
                  body.split("[REDACTED]").length - 1;
              }
            } catch {
              request.bodyOmitted = "Response body unavailable";
            }
          delete s.pending[p.requestId];
          await append(s, [
            {
              kind: "network",
              value: evidenceSchema.shape.network.element.parse(request),
            },
          ]);
        }
      }).catch(() => {});
    });
    chrome.debugger.onDetach.addListener((source) => {
      void serial(async () => {
        const s = await load();
        if (s?.active && s.tabId === source.tabId) {
          s.artifact.evidence.capabilities.network = false;
          s.artifact.evidence.capabilities.bodies = false;
          s.artifact.evidence.capabilities.mode = "standard";
          s.artifact.evidence.capabilities.warnings.push(
            "Debugger detached; continuing in standard mode.",
          );
          await save(s);
        }
      });
    });
  }
  registerDebugger();
  chrome.permissions.onAdded.addListener(registerDebugger);
  chrome.tabs.onRemoved.addListener((tabId) => {
    void serial(async () => {
      const s = await load();
      if (s?.tabId === tabId && s.active) {
        s.active = false;
        s.artifact.evidence.capabilities.warnings.push(
          "Target tab closed; saved evidence remains available.",
        );
        await save(s);
      }
    });
  });
});
