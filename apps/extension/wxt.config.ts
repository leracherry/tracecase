import { defineConfig } from "wxt";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);
export default defineConfig({
  manifest: ({ browser }) => ({
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "tracecase@tracecase.local",
              strict_min_version: "128.0",
            },
          },
        }
      : {}),
    name: "TraceCase",
    description: "Record a browser bug and replay it against localhost.",
    version: version.split("-")[0],
    version_name: version,
    icons: {
      16: "tracecase-logo.png",
      32: "tracecase-logo.png",
      48: "tracecase-logo.png",
      128: "tracecase-logo.png",
    },
    permissions: ["storage", "activeTab", "scripting"],
    optional_permissions: browser === "firefox" ? [] : ["debugger" as never],
    host_permissions: ["http://*/*", "https://*/*"],
    content_security_policy: {
      extension_pages:
        "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src data:; frame-src 'self' blob:; connect-src 'none'",
    },
  }),
  vite: () => ({ build: { target: "es2022" } }),
});
