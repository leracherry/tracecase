import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createDemoServer } from "../fixtures/demo-store/server.mjs";
import { artifactSchema } from "../dist/schema/src/index.js";
import { packArtifact, unpackArtifact } from "../dist/artifact/src/index.js";
import { replay } from "../dist/replay/src/index.js";
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
          assert.equal(artifact.evidence.screenshots.length, 3);
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
