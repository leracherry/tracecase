import { mkdir, open, unlink } from "node:fs/promises";
import { dirname, basename, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";
import {
  exportPlaywright,
  type ExportOptions,
} from "../../playwright-export/src/index.js";
import {
  validatePlugin,
  type TraceCasePlugin,
} from "../../plugins/src/index.js";
import type { Artifact } from "../../schema/src/index.js";
export async function loadPlugins(paths: string[]): Promise<TraceCasePlugin[]> {
  if (paths.length > 8)
    throw new Error("At most eight explicit plugins can be loaded");
  return Promise.all(
    paths.map(async (path) =>
      validatePlugin((await import(pathToFileURL(resolve(path)).href)).default),
    ),
  );
}
export async function writeTest(
  artifact: Artifact,
  out: string,
  options: ExportOptions = {},
) {
  const target = resolve(out);
  if (!target.endsWith(".spec.ts"))
    throw new Error("Test output must end in .spec.ts");
  const name = basename(target).slice(0, -8),
    bundle = exportPlaywright(artifact, { ...options, name });
  const prepared = await Promise.all(
    bundle.files.map(async (file) => ({
      ...file,
      content: await format(file.content, {
        parser: file.name.endsWith(".json")
          ? "json"
          : file.name.endsWith(".mjs")
            ? "babel"
            : "typescript",
      }),
    })),
  );
  await mkdir(dirname(target), { recursive: true });
  const created: { path: string; handle: Awaited<ReturnType<typeof open>> }[] =
    [];
  try {
    // Reserve every output before writing; never partially overwrite a user's test bundle.
    for (const file of prepared) {
      const path = join(dirname(target), file.name);
      created.push({ path, handle: await open(path, "wx") });
    }
    for (let i = 0; i < prepared.length; i++)
      await created[i]!.handle.writeFile(prepared[i]!.content);
    await Promise.all(created.map((file) => file.handle.close()));
  } catch (error) {
    await Promise.allSettled(
      created.map(async (file) => {
        await file.handle.close();
        await unlink(file.path);
      }),
    );
    throw error;
  }
  return { paths: created.map((file) => file.path), warnings: bundle.warnings };
}
export function editorLink(path: string, editor: "vscode" | "cursor") {
  return `${editor}://file/${resolve(path).split("/").map(encodeURIComponent).join("/").replace(/^\//, "")}:1`;
}
