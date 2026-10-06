import {
  readFile,
  writeFile,
  mkdir,
  cp,
  readdir,
  rm,
  chmod,
} from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
const root = process.cwd();
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = pkg.version;
execFileSync(process.execPath, ["scripts/releases/check.mjs"], {
  stdio: "inherit",
});
const output = resolve("release");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Stage only allowlisted runtime files; never package the working tree or recordings.
const stage = resolve(".releases/cli");
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const name of [
  "dist",
  "apps/viewer/dist",
  "LICENSE",
  "docs/REDACTION.md",
  "docs/REPLAY.md",
  "docs/NETWORK_REPLAY.md",
  "docs/TRACECASE_FORMAT.md",
  "docs/TEST_EXPORT.md",
  "docs/AGENT_WORKFLOWS.md",
  "docs/PLUGINS.md",
])
  await cp(name, join(stage, name), { recursive: true });
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const notices = ["# Third-party notices\n"];
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location.startsWith("node_modules/") || info.dev || info.link) continue;
  let files;
  try {
    files = await readdir(location);
  } catch {
    continue;
  }
  const licenses = files.filter((name) =>
    /^(license|licence|copying|notice)(\.|$)/i.test(name),
  );
  for (const file of licenses) {
    try {
      notices.push(
        `## ${location.replace(/^node_modules\//, "")} ${info.version} — ${file}\n\n${await readFile(join(location, file), "utf8")}\n`,
      );
    } catch {
      /* Some packages use license directories. */
    }
  }
}
const noticeText = notices.join("\n");
await writeFile(join(stage, "THIRD_PARTY_NOTICES.md"), noticeText);
const dependencies = Object.fromEntries(
  ["playwright", "fflate", "zod", "prettier", "@modelcontextprotocol/sdk"].map(
    (name) => [name, lock.packages[`node_modules/${name}`].version],
  ),
);
await writeFile(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: "tracecase",
      version,
      description:
        pkg.description || "Local-first executable frontend bug reproductions",
      type: "module",
      license: "MIT",
      engines: pkg.engines,
      bin: { tracecase: "dist/cli/src/index.js" },
      files: [
        "dist",
        "apps/viewer/dist",
        "docs",
        "LICENSE",
        "README.md",
        "THIRD_PARTY_NOTICES.md",
      ],
      exports: {
        "./plugins": {
          types: "./dist/plugins/src/index.d.ts",
          import: "./dist/plugins/src/index.js",
        },
        "./artifact": {
          types: "./dist/artifact/src/index.d.ts",
          import: "./dist/artifact/src/index.js",
        },
        "./schema": {
          types: "./dist/schema/src/index.d.ts",
          import: "./dist/schema/src/index.js",
        },
      },
      dependencies,
      repository: {
        type: "git",
        url: "https://github.com/leracherry/tracecase.git",
      },
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(stage, "README.md"),
  `# TraceCase ${version}\n\nInstall this tarball with npm, then run \`npx playwright install chromium\`.\n\n\`tracecase open recording.tracecase\` opens local evidence.\n\`tracecase run recording.tracecase --url http://localhost:5173 --report replay.json\` reruns the scenario.\n\nUse \`tracecase --help\` for commands. Networking defaults to live; recorded API mode is available. This is an experimental prerelease.\n\nDocumentation: https://github.com/leracherry/tracecase\n`,
);
await chmod(join(stage, "dist/cli/src/index.js"), 0o755);
const pack = JSON.parse(
  execFileSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--ignore-scripts", "--json", "--pack-destination", output],
    { cwd: stage, encoding: "utf8" },
  ),
);
const tarball = pack[0].filename;
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const mtime = new Date(
  Number(
    execFileSync("git", ["show", "-s", "--format=%ct", "HEAD"], {
      encoding: "utf8",
    }).trim(),
  ) * 1000,
);
async function entries(directory, prefix = "") {
  const result = {};
  for (const item of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const path = join(directory, item.name);
    const key = prefix + item.name;
    if (item.isDirectory())
      Object.assign(result, await entries(path, key + "/"));
    else if (item.isFile())
      result[key] = [new Uint8Array(await readFile(path)), { mtime }];
    else throw new Error("Release trees cannot contain symlinks");
  }
  return result;
}
const manifest = JSON.parse(
  await readFile("apps/extension/.output/chrome-mv3/manifest.json", "utf8"),
);
if (
  manifest.version !== version.split("-")[0] ||
  manifest.version_name !== version
)
  throw new Error("Rebuild extension after changing version");
const extension = `tracecase-chrome-${version}.zip`,
  viewer = `tracecase-viewer-${version}.zip`;
const extensionEntries = await entries("apps/extension/.output/chrome-mv3");
const legalEntries = {
  LICENSE: [new Uint8Array(await readFile("LICENSE")), { mtime }],
  "THIRD_PARTY_NOTICES.md": [new TextEncoder().encode(noticeText), { mtime }],
};
await writeFile(
  join(output, extension),
  zipSync({ ...extensionEntries, ...legalEntries }, { level: 9 }),
);
const viewerEntries = await entries("apps/viewer/dist");
viewerEntries["README.txt"] = [
  new TextEncoder().encode(
    "TraceCase local viewer\nServe this folder on localhost, e.g. python3 -m http.server 8080 --bind 127.0.0.1, then open http://127.0.0.1:8080 and choose an artifact. Files are parsed locally; no upload occurs.\n",
  ),
  { mtime },
];
await writeFile(
  join(output, viewer),
  zipSync({ ...viewerEntries, ...legalEntries }, { level: 9 }),
);
await cp("docs/RELEASE_NOTES.md", join(output, "RELEASE_NOTES.md"));
await writeFile(
  join(output, "release-manifest.json"),
  JSON.stringify(
    {
      version,
      commit,
      node: process.version,
      artifacts: [tarball, extension, viewer],
      artifactFormat: ["0.1", "0.2"],
      networkReplay: ["live", "recorded"],
      replayReportVersion: "1.1",
    },
    null,
    2,
  ) + "\n",
);
const names = [
  tarball,
  extension,
  viewer,
  "RELEASE_NOTES.md",
  "release-manifest.json",
];
await writeFile(
  join(output, "SHA256SUMS"),
  (
    await Promise.all(
      names.map(
        async (name) =>
          `${createHash("sha256")
            .update(await readFile(join(output, name)))
            .digest("hex")}  ${name}`,
      ),
    )
  ).join("\n") + "\n",
);
console.log(`Release assets prepared in ${relative(root, output)}/`);
