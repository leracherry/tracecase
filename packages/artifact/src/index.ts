import { zipSync, Unzip, UnzipInflate, strToU8, strFromU8 } from "fflate";
import {
  artifactSchema,
  parseArtifact,
  type Artifact,
} from "../../schema/src/index.js";
export const MAX_PACKED_BYTES = 8 * 1024 * 1024;
export const MAX_EXPANDED_BYTES = 16 * 1024 * 1024;
async function digest(bytes: Uint8Array) {
  const result = await crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  return [...new Uint8Array(result)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
export async function packArtifact(artifact: Artifact): Promise<Uint8Array> {
  const recording = strToU8(JSON.stringify(artifactSchema.parse(artifact)));
  if (recording.length > MAX_EXPANDED_BYTES)
    throw new Error("Expanded artifact exceeds 16 MiB");
  const checksums = strToU8(
    JSON.stringify({ "recording.json": await digest(recording) }),
  );
  if (recording.length + checksums.length > MAX_EXPANDED_BYTES)
    throw new Error("Expanded artifact exceeds 16 MiB");
  const zip = zipSync(
    { "recording.json": recording, "checksums.json": checksums },
    { level: 6 },
  );
  if (zip.length > MAX_PACKED_BYTES)
    throw new Error("Packed artifact exceeds 8 MiB");
  return zip;
}
export async function unpackArtifact(bytes: Uint8Array): Promise<Artifact> {
  if (bytes.length > MAX_PACKED_BYTES)
    throw new Error("Packed artifact exceeds 8 MiB");
  if (bytes[0] !== 80 || bytes[1] !== 75)
    return parseArtifact(strFromU8(bytes));
  const files = new Map<string, Uint8Array>();
  let total = 0;
  let failure: Error | undefined;
  const unzip = new Unzip((file) => {
    if (
      !["recording.json", "checksums.json"].includes(file.name) ||
      files.has(file.name)
    ) {
      failure = new Error("Unexpected or duplicate archive entry");
      return;
    }
    files.set(file.name, new Uint8Array());
    if (
      file.originalSize !== undefined &&
      file.originalSize > MAX_EXPANDED_BYTES
    ) {
      failure = new Error("Expanded artifact exceeds 16 MiB");
      return;
    }
    const chunks: Uint8Array[] = [];
    let length = 0;
    file.ondata = (error, data, final) => {
      if (error) {
        failure = error;
        return;
      }
      length += data.length;
      total += data.length;
      if (total > MAX_EXPANDED_BYTES) {
        failure = new Error("Expanded artifact exceeds 16 MiB");
        file.terminate();
        return;
      }
      chunks.push(data);
      if (final) {
        const merged = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.length;
        }
        files.set(file.name, merged);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  // Feed bounded chunks so forged ZIP sizes cannot trigger an unbounded allocation.
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    if (failure) throw failure;
    unzip.push(
      bytes.subarray(offset, offset + 1024),
      offset + 1024 >= bytes.length,
    );
  }
  if (failure) throw failure;
  const recording = files.get("recording.json"),
    checksums = files.get("checksums.json");
  if (!recording?.length || !checksums?.length)
    throw new Error("Incomplete artifact archive");
  const hashes = JSON.parse(strFromU8(checksums));
  if (hashes["recording.json"] !== (await digest(recording)))
    throw new Error("Artifact checksum mismatch");
  return artifactSchema.parse(JSON.parse(strFromU8(recording)));
}
