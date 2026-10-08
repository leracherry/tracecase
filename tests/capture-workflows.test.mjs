import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { attachRecorder } from "../dist/recorder/src/index.js";
import { replayWithReport } from "../dist/replay/src/index.js";
import { createWorkflowServer } from "../fixtures/workflows/server.mjs";

for (const submit of ["click", "Enter"]) {
  test(
    `shared capture replays native forms, ${submit} submission and navigation without duplicate actions`,
    { timeout: 60000 },
    async (t) => {
      const server = createWorkflowServer();
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      t.after(() => new Promise((resolve) => server.close(resolve)));
      const url = `http://127.0.0.1:${server.address().port}`;
      const browser = await chromium.launch();
      t.after(() => browser.close());
      const page = await browser.newPage();
      const steps = await attachRecorder(page);
      await page.goto(url);
      await page.getByRole("button", { name: "Edit project" }).click();
      await page.getByLabel("Project name").fill("Launch plan");
      await page.getByLabel("Notify team").check();
      await page.getByLabel("Private project", { exact: true }).check();
      await page.getByLabel("Region").selectOption("us");
      await page.getByLabel("Email").fill("private@example.test");
      if (submit === "Enter")
        await page.getByLabel("Project name").press("Enter");
      else await page.getByRole("button", { name: "Save project" }).click();
      await page.getByText("Saved 1 time", { exact: true }).waitFor();
      await page.waitForTimeout(250);
      const artifact = {
        format: "tracecase",
        version: "0.1",
        title: "Project settings",
        createdAt: new Date().toISOString(),
        entryUrl: url,
        viewport: { width: 1280, height: 800 },
        steps: structuredClone(steps),
        failure: { observedText: "Saved 1 time", expectedText: "Saved 1 time" },
      };
      assert.ok(!JSON.stringify(steps).includes("private@example.test"));
      assert.equal(
        steps.filter((s) => s.type === "key").length,
        submit === "Enter" ? 1 : 0,
      );
      assert.equal(
        steps.filter(
          (s) =>
            s.type === "click" &&
            s.target.some((c) => c.name === "Save project"),
        ).length,
        submit === "Enter" ? 0 : 1,
      );
      assert.ok(
        steps.some((s) => s.type === "navigation" && s.mode === "history"),
      );
      for (const engine of process.env.TRACECASE_CROSS_BROWSER
        ? ["chromium", "firefox", "webkit"]
        : ["chromium"]) {
        const report = await replayWithReport(artifact, {
          browser: engine,
          timeoutMs: 3000,
        });
        assert.equal(report.status, "reproduced", JSON.stringify(report));
      }
      await page.getByRole("link", { name: "View project" }).click();
      await page.getByPlaceholder("Search projects").fill("Launch");
      await page.waitForTimeout(50);
      assert.equal(
        steps.filter((s) => s.type === "navigation" && s.mode === "document")
          .length,
        1,
      );
      assert.ok(steps.every((s, i) => i === 0 || s.time >= steps[i - 1].time));
      const full = {
        ...artifact,
        steps: structuredClone(steps),
        failure: {
          observedText: "Project saved",
          expectedText: "Project saved",
        },
      };
      assert.equal(
        (await replayWithReport(full, { timeoutMs: 3000 })).status,
        "reproduced",
      );
    },
  );
}

test("capture skips unsupported controls and modified keys without storing private values", async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const gaps = [];
  const steps = await attachRecorder(page, (message) => gaps.push(message));
  await page.goto(
    'data:text/html,<label>Notes<input id="notes"></label><label>Files<input type="file"></label><label>Colors<select multiple><option value="red">Red</option><option value="blue">Blue</option></select></label>',
  );
  await page.getByLabel("Notes").fill("public note");
  await page.getByLabel("Notes").press("Control+Enter");
  await page.getByLabel("Notes").press("Shift+Tab");
  await page
    .getByLabel("Files")
    .setInputFiles({
      name: "private.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("private file"),
    });
  await page.getByLabel("Colors").selectOption(["red", "blue"]);
  await page.waitForTimeout(50);
  assert.deepEqual(
    steps.map((s) => s.type),
    ["fill"],
  );
  assert.equal(gaps.length, 2);
  assert.ok(!JSON.stringify({ steps, gaps }).includes("private.txt"));
});
