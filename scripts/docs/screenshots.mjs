// Real UI captures from synthetic demo data. Run after `npm run build`.
import { chromium } from "playwright";
import { mkdtemp, cp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createDemoServer } from "../../fixtures/demo-store/server.mjs";
import { packArtifact } from "../../dist/artifact/src/index.js";
const output = resolve("docs/assets/screenshots");
await mkdir(output, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), "tracecase-docs-"));
const extension = join(temporary, "extension");
await cp("apps/extension/.output/chrome-mv3", extension, { recursive: true });
const manifestPath = join(extension, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.permissions.push("debugger");
delete manifest.optional_permissions;
await writeFile(manifestPath, JSON.stringify(manifest));
const server = createDemoServer({ isFixed: () => false });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let context;
try {
  context = await chromium.launchPersistentContext(join(temporary, "profile"), {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const id = new URL(worker.url()).hostname;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.getByLabel("Enhanced network capture").check();
  await popup.locator("body").screenshot({ path: join(output, "record.png") });
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/privacy.html`);
  await settings
    .getByRole("textbox", { name: "Additional sensitive fields" })
    .fill("customer_id\ninternal_reference");
  await settings
    .getByRole("textbox", { name: "Private page elements" })
    .fill(".customer-details\n[data-confidential]");
  await settings.getByRole("button", { name: "Save privacy rules" }).click();
  await settings
    .getByText("Privacy rules saved. They apply to your next recording.")
    .waitFor();
  await settings.screenshot({
    path: join(output, "privacy.png"),
    fullPage: true,
  });
  const send = (message) =>
    popup.evaluate(async (message) => {
      const reply = await chrome.runtime.sendMessage(message);
      if (reply.error) throw new Error(reply.error);
      return reply.value;
    }, message);
  await send({
    type: "privacy:save",
    rules: { version: 1, fields: [], selectors: [] },
  });
  const target = await context.newPage();
  await target.goto(base + "/checkout");
  const tabId = await worker.evaluate(
    async (base) =>
      (await chrome.tabs.query({})).find((tab) => tab.url?.startsWith(base)).id,
    base,
  );
  await target.bringToFront();
  await send({ type: "start", tabId, enhanced: true, screenshots: false });
  await target.getByLabel("Country").selectOption("CA");
  await target.getByLabel("Postal code").fill("V7M 1A1");
  await target.getByRole("button", { name: "Continue", exact: true }).click();
  await target.getByText("Tax service unavailable", { exact: true }).waitFor();
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      (await send({ type: "artifact" })).evidence.network.some(
        (entry) => entry.responseBody,
      )
    )
      break;
    await target.waitForTimeout(50);
  }
  await target.waitForTimeout(250); // Allow the visual recorder to flush the visible outcome.
  await send({ type: "mark" });
  await send({ type: "stop" });
  const artifact = await send({ type: "artifact" });
  artifact.title = "Checkout fails for Canadian addresses";
  artifact.failure = {
    observedText: "Tax service unavailable",
    expectedText: "Order summary is visible",
  };
  const review = await context.newPage();
  await review.goto(`chrome-extension://${id}/review.html`);
  await review.getByLabel("Open artifact").setInputFiles({
    name: "demo.tracecase",
    mimeType: "application/zip",
    buffer: Buffer.from(await packArtifact(artifact)),
  });
  await review.getByRole("heading", { name: artifact.title }).waitFor();
  await review.locator(".row.marker").first().click();
  await review
    .frameLocator("iframe")
    .getByText("Tax service unavailable", { exact: true })
    .waitFor();
  await review.evaluate(() => scrollTo(0, 0));
  const workspace = await review.locator(".workspace").boundingBox();
  await review.screenshot({
    path: join(output, "inspect.png"),
    clip: {
      x: 0,
      y: 0,
      width: 1440,
      height: Math.ceil(workspace.y + workspace.height + 24),
    },
  });
  await review
    .getByLabel("I reviewed the evidence for sensitive content.")
    .check();
  await review
    .locator(".review")
    .screenshot({ path: join(output, "review.png") });
  await review
    .locator(".export-workbench")
    .screenshot({ path: join(output, "export.png") });
  console.log(`Saved five workflow screenshots in ${output}`);
} finally {
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
