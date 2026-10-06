import { createInterface } from "node:readline/promises";
import { safeText, type RepairRequest } from "../../replay/src/index.js";
export async function promptRepair(request: RepairRequest) {
  console.error(
    `\nStep ${request.step} (${request.action}) has no unique visible target.`,
  );
  for (const [index, candidate] of request.suggestions.entries())
    console.error(`${index + 1}. ${safeText(JSON.stringify(candidate))}`);
  if (!request.suggestions.length) {
    console.error("No safe semantic alternatives found.");
    return undefined;
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (
      await rl.question("Choose a replacement number, or Enter to stop: ")
    ).trim();
    if (!/^\d+$/.test(answer)) return undefined;
    return request.suggestions[Number(answer) - 1];
  } finally {
    rl.close();
  }
}
