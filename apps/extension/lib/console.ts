/** Serialized into the main world. Never forward object arguments or stacks. */
export function installConsoleBridge() {
  const win = window as unknown as {
    __tracecaseConsoleInstalled?: boolean;
    __tracecaseConsoleEnabled?: boolean;
  };
  win.__tracecaseConsoleEnabled = true;
  if (win.__tracecaseConsoleInstalled) return;
  win.__tracecaseConsoleInstalled = true;
  const clean = (text: string) =>
    text
      .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(
        /((?:password|secret|token|api[_-]?key|authorization|cookie)\s*[=:]\s*)([^\s,;&]+)/gi,
        "$1[REDACTED]",
      )
      .slice(0, 8192);
  const send = (type: string, message: string) => {
    if (win.__tracecaseConsoleEnabled)
      window.dispatchEvent(
        new CustomEvent("tracecase-console", {
          detail: JSON.stringify({ type, message: clean(message) }),
        }),
      );
  };
  const original = window.console.error;
  window.console.error = function (...args: unknown[]) {
    send(
      "console",
      args
        .map((arg) =>
          typeof arg === "string" ? arg : "[non-text argument omitted]",
        )
        .join(" "),
    );
    return original.apply(window.console, args);
  };
  window.addEventListener("error", (event) => send("error", event.message));
  window.addEventListener("unhandledrejection", (event) =>
    send(
      "error",
      typeof event.reason === "string"
        ? event.reason
        : "Unhandled promise rejection",
    ),
  );
}
