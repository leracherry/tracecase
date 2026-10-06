import React, { useMemo, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import type { Artifact } from "../../../packages/schema/src/index.js";
import { exportPlaywright } from "../../../packages/playwright-export/src/index.js";
import {
  artifactContext,
  issueMarkdown,
} from "../../../packages/context/src/index.js";
export function ExportWorkbench({
  artifact,
  reviewed,
}: {
  artifact: Artifact;
  reviewed: boolean;
}) {
  const [kind, setKind] = useState("test"),
    [network, setNetwork] = useState<"live" | "recorded">("live"),
    [assertion, setAssertion] = useState<"expected" | "observed">("expected"),
    [url, setUrl] = useState("http://localhost:5173"),
    [notice, setNotice] = useState("");
  const output = useMemo(() => {
    try {
      if (kind === "test")
        return {
          ...exportPlaywright(artifact, { url, network, assertion }),
          error: "",
        };
      return {
        files: [
          {
            name: kind === "issue" ? "issue.md" : "context.json",
            content:
              kind === "issue"
                ? issueMarkdown(artifact)
                : JSON.stringify(artifactContext(artifact), null, 2) + "\n",
          },
        ],
        warnings: [],
        error: "",
      };
    } catch (error) {
      return {
        files: [],
        warnings: [],
        error:
          error instanceof Error ? error.message : "Unable to prepare export",
      };
    }
  }, [artifact, kind, network, assertion, url]);
  function download() {
    if (!reviewed || output.error) return;
    const archive = output.files.length > 1;
    const bytes = archive
      ? zipSync(
          Object.fromEntries(
            output.files.map((file) => [file.name, strToU8(file.content)]),
          ),
        )
      : strToU8(output.files[0]!.content);
    const address = URL.createObjectURL(
      new Blob([new Uint8Array(bytes).buffer], {
        type: archive ? "application/zip" : "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = address;
    a.download = archive ? "recording-test.zip" : output.files[0]!.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(address), 10000);
    setNotice(
      archive
        ? "Test bundle downloaded. Extract all files into your test directory."
        : "Export downloaded.",
    );
  }
  return (
    <section
      className="export-workbench"
      id="export"
      aria-label="Developer exports"
    >
      <div className="panel-head">
        <div>
          <p className="eyebrow">NEXT STEP</p>
          <h2>Turn evidence into a fix</h2>
        </div>
        <span className="status">Local export</span>
      </div>
      <div className="export-layout">
        <div className="export-controls">
          <label>
            Export format
            <select
              aria-label="Export format"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setNotice("");
              }}
            >
              <option value="test">Playwright test</option>
              <option value="issue">Issue draft</option>
              <option value="context">Agent context</option>
            </select>
          </label>
          {kind === "test" ? (
            <>
              <label>
                Check
                <select
                  aria-label="Test assertion"
                  value={assertion}
                  onChange={(e) =>
                    setAssertion(e.target.value as "expected" | "observed")
                  }
                >
                  <option value="expected">
                    Expected behavior · regression test
                  </option>
                  <option value="observed">
                    Recorded failure · reproduction check
                  </option>
                </select>
              </label>
              <label>
                API responses
                <select
                  aria-label="Test networking"
                  value={network}
                  onChange={(e) =>
                    setNetwork(e.target.value as "live" | "recorded")
                  }
                >
                  <option value="live">Live backend</option>
                  <option value="recorded">Recorded responses</option>
                </select>
              </label>
              <label>
                Development URL
                <input
                  aria-label="Test base URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  spellCheck={false}
                />
              </label>
              <p className="hint">
                Run with <code>npx playwright test</code> in a project with{" "}
                <code>@playwright/test</code> installed.
              </p>
            </>
          ) : (
            <p className="hint">
              {kind === "issue"
                ? "A Markdown draft with reproduction steps and observed versus expected behavior."
                : "Compact JSON for your coding agent. Input values, API bodies and visual data are omitted."}
            </p>
          )}
          {!reviewed && (
            <p className="hint">
              Complete the privacy review above to download.
            </p>
          )}
          <button
            className="primary"
            disabled={!reviewed || !!output.error}
            onClick={download}
          >
            {kind === "test"
              ? "Download Playwright test"
              : kind === "issue"
                ? "Download issue draft"
                : "Download agent context"}
          </button>
          <p role="status">{notice}</p>
        </div>
        <div className="export-preview">
          {output.error ? (
            <p className="warning" role="status">
              {output.error}
            </p>
          ) : (
            <>
              <div className="panel-head">
                <span className="hint">{output.files[0]?.name}</span>
                <span className="hint">
                  {output.files.length}{" "}
                  {output.files.length === 1 ? "file" : "files"}
                </span>
              </div>
              <pre tabIndex={0} aria-label="Export preview">
                {output.files[0]?.content}
              </pre>
              {output.warnings.map((warning) => (
                <p className="hint" key={warning}>
                  {warning}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
