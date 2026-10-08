import type { Page } from "playwright";
import { stepSchema, type Step } from "../../schema/src/index.js";
import { redactUrl } from "../../redaction/src/index.js";
import { captureRuntime } from "./runtime.generated.js";
/** CLI and extension recording share the same semantic capture and privacy policy. */
export async function attachRecorder(
  page: Page,
  onGap: (message: string) => void = () => {},
): Promise<Step[]> {
  const steps: Step[] = [];
  const startedAt = Date.now();
  await page.exposeBinding("__tracecaseEmit", ({ frame }, event: unknown) => {
    if (frame !== page.mainFrame()) return;
    const step = stepSchema.parse(event);
    const previous = steps.at(-1);
    // Collapse successive keystrokes without changing action ordering.
    if (
      step.type === "fill" &&
      previous?.type === "fill" &&
      JSON.stringify(previous.target) === JSON.stringify(step.target)
    )
      steps[steps.length - 1] = step;
    else if (steps.length < 10000) steps.push(step);
  });
  let firstDocument = true;
  await page.exposeBinding("__tracecaseGap", ({ frame }, message: unknown) => {
    if (frame === page.mainFrame() && typeof message === "string")
      onGap(message.slice(0, 512));
  });
  await page.exposeBinding("__tracecaseDocument", ({ frame }, url: string) => {
    if (frame !== page.mainFrame() || !/^https?:/.test(url)) return;
    if (firstDocument) {
      firstDocument = false;
      return;
    }
    if (steps.length < 10000)
      steps.push(
        stepSchema.parse({
          type: "navigation",
          mode: "document",
          url: redactUrl(url),
          time: Math.max(0, Date.now() - startedAt),
        }),
      );
  });
  await page.addInitScript({
    content: `(() => {
    if (window.top !== window) return;
    ${captureRuntime}
    void window.__tracecaseDocument(location.href);
    TraceCaseCapture.startCapture(
      step => { void window.__tracecaseEmit(step); },
      message => { void window.__tracecaseGap(message); }, () => {}, ${startedAt}
    );
  })();`,
  });
  return steps;
}
