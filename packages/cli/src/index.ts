#!/usr/bin/env node
import { readFile, writeFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { chromium } from "playwright";
import {
  parseArtifact,
  serializeArtifact,
  MAX_ARTIFACT_BYTES,
  type Artifact,
} from "../../schema/src/index.js";
import { attachRecorder } from "../../recorder/src/index.js";
import { unpackArtifact, MAX_PACKED_BYTES } from "../../artifact/src/index.js";
import { openViewer } from "./viewer.js";
import { replay } from "../../replay/src/index.js";
const help = `TraceCase — a bug is a runnable artifact.
  record <url> --out <file> [--title <title>]
  open <file> [--no-browser]
  inspect <file>
  run <file> [--url <base-url>] [--headed]
  verify <file> [--url <base-url>]
Record opens Chromium. Reproduce the bug, then press Enter in this terminal.
V0 captures top-frame click/fill/select actions. No account or backend required.`;
async function main() {
  const [command, arg, ...args] = process.argv.slice(2);
  if (!command || command === "--help") {
    console.log(help);
    return;
  }
  const opts: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--headed") opts.headed = true;
    else if (flag === "--no-browser") opts.noBrowser = true;
    else if (
      ["--url", "--out", "--title"].includes(flag) &&
      args[i + 1] &&
      !args[i + 1].startsWith("--")
    )
      opts[flag.slice(2)] = args[++i];
    else throw new Error(`Unknown or incomplete option: ${flag}`);
  }
  if (!arg) throw new Error("Missing URL or artifact path");
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
      await writeFile(opts.out, serializeArtifact(artifact), { flag: "wx" });
      console.log(`Saved ${steps.length} actions to ${opts.out}`);
    } finally {
      rl.close();
      await browser.close();
    }
    return;
  }
  if (!["open", "inspect", "run", "verify"].includes(command))
    throw new Error(`Unknown command: ${command}`);
  if ((await stat(arg)).size > MAX_PACKED_BYTES)
    throw new Error("Artifact exceeds 8 MiB limit");
  const data = await readFile(arg);
  const artifact = await unpackArtifact(data);
  if (command === "open") {
    await openViewer(data, { launch: opts.noBrowser !== true });
    return;
  }
  if (command === "inspect") {
    console.log(JSON.stringify(artifact, null, 2));
    return;
  }
  if (command === "verify" && !artifact.failure)
    throw new Error("verify requires recorded expected behavior");
  console.log(
    await replay(artifact, {
      url: typeof opts.url === "string" ? opts.url : undefined,
      headed: opts.headed === true,
      verify: command === "verify",
    }),
  );
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "TraceCase failed");
  process.exitCode = 1;
});
