import { readFileSync } from "node:fs";
// Inline local styles so recorded examples keep their styling with remote CSS blocked.
export function exampleStyles() {
  return ["openai-foundations.css", "select.css", "tokens.css", "examples.css"]
    .map((name) =>
      readFileSync(
        new URL(`../packages/ui/${name}`, import.meta.url),
        "utf8",
      ).replace(/^@import.*$/gm, ""),
    )
    .join("\n");
}
