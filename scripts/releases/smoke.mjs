import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { packArtifact } from "../../dist/artifact/src/index.js";
import { unzipSync } from "fflate";
import { createDemoServer } from "../../fixtures/demo-store/server.mjs";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const release = resolve("release");
for (const line of (await readFile(join(release, "SHA256SUMS"), "utf8"))
  .trim()
  .split("\n")) {
  const [hash, name] = line.split("  ");
  if (
    createHash("sha256")
      .update(await readFile(join(release, name)))
      .digest("hex") !== hash
  )
    throw new Error(`Checksum mismatch: ${name}`);
}
for (const kind of ["chrome", "viewer"]) {
  const files = unzipSync(
    new Uint8Array(
      await readFile(join(release, `tracecase-${kind}-${pkg.version}.zip`)),
    ),
  );
  if (!files[kind === "chrome" ? "manifest.json" : "index.html"])
    throw new Error(`${kind} archive has no entrypoint`);
  if (
    Object.keys(files).some(
      (name) => name.includes("..") || name.startsWith("/"),
    )
  )
    throw new Error("Unsafe release path");
}
const directory = await mkdtemp(join(tmpdir(), "tracecase-release-"));
let fixed = false;
const server = createDemoServer({ isFixed: () => fixed });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
try {
  await writeFile(join(directory, "package.json"), "{}");
  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(release, `tracecase-${pkg.version}.tgz`),
    ],
    { cwd: directory, stdio: "inherit" },
  );
  const cli = join(directory, "node_modules/tracecase/dist/cli/src/index.js");
  if (
    execFileSync(process.execPath, [cli, "--version"], {
      encoding: "utf8",
    }).trim() !== pkg.version
  )
    throw new Error("Packaged CLI version mismatch");
  const artifact = resolve("examples/checkout.tracecase");
  const report = join(directory, "report.json");
  // Async child: the parent must keep the demo HTTP server responsive.
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cli, "run", artifact, "--url", url, "--report", report],
      { cwd: directory, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Packaged replay exited ${code}`)),
    );
  });
  if (JSON.parse(await readFile(report, "utf8")).status !== "reproduced")
    throw new Error("Packaged replay did not reproduce demo");
  const sample = JSON.parse(await readFile(artifact, "utf8"));
  const recorded = {
    ...sample,
    version: "0.2",
    evidence: {
      environment: {
        userAgent: "test",
        platform: "test",
        language: "en",
        timezone: "UTC",
      },
      capabilities: {
        visual: false,
        console: false,
        network: true,
        bodies: true,
        screenshots: false,
        mode: "enhanced",
        warnings: [],
      },
      events: [],
      visual: [],
      screenshots: [],
      privacy: { redactions: 0, excludedInputs: 0, reviewed: true },
      network: [
        {
          id: "tax",
          time: 0,
          method: "GET",
          url: new URL("/api/tax?country=CA", sample.entryUrl).href,
          requestHeaders: {},
          responseHeaders: { "content-type": "application/json" },
          status: 500,
          duration: 0,
          responseBody: '{"error":"Tax service unavailable"}',
        },
      ],
    },
  };
  const recording = join(directory, "historical.tracecase"),
    historicalReport = join(directory, "historical.json");
  await writeFile(recording, await packArtifact(recorded));
  fixed = true;
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        cli,
        "run",
        recording,
        "--url",
        url,
        "--network",
        "recorded",
        "--report",
        historicalReport,
      ],
      { cwd: directory, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Packaged recorded replay exited ${code}`)),
    );
  });
  const historical = JSON.parse(await readFile(historicalReport, "utf8"));
  if (
    historical.status !== "reproduced" ||
    historical.coverage.matched !== 1 ||
    historical.coverage.aborted
  )
    throw new Error(
      "Packaged recorded replay did not reproduce historical failure",
    );
  const child = spawn(
    process.execPath,
    [cli, "open", artifact, "--no-browser"],
    { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
  );
  try {
    const viewerUrl = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new Error("Packaged viewer startup timed out")),
        10000,
      );
      child.stdout.on("data", (data) => {
        output += data;
        const match = output.match(/Local viewer: (http:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      child.on("error", reject);
      child.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Packaged viewer exited ${code}`));
      });
    });
    if (!(await fetch(viewerUrl)).ok)
      throw new Error("Packaged viewer cannot serve its assets");
  } finally {
    child.kill("SIGINT");
  }
  console.log(
    "Packaged CLI, replay report, viewer, extension, and checksums passed smoke checks.",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
