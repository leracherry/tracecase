import { chromium, type Page, type Locator } from "playwright";
import { createHash } from "node:crypto";
import {
  installNetworkReplay,
  validateNetworkOptions,
  type NetworkOptions,
  type NetworkCoverage,
} from "../../network-fixtures/src/index.js";
import {
  artifactSchema,
  locatorSchema,
  type Artifact,
  type Candidate,
  type Step,
} from "../../schema/src/index.js";
import { redactText, redactUrl } from "../../redaction/src/index.js";

export type Attempt = {
  candidate: Candidate;
  state: "missing" | "hidden" | "ambiguous" | "matched";
  matches: number;
};
export type StepResult = {
  step: number;
  action: Step["type"];
  status: "passed" | "diverged";
  durationMs: number;
  attempts: Attempt[];
  selected?: Candidate;
  repaired?: boolean;
  message?: string;
};
export type Repair = { step: number; candidate: Candidate };
export type ReplayReport = {
  format: "tracecase-replay-report";
  version: "1.1";
  artifactSha256: string;
  title: string;
  startedAt: string;
  durationMs: number;
  targetUrl: string;
  network: "live" | "recorded";
  coverage?: NetworkCoverage;
  mode: "reproduce" | "verify";
  status:
    | "completed"
    | "reproduced"
    | "verified"
    | "diverged"
    | "network-diverged"
    | "assertion-failed"
    | "error";
  steps: StepResult[];
  repairs: Repair[];
  console: { level: "error" | "warning"; message: string; time: number }[];
  assertion?: { expectedText: string; passed: boolean };
  message?: string;
};
export type RepairRequest = {
  step: number;
  action: Step["type"];
  attempts: Attempt[];
  suggestions: Candidate[];
};
export type ReplayOptions = NetworkOptions & {
  url?: string;
  headed?: boolean;
  verify?: boolean;
  timeoutMs?: number;
  onStep?: (step: StepResult) => void;
  repair?: (request: RepairRequest) => Promise<Candidate | undefined>;
};
export class ReplayDivergence extends Error {
  constructor(public result: StepResult) {
    super(result.message);
    this.name = "ReplayDivergence";
  }
}
export const safeText = (text: string) =>
  redactText(text)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .slice(0, 8192);
const safeCandidate = (candidate: Candidate): Candidate =>
  candidate.kind === "role"
    ? { ...candidate, name: safeText(candidate.name) }
    : { ...candidate, value: safeText(candidate.value) };
