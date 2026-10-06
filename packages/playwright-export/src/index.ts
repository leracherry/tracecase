import {
  artifactSchema,
  httpUrl,
  type Artifact,
  type Candidate,
} from "../../schema/src/index.js";
import { fixturePlan } from "../../network-fixtures/src/matching.js";
import { recordedRuntime } from "./runtime.generated.js";
export type ExportOptions = {
  url?: string;
  assertion?: "expected" | "observed";
  network?: "live" | "recorded";
  name?: string;
};
export type ExportBundle = {
  files: { name: string; content: string }[];
  warnings: string[];
};
const quote = (value: string) =>
  JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
function locator(candidate: Candidate) {
  if (candidate.kind === "role")
    return `page.getByRole(${quote(candidate.role)}, { name: ${quote(candidate.name)}, exact: true })`;
  if (candidate.kind === "testId")
    return `page.getByTestId(${quote(candidate.value)})`;
  return `page.${candidate.kind === "label" ? "getByLabel" : "getByPlaceholder"}(${quote(candidate.value)}, { exact: true })`;
}
export function exportPlaywright(
  input: Artifact,
  options: ExportOptions = {},
): ExportBundle {
  const artifact = artifactSchema.parse(input),
    mode = options.assertion ?? "expected",
    network = options.network ?? "live";
  if (!["expected", "observed"].includes(mode))
    throw new Error("Assertion must be expected or observed");
  if (!["live", "recorded"].includes(network))
    throw new Error("Network must be live or recorded");
  if (!artifact.failure)
    throw new Error(
      "Add observed failure and expected behavior before exporting a test.",
    );
  if (artifact.steps.some((step) => step.type === "fill" && step.redacted))
    throw new Error(
      "A recorded input was private. Supply that value in a reviewed local copy before exporting.",
    );
  const baseURL = options.url ?? "http://localhost:5173";
  httpUrl.parse(baseURL);
  const name = options.name ?? "recording";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(name))
    throw new Error(
      "Use a simple test filename: letters, numbers, hyphens, and underscores.",
    );
  if (network === "recorded" && !fixturePlan(artifact).eligible)
    throw new Error(
      "No usable recorded API responses. Choose live networking or capture responses first.",
    );
  const warnings = [
    "Review the generated locators and data before committing. The first recorded semantic locator is used for each action.",
  ];
  if (network === "recorded")
    warnings.push(
      "Historical responses may preserve the failure; review fixtures when asserting expected behavior. Unmatched API requests fail the test.",
    );
  const lines = [`import { test, expect } from "@playwright/test";`];
  if (network === "recorded")
    lines.push(
      `import { readFileSync } from "node:fs";`,
      `import { installNetworkReplay } from "./${name}.network.mjs";`,
    );
  lines.push(
    "",
    `const baseURL = process.env.TRACECASE_BASE_URL || ${quote(baseURL)};`,
    "",
    "function appURL(recordedURL: string): string {",
    "  const url = new URL(recordedURL);",
    "  const base = new URL(baseURL);",
    '  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {',
    '    throw new Error("Use an HTTP(S) base URL without credentials");',
    "  }",
    "  url.protocol = base.protocol;",
    "  url.host = base.host;",
    "  return url.href;",
    "}",
    "",
    `test.use({ viewport: ${JSON.stringify(artifact.viewport)}${network === "recorded" ? ', serviceWorkers: "block"' : ""} });`,
    "",
    `test(${quote(artifact.title + " — " + (mode === "expected" ? "expected behavior" : "recorded failure"))}, async ({ page${network === "recorded" ? ", context" : ""} }) => {`,
  );
  if (network === "recorded")
    lines.push(
      `  const recording = JSON.parse(readFileSync(new URL("./${name}.fixtures.json", import.meta.url), "utf8"));`,
      `  const coverage = await installNetworkReplay(context, recording, appURL(recording.entryUrl), { network: "recorded" });`,
    );
  lines.push(`  await page.goto(appURL(${quote(artifact.entryUrl)}));`);
  for (const step of artifact.steps) {
    if (step.type === "navigation") {
      if (step.mode === "history")
        lines.push(
          `  await expect(page).toHaveURL(appURL(${quote(step.url)}));`,
        );
      else
        lines.push(
          `  if (page.url() !== appURL(${quote(step.url)})) {`,
          `    await page.goto(appURL(${quote(step.url)}));`,
          "  }",
        );
    } else {
      const method = {
        click: "click",
        fill: "fill",
        select: "selectOption",
        key: "press",
      }[step.type];
      lines.push(
        `  await ${locator(step.target[0]!)}.${method}(${step.type === "click" ? "" : quote(step.value)});`,
      );
    }
  }
  lines.push(
    "",
    `  await expect(page.getByText(${quote(mode === "expected" ? artifact.failure.expectedText : artifact.failure.observedText)}, { exact: true })).toBeVisible();`,
  );
  if (network === "recorded")
    lines.push(
      '  await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});',
      '  expect(coverage.aborted, "Unmatched API requests").toBe(0);',
      '  expect(coverage.errors, "API routing errors").toBe(0);',
    );
  lines.push("});", "");
  const files = [{ name: `${name}.spec.ts`, content: lines.join("\n") }];
  if (network === "recorded")
    files.push(
      {
        name: `${name}.fixtures.json`,
        content:
          JSON.stringify(
            {
              version: "0.2",
              entryUrl: artifact.entryUrl,
              evidence: {
                network:
                  artifact.version === "0.2" ? artifact.evidence.network : [],
              },
            },
            null,
            2,
          ) + "\n",
      },
      {
        name: `${name}.network.mjs`,
        content:
          "// Generated TraceCase recorded-network helper. MIT licensed.\n" +
          recordedRuntime,
      },
      {
        name: `${name}.network.d.mts`,
        content:
          'import type { BrowserContext } from "@playwright/test";\nexport declare function installNetworkReplay(context: BrowserContext, recording: unknown, destination: string, options: { network: "recorded" }): Promise<{ aborted: number; errors: number }>;\n',
      },
    );
  return { files, warnings };
}
