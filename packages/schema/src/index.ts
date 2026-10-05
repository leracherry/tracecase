import { z } from "zod";
const text = z.string().min(1).max(4096);
export const locatorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("testId"), value: text }).strict(),
  z
    .object({
      kind: z.literal("role"),
      role: z.enum([
        "button",
        "link",
        "textbox",
        "combobox",
        "checkbox",
        "radio",
      ]),
      name: text,
    })
    .strict(),
  z.object({ kind: z.literal("label"), value: text }).strict(),
  z.object({ kind: z.literal("placeholder"), value: text }).strict(),
]);
export const httpUrl = text.refine((value) => {
  try {
    const u = new URL(value);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
}, "Expected HTTP(S) URL without credentials");
const target = z.array(locatorSchema).min(1).max(8);
const base = { time: z.number().nonnegative(), target };
export const stepSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("click") }).strict(),
  z
    .object({
      ...base,
      type: z.literal("fill"),
      value: z.string().max(65536),
      redacted: z.boolean().optional(),
    })
    .strict(),
  z
    .object({ ...base, type: z.literal("select"), value: z.string().max(4096) })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("key"),
      value: z.enum([
        "Enter",
        "Escape",
        "Tab",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("navigation"),
      time: z.number().nonnegative(),
      url: httpUrl,
      mode: z.enum(["document", "history"]),
    })
    .strict(),
]);
const core = {
  format: z.literal("tracecase"),
  title: text,
  createdAt: z.iso.datetime(),
  entryUrl: httpUrl,
  viewport: z
    .object({
      width: z.number().int().min(1).max(10000),
      height: z.number().int().min(1).max(10000),
    })
    .strict(),
  steps: z.array(stepSchema).max(10000),
  failure: z
    .object({ observedText: text, expectedText: text })
    .strict()
    .optional(),
};
export const evidenceSchema = z
  .object({
    environment: z
      .object({
        userAgent: z.string().max(4096),
        platform: z.string().max(128),
        language: z.string().max(64),
        timezone: z.string().max(128),
      })
      .strict(),
    capabilities: z
      .object({
        visual: z.boolean(),
        console: z.boolean(),
        network: z.boolean(),
        bodies: z.boolean(),
        screenshots: z.boolean(),
        mode: z.enum(["standard", "enhanced"]),
        warnings: z.array(z.string().max(4096)).max(100),
      })
      .strict(),
    events: z
      .array(
        z
          .object({
            type: z.enum(["console", "error", "marker", "navigation", "gap"]),
            time: z.number().nonnegative(),
            message: z.string().max(8192),
          })
          .strict(),
      )
      .max(10000),
    visual: z
      .array(
        z
          .object({
            type: z.number().int().min(0).max(6),
            timestamp: z.number().nonnegative(),
            data: z.unknown(),
          })
          .strict(),
      )
      .max(20000),
    screenshots: z
      .array(
        z
          .object({
            time: z.number().nonnegative(),
            reason: z.enum(["start", "marker", "stop"]),
            data: z.string().max(3000000).startsWith("data:image/jpeg;base64,"),
          })
          .strict(),
      )
      .max(20),
    network: z
      .array(
        z
          .object({
            id: z.string().max(128),
            time: z.number().nonnegative(),
            method: z.string().max(16),
            url: httpUrl,
            requestHeaders: z.record(z.string(), z.string().max(8192)),
            responseHeaders: z.record(z.string(), z.string().max(8192)),
            status: z.number().int().min(0).max(599),
            duration: z.number().nonnegative(),
            requestBody: z.string().max(262144).optional(),
            responseBody: z.string().max(262144).optional(),
            bodyOmitted: z.string().max(512).optional(),
          })
          .strict(),
      )
      .max(2000),
    privacy: z
      .object({
        redactions: z.number().int().nonnegative(),
        excludedInputs: z.number().int().nonnegative(),
        reviewed: z.boolean(),
      })
      .strict(),
  })
  .strict();
export const artifactSchema = z.union([
  z.object({ ...core, version: z.literal("0.1") }).strict(),
  z
    .object({ ...core, version: z.literal("0.2"), evidence: evidenceSchema })
    .strict(),
]);
export type Evidence = z.infer<typeof evidenceSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Candidate = z.infer<typeof locatorSchema>;
export const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
export function parseArtifact(data: string): Artifact {
  if (new TextEncoder().encode(data).byteLength > MAX_ARTIFACT_BYTES)
    throw new Error("Artifact exceeds 4 MiB limit");
  return artifactSchema.parse(JSON.parse(data));
}
export function serializeArtifact(value: Artifact): string {
  const data = JSON.stringify(artifactSchema.parse(value), null, 2) + "\n";
  if (new TextEncoder().encode(data).byteLength > MAX_ARTIFACT_BYTES)
    throw new Error("Artifact exceeds 4 MiB limit");
  return data;
}
