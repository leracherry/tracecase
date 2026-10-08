import { test } from "node:test";
import assert from "node:assert/strict";
import puppeteer, { PUPPETEER_REVISIONS, TimeoutError } from "puppeteer-core";
import { computeExecutablePath, Browser } from "@puppeteer/browsers";
import { resolve } from "node:path";
import { createDemoServer } from "../fixtures/demo-store/server.mjs";
import { artifactSchema } from "../dist/schema/src/index.js";
import { packArtifact, unpackArtifact } from "../dist/artifact/src/index.js";
import { replayWithReport } from "../dist/replay/src/index.js";
const uuid = "71d5522c-bf51-4323-bc9d-1a0488b70d44";
async function extensionPage(browser, path) {
  const page = await browser.newPage();
  // Firefox BiDi does not consistently emit load milestones for extension documents.
  await page
    .goto(`moz-extension://${uuid}/${path}`, { timeout: 1500 })
    .catch((error) => {
      if (!(error instanceof TimeoutError)) throw error;
    });
  await page.waitForSelector(path === "popup.html" ? "#app" : "#root");
  return page;
}
async function request(page, message) {
  const result = await page.evaluate(
    (message) => browser.runtime.sendMessage(message),
    message,
  );
  if (result?.error) throw new Error(result.error);
  return result?.value;
}
test(
  "Firefox MV3 standard capture preserves privacy through navigation, review, ZIP and replay",
  { timeout: 90000, skip: !process.env.TRACECASE_FIREFOX_CAPTURE },
  async (t) => {
    const server = createDemoServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    const url = `http://127.0.0.1:${server.address().port}/checkout`;
    const browser = await puppeteer.launch({
      browser: "firefox",
      headless: true,
      protocolTimeout: 15000,
      args: ["--remote-allow-system-access"],
      executablePath: computeExecutablePath({
        browser: Browser.FIREFOX,
        buildId: PUPPETEER_REVISIONS.firefox,
        cacheDir: resolve(".releases/browsers"),
      }),
      extraPrefsFirefox: {
        "extensions.webextensions.uuids": JSON.stringify({
          "tracecase@tracecase.local": uuid,
        }),
      },
    });
    t.after(() => browser.close());
    await browser.installExtension(
      resolve("apps/extension/.output/firefox-mv3"),
    );
    const popup = await extensionPage(browser, "popup.html");
    assert.equal(await popup.$eval("#enhanced", (el) => el.disabled), true);
    const target = await browser.newPage();
    await target.goto(url);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const tabId = await popup.evaluate(
      async (url) =>
        (await browser.tabs.query({})).find((tab) => tab.url === url).id,
      url,
    );
    await request(popup, {
      type: "privacy:save",
      rules: {
        version: 1,
        fields: ["internalcode"],
        selectors: [".private-note"],
      },
    });
    await request(popup, {
      type: "start",
      tabId,
      enhanced: true,
      screenshots: false,
    });
    await target.waitForSelector("[data-tracecase-ignore]");
    await Promise.all([
      target.waitForNavigation(),
      target.locator("a").click(),
    ]);
    await target.waitForSelector("[data-tracecase-ignore]");
    await target.select('[data-testid="country"]', "CA");
    await target.locator('[data-testid="postal"]').fill("V7M 1A1");
    await target.waitForFunction(
      () => window.__tracecaseConsoleEnabled === true,
    );
    await target.evaluate(() => {
      const el = document.createElement("input");
      el.name = "internalcode";
      el.value = "FIREFOX_PRIVATE_VALUE";
      document.body.append(el);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      const button = document.createElement("button");
      button.id = "emit-console";
      button.setAttribute("data-tracecase-ignore", "");
      button.textContent = "Emit console";
      button.setAttribute(
        "onclick",
        "console.error('Firefox console token=FIREFOX_SECRET')",
      );
      document.body.append(button);
    });
    await target.locator("#emit-console").click();
    await target.locator('button[type="submit"]').click();
    await target.waitForFunction(() =>
      document.body.innerText.includes("Tax service unavailable"),
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    await request(popup, { type: "stop" });
    const artifact = artifactSchema.parse(
      await request(popup, { type: "artifact" }),
    );
    assert.equal(artifact.evidence.capabilities.mode, "standard");
    assert.equal(artifact.evidence.capabilities.network, false);
    assert.equal(artifact.evidence.capabilities.bodies, false);
    assert.equal(artifact.evidence.network.length, 0);
    assert.ok(
      artifact.evidence.capabilities.warnings.some((w) =>
        w.includes("Firefox standard"),
      ),
    );
    assert.ok(artifact.evidence.visual.length > 0);
    assert.ok(
      artifact.evidence.events.some(
        (e) => e.type === "console" && e.message.includes("Firefox console"),
      ),
    );
    assert.ok(
      artifact.steps.some(
        (s) => s.type === "navigation" && s.mode === "document",
      ),
    );
    assert.ok(!JSON.stringify(artifact).includes("FIREFOX_PRIVATE_VALUE"));
    assert.ok(!JSON.stringify(artifact).includes("FIREFOX_SECRET"));
    assert.ok(artifact.evidence.privacy.excludedInputs > 0);
    const review = await extensionPage(browser, "review.html");
    await review.waitForFunction(() =>
      document.body.innerText.includes("Browser reproduction"),
    );
    assert.equal(
      await review.$eval("body", (el) => el.scrollWidth <= window.innerWidth),
      true,
    );
    assert.ok(
      await review.$eval("body", (el) =>
        el.innerText.includes("Export & handoff"),
      ),
    );
    artifact.failure = {
      observedText: "Tax service unavailable",
      expectedText: "Order summary is visible",
    };
    const roundTrip = await unpackArtifact(await packArtifact(artifact));
    const report = await replayWithReport(roundTrip, {
      browser: "firefox",
      timeoutMs: 3000,
    });
    assert.equal(report.status, "reproduced", JSON.stringify(report));
    await target.bringToFront();
    // A second recording on the same document must restore instrumented accessors.
    await request(popup, {
      type: "start",
      tabId,
      enhanced: false,
      screenshots: false,
    });
    await target.select('[data-testid="country"]', "US");
    await target.locator('[data-testid="postal"]').fill("90210");
    await target.locator('button[type="submit"]').click();
    await target.waitForFunction(() =>
      document.body.innerText.includes("Order summary is visible"),
    );
    await request(popup, { type: "stop" });
    const second = artifactSchema.parse(
      await request(popup, { type: "artifact" }),
    );
    assert.ok(
      second.steps.some(
        (step) => step.type === "select" && step.value === "US",
      ),
    );
    assert.ok(
      second.steps.some(
        (step) => step.type === "fill" && step.value === "90210",
      ),
    );
    const freshPopup = await extensionPage(browser, "popup.html");
    assert.equal(
      await freshPopup.evaluate(
        () => document.querySelector("#enhanced").disabled,
      ),
      true,
    );
  },
);
