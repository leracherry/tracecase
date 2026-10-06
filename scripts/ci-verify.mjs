import { appendFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
const env = process.env;
if (!["expected", "observed"].includes(env.TRACECASE_ASSERTION))
  throw new Error("Assertion must be expected or observed");
if (!["live", "recorded"].includes(env.TRACECASE_NETWORK))
  throw new Error("Network must be recorded or live");
if (!env.TRACECASE_ARTIFACT || !env.TRACECASE_BASE_URL)
  throw new Error("Provide artifact and base-url");
const report = join(env.RUNNER_TEMP, "tracecase-" + randomUUID() + ".json");
await appendFile(env.GITHUB_OUTPUT, `report=${report}\n`);
const child = spawn(
  process.execPath,
  [
    resolve(env.TRACECASE_ACTION_ROOT, "dist/cli/src/index.js"),
    env.TRACECASE_ASSERTION === "expected" ? "verify" : "run",
    resolve(env.GITHUB_WORKSPACE, env.TRACECASE_ARTIFACT),
    "--url",
    env.TRACECASE_BASE_URL,
    "--network",
    env.TRACECASE_NETWORK,
    "--report",
    report,
  ],
  { stdio: "inherit" },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
