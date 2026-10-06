import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { preview } from "vite";
import { readFile } from "node:fs/promises";
import { attachRecorder } from "../dist/recorder/src/index.js";
import { replayWithReport, repairArtifact } from "../dist/replay/src/index.js";
// Browser startup and framework hydration share this budget with action waits.
// Keep it realistic on CI hosts running several browser suites concurrently.
const replayOptions = { timeoutMs: 2000 };
const sample = JSON.parse(
  await readFile(
    new URL("../examples/checkout.tracecase", import.meta.url),
    "utf8",
  ),
);
test(
  "React, Vue and Svelte recordings replay, report divergence, and accept explicit semantic repair",
  { timeout: 90000 },
  async () => {
    const server = await preview({
      configFile: "fixtures/frameworks/vite.config.mjs",
      preview: { host: "127.0.0.1", port: 0 },
    });
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    const browser = await chromium.launch();
    try {
      for (const framework of ["react", "vue", "svelte"]) {
        const page = await browser.newPage();
        const steps = await attachRecorder(page);
        await page.goto(`${base}/${framework}.html`);
        await page.getByLabel("Country").selectOption("CA");
        await page.getByLabel("Postal code").fill("V7M 1A1");
        await page
          .getByRole("button", { name: "Continue", exact: true })
          .click();
        await page
          .getByText("Tax service unavailable", { exact: true })
          .waitFor();
        const artifact = {
          ...sample,
          entryUrl: `${base}/${framework}.html`,
          steps: structuredClone(steps),
        };
        assert.equal(artifact.steps.length, 3);
        const report = await replayWithReport(artifact, replayOptions);
        assert.equal(report.status, "reproduced");
        assert.equal(report.steps.length, 3);
        assert.ok(report.assertion.passed);
        const fallback = structuredClone(artifact);
        fallback.steps[0].target[0].value = "removed";
        assert.equal(
          (await replayWithReport(fallback, replayOptions)).status,
          "reproduced",
        );
        const changed = {
          ...artifact,
          entryUrl: `${base}/${framework}.html?renamed=1`,
        };
        const divergent = await replayWithReport(changed, replayOptions);
        assert.equal(divergent.status, "diverged");
        assert.equal(divergent.steps.at(-1).step, 3);
        assert.equal(divergent.steps.at(-1).attempts[0].state, "missing");
        let prompts = 0;
        const repaired = await replayWithReport(changed, {
          ...replayOptions,
          repair: async (request) => {
            prompts++;
            assert.equal(request.step, 3);
            return request.suggestions.find(
              (c) => c.kind === "role" && c.name === "Review order",
            );
          },
        });
        assert.equal(prompts, 1, JSON.stringify(repaired));
        assert.equal(repaired.status, "reproduced");
        assert.equal(repaired.repairs.length, 1);
        const updated = repairArtifact(changed, repaired.repairs);
        assert.equal(
          (await replayWithReport(updated, replayOptions)).status,
          "reproduced",
        );
        assert.equal(changed.steps[2].target[0].name, "Continue");
        assert.equal(
          (await replayWithReport(artifact, { ...replayOptions, verify: true }))
            .status,
          "assertion-failed",
        );
        await page.close();
      }
    } finally {
      await browser.close();
      await new Promise((resolve) => server.httpServer.close(resolve));
    }
  },
);
test("replay reports errors without leaking input values", async () => {
  const server = await preview({
    configFile: "fixtures/frameworks/vite.config.mjs",
    preview: { host: "127.0.0.1", port: 0 },
  });
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  try {
    const artifact = {
      ...sample,
      entryUrl: `${base}/react.html`,
      steps: [
        {
          type: "fill",
          time: 0,
          value: "secret-value-never-report",
          target: [{ kind: "label", value: "Postal code" }],
        },
      ],
    };
    const report = await replayWithReport(artifact, replayOptions);
    assert.equal(report.status, "assertion-failed", JSON.stringify(report));
    assert.ok(!JSON.stringify(report).includes("secret-value-never-report"));
    const privateValue = structuredClone(artifact);
    privateValue.steps[0].redacted = true;
    assert.equal(
      (await replayWithReport(privateValue, replayOptions)).status,
      "diverged",
    );
    const error = await replayWithReport(
      { ...artifact, entryUrl: "http://127.0.0.1:1/" },
      replayOptions,
    );
    assert.equal(error.status, "error");
    assert.equal(error.steps.length, 0);
  } finally {
    await new Promise((resolve) => server.httpServer.close(resolve));
  }
});
