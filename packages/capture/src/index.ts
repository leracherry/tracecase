import type { Step, Candidate } from "../../schema/src/index.js";
import {
  PRIVATE_SELECTOR,
  defaultPrivacyRules,
  customPrivateSelector,
  type PrivacyRules,
  sensitiveKey,
  redactText,
  redactUrl,
} from "../../redaction/src/index.js";
export function startCapture(
  emit: (step: Step) => void,
  onGap: (message: string) => void,
  onPrivate: () => void,
  startedAt = Date.now(),
  rules: PrivacyRules = defaultPrivacyRules,
) {
  const selector = [
    PRIVATE_SELECTOR,
    "[data-tracecase-ignore]",
    customPrivateSelector(rules),
  ]
    .filter(Boolean)
    .join(",");
  const time = () => Math.max(0, Date.now() - startedAt);
  const privateElement = (el: Element) =>
    !!el.closest(selector) ||
    sensitiveKey(
      [el.getAttribute("name"), el.id, el.getAttribute("autocomplete")].join(
        " ",
      ),
    ) ||
    rules.fields.some((key) =>
      [el.getAttribute("name"), el.id].some(
        (value) => value?.toLowerCase() === key,
      ),
    );
  const candidates = (el: Element): Candidate[] => {
    const result: Candidate[] = [];
    const testId = el.getAttribute("data-testid");
    if (testId) result.push({ kind: "testId", value: testId });
    const label =
      el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(" ") ||
      (el as HTMLInputElement).labels?.[0]?.textContent?.trim();
    const role =
      el.getAttribute("role") ||
      (
        {
          BUTTON: "button",
          A: "link",
          SELECT: "combobox",
          TEXTAREA: "textbox",
          INPUT:
            (el as HTMLInputElement).type === "checkbox"
              ? "checkbox"
              : (el as HTMLInputElement).type === "radio"
                ? "radio"
                : "textbox",
        } as Record<string, string>
      )[el.tagName];
    const name =
      label ||
      (["button", "link"].includes(role || "")
        ? el.textContent?.trim()
        : undefined);
    if (
      role &&
      name &&
      ["button", "link", "textbox", "combobox", "checkbox", "radio"].includes(
        role,
      )
    )
      result.push({
        kind: "role",
        role: role as "button",
        name: redactText(name, rules).slice(0, 4096),
      });
    if (label)
      result.push({
        kind: "label",
        value: redactText(label, rules).slice(0, 4096),
      });
    const placeholder = el.getAttribute("placeholder");
    if (placeholder) result.push({ kind: "placeholder", value: placeholder });
    return result;
  };
  const action = (
    type: "click" | "fill" | "select" | "key",
    el: Element,
    value?: string,
  ) => {
    if (el.closest("[data-tracecase-ignore]")) return;
    if (privateElement(el)) {
      onPrivate();
      return;
    }
    const target = candidates(el);
    if (!target.length) {
      onGap("Interaction skipped: no semantic locator");
      return;
    }
    emit({
      type,
      time: time(),
      target,
      ...(value === undefined
        ? {}
        : {
            value: redactText(value, rules),
            ...(type === "fill" && redactText(value, rules) !== value
              ? { redacted: true }
              : {}),
          }),
    } as Step);
  };
  let lastEnter = 0;
  const click = (event: Event) => {
    if (
      event instanceof MouseEvent &&
      event.detail === 0 &&
      Date.now() - lastEnter < 500
    )
      return;
    const el =
      event.target instanceof Element
        ? event.target.closest(
            "button,a,[role=button],input[type=checkbox],input[type=radio]",
          )
        : null;
    if (el) action("click", el);
  };
  const input = (event: Event) => {
    const el = event.target;
    if (
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement &&
        !["checkbox", "radio"].includes(el.type))
    )
      action("fill", el, el.value);
  };
  const change = (event: Event) => {
    if (event.target instanceof HTMLSelectElement)
      action("select", event.target, event.target.value);
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === "Enter") lastEnter = Date.now();
    if (
      event.target instanceof Element &&
      [
        "Enter",
        "Escape",
        "Tab",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ].includes(event.key)
    )
      action("key", event.target, event.key);
  };
  document.addEventListener("click", click, true);
  document.addEventListener("input", input, true);
  document.addEventListener("change", change, true);
  document.addEventListener("keydown", key, true);
  // URL polling works from the isolated extension world without patching app history methods.
  let current = location.href;
  const navigation = setInterval(() => {
    if (location.href !== current) {
      current = location.href;
      emit({
        type: "navigation",
        mode: "history",
        url: redactUrl(current, rules),
        time: time(),
      });
    }
  }, 200);
  return () => {
    clearInterval(navigation);
    document.removeEventListener("click", click, true);
    document.removeEventListener("input", input, true);
    document.removeEventListener("change", change, true);
    document.removeEventListener("keydown", key, true);
  };
}
