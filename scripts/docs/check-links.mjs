import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const files = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "*.md"],
      { cwd: root, encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
];
const anchors = new Map();
async function markdown(path) {
  return (await readFile(path, "utf8")).replace(
    /^```[^\n]*\n[\s\S]*?^```\s*$/gm,
    "",
  );
}
async function headings(path) {
  if (anchors.has(path)) return anchors.get(path);
  const text = await markdown(path),
    found = new Set(),
    counts = new Map();
  for (const match of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = match[1]
      .toLowerCase()
      .replace(/<[^>]*>/g, "")
      .replace(/[^\p{L}\p{N}_\-\s]/gu, "")
      .replace(/\s/g, "-");
    const count = counts.get(base) || 0;
    found.add(base + (count ? `-${count}` : ""));
    counts.set(base, count + 1);
  }
  for (const match of text.matchAll(/\b(?:id|name)=["']([^"']+)["']/g))
    found.add(match[1]);
  anchors.set(path, found);
  return found;
}
const errors = [];
let checked = 0;
for (const file of files) {
  const path = resolve(root, file),
    text = await markdown(path);
  const targets = [
    ...text.matchAll(
      /!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*)?\)/g,
    ),
  ].map((match) => match[1] || match[2]);
  targets.push(
    ...[...text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(
      (match) => match[1],
    ),
  );
  for (const target of targets) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
    checked++;
    try {
      const [name, hash] = target.split("#"),
        destination = name
          ? resolve(dirname(path), decodeURIComponent(name))
          : path;
      await stat(destination);
      if (
        hash &&
        extname(destination) === ".md" &&
        !(await headings(destination)).has(decodeURIComponent(hash))
      )
        throw new Error("missing heading");
    } catch (error) {
      errors.push(`${file}: ${target} (${error.message})`);
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Checked ${checked} local links and anchors in ${files.length} Markdown files.`,
  );
