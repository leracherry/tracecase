import { defineConfig } from "wxt";
export default defineConfig({
  manifest: {
    name: "TraceCase",
    description: "Record a browser bug and replay it against localhost.",
    version: "0.0.2",
    permissions: ["storage", "activeTab", "scripting"],
    optional_permissions: ["debugger" as never],
    host_permissions: ["http://*/*", "https://*/*"],
    content_security_policy: {
      extension_pages:
        "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; frame-src 'self' blob:; connect-src 'none'",
    },
  },
  vite: () => ({ build: { target: "es2022" } }),
});
