/** Replay evidence is untrusted. Remove active nodes and remote-resource URLs. */
export function sanitizeVisual(value: unknown, depth = 0): any {
  if (depth > 100) return null;
  if (Array.isArray(value))
    return value
      .map((item) => sanitizeVisual(item, depth + 1))
      .filter((item) => item !== null);
  if (typeof value === "string")
    return value
      .replace(/@import[^;]*;/gi, "")
      .replace(/url\([^)]*\)/gi, "none");
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, any>;
  if (
    ["script", "iframe", "object", "embed", "link", "meta"].includes(
      String(source.tagName).toLowerCase(),
    )
  )
    return { ...source, tagName: "span", attributes: {}, childNodes: [] };
  const result: Record<string, any> = Object.create(null);
  for (const [key, item] of Object.entries(source)) {
    if (key === "attributes") {
      const attrs: Record<string, unknown> = {};
      for (const [name, attribute] of Object.entries(item || {})) {
        if (
          /^on/i.test(name) ||
          /^(src|srcset|href|action|formaction|srcdoc|background|xlink:href)$/i.test(
            name,
          )
        )
          continue;
        if (name === "style")
          attrs[name] = String(attribute).replace(/url\([^)]*\)/gi, "none");
        else attrs[name] = attribute;
      }
      result[key] = attrs;
    } else if (key === "textContent" || key === "cssText" || key === "rule")
      result[key] =
        typeof item === "string"
          ? item
              .replace(/@import[^;]*;/gi, "")
              .replace(/url\([^)]*\)/gi, "none")
          : item;
    else result[key] = sanitizeVisual(item, depth + 1);
  }
  return result;
}
