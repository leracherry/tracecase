import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { artifactSchema } from "../dist/schema/src/index.js";
import { spawn } from "node:child_process";
import { packArtifact, unpackArtifact } from "../dist/artifact/src/index.js";
const sample = JSON.parse(
  await readFile(
    new URL("../examples/checkout.tracecase", import.meta.url),
    "utf8",
  ),
);
test(
  "local CLI viewer renders untrusted evidence safely, filters events, and removes export categories",
  { timeout: 30000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "tracecase-viewer-"));
    const timestamp = Date.now();
    const node = (id, tagName, childNodes = [], attributes = {}) => ({
      type: 2,
      id,
      tagName,
      childNodes,
      attributes,
    });
    const artifact = {
      ...sample,
      version: "0.2",
      createdAt: new Date(timestamp).toISOString(),
      title: "<img src=x onerror=alert(1)>",
      evidence: {
        environment: {
          userAgent: "Test Chromium",
          platform: "test",
          language: "en",
          timezone: "UTC",
        },
        capabilities: {
          visual: true,
          console: true,
          network: true,
          bodies: true,
          screenshots: false,
          mode: "enhanced",
          warnings: [],
        },
        events: [
          { type: "console", time: 5, message: "Captured console error" },
          { type: "marker", time: 15, message: "Bug marked" },
        ],
        visual: [
          {
            type: 4,
            timestamp,
            data: { href: sample.entryUrl, width: 1280, height: 800 },
          },
          {
            type: 2,
            timestamp: timestamp + 1,
            data: {
              node: {
                type: 0,
                id: 1,
                childNodes: [
                  node(2, "html", [
                    node(3, "head"),
                    node(4, "body", [
                      node(5, "p", [
                        {
                          type: 3,
                          id: 6,
                          textContent: "Capture detail visible",
                        },
                      ]),
                      node(7, "script", [
                        {
                          type: 3,
                          id: 8,
                          textContent: "parent.__TRACECASE_PWNED=true",
                        },
                      ]),
                      node(9, "img", [], {
                        src: "https://attacker.invalid/leak",
                        onerror: "parent.__TRACECASE_PWNED=true",
                      }),
                      node(10, "style", [
                        {
                          type: 3,
                          id: 11,
                          textContent:
                            '@import "https://attacker.invalid/leak.css"; body {background:url(https://attacker.invalid/leak)}',
                        },
                      ]),
                    ]),
                  ]),
                ],
              },
              initialOffset: { top: 0, left: 0 },
            },
          },
        ],
        screenshots: [],
        network: [
          {
            id: "request-1",
            time: 10,
            method: "GET",
            url: "https://demo.test/api/tax",
            requestHeaders: {},
            responseHeaders: {},
            status: 500,
            duration: 20,
            responseBody: '{"error":"unavailable"}',
          },
        ],
        privacy: { redactions: 0, excludedInputs: 0, reviewed: false },
      },
    };
    const path = join(directory, "viewer.tracecase");
    await writeFile(path, await packArtifact(artifact));
    const child = spawn(
      process.execPath,
      ["dist/cli/src/index.js", "open", path, "--no-browser"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const browser = await chromium.launch();
    try {
      const url = await new Promise((resolve, reject) => {
        let output = "";
        child.stdout.on("data", (data) => {
          output += data;
          const match = output.match(/Local viewer: (http:\/\/[^\s]+)/);
          if (match) resolve(match[1]);
        });
        child.once("exit", (code) =>
          reject(new Error(`Viewer exited: ${code}`)),
        );
        child.stderr.on("data", (data) => reject(new Error(String(data))));
      });
      const page = await browser.newPage();
      const remote = [];
      page.on("request", (request) => {
        if (new URL(request.url()).hostname === "attacker.invalid")
          remote.push(request.url());
      });
      await page.goto(url);
      await page
        .getByRole("heading", { name: artifact.title, exact: true })
        .waitFor();
      await page
        .frameLocator("iframe")
        .getByText("Capture detail visible", { exact: true })
        .waitFor();
      assert.equal(
        await page.evaluate(() => window.__TRACECASE_PWNED),
        undefined,
      );
      assert.equal(
        await page.frameLocator("iframe").locator("script").count(),
        0,
      );
      assert.deepEqual(remote, []);
      await page.getByLabel("Filter timeline").selectOption("network");
      assert.equal(await page.locator(".row").count(), 1);
      assert.ok(await page.locator(".row.failed").count());
      await page.locator(".row").click();
      assert.ok(
        (await page.locator(".detail pre").first().textContent()).includes(
          "request-1",
        ),
      );
      const coverageReport = {
        format: "tracecase-replay-report",
        version: "1.1",
        artifactSha256: createHash("sha256")
          .update(JSON.stringify(artifactSchema.parse(artifact)))
          .digest("hex"),
        title: artifact.title,
        status: "network-diverged",
        network: "recorded",
        coverage: {
          policy: "abort",
          totalFixtures: 1,
          eligibleFixtures: 0,
          usedFixtures: 0,
          unusedFixtures: 0,
          requests: 1,
          matched: 0,
          passedThrough: 0,
          unmatched: 1,
          aborted: 1,
          errors: 0,
          truncated: false,
          unused: [],
          unavailable: [
            {
              index: 0,
              method: "GET",
              url: "https://demo.test/api/tax",
              reason: "Unsupported response body type",
            },
          ],
          entries: [
            {
              method: "GET",
              url: "https://demo.test/api/tax",
              occurrence: 1,
              outcome: "aborted",
              reason: "<img src=x onerror=alert(1)>",
            },
          ],
        },
      };
      await page.getByLabel("Open replay report").setInputFiles({
        name: "replay.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(coverageReport)),
      });
      await page.getByText("Network mismatch", { exact: true }).waitFor();
      assert.ok(
        (await page.locator(".network-replay").textContent()).includes(
          "1 blocked",
        ),
      );
      assert.equal(await page.locator(".network-replay img").count(), 0);
      await page.screenshot({
        path: join(tmpdir(), "tracecase-brand-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: join(tmpdir(), "tracecase-brand-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByLabel("Open replay report").setInputFiles({
        name: "wrong.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            ...coverageReport,
            artifactSha256: "0".repeat(64),
          }),
        ),
      });
      await page.getByRole("alert").waitFor();
      assert.equal(
        await page.getByText("Network mismatch", { exact: true }).count(),
        0,
      );
      await page.getByLabel("Open replay report").setInputFiles({
        name: "replay.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(coverageReport)),
      });
      await page.getByText("Network mismatch", { exact: true }).waitFor();
      await page.getByLabel("Filter timeline").selectOption("all");
      await page.getByLabel("Search timeline").fill("Captured console");
      assert.equal(await page.locator(".row").count(), 1);
      await page.getByLabel("Visual replay", { exact: true }).uncheck();
      await page.getByLabel("Network", { exact: true }).uncheck();
      await page.getByLabel("Console", { exact: true }).uncheck();
      await page
        .getByLabel("I reviewed the evidence for sensitive content.")
        .check();
      const pending = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export reviewed artifact" })
        .click();
      const download = await pending;
      const exported = await unpackArtifact(
        new Uint8Array(await readFile(await download.path())),
      );
      assert.equal(exported.evidence.visual.length, 0);
      assert.equal(exported.evidence.network.length, 0);
      assert.ok(!exported.evidence.events.some((e) => e.type === "console"));
      assert.ok(exported.evidence.events.some((e) => e.type === "marker"));
      await page
        .getByLabel("Expected behavior", { exact: true })
        .fill("Updated expected behavior");
      await page
        .getByRole("button", { name: "Download Playwright test" })
        .waitFor();
      const testDownload = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download Playwright test" })
        .click();
      const testFile = await testDownload;
      assert.ok(
        (await readFile(await testFile.path(), "utf8")).includes(
          "Updated expected behavior",
        ),
      );
      await page.getByLabel("Test networking").selectOption("recorded");
      assert.equal(
        await page
          .getByRole("button", { name: "Download Playwright test" })
          .isDisabled(),
        true,
      );
      await page.getByLabel("Export format").selectOption("context");
      const contextDownload = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Download agent context" })
        .click();
      const contextFile = await contextDownload;
      const handoff = JSON.parse(
        await readFile(await contextFile.path(), "utf8"),
      );
      assert.equal(handoff.counts.requests, 0);
      assert.equal(handoff.errors.length, 0);
      assert.equal(handoff.failure.expected, "Updated expected behavior");
      await page.getByLabel("Export format").selectOption("issue");
      const issueDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "Download issue draft" }).click();
      const issueFile = await issueDownload;
      assert.ok(
        (await readFile(await issueFile.path(), "utf8")).includes("&lt;img"),
      );
      await page.getByLabel("Export format").selectOption("test");
      await page.getByLabel("Test networking").selectOption("live");
      await page
        .locator(".export-workbench")
        .screenshot({ path: join(tmpdir(), "tracecase-export-panel.png") });
      await page.screenshot({
        path: join(tmpdir(), "tracecase-workbench-desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.screenshot({
        path: join(tmpdir(), "tracecase-workbench-mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByLabel("Open artifact").setInputFiles({
        name: "bad.tracecase",
        mimeType: "application/zip",
        buffer: Buffer.from("invalid"),
      });
      await page.getByRole("alert").waitFor();
      await page.goto(new URL("/", url).href);
      await page.getByRole("button", { name: "Choose a recording" }).waitFor();
      const chooserPromise = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "Choose a recording" }).click();
      const chooser = await chooserPromise;
      await page.screenshot({
        path: join(tmpdir(), "tracecase-empty-desktop.png"),
        fullPage: true,
      });
      await chooser.setFiles(path);
      await page
        .getByRole("heading", { name: artifact.title, exact: true })
        .waitFor();
      // Opening another recording must reset filters and privacy consent.
      await page.getByLabel("Open artifact").setInputFiles({
        name: "simple.tracecase",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({ ...sample, title: "A".repeat(240) }),
        ),
      });
      await page
        .getByRole("heading", { name: "No visual replay available" })
        .waitFor();
      assert.equal(await page.getByLabel("Search timeline").inputValue(), "");
      assert.equal(
        await page.getByLabel("Filter timeline").inputValue(),
        "all",
      );
      assert.equal(
        await page
          .getByLabel("I reviewed the evidence for sensitive content.")
          .isChecked(),
        false,
      );
      await page.getByLabel("Search timeline").fill("no such event");
      await page.getByRole("button", { name: "Clear filters" }).click();
      assert.equal(await page.locator(".row").count(), sample.steps.length);
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `overflow at ${width}px`,
        );
      }
      await page.keyboard.press("ControlOrMeta+Home");
      await page.locator(".skip-link").focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "main-content",
      );
      // Touch targets and keyboard focus remain usable at narrow widths.
      await page.setViewportSize({ width: 390, height: 844 });
      assert.ok(
        (
          await page
            .getByRole("button", { name: "Export reviewed artifact" })
            .boundingBox()
        ).height >= 44,
      );
      await page.screenshot({
        path: join(tmpdir(), "tracecase-polished-mobile.png"),
        fullPage: true,
      });
    } finally {
      child.kill("SIGINT");
      await browser.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
