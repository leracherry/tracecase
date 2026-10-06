export const PRIVATE_SELECTOR =
  '[data-private],input[type="password"],input[type="hidden"],input[autocomplete^="cc-"],input[autocomplete="current-password"],input[autocomplete="new-password"],input[name*="token" i],input[name*="secret" i],input[name*="password" i]';
const privateKey =
  /(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|secret|token|api[_-]?key|ssn|credit[_-]?card|cvv|cvc|email|phone)/i;
export function sensitiveKey(key: string) {
  return privateKey.test(key);
}
export function redactText(text: string): string {
  return text
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[REDACTED]",
    )
    .replace(
      /((?:password|secret|token|api[_-]?key|authorization|cookie)\s*[=:]\s*)([^\s,;&]+)/gi,
      "$1[REDACTED]",
    );
}
export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (sensitiveKey(key)) url.searchParams.set(key, "[REDACTED]");
    return url.href;
  } catch {
    return "[invalid URL]";
  }
}
export function redactHeaders(
  headers: Record<string, unknown>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      sensitiveKey(key)
        ? "[REDACTED]"
        : redactText(String(value)).slice(0, 8192),
    ]),
  );
}
export function redactJson(value: unknown, depth = 0): unknown {
  if (depth > 40) return "[depth limit]";
  if (Array.isArray(value))
    return value.map((item) => redactJson(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey(key) ? "[REDACTED]" : redactJson(item, depth + 1),
      ]),
    );
  return typeof value === "string" ? redactText(value) : value;
}
export function redactBody(
  body: string,
  contentType: string,
): string | undefined {
  if (new TextEncoder().encode(body).length > 262144) return undefined;
  if (/json/i.test(contentType)) {
    try {
      return JSON.stringify(redactJson(JSON.parse(body)));
    } catch {
      return undefined;
    }
  }
  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    const params = new URLSearchParams();
    for (const [key, value] of new URLSearchParams(body))
      params.append(key, sensitiveKey(key) ? "[REDACTED]" : redactText(value));
    return params.toString();
  }
  // Free-form response text is omitted: key-based redaction cannot safely cover it.
  return undefined;
}
/** Redact DOM attributes and URL metadata before visual evidence leaves the page. */
export function redactVisual(value: unknown, depth = 0): unknown {
  if (depth > 100) return null;
  if (Array.isArray(value))
    return value.map((item) => redactVisual(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveKey(key)
          ? "[REDACTED]"
          : typeof item === "string"
            ? /^(href|src|url|action)$/i.test(key) && /^https?:/.test(item)
              ? redactUrl(item)
              : redactText(item)
            : redactVisual(item, depth + 1),
      ]),
    );
  return value;
}
