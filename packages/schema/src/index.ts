import { z } from 'zod';
const text = z.string().min(1).max(4096);
export const locatorSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('testId'), value: text}).strict(),
  z.object({kind: z.literal('role'), role: z.enum(['button','link','textbox','combobox','checkbox','radio']), name: text}).strict(),
  z.object({kind: z.literal('label'), value: text}).strict(),
  z.object({kind: z.literal('placeholder'), value: text}).strict(),
]);
const target = z.array(locatorSchema).min(1).max(8);
const base = {time: z.number().nonnegative(), target};
export const stepSchema = z.discriminatedUnion('type', [
  z.object({...base, type:z.literal('click')}).strict(),
  z.object({...base, type:z.literal('fill'), value:z.string().max(65536), redacted:z.boolean().optional()}).strict(),
  z.object({...base, type:z.literal('select'), value:z.string().max(4096)}).strict(),
]);
const httpUrl = text.refine(value => {try { const u=new URL(value); return ['http:','https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }}, 'Expected HTTP(S) URL without credentials');
export const artifactSchema = z.object({
  format:z.literal('tracecase'), version:z.literal('0.1'), title:text,
  createdAt:z.iso.datetime(), entryUrl:httpUrl,
  viewport:z.object({width:z.number().int().min(1).max(10000),height:z.number().int().min(1).max(10000)}).strict(),
  steps:z.array(stepSchema).max(10000),
  failure:z.object({observedText:text, expectedText:text}).strict().optional(),
}).strict();
export type Artifact = z.infer<typeof artifactSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Candidate = z.infer<typeof locatorSchema>;
export const MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
export function parseArtifact(data:string): Artifact {
  if (Buffer.byteLength(data)>MAX_ARTIFACT_BYTES) throw new Error('Artifact exceeds 4 MiB limit');
  return artifactSchema.parse(JSON.parse(data));
}
export function serializeArtifact(value:Artifact): string {
  const data=JSON.stringify(artifactSchema.parse(value),null,2)+'\n';
  if(Buffer.byteLength(data)>MAX_ARTIFACT_BYTES) throw new Error('Artifact exceeds 4 MiB limit');
  return data;
}
