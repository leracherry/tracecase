import { z } from "zod";
import type { Artifact, Evidence } from "../../schema/src/index.js";
import { redactUrl } from "../../redaction/src/index.js";
export type RecordedRequest = Evidence["network"][number];
export function contentType(headers: Record<string, string>): string {
  return (
    Object.entries(headers).find(
      ([key]) => key.toLowerCase() === "content-type",
    )?.[1] || ""
  )
    .split(";")[0]!
    .trim()
    .toLowerCase();
}
export function fixtureIssue(record: RecordedRequest): string | undefined {
  if (!/^[A-Z]+$/i.test(record.method)) return "Unsupported HTTP method";
  if (record.status < 200 || (record.status >= 300 && record.status < 400))
    return "Failed or redirect response is unavailable";
  if (
    !["GET", "HEAD", "OPTIONS"].includes(record.method.toUpperCase()) &&
    record.requestBody === undefined
  )
    return "Request body was not captured";
  if (
    record.requestBody !== undefined &&
    !/json|application\/x-www-form-urlencoded/.test(
      contentType(record.requestHeaders),
    )
  )
    return "Unsupported request body type";
  if (
    record.requestBody !== undefined &&
    /json/.test(contentType(record.requestHeaders))
  ) {
    try {
      JSON.parse(record.requestBody);
    } catch {
      return "Recorded JSON request is invalid";
    }
  }
  if (
    record.method.toUpperCase() === "HEAD" ||
    [204, 205].includes(record.status)
  )
    return undefined;
  if (record.responseBody === undefined)
    return "Response body was not captured";
  if (
    !/^(application\/([\w.-]+\+)?json|application\/x-www-form-urlencoded)$/.test(
      contentType(record.responseHeaders),
    )
  )
    return "Unsupported response body type";
  if (/json/.test(contentType(record.responseHeaders))) {
    try {
      JSON.parse(record.responseBody);
    } catch {
      return "Recorded JSON response is invalid";
    }
  }
  return undefined;
}
/** Sort query parameters and remap only the recorded application's origin. */
export function normalizedUrl(
  value: string,
  entryUrl: string,
  destination: string,
): string {
  const url = new URL(redactUrl(value));
  if (url.origin === new URL(entryUrl).origin) {
    const base = new URL(destination);
    url.protocol = base.protocol;
    url.host = base.host;
  }
  url.searchParams.sort();
  return url.href;
}
export function fixturePlan(artifact: Artifact) {
  const records = artifact.version === "0.2" ? artifact.evidence.network : [];
  const entries = records.map((record, index) => ({
    index,
    id: record.id,
    method: record.method,
    url: redactUrl(record.url),
    issue: fixtureIssue(record),
  }));
  return {
    total: records.length,
    eligible: entries.filter((item) => !item.issue).length,
    entries,
  };
}
const count = z.number().int().nonnegative().max(1000000);
export const networkCoverageSchema = z
  .object({
    policy: z.enum(["abort", "live"]),
    totalFixtures: count,
    eligibleFixtures: count,
    usedFixtures: count,
    unusedFixtures: count,
    requests: count,
    matched: count,
    passedThrough: count,
    unmatched: count,
    aborted: count,
    errors: count,
    truncated: z.boolean(),
    entries: z
      .array(
        z
          .object({
            method: z.string().max(16),
            url: z.string().max(8192),
            outcome: z.enum(["matched", "passthrough", "aborted", "live"]),
            occurrence: count,
            fixtureIndex: count.optional(),
            reason: z.string().max(512).optional(),
          })
          .strict(),
      )
      .max(2000),
    unavailable: z
      .array(
        z
          .object({
            index: count,
            method: z.string().max(16),
            url: z.string().max(8192),
            reason: z.string().max(512),
          })
          .strict(),
      )
      .max(2000),
    unused: z.array(count).max(2000),
  })
  .strict();
export type NetworkCoverage = z.infer<typeof networkCoverageSchema>;
export const coverageReportSchema = z.object({
  format: z.literal("tracecase-replay-report"),
  version: z.literal("1.1"),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().max(8192),
  status: z.enum([
    "completed",
    "reproduced",
    "verified",
    "diverged",
    "assertion-failed",
    "network-diverged",
    "error",
  ]),
  network: z.literal("recorded"),
  coverage: networkCoverageSchema,
});
