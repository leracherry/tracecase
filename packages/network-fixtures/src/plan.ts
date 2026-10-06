import { z } from "zod";
export * from "./matching.js";
const count = z.number().int().nonnegative().max(1000000);
export const networkCoverageSchema = z
  .object({
    policy: z.enum(["abort", "live"]),
    totalFixtures: count,
    eligibleFixtures: count,
    usedFixtures: count,
    unusedFixtures: count,
    requests: count,
    matched: count,
    passedThrough: count,
    unmatched: count,
    aborted: count,
    errors: count,
    truncated: z.boolean(),
    entries: z
      .array(
        z
          .object({
            method: z.string().max(16),
            url: z.string().max(8192),
            outcome: z.enum(["matched", "passthrough", "aborted", "live"]),
            occurrence: count,
            fixtureIndex: count.optional(),
            reason: z.string().max(512).optional(),
          })
          .strict(),
      )
      .max(2000),
    unavailable: z
      .array(
        z
          .object({
            index: count,
            method: z.string().max(16),
            url: z.string().max(8192),
            reason: z.string().max(512),
          })
          .strict(),
      )
      .max(2000),
    unused: z.array(count).max(2000),
  })
  .strict();
export type NetworkCoverage = z.infer<typeof networkCoverageSchema>;
export const coverageReportSchema = z.object({
  format: z.literal("tracecase-replay-report"),
  version: z.literal("1.1"),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().max(8192),
  plugins: z.array(z.string().max(8192)).max(8).optional(),
  status: z.enum([
    "completed",
    "reproduced",
    "verified",
    "diverged",
    "assertion-failed",
    "network-diverged",
    "error",
  ]),
  network: z.literal("recorded"),
  coverage: networkCoverageSchema,
});
