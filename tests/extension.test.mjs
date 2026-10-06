import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createDemoServer } from "../fixtures/demo-store/server.mjs";
import { artifactSchema } from "../dist/schema/src/index.js";
import { packArtifact, unpackArtifact } from "../dist/artifact/src/index.js";
import { replay, replayWithReport } from "../dist/replay/src/index.js";
const built = resolve("apps/extension/.output/chrome-mv3");
async function launchExtension(enhanced) {
  const directory = await mkdtemp(join(tmpdir(), "tracecase-e2e-"));
  const extension = join(directory, "extension");
  await cp(built, extension, { recursive: true });
  if (enhanced) {
    const file = join(extension, "manifest.json");
    const manifest = JSON.parse(await readFile(file, "utf8"));
    manifest.permissions.push("debugger");
    delete manifest.optional_permissions;
    await writeFile(file, JSON.stringify(manifest));
  }
  const context = await chromium.launchPersistentContext(
    join(directory, "profile"),
    {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    },
  );
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).hostname;
  return {
    context,
    worker,
    id,
    async close() {
      await context.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
async function request(page, message) {
  const result = await page.evaluate(
    (message) => chrome.runtime.sendMessage(message),
    message,
  );
  if (result.error) throw new Error(result.error);
  return result.value;
}
for (const enhanced of [false, true])
  test(
    `real MV3 ${enhanced ? "enhanced" : "standard/fallback"} capture → review → ZIP → CLI replay`,
    { timeout: 60000 },
    async (t) => {
      const server = createDemoServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const url = `http://127.0.0.1:${server.address().port}`;
      const extension = await launchExtension(enhanced);
      t.after(() => extension.close());
      try {
        const { context, worker, id } = extension;
        const target = await context.newPage();
        await target.goto(url + "/checkout");
        await target.waitForTimeout(300);
        const popup = await context.newPage();
        await popup.goto(`chrome-extension://${id}/popup.html`);

        await popup.locator("body").screenshot({
          path: join(
            tmpdir(),
            `tracecase-popup-${enhanced ? "enhanced" : "standard"}.png`,
          ),
        });
        const tabId = await worker.evaluate(
          async (url) =>
            (await chrome.tabs.query({})).find((tab) => tab.url === url).id,
          url + "/checkout",
        );
        // Standard test asks for enhanced mode without permission to exercise fallback.

        await target.bringToFront();
        await request(popup, {
          type: "start",
          tabId,
          enhanced: true,
          screenshots: enhanced,
        });

        await popup.reload();
        await popup.getByRole("button", { name: "Stop & review" }).waitFor();
        assert.equal(
          await popup.getByLabel("Enhanced network capture").isDisabled(),
          true,
        );
        assert.equal(
          await popup.getByLabel("Include screenshots").isChecked(),
          enhanced,
        );
        await popup
          .getByRole("button", { name: "Mark bug", exact: true })
          .click();
        await popup
          .getByText("Bug marked. Keep recording or stop to review.")
          .waitFor();
        await target.bringToFront();
        await target
          .locator("[data-tracecase-ignore]")
          .filter({
            has: target.getByRole("button", { name: "Mark bug", exact: true }),
          })
          .waitFor();
        await target
          .getByRole("button", { name: "Change address", exact: true })
          .click();
        await target.waitForTimeout(350);
        await target
          .getByRole("link", { name: "Restart checkout", exact: true })
          .click();
        await target
          .getByRole("button", { name: "Mark bug", exact: true })
          .waitFor();
        await target.getByLabel("Country").selectOption("CA");
        await target.getByLabel("Postal code").fill("V7M 1A1");
        await target.evaluate(() => {
          const privateInput = document.createElement("input");
          privateInput.type = "password";
          privateInput.setAttribute("data-testid", "private-secret");
          document.querySelector("form").append(privateInput);
        });
        await target.getByTestId("private-secret").fill("DO_NOT_PERSIST");
        await target.getByLabel("Postal code").press("Escape");
        if (enhanced) {
          await context.addCookies([
            { name: "sid", value: "DO_NOT_PERSIST", url },
          ]);
          await target.evaluate(async () => {
            await fetch("/api/privacy", {
              method: "POST",
              headers: {
                Authorization: "Bearer DO_NOT_PERSIST",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                password: "DO_NOT_PERSIST",
                country: "CA",
              }),
            });
            await fetch("/api/large");
          });
        }
        await target.evaluate(() => console.error("token=DO_NOT_PERSIST"));
        await target.getByLabel("Postal code").press("Enter");
        await target
          .getByText("Tax service unavailable", { exact: true })
          .waitFor();
        // Allow debugger loadingFinished and batched visual events to persist.
        await target.waitForTimeout(650);
        await target
          .getByRole("button", { name: "Mark bug", exact: true })
          .click();

        const reviewPromise = context.waitForEvent("page");
        await target.getByRole("button", { name: "Stop", exact: true }).click();
        const review = await reviewPromise;

        await review.waitForLoadState();
        await review
          .getByRole("heading", { name: "Browser reproduction", exact: true })
          .waitFor();

        const artifact = artifactSchema.parse(
          await request(popup, { type: "artifact" }),
        );
        assert.equal(artifact.version, "0.2");
        assert.equal(
          artifact.evidence.capabilities.mode,
          enhanced ? "enhanced" : "standard",
        );
        assert.ok(
          artifact.steps.some(
            (s) => s.type === "navigation" && s.mode === "document",
          ),
        );
        assert.ok(
          artifact.steps.some(
            (s) => s.type === "navigation" && s.mode === "history",
          ),
        );
        assert.ok(artifact.steps.some((s) => s.type === "key"));
        assert.ok(
          !artifact.steps.some(
            (s) =>
              s.type === "click" &&
              s.target.some(
                (t) => t.kind === "testId" && t.value === "continue",
              ),
          ),
        );
        assert.ok(artifact.evidence.visual.length >= 2);
        assert.ok(artifact.evidence.events.some((e) => e.type === "marker"));
        assert.ok(artifact.evidence.events.some((e) => e.type === "console"));
        assert.ok(artifact.evidence.privacy.excludedInputs > 0);
        assert.ok(!JSON.stringify(artifact).includes("DO_NOT_PERSIST"));
        if (enhanced) {
          // Start, popup marker, in-page marker, and stop each capture a frame.
          assert.equal(artifact.evidence.screenshots.length, 4);
          assert.ok(
            artifact.evidence.network.some(
              (r) =>
                r.url.endsWith("/api/privacy") &&
                r.requestHeaders.Authorization === "[REDACTED]" &&
                r.responseBody.includes("[REDACTED]"),
            ),
          );
          assert.ok(
            artifact.evidence.network.some(
              (r) => r.url.endsWith("/api/large") && r.bodyOmitted,
            ),
          );
          assert.ok(
            artifact.evidence.network.some(
              (r) =>
                r.status === 500 &&
                r.responseBody.includes("Tax service unavailable"),
            ),
          );
        } else
          assert.ok(
            artifact.evidence.capabilities.warnings.some((w) =>
              w.includes("Standard mode"),
            ),
          );
        await review
          .getByPlaceholder("Exact visible failure text")
          .fill("Tax service unavailable");
        await review
          .getByPlaceholder("Exact text expected after the fix")
          .fill("Order summary is visible");
        await review
          .getByLabel("I reviewed the evidence for sensitive content.")
          .check();
        const downloadPromise = review.waitForEvent("download");
        await review
          .getByRole("button", { name: "Export reviewed artifact" })
          .click();
        const download = await downloadPromise;
        const exported = await unpackArtifact(
          new Uint8Array(await readFile(await download.path())),
        );
        assert.equal(exported.evidence.privacy.reviewed, true);
        assert.equal(await replay(exported, { url }), "FAILURE REPRODUCED");
        if (enhanced) {
          const fixedServer = createDemoServer({ isFixed: () => true });
          await new Promise((resolve) =>
            fixedServer.listen(0, "127.0.0.1", resolve),
          );
          try {
            const changedUrl = `http://127.0.0.1:${fixedServer.address().port}`;
            assert.equal(
              (
                await replayWithReport(exported, {
                  url: changedUrl,
                  timeoutMs: 500,
                })
              ).status,
              "assertion-failed",
            );
            const historical = await replayWithReport(exported, {
              url: changedUrl,
              network: "recorded",
            });
            assert.equal(historical.status, "reproduced");
            assert.equal(historical.coverage.matched, 1);
            assert.equal(historical.coverage.aborted, 0);
          } finally {
            await new Promise((resolve) => fixedServer.close(resolve));
          }
        }
        await review.screenshot({
          path: join(
            tmpdir(),
            `tracecase-${enhanced ? "enhanced" : "standard"}-review.png`,
          ),
          fullPage: true,
        });
      } finally {
        await extension.close();
        await new Promise((resolve) => server.close(resolve));
      }
    },
  );

for (const enhanced of [false, true])
  test(
    `privacy settings protect ${enhanced ? "enhanced" : "standard"} storage, survive navigation, and apply changes only to new recordings`,
    { timeout: 60000 },
    async () => {
      const { createServer } = await import("node:http");
      const server = createServer((req, res) => {
        if (req.url.startsWith("/api")) {
          res.writeHead(200, {
            "content-type": "application/json",
            customer_id: "PRIVATE_RESPONSE_HEADER",
          });
          res.end(
            JSON.stringify({ customer_id: "PRIVATE_RESPONSE_BODY", ok: true }),
          );
        } else {
          res.writeHead(200, { "content-type": "text/html" });
          res.end(
            '<html><body><section class="confidential">PRIVATE_VISIBLE_TEXT<input aria-label="Private area input" value="PRIVATE_ATTRIBUTE"></section><input name="customer_id" aria-label="Customer ID"><input aria-label="Public note"><button>Continue</button></body></html>',
          );
        }
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const url = `http://127.0.0.1:${server.address().port}`;
      const extension = await launchExtension(enhanced);
      try {
        const { context, worker, id } = extension;
        const settings = await context.newPage();
        await settings.goto(`chrome-extension://${id}/privacy.html`);
        const fields = settings.getByRole("textbox", {
          name: "Additional sensitive fields",
        });
        const selectors = settings.getByRole("textbox", {
          name: "Private page elements",
        });
        await fields.fill("customer_id");
        await selectors.fill("body { color: red }");
        await settings
          .getByRole("button", { name: "Save privacy rules" })
          .click();
        await settings.getByRole("alert").waitFor();
        assert.deepEqual(
          (await request(settings, { type: "privacy:get" })).fields,
          [],
        );
        await selectors.fill(".confidential");
        await settings
          .getByRole("button", { name: "Save privacy rules" })
          .click();
        await settings
          .getByText("Privacy rules saved. They apply to your next recording.")
          .waitFor();
        await settings.reload();
        await fields.waitFor();
        assert.equal(await fields.inputValue(), "customer_id");
        await settings.screenshot({
          path: join(tmpdir(), "tracecase-privacy-desktop.png"),
          fullPage: true,
        });
        await settings.setViewportSize({ width: 390, height: 844 });
        assert.ok(
          await settings.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        await settings.screenshot({
          path: join(tmpdir(), "tracecase-privacy-mobile.png"),
          fullPage: true,
        });
        const target = await context.newPage();
        await target.goto(url + "/?customer_id=PRIVATE_ENTRY_URL");
        const tabId = await worker.evaluate(
          async (url) =>
            (await chrome.tabs.query({})).find((tab) =>
              tab.url?.startsWith(url),
            ).id,
          url,
        );
        await target.bringToFront();
        await request(settings, {
          type: "start",
          tabId,
          enhanced,
          screenshots: enhanced,
        });
        await target.getByLabel("Customer ID").fill("PRIVATE_INPUT");
        await target
          .getByLabel("Private area input")
          .fill("PRIVATE_REGION_INPUT");
        await target.getByLabel("Public note").fill("Public evidence");
        await target.evaluate(async () => {
          console.error("customer_id=PRIVATE_CONSOLE");
          await fetch("/api?customer_id=PRIVATE_REQUEST_URL", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              customer_id: "PRIVATE_REQUEST_HEADER",
            },
            body: JSON.stringify({
              customer_id: "PRIVATE_REQUEST_BODY",
              ok: true,
            }),
          });
        });
        for (let attempt = 0; enhanced && attempt < 50; attempt++) {
          const captured = await request(settings, { type: "artifact" });
          if (captured.evidence.network.some((entry) => entry.responseBody))
            break;
          await target.waitForTimeout(50);
        }
        // Assert screenshot masking itself, before pixels are collected by the background.
        await worker.evaluate(
          (tabId) => chrome.tabs.sendMessage(tabId, { type: "mask" }),
          tabId,
        );
        assert.equal(
          await target
            .locator(".confidential")
            .evaluate((el) => getComputedStyle(el).opacity),
          "0",
        );
        await worker.evaluate(
          (tabId) => chrome.tabs.sendMessage(tabId, { type: "unmask" }),
          tabId,
        );
        assert.equal(
          await target
            .locator(".confidential")
            .evaluate((el) => getComputedStyle(el).opacity),
          "1",
        );
        // Save different defaults during capture; the running session must retain its rules.
        await request(settings, {
          type: "privacy:save",
          rules: { version: 1, fields: [], selectors: [] },
        });
        await target.goto(url + "/next?customer_id=PRIVATE_NEXT_URL");
        await target
          .getByRole("button", { name: "Mark bug", exact: true })
          .waitFor();
        await target
          .getByLabel("Customer ID")
          .fill("PRIVATE_INPUT_AFTER_NAVIGATION");
        await target.getByLabel("Public note").fill("Still public");
        await request(settings, { type: "stop" });
        const artifact = await request(settings, { type: "artifact" });
        assert.ok(
          artifact.steps.some(
            (step) => step.type === "fill" && step.value === "Still public",
          ),
        );
        if (enhanced)
          assert.ok(
            artifact.evidence.network.some((entry) =>
              entry.responseBody?.includes("[REDACTED]"),
            ),
          );
        assert.ok(
          artifact.evidence.events.some((entry) =>
            entry.message.includes("customer_id=[REDACTED]"),
          ),
        );
        assert.ok(artifact.evidence.privacy.excludedInputs >= 3);
        assert.ok(artifact.evidence.visual.length > 1);
        if (enhanced) assert.ok(artifact.evidence.screenshots.length > 0);
        assert.ok(!JSON.stringify(artifact).includes("PRIVATE_"));
        const storage = await settings.evaluate(async () => {
          const local = await chrome.storage.local.get(null);
          const rows = await new Promise((resolve, reject) => {
            const open = indexedDB.open("tracecase-capture", 1);
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const request = db
                .transaction("rows")
                .objectStore("rows")
                .getAll();
              request.onsuccess = () => {
                db.close();
                resolve(request.result);
              };
              request.onerror = () => reject(request.error);
            };
          });
          return JSON.stringify({ local, rows });
        });
        assert.ok(
          !storage.includes("PRIVATE_"),
          "Sensitive data must not reach persistent storage",
        );
        await target.bringToFront();
        await request(settings, {
          type: "start",
          tabId,
          enhanced: false,
          screenshots: false,
        });
        assert.equal(
          (await request(settings, { type: "status" })).privacyRuleCount,
          0,
        );
        await request(settings, { type: "stop" });
      } finally {
        await extension.close();
        await new Promise((resolve) => server.close(resolve));
      }
    },
  );
