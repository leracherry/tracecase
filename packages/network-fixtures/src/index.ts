import { createHash } from "node:crypto";
import type { BrowserContext } from "playwright";
import type { Artifact } from "../../schema/src/index.js";
import { redactBody, redactUrl } from "../../redaction/src/index.js";
import {
  contentType,
  fixtureIssue,
  normalizedUrl,
  type NetworkCoverage,
} from "./plan.js";
export { fixturePlan } from "./plan.js";
export type { NetworkCoverage } from "./plan.js";
export type NetworkOptions = {
  network?: "live" | "recorded";
  unmatched?: "abort" | "live";
  passthrough?: string[];
};
export function validateNetworkOptions(options: NetworkOptions) {
  if (
    options.network !== undefined &&
    !["live", "recorded"].includes(options.network)
  )
    throw new Error("--network must be live or recorded");
  if (
    options.unmatched !== undefined &&
    !["abort", "live"].includes(options.unmatched)
  )
    throw new Error("--unmatched must be abort or live");
  if (
    (options.unmatched || options.passthrough?.length) &&
    options.network !== "recorded"
  )
    throw new Error("Network exceptions require --network recorded");
  if (
    options.passthrough &&
    (options.passthrough.length > 16 ||
      options.passthrough.some((pattern) => !pattern || pattern.length > 512))
  )
    throw new Error(
      "Provide at most 16 passthrough patterns, up to 512 characters each",
    );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
export function bodyHash(
  body: string | undefined,
  type: string,
): string | undefined {
  if (body === undefined || body === "")
    return createHash("sha256").update("").digest("hex");
  const safe = redactBody(body, type);
  if (safe === undefined) return undefined;
  let normalized = safe;
  if (/json/.test(type)) normalized = canonical(JSON.parse(safe));
  else {
    const params = new URLSearchParams(safe);
    params.sort();
    normalized = params.toString();
  }
  return createHash("sha256").update(normalized).digest("hex");
}
function glob(pattern: string): RegExp {
  return new RegExp(
    "^" +
      pattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*") +
      "$",
  );
}
export async function installNetworkReplay(
  context: BrowserContext,
  artifact: Artifact,
  destination: string,
  options: NetworkOptions,
): Promise<NetworkCoverage> {
  validateNetworkOptions(options);
  const records = artifact.version === "0.2" ? artifact.evidence.network : [];
  const fixtures = records.map((record, index) => ({
    record,
    index,
    issue: fixtureIssue(record),
    url: normalizedUrl(record.url, artifact.entryUrl, destination),
    hash: bodyHash(record.requestBody, contentType(record.requestHeaders)),
  }));
  const coverage: NetworkCoverage = {
    policy: options.unmatched || "abort",
    totalFixtures: records.length,
    eligibleFixtures: fixtures.filter((f) => !f.issue).length,
    usedFixtures: 0,
    unusedFixtures: fixtures.filter((f) => !f.issue).length,
    requests: 0,
    matched: 0,
    passedThrough: 0,
    unmatched: 0,
    aborted: 0,
    errors: 0,
    truncated: false,
    entries: [],
    unavailable: fixtures
      .filter((f) => f.issue)
      .map((f) => ({
        index: f.index,
        method: f.record.method,
        url: redactUrl(f.record.url),
        reason: f.issue!,
      })),
    unused: fixtures.filter((f) => !f.issue).map((f) => f.index),
  };
  const occurrences = new Map<string, number>(),
    used = new Set<number>();
  const exceptions = (options.passthrough || []).map(glob);
  const groups = new Map<string, typeof fixtures>();
  const keyOf = (
    method: string,
    url: string,
    type: string,
    hash: string | undefined,
  ) => JSON.stringify([method.toUpperCase(), url, type, hash]);
  for (const fixture of [...fixtures].sort(
    (a, b) => a.record.time - b.record.time || a.index - b.index,
  )) {
    const key = keyOf(
      fixture.record.method,
      fixture.url,
      contentType(fixture.record.requestHeaders),
      fixture.hash,
    );
    const group = groups.get(key) || [];
    group.push(fixture);
    groups.set(key, group);
  }
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!["fetch", "xhr"].includes(request.resourceType())) {
      await route.continue().catch(() => {});
      return;
    }
    const method = request.method(),
      url = normalizedUrl(request.url(), destination, destination);
    coverage.requests++;
    const type = contentType(request.headers());
    const body = request.postData() ?? undefined;
    const hash = bodyHash(body, type);
    const key = keyOf(method, url, type, hash);
    const occurrence = (occurrences.get(key) || 0) + 1;
    occurrences.set(key, occurrence);
    const entry: NetworkCoverage["entries"][number] = {
      method: method.slice(0, 16),
      url: url.slice(0, 8192),
      occurrence,
      outcome: "aborted",
    };
    const append = () => {
      if (coverage.entries.length < 2000) coverage.entries.push(entry);
      else coverage.truncated = true;
    };
    try {
      // Explicit exceptions are evaluated before consuming any recorded occurrence.
      if (exceptions.some((pattern) => pattern.test(url))) {
        entry.outcome = "passthrough";
        entry.reason = "Explicit live exception";
        coverage.passedThrough++;
        append();
        await route.continue();
        return;
      }
      const fixture = groups.get(key)?.[occurrence - 1];
      if (hash !== undefined && fixture && !fixture.issue) {
        entry.outcome = "matched";
        entry.fixtureIndex = fixture.index;
        coverage.matched++;
        used.add(fixture.index);
        coverage.usedFixtures = used.size;
        coverage.unused = fixtures
          .filter((f) => !f.issue && !used.has(f.index))
          .map((f) => f.index);
        coverage.unusedFixtures = coverage.unused.length;
        append();
        const record = fixture.record;
        // Never restore credentials, redirects, compression or executable response types.
        const headers: Record<string, string> = { "cache-control": "no-store" };
        const responseType = contentType(record.responseHeaders);
        if (responseType) headers["content-type"] = responseType;
        await route.fulfill({
          status: record.status,
          headers,
          body:
            method === "HEAD" || [204, 205].includes(record.status)
              ? ""
              : record.responseBody!,
        });
        return;
      }
      coverage.unmatched++;
      const sameUrl = fixtures.filter(
        (f) => f.url === url && f.record.method.toUpperCase() === method,
      );
      entry.reason =
        fixture?.issue ||
        (hash === undefined
          ? "Request body type cannot be safely matched"
          : sameUrl.length
            ? "Request body, content type, or occurrence differs"
            : "No recorded request matches this URL and method");
      if (coverage.policy === "live") {
        entry.outcome = "live";
        coverage.passedThrough++;
        append();
        await route.continue();
      } else {
        coverage.aborted++;
        append();
        await route.abort("failed");
      }
    } catch {
      entry.reason = "API routing failed before the request completed";
      coverage.errors++;
    }
  });
  return coverage;
}
