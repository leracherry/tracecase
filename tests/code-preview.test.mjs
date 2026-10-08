import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("code previews highlight supported languages without interpreting untrusted markup and bound large previews", async () => {
  await mkdir(resolve(".releases"), { recursive: true });
  const directory = await mkdtemp(resolve(".releases/code-preview-"));
  try {
    const file = join(directory, "component.mjs");
    await build({
      entryPoints: ["apps/viewer/src/CodeBlock.tsx"],
      outfile: file,
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      logLevel: "silent",
    });
    const { CodeBlock } = await import(pathToFileURL(file).href);
    const samples = {
      json: '{"message":"<img src=x onerror=alert(1)>","count":42,"ok":true}',
      yaml: "name: tracecase\nenabled: true\nsteps:\n  - run: npm test",
      typescript:
        'import { test } from "@playwright/test";\nconst count: number = 42;',
      javascript: 'const value = "<script>alert(1)</script>";',
      bash: 'echo "hello" # comment',
      markdown: "# A recording\n**Expected** behavior",
    };
    for (const [language, code] of Object.entries(samples)) {
      const html = renderToStaticMarkup(
        React.createElement(CodeBlock, { code, language, label: "Example" }),
      );
      assert.match(html, /class="hljs-/, language);
      assert.doesNotMatch(html, /<script|<img/);
      assert.match(html, /Copy Example/);
    }
    const large = renderToStaticMarkup(
      React.createElement(CodeBlock, {
        code: "x".repeat(40000) + "SHOULD_NOT_RENDER",
        language: "json",
        label: "Large preview",
      }),
    );
    assert.doesNotMatch(large, /SHOULD_NOT_RENDER/);
    assert.match(large, /40,000 characters/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
