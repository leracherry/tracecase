import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  access,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createDemoServer } from "../fixtures/demo-store/server.mjs";
import { exportPlaywright } from "../dist/playwright-export/src/index.js";
import { writeTest } from "../dist/cli/src/exports.js";
import { artifactContext, issueMarkdown } from "../dist/context/src/index.js";
import { unpackArtifact, packArtifact } from "../dist/artifact/src/index.js";
import { applyPlugins } from "../dist/plugins/src/index.js";
import { replayWithReport, targetUrl } from "../dist/replay/src/index.js";
const source = await unpackArtifact(
  await readFile("examples/checkout-recorded.tracecase"),
);
async function directory() {
  await mkdir(".releases", { recursive: true });
  return mkdtemp(resolve(".releases/workflows-"));
}
function run(args, env = {}) {
  return new Promise((done, reject) => {
    let output = "";
    const child = spawn(process.execPath, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("error", reject);
    child.on("exit", (code) => done({ code, output }));
  });
}
test(
  "generated standalone tests fail before a fix, pass after it, and reproduce historical API failures",
  { timeout: 90000 },
  async () => {
    const dir = await directory();
    let fixed = false;
    const server = createDemoServer({ isFixed: () => fixed });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${server.address().port}`;
    try {
      await writeFile(
        join(dir, "playwright.config.ts"),
        `export default { testDir: '.', timeout: 10000, expect: {timeout: 800}, workers: 1, reporter: 'line' };`,
      );
      const regression = await writeTest(
        source,
        join(dir, "checkout.spec.ts"),
        { url },
      );
      const code = await readFile(regression.paths[0], "utf8");
      assert.ok(code.includes("Order summary is visible"));
      assert.ok(!code.includes("waitForTimeout"));
      assert.ok(!code.includes('from "tracecase'));
      let result = await run([
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        join(dir, "playwright.config.ts"),
      ]);
      assert.equal(result.code, 1, result.output);
      fixed = true;
      result = await run([
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        join(dir, "playwright.config.ts"),
      ]);
      assert.equal(result.code, 0, result.output);
      await writeTest(source, join(dir, "historical.spec.ts"), {
        url,
        assertion: "observed",
        network: "recorded",
      });
      result = await run([
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        join(dir, "playwright.config.ts"),
      ]);
      assert.equal(result.code, 0, result.output);
      result = await run([
        "node_modules/typescript/bin/tsc",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "ES2022",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        join(dir, "historical.spec.ts"),
      ]);
      assert.equal(result.code, 0, result.output);
      const original = await readFile(regression.paths[0]);
      await assert.rejects(
        () => writeTest(source, regression.paths[0], { url }),
        /exist/i,
      );
      assert.deepEqual(await readFile(regression.paths[0]), original);
      await writeFile(join(dir, "collision.fixtures.json"), "keep");
      await assert.rejects(
        () =>
          writeTest(source, join(dir, "collision.spec.ts"), {
            network: "recorded",
          }),
        /exist/i,
      );
      await assert.rejects(() => access(join(dir, "collision.spec.ts")));
      assert.equal(
        await readFile(join(dir, "collision.fixtures.json"), "utf8"),
        "keep",
      );
    } finally {
      await new Promise((r) => server.close(r));
      await rm(dir, { recursive: true, force: true });
    }
  },
);
test("exports validate private inputs and assertions, escape source text, and keep URLs on the configured app", async () => {
  const privateArtifact = structuredClone(source);
  privateArtifact.steps[1].redacted = true;
  assert.throws(() => exportPlaywright(privateArtifact), /private/);
  const noAssertion = structuredClone(source);
  delete noAssertion.failure;
  assert.throws(() => exportPlaywright(noAssertion), /expected behavior/);
  assert.throws(() => exportPlaywright(source, { url: "javascript:alert(1)" }));
  assert.throws(() => exportPlaywright(source, { name: "../escape" }));
  const hostile = {
    ...source,
    title: 'x"; throw new Error("injected"); //\n`template`',
  };
  const output = exportPlaywright(hostile).files[0].content;
  assert.ok(output.includes('x\\"; throw'));
  assert.equal(
    new URL(
      targetUrl(
        "https://recorded.test//evil.test/path",
        "http://localhost:5173",
      ),
    ).host,
    "localhost:5173",
  );
});
test("agent summaries omit values, bound evidence, and escape Markdown payloads", () => {
  const artifact = structuredClone(source);
  artifact.title = "<script>payload</script>";
  artifact.steps[1].value = "DO_NOT_SHARE_INPUT";
  artifact.steps = Array.from({ length: 70 }, () => artifact.steps[1]);
  artifact.evidence.network[0].responseBody = "DO_NOT_SHARE_BODY";
  const context = artifactContext(artifact);
  assert.equal(context.steps.length, 50);
  assert.equal(context.truncated, true);
  assert.ok(!JSON.stringify(context).includes("DO_NOT_SHARE"));
  const markdown = issueMarkdown(artifact);
  assert.ok(markdown.includes("&lt;script&gt;"));
  assert.ok(!markdown.includes("DO_NOT_SHARE"));
});
test(
  "MCP exposes only the selected artifact through bounded read-only tools",
  { timeout: 20000 },
  async () => {
    const dir = await directory();
    const file = join(dir, "recording.tracecase");
    await writeFile(file, await packArtifact(source));
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve("dist/cli/src/index.js"), "mcp", file],
      stderr: "pipe",
    });
    const client = new Client({ name: "test-client", version: "1.0" });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      assert.equal(listed.tools.length, 4);
      assert.ok(listed.tools.every((t) => t.annotations.readOnlyHint));
      const summary = await client.callTool({
        name: "tracecase_summary",
        arguments: {},
      });
      assert.equal(
        JSON.parse(summary.content[0].text).format,
        "tracecase-context",
      );
      const steps = await client.callTool({
        name: "tracecase_steps",
        arguments: { offset: 0, limit: 1 },
      });
      assert.equal(JSON.parse(steps.content[0].text).steps.length, 1);
      assert.equal(JSON.parse(steps.content[0].text).next, 1);
      const invalid = await client.callTool({
        name: "tracecase_steps",
        arguments: { offset: -1, limit: 1000 },
      });
      assert.equal(invalid.isError, true);
      const resources = await client.listResources();
      assert.equal(resources.resources[0].uri, "tracecase://recording/summary");
    } finally {
      await client.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
test("explicit plugins transform validated copies and adapt APIs without capture-engine changes", async () => {
  const plugin = {
    apiVersion: 1,
    name: "sanitize-title",
    transformArtifact: (a) => ({ ...a, title: "Sanitized" }),
  };
  const transformed = await applyPlugins(source, [plugin]);
  assert.equal(transformed.title, "Sanitized");
  assert.notEqual(source.title, "Sanitized");
  await assert.rejects(() =>
    applyPlugins(source, [
      { ...plugin, transformArtifact: () => ({ bad: true }) },
    ]),
  );
  const server = createDemoServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const report = await replayWithReport(source, {
      url: `http://127.0.0.1:${server.address().port}`,
      verify: true,
      plugins: [
        {
          apiVersion: 1,
          name: "tax-adapter",
          beforeReplay: (context) =>
            context.route("**/api/tax?*", (route) =>
              route.fulfill({
                contentType: "application/json",
                body: '{"tax":8.5}',
              }),
            ),
        },
      ],
    });
    assert.equal(report.status, "verified");
    assert.deepEqual(report.plugins, ["tax-adapter"]);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
for (const browser of ["chromium", "firefox", "webkit"])
  test(
    `${browser} executable replay and recorded API compatibility`,
    {
      skip:
        browser !== "chromium" && process.env.TRACECASE_CROSS_BROWSER !== "1",
      timeout: 30000,
    },
    async () => {
      const server = createDemoServer({ isFixed: () => true });
      await new Promise((r) => server.listen(0, "127.0.0.1", r));
      try {
        const url = `http://127.0.0.1:${server.address().port}`;
        assert.equal(
          (await replayWithReport(source, { url, browser, verify: true }))
            .status,
          "verified",
        );
        const report = await replayWithReport(source, {
          url,
          browser,
          network: "recorded",
        });
        assert.equal(report.status, "reproduced");
        assert.equal(report.coverage.matched, 1);
      } finally {
        await new Promise((r) => server.close(r));
      }
    },
  );
