import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
export async function checkAccessibility(page, exclude = []) {
  let audit = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21aa",
    "wcag22aa",
  ]);
  for (const selector of exclude) audit = audit.exclude(selector);
  const result = await audit.analyze();
  assert.deepEqual(
    result.violations.map((item) => ({
      rule: item.id,
      impact: item.impact,
      targets: item.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
    [],
  );
}
export async function checkReflow(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Page must reflow without horizontal scrolling",
  );
}
