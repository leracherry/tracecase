import { readFile, readdir } from "node:fs/promises";
const root = JSON.parse(await readFile("package.json", "utf8"));
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(root.version))
  throw new Error("Use a semantic package version");
for (const directory of ["packages", "apps"])
  for (const name of await readdir(directory)) {
    try {
      const value = JSON.parse(
        await readFile(`${directory}/${name}/package.json`, "utf8"),
      );
      if (value.version !== root.version)
        throw new Error(`${directory}/${name} version differs from root`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
if (lock.version !== root.version || lock.packages[""].version !== root.version)
  throw new Error("Refresh package-lock.json after changing versions");
if (
  process.env.GITHUB_REF_TYPE === "tag" &&
  process.env.GITHUB_REF_NAME !== `v${root.version}`
)
  throw new Error("Release tag must match package.json version");
const notes = await readFile("docs/RELEASE_NOTES.md", "utf8");
if (!notes.includes(root.version))
  throw new Error("Release notes must name the current version");
console.log(`Release metadata valid: v${root.version}`);
