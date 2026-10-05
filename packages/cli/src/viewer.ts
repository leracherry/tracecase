import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
export async function openViewer(
  artifact: Uint8Array,
  options: { launch?: boolean } = {},
) {
  const root = resolve(
    fileURLToPath(new URL("../../..", import.meta.url)),
    "apps/viewer/dist",
  );
  try {
    await readFile(resolve(root, "index.html"));
  } catch {
    throw new Error("Build the viewer first: npm run build:viewer");
  }
  const token = randomBytes(24).toString("hex");
  const server = createServer(async (req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (path === `/${token}/artifact`) {
      res.setHeader("Content-Type", "application/octet-stream");
      res.end(artifact);
      return;
    }
    const relative = path === "/" ? "index.html" : path.slice(1);
    const absolute = resolve(root, relative);
    if (!absolute.startsWith(root + "/")) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        (
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
          } as Record<string, string>
        )[extname(absolute)] || "application/octet-stream",
      );
      res.end(await readFile(absolute));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Unable to start viewer");
  const url = `http://127.0.0.1:${address.port}/?artifact=${token}`;
  console.log(`Local viewer: ${url}\nPress Ctrl+C to close.`);
  if (options.launch !== false) {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "explorer"
          : "xdg-open";
    const child = spawn(command, [url], { stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  }
  process.once("SIGINT", () => server.close());
}
