import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { createLowlight } from "lowlight";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import markdown from "highlight.js/lib/languages/markdown";
import type { RootContent } from "hast";
const highlighter = createLowlight({
  json,
  yaml,
  typescript,
  javascript,
  bash,
  markdown,
});
export type CodeLanguage =
  "json" | "yaml" | "typescript" | "javascript" | "bash" | "markdown";
const labels: Record<CodeLanguage, string> = {
  json: "JSON",
  yaml: "YAML",
  typescript: "TypeScript",
  javascript: "JavaScript",
  bash: "Shell",
  markdown: "Markdown",
};
const MAX_PREVIEW = 40000;
// Render only text and spans. Recorded HTML never becomes executable markup.
function tokens(nodes: RootContent[]): ReactNode[] {
  return nodes.map((node, index) =>
    node.type === "text" ? (
      node.value
    ) : node.type === "element" ? (
      <span
        key={index}
        className={
          Array.isArray(node.properties.className)
            ? node.properties.className.join(" ")
            : undefined
        }
      >
        {tokens(node.children)}
      </span>
    ) : null,
  );
}
export function CodeBlock({
  code,
  language,
  label,
}: {
  code: string;
  language: CodeLanguage;
  label: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [wrapped, setWrapped] = useState(true);
  useEffect(() => setCopyStatus(""), [code]);
  useEffect(() => {
    if (!copyStatus) return;
    const timer = setTimeout(() => setCopyStatus(""), 3000);
    return () => clearTimeout(timer);
  }, [copyStatus]);
  const visible = code.slice(0, MAX_PREVIEW);
  const highlighted = useMemo(() => {
    try {
      return tokens(highlighter.highlight(language, visible).children);
    } catch {
      return visible;
    }
  }, [visible, language]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy unavailable. Select the text to copy.");
    }
  }
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span className="code-language">{labels[language]}</span>
        <div className="code-actions">
          <button
            type="button"
            aria-label={`Wrap lines in ${label}`}
            aria-pressed={wrapped}
            onClick={() => setWrapped(!wrapped)}
          >
            Wrap
          </button>
          <button
            type="button"
            aria-label={`Copy ${label}`}
            onClick={() => void copy()}
          >
            Copy
          </button>
        </div>
      </div>
      <pre
        className={wrapped ? "code-content wrapped" : "code-content"}
        tabIndex={0}
        aria-label={label}
      >
        <code>{highlighted}</code>
      </pre>
      {code.length > MAX_PREVIEW && (
        <p className="hint code-note">
          Preview limited to 40,000 characters. Copy or download to get the
          complete content.
        </p>
      )}
      <p className="code-copy-status" role="status">
        {copyStatus}
      </p>
    </div>
  );
}
