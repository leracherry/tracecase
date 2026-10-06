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
