import { artifactSchema, type Artifact } from "../../schema/src/index.js";
import type { BrowserContext } from "playwright";
export interface TraceCasePlugin {
  apiVersion: 1;
  name: string;
  transformArtifact?: (artifact: Artifact) => Artifact | Promise<Artifact>;
  beforeReplay?: (
    context: BrowserContext,
    artifact: Artifact,
  ) => void | Promise<void>;
}
export function validatePlugin(value: unknown): TraceCasePlugin {
  const p = value as TraceCasePlugin;
  if (
    !p ||
    p.apiVersion !== 1 ||
    typeof p.name !== "string" ||
    !p.name ||
    p.name.length > 100 ||
    (p.transformArtifact !== undefined &&
      typeof p.transformArtifact !== "function") ||
    (p.beforeReplay !== undefined && typeof p.beforeReplay !== "function")
  )
    throw new Error(
      "Plugin must declare apiVersion 1, name, and callable hooks",
    );
  return p;
}
export async function applyPlugins(
  input: Artifact,
  plugins: TraceCasePlugin[],
): Promise<Artifact> {
  if (plugins.length > 8)
    throw new Error("At most eight plugins can be loaded");
  let artifact = artifactSchema.parse(structuredClone(input));
  for (const plugin of plugins) {
    validatePlugin(plugin);
    if (plugin.transformArtifact)
      artifact = artifactSchema.parse(
        await plugin.transformArtifact(structuredClone(artifact)),
      );
  }
  return artifact;
}
export async function prepareReplay(
  context: BrowserContext,
  artifact: Artifact,
  plugins: TraceCasePlugin[],
) {
  if (plugins.length > 8)
    throw new Error("At most eight plugins can be loaded");
  for (const plugin of plugins) {
    validatePlugin(plugin);
    await plugin.beforeReplay?.(context, structuredClone(artifact));
  }
}
