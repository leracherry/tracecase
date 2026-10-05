import type { Page } from "playwright";
import { stepSchema, type Step } from "../../schema/src/index.js";
/** Runs in the page. Keep self-contained so Playwright can serialize it. */
export function installRecorder() {
  if (window.top !== window) return;
  const started = performance.now();
  const emit = (type: string, element: Element, value?: string) => {
    if (element.closest("[data-private], [data-tracecase-ignore]")) return;
    const input = element as HTMLInputElement;
    if (
      element.matches("input[type=password],input[type=hidden]") ||
      /password|secret|token|api.?key|ssn|credit|card|cvc|cvv/i.test(
        [input.name, input.id, input.autocomplete].join(" "),
      )
    )
      return;
    const target: unknown[] = [];
    const testId = element.getAttribute("data-testid");
    if (testId) target.push({ kind: "testId", value: testId });
    const labels = (element as HTMLInputElement).labels;
    const labelledBy = (element.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    const label =
      element.getAttribute("aria-label") ||
      labelledBy ||
      labels?.[0]?.textContent?.trim();
    const role =
      element.getAttribute("role") ||
      (
        {
          BUTTON: "button",
          A: "link",
          SELECT: "combobox",
          TEXTAREA: "textbox",
          INPUT:
            input.type === "checkbox"
              ? "checkbox"
              : input.type === "radio"
                ? "radio"
                : "textbox",
        } as Record<string, string>
      )[element.tagName];
    const name =
      label ||
      (["button", "link"].includes(role)
        ? element.textContent?.trim()
        : undefined);
    if (
      role &&
      name &&
      ["button", "link", "combobox", "textbox", "checkbox", "radio"].includes(
        role,
      )
    )
      target.push({ kind: "role", role, name });
    if (label) target.push({ kind: "label", value: label });
    const placeholder = element.getAttribute("placeholder");
    if (placeholder) target.push({ kind: "placeholder", value: placeholder });
    if (!target.length) return;
    const event = {
      type,
      time: performance.now() - started,
      target,
      ...(value === undefined ? {} : { value }),
    };
    void (
      window as unknown as {
        __tracecaseEmit: (event: unknown) => Promise<void>;
      }
    ).__tracecaseEmit(event);
  };
  document.addEventListener(
    "click",
    (event) => {
      const el = (event.target as Element)?.closest(
        "button,a,input[type=checkbox],input[type=radio],[role=button]",
      );
      if (el) emit("click", el);
    },
    true,
  );
  document.addEventListener(
    "input",
    (event) => {
      const el = event.target;
      if (
        (el instanceof HTMLInputElement &&
          !["checkbox", "radio"].includes(el.type)) ||
        el instanceof HTMLTextAreaElement
      )
        emit("fill", el, (el as HTMLInputElement).value);
    },
    true,
  );
  document.addEventListener(
    "change",
    (event) => {
      const el = event.target;
      if (el instanceof HTMLSelectElement) emit("select", el, el.value);
    },
    true,
  );
}
export async function attachRecorder(page: Page): Promise<Step[]> {
  const steps: Step[] = [];
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
  await page.addInitScript(installRecorder);
  return steps;
}
