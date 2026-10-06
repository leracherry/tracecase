import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
      await page.getByLabel("Open artifact").setInputFiles({
        name: "bad.tracecase",
        mimeType: "application/zip",
        buffer: Buffer.from("invalid"),
      });
      await page.getByRole("alert").waitFor();
    } finally {
      child.kill("SIGINT");
      await browser.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
