import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import {
  packArtifact,
  unpackArtifact,
  MAX_PACKED_BYTES,
  MAX_EXPANDED_BYTES,
} from "../dist/artifact/src/index.js";
import {
  redactHeaders,
  redactBody,
  redactUrl,
} from "../dist/redaction/src/index.js";
const sample = JSON.parse(
  await readFile(
    new URL("../examples/checkout.tracecase", import.meta.url),
    "utf8",
  ),
);
test("portable ZIP integrity, legacy compatibility, and bounded untrusted archives", async () => {
  const packed = await packArtifact(sample);
  assert.deepEqual(await unpackArtifact(packed), sample);
  assert.deepEqual(
    await unpackArtifact(strToU8(JSON.stringify(sample))),
    sample,
  );
  await assert.rejects(
    unpackArtifact(zipSync({ "../escape": strToU8("bad") })),
    /Unexpected/,
  );
  await assert.rejects(
    unpackArtifact(
      zipSync({
        "recording.json": strToU8("{}"),
        "checksums.json": strToU8("{}"),
      }),
    ),
    /checksum/,
  );
  await assert.rejects(
    unpackArtifact(new Uint8Array(MAX_PACKED_BYTES + 1)),
    /8 MiB/,
  );
  await assert.rejects(
    unpackArtifact(
      zipSync({
        "recording.json": new Uint8Array(MAX_EXPANDED_BYTES + 1),
        "checksums.json": strToU8("{}"),
      }),
    ),
    /16 MiB/,
  );
  const forged = zipSync({
    "recording.json": new Uint8Array(MAX_EXPANDED_BYTES + 1),
    "checksums.json": strToU8("{}"),
  });
  new DataView(forged.buffer).setUint32(22, 4, true);
  await assert.rejects(unpackArtifact(forged), /16 MiB/);
  await assert.rejects(unpackArtifact(packed.slice(0, 50)));
});
test("default network redaction excludes credentials and oversized/unsupported bodies", () => {
  const headers = redactHeaders({
    Authorization: "Bearer secret",
    "Proxy-Authorization": "secret",
    Cookie: "sid=secret",
    "Set-Cookie": "sid=secret",
    "content-type": "application/json",
  });
  assert.equal(headers.Authorization, "[REDACTED]");
  assert.equal(headers.Cookie, "[REDACTED]");
  assert.equal(headers["Set-Cookie"], "[REDACTED]");
  const body = redactBody(
    JSON.stringify({
      password: "secret",
      profile: { email: "secret", refresh_token: "secret", name: "Ada" },
      items: [{ api_key: "secret" }],
    }),
    "application/json",
  );
  assert.ok(!body.includes("secret"));
  assert.ok(body.includes("Ada"));
  assert.ok(
    !redactUrl(
      "https://user:secret@test.test/path?access_token=secret&country=CA#secret",
    ).includes("secret"),
  );
  assert.equal(redactBody("a".repeat(262145), "application/json"), undefined);
  assert.equal(redactBody("raw secret", "text/plain"), undefined);
  assert.equal(redactBody("not json", "application/json"), undefined);
  assert.ok(
    !redactBody(
      "password=secret&country=CA",
      "application/x-www-form-urlencoded",
    ).includes("secret"),
  );
});

test("custom privacy rules are bounded, additive, and redact structured and textual data", async () => {
  const { parsePrivacyRules, redactText, redactVisual } =
    await import("../dist/redaction/src/index.js");
  const rules = parsePrivacyRules({
    version: 1,
    fields: ["Customer_ID", "customer_id", "case.code"],
    selectors: [".confidential", '[name="private-field"]'],
  });
  assert.deepEqual(rules.fields, ["customer_id", "case.code"]);
  for (const invalid of [
    null,
    { ...rules, version: 2 },
    { ...rules, fields: [".*"] },
    { ...rules, selectors: ["body{display:none}"] },
    { ...rules, selectors: ["div > p"] },
    { ...rules, fields: Array(51).fill("a") },
    { ...rules, execute: "code" },
  ])
    assert.throws(() => parsePrivacyRules(invalid));
  assert.equal(
    redactHeaders(
      {
        CUSTOMER_ID: "PRIVATE",
        Authorization: "PRIVATE",
        Accept: "application/json",
      },
      rules,
    ).CUSTOMER_ID,
    "[REDACTED]",
  );
  assert.equal(
    redactHeaders({ Authorization: "PRIVATE" }, rules).Authorization,
    "[REDACTED]",
  );
  assert.equal(
    new URL(
      redactUrl("https://example.test/?customer_id=PRIVATE&ok=yes", rules),
    ).searchParams.get("customer_id"),
    "[REDACTED]",
  );
  assert.deepEqual(
    JSON.parse(
      redactBody(
        '{"nested":[{"Customer_ID":"PRIVATE","ok":2}]}',
        "application/json",
        rules,
      ),
    ),
    { nested: [{ Customer_ID: "[REDACTED]", ok: 2 }] },
  );
  assert.equal(
    new URLSearchParams(
      redactBody(
        "customer_id=PRIVATE&ok=yes",
        "application/x-www-form-urlencoded",
        rules,
      ),
    ).get("customer_id"),
    "[REDACTED]",
  );
  assert.equal(
    redactText("customer_id=PRIVATE case.code:PRIVATE caseXcode:public", rules),
    "customer_id=[REDACTED] case.code:[REDACTED] caseXcode:public",
  );
  assert.ok(
    !JSON.stringify(
      redactVisual(
        {
          data: {
            href: "https://example.test/?customer_id=PRIVATE",
            textContent: "customer_id=PRIVATE",
          },
        },
        0,
        rules,
      ),
    ).includes("PRIVATE"),
  );
});
