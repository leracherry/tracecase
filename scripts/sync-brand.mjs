import { cp, mkdir } from "node:fs/promises";
for (const target of ["apps/extension/public", "apps/viewer/public"]) {
  await mkdir(target, { recursive: true });
  await cp("docs/assets/tracecase-logo.png", `${target}/tracecase-logo.png`);
}
