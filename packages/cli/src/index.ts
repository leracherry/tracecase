#!/usr/bin/env node
import { readFile, writeFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { chromium } from "playwright";
import { serializeArtifact, type Artifact } from "../../schema/src/index.js";
import { attachRecorder } from "../../recorder/src/index.js";
import {
  unpackArtifact,
  packArtifact,
  MAX_PACKED_BYTES,
} from "../../artifact/src/index.js";
import { openViewer } from "./viewer.js";
import {
  replayWithReport,
  reportSummary,
  repairArtifact,
  safeText,
} from "../../replay/src/index.js";
import { applyPlugins } from "../../plugins/src/index.js";
import { artifactContext, issueMarkdown } from "../../context/src/index.js";
import { loadPlugins, writeTest, editorLink } from "./exports.js";
import { serveArtifact } from "../../mcp/src/index.js";
import { promptRepair } from "./repair.js";
const help = `TraceCase — a bug is a runnable artifact.
  record <url> --out <file> [--title <title>]
  open <file> [--no-browser]
  inspect <file>
  validate <file>
  run <file> [--url <base-url>] [--headed] [--report <file>] [--json]
  run <file> --repair [--save-repaired <new-file>] [--timeout-ms <ms>]
  run <file> --network recorded [--unmatched abort|live] [--passthrough <URL-glob>]
  verify <file> [--url <base-url>] [--browser chromium|firefox|webkit]
  test <file> --out <name.spec.ts> [--assertion expected|observed] [--network live|recorded]
  context <file> [--out <file>]
  issue <file> [--out <file>]
  mcp <file>
  Optional: --plugin <local-module.mjs> (repeatable); test --editor vscode|cursor
Record opens Chromium. Reproduce the bug, then press Enter in this terminal.
V0 captures top-frame click/fill/select actions. No account or backend required.`;
async function main() {
  const [command, arg, ...args] = process.argv.slice(2);
  if (command === "--version") {
    const { version } = JSON.parse(
      await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
    );
    console.log(version);
    return;
  }
  if (!command || command === "--help" || arg === "--help") {
    console.log(help);
    return;
  }
  const passthrough: string[] = [],
    pluginPaths: string[] = [];
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--headed") opts.headed = true;
    else if (flag === "--repair") opts.repair = true;
    else if (flag === "--json") opts.json = true;
    else if (flag === "--no-browser") opts.noBrowser = true;
    else if (
      flag === "--plugin" &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      pluginPaths.push(args[++i]);
    else if (
      flag === "--passthrough" &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      passthrough.push(args[++i]);
    else if (
      [
        "--url",
        "--out",
        "--title",
        "--report",
        "--save-repaired",
        "--timeout-ms",
        "--network",
        "--unmatched",
        "--assertion",
        "--editor",
        "--browser",
      ].includes(flag) &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      opts[flag.slice(2)] = args[++i];
    else throw new Error(`Unknown or incomplete option: ${flag}`);
  }
  if (!arg) throw new Error("Missing URL or artifact path");
  const allowed: Record<string, string[]> = {
    record: ["out", "title"],
    open: ["noBrowser"],
    inspect: [],
    validate: [],
    context: ["out"],
    issue: ["out"],
    mcp: [],
    test: ["out", "url", "network", "assertion", "editor"],
    run: [
      "url",
      "headed",
      "report",
      "json",
      "repair",
      "save-repaired",
      "timeout-ms",
      "network",
      "unmatched",
      "browser",
    ],
    verify: [
      "url",
      "headed",
      "report",
      "json",
      "repair",
      "save-repaired",
      "timeout-ms",
      "network",
      "unmatched",
      "browser",
    ],
  };
  if (!allowed[command]) throw new Error(`Unknown command: ${command}`);
  for (const key of Object.keys(opts))
    if (!allowed[command]!.includes(key))
      throw new Error(`Option --${key} is not supported by ${command}`);
  if (passthrough.length && !["run", "verify"].includes(command))
    throw new Error("--passthrough is supported by run and verify");

  const plugins = await loadPlugins(pluginPaths);
  if (command === "record") {
    if (typeof opts.out !== "string")
      throw new Error("record requires --out <file>");
    const url = new URL(arg);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Use an HTTP(S) URL without credentials");
    if (!process.stdin.isTTY)
      throw new Error("Recording requires an interactive terminal");
    const browser = await chromium.launch({ headless: false });
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
      });
      const steps = await attachRecorder(page);
      await page.goto(url.href);
      await rl.question(
        "Recording. Reproduce the bug, then press Enter to stop. ",
      );
      await page.evaluate(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );
      const observedText = await rl.question(
        "Exact visible failure text (blank to skip): ",
      );
      const expectedText = observedText
        ? await rl.question("Exact text expected after the fix: ")
        : "";
      const artifact: Artifact = {
        format: "tracecase",
        version: "0.1",
        title:
          typeof opts.title === "string" ? opts.title : "Browser reproduction",
        createdAt: new Date().toISOString(),
        entryUrl: url.href,
        viewport: { width: 1280, height: 800 },
        steps: [...steps],
        ...(observedText ? { failure: { observedText, expectedText } } : {}),
      };
      await writeFile(
        opts.out,
        serializeArtifact(await applyPlugins(artifact, plugins)),
        { flag: "wx" },
      );
      console.log(`Saved ${steps.length} actions to ${opts.out}`);
    } finally {
      rl.close();
      await browser.close();
    }
    return;
  }
  if (
    ![
      "open",
      "inspect",
      "run",
      "verify",
      "test",
      "context",
      "issue",
      "mcp",
      "validate",
    ].includes(command)
  )
    throw new Error(`Unknown command: ${command}`);
  if ((await stat(arg)).size > MAX_PACKED_BYTES)
    throw new Error("Artifact exceeds 8 MiB limit");
  const data = await readFile(arg);
  const artifact = await applyPlugins(await unpackArtifact(data), plugins);
  if (command === "mcp") {
    await serveArtifact(artifact);
    return;
  }
  if (command === "context" || command === "issue") {
    const output =
      command === "context"
        ? JSON.stringify(artifactContext(artifact), null, 2) + "\n"
        : issueMarkdown(artifact);
    if (typeof opts.out === "string")
      await writeFile(opts.out, output, { flag: "wx" });
    else process.stdout.write(output);
    return;
  }
  if (command === "test") {
    if (typeof opts.out !== "string")
      throw new Error("test requires --out <name.spec.ts>");
    if (
      opts.editor !== undefined &&
      !["vscode", "cursor"].includes(String(opts.editor))
    )
      throw new Error("Editor must be vscode or cursor");
    const result = await writeTest(artifact, opts.out, {
      url: opts.url as string | undefined,
      network: opts.network as "live" | "recorded" | undefined,
      assertion: opts.assertion as "expected" | "observed" | undefined,
    });
    for (const path of result.paths) console.log(`Saved ${path}`);
    for (const warning of result.warnings) console.log(warning);
    if (opts.editor)
      console.log(
        editorLink(result.paths[0]!, opts.editor as "vscode" | "cursor"),
      );
    return;
  }
  if (command === "open") {
    await openViewer(plugins.length ? await packArtifact(artifact) : data, {
      launch: opts.noBrowser !== true,
    });
    return;
  }
  if (command === "validate") {
    console.log(
      `Valid TraceCase ${artifact.version}: ${artifact.steps.length} steps`,
    );
    return;
  }
  if (command === "inspect") {
    console.log(JSON.stringify(artifact, null, 2));
    return;
  }
  if (command === "verify" && !artifact.failure)
    throw new Error("verify requires recorded expected behavior");
  if (opts.repair && !process.stdin.isTTY)
    throw new Error("--repair requires an interactive terminal");
  if (opts["save-repaired"] && !opts.repair)
    throw new Error("--save-repaired requires --repair");
  if (opts["save-repaired"] && typeof opts["save-repaired"] !== "string")
    throw new Error("Provide a new artifact path");
  if (
    opts.network !== undefined &&
    !["live", "recorded"].includes(String(opts.network))
  )
    throw new Error("--network must be live or recorded");
  if (
    opts.unmatched !== undefined &&
    !["abort", "live"].includes(String(opts.unmatched))
  )
    throw new Error("--unmatched must be abort or live");
  if (
    opts.browser !== undefined &&
    !["chromium", "firefox", "webkit"].includes(String(opts.browser))
  )
    throw new Error("Browser must be chromium, firefox, or webkit");
  const report = await replayWithReport(artifact, {
    plugins,
    browser: opts.browser as "chromium" | "firefox" | "webkit" | undefined,
    network: opts.network as "live" | "recorded" | undefined,
    unmatched: opts.unmatched as "abort" | "live" | undefined,
    passthrough,
    url: typeof opts.url === "string" ? opts.url : undefined,
    headed: opts.headed === true || opts.repair === true,
    verify: command === "verify",
    timeoutMs:
      typeof opts["timeout-ms"] === "string"
        ? Number(opts["timeout-ms"])
        : undefined,
    repair: opts.repair ? promptRepair : undefined,
    onStep: opts.json
      ? undefined
      : (step) =>
          console.log(
            `${step.step}. ${step.action} ${step.status.toUpperCase()}${step.repaired ? " (repaired)" : step.selected ? " · " + safeText(JSON.stringify(step.selected)) : ""}`,
          ),
  });
  if (typeof opts.report === "string")
    await writeFile(opts.report, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
  if (typeof opts["save-repaired"] === "string" && report.repairs.length) {
    await writeFile(
      opts["save-repaired"],
      await packArtifact(repairArtifact(artifact, report.repairs)),
      { flag: "wx" },
    );
  }
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const entry of report.console)
      console.error(`[${entry.level}] ${entry.message}`);
    if (report.message) console.error(report.message);
    if (report.coverage)
      console.log(
        `API coverage: ${report.coverage.matched}/${report.coverage.requests} matched · ${report.coverage.passedThrough} live · ${report.coverage.aborted} blocked · ${report.coverage.unusedFixtures} unused fixtures`,
      );
    console.log(reportSummary(report));
  }
  if (
    ["diverged", "network-diverged", "assertion-failed", "error"].includes(
      report.status,
    )
  )
    process.exitCode = 1;
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "TraceCase failed");
  process.exitCode = 1;
});
