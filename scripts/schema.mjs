import { z } from "zod";
import { artifactSchema } from "../dist/schema/src/index.js";
import { writeFile } from "node:fs/promises";
await writeFile(
  "docs/tracecase.schema.json",
  JSON.stringify(z.toJSONSchema(artifactSchema), null, 2) + "\n",
);
