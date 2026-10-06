import React, { useEffect, useState } from "react";
import {
  artifactSchema,
  type Artifact,
} from "../../../packages/schema/src/index.js";
import {
  fixturePlan,
  coverageReportSchema,
} from "../../../packages/network-fixtures/src/plan.js";
import type { z } from "zod";
type Report = z.infer<typeof coverageReportSchema>;
const outcomeLabel = {
  matched: "Recorded",
  passthrough: "Live exception",
  aborted: "Blocked",
  live: "Live fallback",
};
const statusLabel = {
  completed: "Actions completed",
  reproduced: "Failure reproduced",
  verified: "Fix verified",
  diverged: "Action mismatch",
  "assertion-failed": "Outcome mismatch",
  "network-diverged": "Network mismatch",
  error: "Replay error",
};
export function NetworkReplay({ artifact }: { artifact: Artifact }) {
  const plan = fixturePlan(artifact);
  const [report, setReport] = useState<Report>(),
    [error, setError] = useState("");
  useEffect(() => {
    setReport(undefined);
    setError("");
  }, [artifact]);
  async function load(file: File) {
    try {
      if (file.size > 4 * 1024 * 1024)
        throw new Error("Replay report exceeds 4 MiB");
      const value = coverageReportSchema.parse(JSON.parse(await file.text()));
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          JSON.stringify(artifactSchema.parse(artifact)),
        ),
      );
      const fingerprint = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (fingerprint !== value.artifactSha256)
        throw new Error(
          "This report belongs to a different artifact. Open the matching recording first.",
        );
      setReport(value);
      setError("");
    } catch {
      setReport(undefined);
      setError(
        "Unable to load report. Choose a recorded-network replay report for this exact artifact (report version 1.1, up to 4 MiB).",
      );
    }
  }
  return (
    <section className="network-replay" aria-label="Network replay coverage">
      <div className="panel-head">
        <h2>Network replay</h2>
        <label className="button">
          Open replay report
          <input
            type="file"
            accept=".json"
            aria-label="Open replay report"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void load(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="coverage-stats">
        <span>
          <strong>
            {plan.eligible} / {plan.total}
          </strong>{" "}
          captured responses available
        </span>
        {!plan.total && (
          <span className="muted">
            Record with enhanced network capture to save API responses.
          </span>
        )}
      </div>
      {!report && (
        <p className="hint">
          Run with <code>--network recorded --report replay.json</code>, then
          open the report to inspect matches and blocked requests.
        </p>
      )}
      {report && (
        <>
          <div className="coverage-stats" role="status">
            <span>
              <strong>
                {report.coverage.matched} / {report.coverage.requests}
              </strong>{" "}
              requests matched
            </span>
            <span>{report.coverage.passedThrough} passed through live</span>
            <span>{report.coverage.aborted} blocked</span>
            <span>{report.coverage.unusedFixtures} unused fixtures</span>
            <span>{report.coverage.errors} routing errors</span>
            <span
              className={
                "status" +
                ([
                  "network-diverged",
                  "error",
                  "diverged",
                  "assertion-failed",
                ].includes(report.status)
                  ? " problem"
                  : "")
              }
            >
              {statusLabel[report.status]}
            </span>
          </div>
          {!!report.coverage.unmatched && (
            <p className="hint">
              {report.coverage.unmatched} requests did not match a recorded
              response.{" "}
              {report.coverage.policy === "abort"
                ? "Unmatched requests were blocked."
                : "Unmatched requests used the live backend."}
            </p>
          )}
          {report.coverage.truncated && (
            <p className="warning">
              Request details are limited to the first 2,000 entries. Counts
              include all observed requests.
            </p>
          )}
          <div className="table-scroll">
            <table>
              <caption className="muted">API request results</caption>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Occurrence</th>
                  <th>Result</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {report.coverage.entries.map((entry, index) => (
                  <tr key={index}>
                    <td>
                      <code>
                        {entry.method} {entry.url}
                      </code>
                    </td>
                    <td>{entry.occurrence}</td>
                    <td>
                      <span
                        className={
                          "status" +
                          (entry.outcome === "aborted" ? " problem" : "")
                        }
                      >
                        {outcomeLabel[entry.outcome]}
                      </span>
                    </td>
                    <td>
                      {entry.reason ||
                        `Recorded response #${entry.fixtureIndex! + 1}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!!plan.entries.some((entry) => entry.issue) && (
        <details>
          <summary>
            Unavailable responses ({plan.total - plan.eligible})
          </summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {plan.entries
                  .filter((entry) => entry.issue)
                  .map((entry) => (
                    <tr key={entry.index}>
                      <td>
                        <code>
                          {entry.method} {entry.url}
                        </code>
                      </td>
                      <td>{entry.issue}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
