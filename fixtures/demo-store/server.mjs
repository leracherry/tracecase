import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
export function createDemoServer({
  isFixed = () => process.env.TRACECASE_DEMO_FIXED === "1",
} = {}) {
  return createServer(async (req, res) => {
    if (req.url === "/api/privacy") {
      res.writeHead(200, {
        "content-type": "application/json",
        "Set-Cookie": "sid=DO_NOT_PERSIST; HttpOnly; SameSite=Lax",
      });
      res.end(
        JSON.stringify({
          email: "DO_NOT_PERSIST",
          nested: { access_token: "DO_NOT_PERSIST" },
          country: "CA",
        }),
      );
      return;
    }
    if (req.url === "/api/large") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ large: "x".repeat(300000) }));
      return;
    }
    if (req.url?.startsWith("/api/tax")) {
      const country = new URL(req.url, "http://localhost").searchParams.get(
        "country",
      );
      const broken = country === "CA" && !isFixed();
      res.writeHead(broken ? 500 : 200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          broken ? { error: "Tax service unavailable" } : { tax: 8.5 },
        ),
      );
      return;
    }
    if (
      new URL(req.url || "/", "http://localhost").pathname === "/" ||
      new URL(req.url || "/", "http://localhost").pathname === "/checkout"
    ) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(await readFile(new URL("./index.html", import.meta.url)));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });
}
if (
  process.argv[1] &&
  import.meta.url === new URL(process.argv[1], "file:").href
) {
  const port = Number(process.env.PORT || 5173);
  createDemoServer().listen(port, "127.0.0.1", () =>
    console.log(`Demo checkout: http://127.0.0.1:${port}/checkout`),
  );
}
