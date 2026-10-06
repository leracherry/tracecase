import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { replayWithReport } from "../dist/replay/src/index.js";
import { packArtifact, unpackArtifact } from "../dist/artifact/src/index.js";
import { bodyHash } from "../dist/network-fixtures/src/index.js";
import { fixturePlan } from "../dist/network-fixtures/src/plan.js";
const sample = JSON.parse(
  await readFile(
    new URL("../examples/checkout.tracecase", import.meta.url),
    "utf8",
  ),
);
function recorded(network, path = "/", expected = "historical") {
  return {
    ...sample,
    version: "0.2",
    entryUrl: `https://recorded.test${path}`,
    steps: [
      {
        type: "click",
        time: 0,
        target: [{ kind: "role", role: "button", name: "Run" }],
      },
    ],
    failure: { observedText: expected, expectedText: "live" },
    evidence: {
      environment: {
        userAgent: "test",
        platform: "test",
        language: "en",
        timezone: "UTC",
      },
      capabilities: {
        visual: false,
        console: true,
        network: true,
        bodies: true,
        screenshots: false,
        mode: "enhanced",
        warnings: [],
      },
      events: [],
      visual: [],
      screenshots: [],
      network,
      privacy: { redactions: 0, excludedInputs: 0, reviewed: true },
    },
  };
}
function fixture(path, body, overrides = {}) {
  return {
    id: Math.random().toString(36),
    time: 0,
    method: "GET",
    url: `https://recorded.test${path}`,
    requestHeaders: {},
    responseHeaders: {
      "content-type": "application/json",
      "set-cookie": "secret=DO_NOT_RESTORE",
      "content-encoding": "gzip",
    },
    status: 200,
    duration: 0,
    responseBody: JSON.stringify({ message: body }),
    ...overrides,
  };
}
async function app(script) {
  let hits = 0;
  const server = createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      hits++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "live" }));
    } else {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<button>Run</button><p id="status"></p><script>document.querySelector('button').onclick=async()=>{try{${script}}catch{document.querySelector('#status').textContent='blocked';}};</script>`,
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    get hits() {
      return hits;
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
test("recorded replay preserves per-body occurrences, normalizes queries, loads local frontend, and never calls the changed API", async () => {
  const server = await app(
    `const results=[];for(const body of [{b:2,a:1},{a:9},{a:1,b:2}]){const res=await fetch('/api/state?z=2&a=1',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});results.push((await res.json()).message);}document.querySelector('#status').textContent=results.join(',');`,
  );
  const headers = { "Content-Type": "application/json; charset=utf-8" };
  const first = fixture("/api/state?a=1&z=2", "first", {
    time: 10,
    method: "POST",
    requestHeaders: headers,
    requestBody: '{"a":1,"b":2}',
  });
  const second = fixture("/api/state?z=2&a=1", "second", {
    time: 30,
    method: "POST",
    requestHeaders: headers,
    requestBody: '{"b":2,"a":1}',
  });
  const other = fixture("/api/state?a=1&z=2", "other", {
    time: 20,
    method: "POST",
    requestHeaders: headers,
    requestBody: '{"a":9}',
  });
  try {
    const artifact = await unpackArtifact(
      await packArtifact(
        recorded([second, first, other], "/", "first,other,second"),
      ),
    );
    const report = await replayWithReport(artifact, {
      url: server.url,
      network: "recorded",
    });
    assert.equal(report.status, "reproduced");
    assert.equal(report.coverage.matched, 3);
    assert.equal(report.coverage.unusedFixtures, 0);
    assert.equal(server.hits, 0);
    assert.deepEqual(
      report.coverage.entries.map((entry) => entry.occurrence),
      [1, 1, 2],
    );
    assert.ok(!JSON.stringify(report).includes("DO_NOT_RESTORE"));
  } finally {
    await server.close();
  }
});
test("strict mismatches block writes even when the visible assertion passes; live exceptions are explicit and counted", async () => {
  const server = await app(
    `await fetch('/api/write',{method:'POST',headers:{'content-type':'application/json'},body:'{"x":2}'}).catch(()=>{});document.querySelector('#status').textContent='historical';`,
  );
  const artifact = recorded([
    fixture("/api/write", "unused", {
      method: "POST",
      requestHeaders: { "content-type": "application/json" },
      requestBody: '{"x":1}',
    }),
  ]);
  try {
    const blocked = await replayWithReport(artifact, {
      url: server.url,
      network: "recorded",
    });
    assert.equal(blocked.status, "network-diverged");
    assert.equal(blocked.assertion.passed, true);
    assert.equal(blocked.coverage.aborted, 1);
    assert.equal(server.hits, 0);
    const live = await replayWithReport(artifact, {
      url: server.url,
      network: "recorded",
      unmatched: "live",
    });
    assert.equal(live.status, "reproduced");
    assert.equal(live.coverage.unmatched, 1);
    assert.equal(live.coverage.passedThrough, 1);
    assert.equal(server.hits, 1);
    const exception = await replayWithReport(artifact, {
      url: server.url,
      network: "recorded",
      passthrough: ["*/api/write"],
    });
    assert.equal(exception.coverage.entries[0].outcome, "passthrough");
    assert.equal(exception.coverage.unmatched, 0);
    assert.equal(server.hits, 2);
    await assert.rejects(
      () => replayWithReport(artifact, { network: "bad" }),
      /live or recorded/,
    );
  } finally {
    await server.close();
  }
});
test("missing responses reserve their occurrence; exhausted fixtures and method mismatches cannot reuse a response", async () => {
  const server = await app(
    `const results=[];for(let i=0;i<3;i++){try{const res=await fetch('/api/state');results.push((await res.json()).message);}catch{results.push('blocked');}}await fetch('/api/state',{method:'POST',body:'unknown'}).catch(()=>{});document.querySelector('#status').textContent=results.join(',');`,
  );
  const artifact = recorded(
    [
      fixture("/api/state", "unavailable", {
        responseBody: undefined,
        bodyOmitted: "size limit",
        time: 0,
      }),
      fixture("/api/state", "second", { time: 1 }),
    ],
    "/",
    "blocked,second,blocked",
  );
  try {
    const report = await replayWithReport(artifact, {
      url: server.url,
      network: "recorded",
    });
    assert.equal(report.status, "network-diverged");
    assert.equal(report.coverage.matched, 1);
    assert.equal(report.coverage.aborted, 3);
    assert.equal(report.coverage.unavailable.length, 1);
    assert.equal(server.hits, 0);
    assert.deepEqual(
      report.coverage.entries.slice(0, 3).map((entry) => entry.occurrence),
      [1, 2, 3],
    );
  } finally {
    await server.close();
  }
});
test("fixture eligibility excludes executable content and redirects; hashes preserve arrays and duplicate form values", () => {
  const artifact = recorded([
    fixture("/api/a", "x", {
      responseHeaders: { "content-type": "text/html" },
      responseBody: "<script>bad()</script>",
    }),
    fixture("/api/b", "x", { status: 302 }),
    fixture("/api/c", "x", { responseBody: undefined, status: 204 }),
  ]);
  assert.equal(fixturePlan(artifact).eligible, 1);
  assert.equal(
    bodyHash('{"b":2,"a":1}', "application/json"),
    bodyHash('{"a":1,"b":2}', "application/json"),
  );
  assert.notEqual(
    bodyHash("[1,2]", "application/json"),
    bodyHash("[2,1]", "application/json"),
  );
  assert.notEqual(
    bodyHash("a=1&a=2", "application/x-www-form-urlencoded"),
    bodyHash("a=2&a=2", "application/x-www-form-urlencoded"),
  );
  assert.equal(
    bodyHash("password=old&a=1", "application/x-www-form-urlencoded"),
    bodyHash("a=1&password=new", "application/x-www-form-urlencoded"),
  );
});
test("CLI accepts recorded mode and produces a clean JSON coverage report with nonzero divergence exit", async () => {
  const server = await app(
    `await fetch('/api/new').catch(()=>{});document.querySelector('#status').textContent='historical';`,
  );
  const directory = await mkdtemp(join(tmpdir(), "tracecase-network-"));
  try {
    const file = join(directory, "recording.tracecase");
    await writeFile(file, await packArtifact(recorded([])));
    const result = await new Promise((resolve, reject) => {
      let output = "",
        error = "";
      const child = spawn(process.execPath, [
        "dist/cli/src/index.js",
        "run",
        file,
        "--network",
        "recorded",
        "--url",
        server.url,
        "--json",
      ]);
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (error += chunk));
      child.on("error", reject);
      child.on("exit", (code) => resolve({ code, output, error }));
    });
    assert.equal(result.code, 1);
    const report = JSON.parse(result.output);
    assert.equal(report.status, "network-diverged");
    assert.equal(report.coverage.aborted, 1);
    assert.equal(server.hits, 0);
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("external API origins stay exact and XHR responses never restore recorded cookies", async () => {
  const external = await app("");
  const server = await app(
    `const message=await new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('GET',${JSON.stringify(external.url + "/api/external")});xhr.onload=()=>resolve(JSON.parse(xhr.responseText).message);xhr.onerror=reject;xhr.send();});document.querySelector('#status').textContent=document.cookie.includes('DO_NOT_RESTORE')?'cookie-leaked':message;`,
  );
  const artifact = recorded([
    fixture("/api/external", "historical", {
      url: external.url + "/api/external",
      responseHeaders: {
        "content-type": "application/json",
        "access-control-allow-origin": "https://recorded.test",
        "set-cookie": "secret=DO_NOT_RESTORE",
      },
    }),
  ]);
  try {
    const report = await replayWithReport(artifact, {
      url: server.url,
      network: "recorded",
      timeoutMs: 1000,
    });
    assert.equal(report.status, "reproduced");
    assert.equal(report.coverage.matched, 1);
    assert.equal(external.hits, 0);
  } finally {
    await server.close();
    await external.close();
  }
});