export function resolveCandidate(page: Page, candidate: Candidate): Locator {
  switch (candidate.kind) {
    case "testId":
      return page.getByTestId(candidate.value);
    case "role":
      return page.getByRole(candidate.role, {
        name: candidate.name,
        exact: true,
      });
    case "label":
      return page.getByLabel(candidate.value, { exact: true });
    case "placeholder":
      return page.getByPlaceholder(candidate.value, { exact: true });
  }
}
export function targetUrl(entryUrl: string, baseUrl?: string): string {
  const entry = new URL(entryUrl);
  if (
    !["http:", "https:"].includes(entry.protocol) ||
    entry.username ||
    entry.password
  )
    throw new Error("Replay destinations must be HTTP(S) without credentials");
  if (!baseUrl) return entry.href;
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new Error("Replay URL must be HTTP(S) without credentials");
  return new URL(entry.pathname + entry.search, base.origin).href;
}
function timeout(options: ReplayOptions): number {
  const value = options.timeoutMs ?? 5000;
  if (!Number.isInteger(value) || value < 100 || value > 60000)
    throw new Error("Timeout must be an integer between 100 and 60000 ms");
  return value;
}
async function choose(page: Page, candidates: Candidate[], timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let attempts: Attempt[] = [];
  do {
    attempts = [];
    for (const candidate of candidates) {
      const locator = resolveCandidate(page, candidate);
      const matches = await locator.count();
      const state =
        matches === 0
          ? "missing"
          : matches > 1
            ? "ambiguous"
            : (await locator.isVisible())
              ? "matched"
              : "hidden";
      attempts.push({ candidate: safeCandidate(candidate), matches, state });
      if (state === "matched") return { locator, candidate, attempts };
    }
    if (Date.now() < deadline)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(50, deadline - Date.now())),
      );
  } while (Date.now() < deadline);
  return { locator: undefined, candidate: undefined, attempts };
}
/** Suggestions are semantic and verified unique/visible before a human can choose them. */
export async function suggestLocators(page: Page): Promise<Candidate[]> {
  const raw = await page
    .locator(
      "button,a,input:not([type=password]):not([type=hidden]),textarea,select,[role=button]",
    )
    .evaluateAll((elements) =>
      elements.slice(0, 100).flatMap((el) => {
        if (el.closest("[data-private]")) return [];
        const candidates: unknown[] = [];
        const testId = el.getAttribute("data-testid");
        if (testId) candidates.push({ kind: "testId", value: testId });
        const label =
          el.getAttribute("aria-label") ||
          (el.getAttribute("aria-labelledby") || "")
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim())
            .filter(Boolean)
            .join(" ") ||
          (el as HTMLInputElement).labels?.[0]?.textContent?.trim();
        const role =
          el.getAttribute("role") ||
          (
            {
              BUTTON: "button",
              A: "link",
              SELECT: "combobox",
              TEXTAREA: "textbox",
              INPUT:
                (el as HTMLInputElement).type === "checkbox"
                  ? "checkbox"
                  : (el as HTMLInputElement).type === "radio"
                    ? "radio"
                    : "textbox",
            } as Record<string, string>
          )[el.tagName];
        const name =
          label ||
          (["button", "link"].includes(role)
            ? el.textContent?.trim()
            : undefined);
        if (role && name) candidates.push({ kind: "role", role, name });
        if (label) candidates.push({ kind: "label", value: label });
        const placeholder = el.getAttribute("placeholder");
        if (placeholder)
          candidates.push({ kind: "placeholder", value: placeholder });
        return candidates;
      }),
    );
  const suggestions: Candidate[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = locatorSchema.safeParse(item);
    if (!parsed.success) continue;
    const key = JSON.stringify(parsed.data);
    if (key !== JSON.stringify(safeCandidate(parsed.data)) || seen.has(key))
      continue;
    seen.add(key);
    const locator = resolveCandidate(page, parsed.data);
    if ((await locator.count()) === 1 && (await locator.isVisible()))
      suggestions.push(parsed.data);
    if (suggestions.length === 20) break;
  }
  return suggestions;
}
export async function execute(
  page: Page,
  artifact: Artifact,
  baseUrl?: string,
  options: ReplayOptions = {},
): Promise<StepResult[]> {
  const wait = timeout(options);
  const results: StepResult[] = [];
  page.setDefaultTimeout(wait);
  page.setDefaultNavigationTimeout(wait);
  await page.goto(targetUrl(artifact.entryUrl, baseUrl));
  for (const [index, step] of artifact.steps.entries()) {
    const started = Date.now();
    const result: StepResult = {
      step: index + 1,
      action: step.type,
      status: "passed",
      durationMs: 0,
      attempts: [],
    };
    try {
      if (step.type === "navigation") {
        const expected = targetUrl(
          new URL(step.url, artifact.entryUrl).href,
          baseUrl,
        );
        if (step.mode === "document" && page.url() !== expected)
          await page.goto(expected);
        else await page.waitForURL(expected, { timeout: wait });
      } else {
        if (step.type === "fill" && step.redacted)
          throw new Error(
            "requires a private value; update a local copy before replay",
          );
        let selection = await choose(page, step.target, wait);
        result.attempts = selection.attempts;
        if (!selection.locator && options.repair) {
          const candidate = await options.repair({
            step: index + 1,
            action: step.type,
            attempts: selection.attempts,
            suggestions: await suggestLocators(page),
          });
          if (candidate) {
            const valid = locatorSchema.parse(candidate);
            selection = await choose(page, [valid], wait);
            result.attempts.push(...selection.attempts);
            if (selection.locator) result.repaired = true;
          }
        }
        if (!selection.locator)
          throw new Error("no unique visible semantic target");
        result.selected = safeCandidate(selection.candidate!);
        const locator = selection.locator;
        // Never retry an action after it starts: a click may have already changed app state.
        try {
          if (step.type === "click") await locator.click();
          else if (step.type === "fill") await locator.fill(step.value);
          else if (step.type === "select")
            await locator.selectOption(step.value);
          else await locator.press(step.value);
        } catch {
          throw new Error(
            `${step.type} could not execute; action was not retried`,
          );
        }
      }
    } catch (error) {
      result.status = "diverged";
      const reason =
        step.type === "navigation"
          ? "navigation did not reach the recorded destination"
          : error instanceof Error
            ? error.message
            : "action failed";
      result.message = `Replay diverged at step ${index + 1}: ${safeText(reason)}`;
    }
    result.durationMs = Date.now() - started;
    results.push(result);
    options.onStep?.(result);
    if (result.status === "diverged") throw new ReplayDivergence(result);
  }
  return results;
}
export async function replayWithReport(
  input: Artifact,
  options: ReplayOptions = {},
): Promise<ReplayReport> {
  const artifact = artifactSchema.parse(input);
  validateNetworkOptions(options);
  const wait = timeout(options);
  const started = Date.now();
  const destination = targetUrl(artifact.entryUrl, options.url);
  const report: ReplayReport = {
    format: "tracecase-replay-report",
    version: "1.1",
    artifactSha256: createHash("sha256")
      .update(JSON.stringify(artifact))
      .digest("hex"),
    title: safeText(artifact.title),
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    targetUrl: redactUrl(destination),
    network: options.network || "live",
    mode: options.verify ? "verify" : "reproduce",
    status: "error",
    steps: [],
    repairs: [],
    console: [],
  };
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    if (options.verify && !artifact.failure)
      throw new Error("verify requires recorded expected behavior");
    browser = await chromium.launch({ headless: !options.headed });
    const context = await browser.newContext({
      viewport: artifact.viewport,
      serviceWorkers: options.network === "recorded" ? "block" : "allow",
    });
    if (options.network === "recorded")
      report.coverage = await installNetworkReplay(
        context,
        artifact,
        destination,
        options,
      );
    const page = await context.newPage();
    const recordConsole = (level: "error" | "warning", message: string) => {
      if (report.console.length < 200)
        report.console.push({
          level,
          message: safeText(message),
          time: Date.now() - started,
        });
    };
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        recordConsole(message.type() as "error" | "warning", message.text());
    });
    page.on("pageerror", (error) => recordConsole("error", error.message));
    await execute(page, artifact, options.url, {
      ...options,
      onStep: (step) => {
        report.steps.push(step);
        if (step.repaired && step.selected)
          report.repairs.push({ step: step.step, candidate: step.selected });
        options.onStep?.(step);
      },
    });
    if (artifact.failure) {
      const expectedText = options.verify
        ? artifact.failure.expectedText
        : artifact.failure.observedText;
      report.assertion = {
        expectedText: safeText(expectedText),
        passed: false,
      };
      try {
        await page
          .getByText(expectedText, { exact: true })
          .waitFor({ state: "visible", timeout: wait });
        report.assertion.passed = true;
        report.status = options.verify ? "verified" : "reproduced";
      } catch {
        report.status = "assertion-failed";
        report.message =
          "Actions completed, but the selected failure/expected-outcome text was not uniquely visible";
      }
    } else report.status = "completed";
    if (options.network === "recorded") {
      // Observe late requests from the completed interaction, with a bounded quiet period.
      await page
        .waitForLoadState("networkidle", { timeout: Math.min(wait, 2000) })
        .catch(() => {});
    }
  } catch (error) {
    report.status = error instanceof ReplayDivergence ? "diverged" : "error";
    report.message =
      error instanceof ReplayDivergence
        ? error.message
        : "Replay could not start or navigate. Check the target URL, browser installation, and timeout.";
    if (options.verify && !artifact.failure)
      report.message = "verify requires recorded expected behavior";
  } finally {
    await browser?.close();
    if (
      report.coverage &&
      (report.coverage.aborted || report.coverage.errors)
    ) {
      report.status = "network-diverged";
      report.message =
        "Recorded API replay encountered blocked requests or routing errors. Inspect network coverage or configure explicit live exceptions.";
    }
    report.durationMs = Date.now() - started;
  }
  return report;
}
export function repairArtifact(
  artifact: Artifact,
  repairs: Repair[],
): Artifact {
  const copy = structuredClone(artifact);
  for (const repair of repairs) {
    const step = copy.steps[repair.step - 1];
    if (!step || step.type === "navigation")
      throw new Error("Invalid repair step");
    const candidate = locatorSchema.parse(repair.candidate);
    step.target = [
      candidate,
      ...step.target.filter(
        (item) => JSON.stringify(item) !== JSON.stringify(candidate),
      ),
    ].slice(0, 8);
  }
  return artifactSchema.parse(copy);
}
export function reportSummary(report: ReplayReport): string {
  return {
    completed: "COMPLETED (no failure assertion recorded)",
    reproduced: "FAILURE REPRODUCED",
    verified: "VERIFIED",
    diverged: "REPLAY DIVERGED",
    "assertion-failed": "ASSERTION FAILED",
    "network-diverged": "NETWORK DIVERGED",
    error: "REPLAY ERROR",
  }[report.status];
}
/** Compatibility API for existing consumers. Detailed callers should use replayWithReport. */
export async function replay(artifact: Artifact, options: ReplayOptions = {}) {
  const report = await replayWithReport(artifact, options);
  if (
    ["diverged", "network-diverged", "assertion-failed", "error"].includes(
      report.status,
    )
  )
    throw new Error(report.message || reportSummary(report));
  return reportSummary(report);
}
