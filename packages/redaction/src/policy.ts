export type PrivacyRules = {
  version: 1;
  fields: string[];
  selectors: string[];
};
export const defaultPrivacyRules: PrivacyRules = {
  version: 1,
  fields: [],
  selectors: [],
};
// Deliberately bounded, declarative rules: no scripts, regexes or arbitrary CSS.
const field = /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/;
const selector =
  /^(?:[.#][A-Za-z_][A-Za-z0-9_-]*|\[(?:data-[a-zA-Z0-9_-]+|name|id)(?:="[A-Za-z0-9_. -]+")?\])$/;
export function parsePrivacyRules(value: unknown): PrivacyRules {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid privacy rules");
  const rules = value as Record<string, unknown>;
  if (
    rules.version !== 1 ||
    Object.keys(rules).some(
      (key) => !["version", "fields", "selectors"].includes(key),
    )
  )
    throw new Error("Unsupported privacy rules");
  const list = (
    input: unknown,
    pattern: RegExp,
    maxLength: number,
  ): string[] => {
    if (!Array.isArray(input) || input.length > 50)
      throw new Error("Use up to 50 rules per list");
    return input.map((item) => {
      if (
        typeof item !== "string" ||
        item.length > maxLength ||
        !pattern.test(item.trim())
      )
        throw new Error("Invalid privacy rule");
      return item.trim();
    });
  };
  return {
    version: 1,
    fields: [
      ...new Set(list(rules.fields, field, 64).map((key) => key.toLowerCase())),
    ],
    selectors: [...new Set(list(rules.selectors, selector, 160))],
  };
}
export function customPrivateSelector(rules: PrivacyRules): string {
  return [
    ...rules.selectors,
    ...rules.fields.flatMap((key) => [`[name="${key}" i]`, `[id="${key}" i]`]),
  ].join(",");
}
