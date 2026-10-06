import React, { useEffect, useMemo, useRef, useState } from "react";
import { Replayer } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import {
  packArtifact,
  unpackArtifact,
  MAX_PACKED_BYTES,
} from "../../../packages/artifact/src/index.js";
import {
  artifactSchema,
  type Artifact,
} from "../../../packages/schema/src/index.js";
import { sanitizeVisual } from "./sanitize";
import { ExportWorkbench } from "./ExportWorkbench";
import { NetworkReplay } from "./NetworkReplay";
import "rrweb/dist/style.css";
import "./style.css";
type TimelineRow = {
  time: number;
  type: string;
  message: string;
  detail: unknown;
};
export function Inspector({ initial }: { initial?: Artifact }) {
  const [artifact, setArtifact] = useState<Artifact | undefined>(initial),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<TimelineRow>(),
    [playing, setPlaying] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [observed, setObserved] = useState(""),
    [expected, setExpected] = useState("");
  const [includeVisual, setIncludeVisual] = useState(true),
    [includeScreenshots, setIncludeScreenshots] = useState(true),
    [includeNetwork, setIncludeNetwork] = useState(true),
    [includeConsole, setIncludeConsole] = useState(true);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [hasPlayer, setHasPlayer] = useState(false);
  const replayRoot = useRef<HTMLDivElement>(null),
    player = useRef<Replayer | undefined>(undefined);
  const evidence = artifact?.version === "0.2" ? artifact.evidence : undefined;
  async function load(file: File) {
    try {
      if (file.size > MAX_PACKED_BYTES) throw new Error("File exceeds 8 MiB");
      const value = await unpackArtifact(
        new Uint8Array(await file.arrayBuffer()),
      );
      setArtifact(value);
      setError("");
      setSelected(undefined);
      setReviewed(false);
      setPlaying(false);
      setDownloadNotice("");
      setIncludeVisual(true);
      setIncludeScreenshots(true);
      setIncludeNetwork(true);
      setIncludeConsole(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to open artifact",
      );
    }
  }
  useEffect(() => {
    if (initial) setArtifact(initial);
  }, [initial]);
  useEffect(() => {
    setObserved(artifact?.failure?.observedText || "");
    setExpected(artifact?.failure?.expectedText || "");
    setReviewed(false);
  }, [artifact]);
  useEffect(() => {
    const root = replayRoot.current;
    if (!root) return;
    root.replaceChildren();
    player.current = undefined;
    setHasPlayer(false);
    if (!evidence?.visual.length || evidence.visual.length < 2) return;
    const fit = () => {
      const wrapper = root.querySelector<HTMLElement>(".replayer-wrapper");
      if (wrapper && artifact) {
        const scale = Math.min(1, root.clientWidth / artifact.viewport.width);
        wrapper.style.transform = `scale(${scale})`;
        root.style.height = `${artifact.viewport.height * scale}px`;
      }
    };
    const resize = new ResizeObserver(fit);
    resize.observe(root);
    try {
      player.current = new Replayer(
        sanitizeVisual(evidence.visual) as eventWithTime[],
        {
          root,
          skipInactive: false,
          showWarning: false,
          showDebug: false,
          loadTimeout: 0,
        },
      );
      player.current.pause(0);
      setHasPlayer(true);
      fit();
    } catch (error) {
      setError(`Visual replay unavailable: ${String(error)}`);
    }
    return () => {
      resize.disconnect();
      player.current?.destroy();
      player.current = undefined;
    };
  }, [evidence]);
  const rows = useMemo<TimelineRow[]>(() => {
    if (!artifact) return [];
    const result: TimelineRow[] = artifact.steps.map((step) => ({
      time: step.time,
      type: "action",
      message:
        step.type === "navigation"
          ? `Navigate ${step.url}`
          : `${step.type} · ${step.target.map((t) => (t.kind === "role" ? t.name : t.value)).join(" / ")}`,
      detail: step,
    }));
    for (const event of evidence?.events || [])
      result.push({
        time: event.time,
        type: event.type,
        message: event.message,
        detail: event,
      });
    for (const request of evidence?.network || [])
      result.push({
        time: request.time,
        type: "network",
        message: `${request.method} ${request.url} → ${request.status}`,
        detail: request,
      });
    return result.sort((a, b) => a.time - b.time);
  }, [artifact, evidence]);
  useEffect(() => {
    if (!playing || !player.current || !artifact) return;
    const timer = setInterval(() => {
      const current = player.current;
      if (!current) return;
      const time =
        current.getMetaData().startTime +
        current.getCurrentTime() -
        Date.parse(artifact.createdAt);
      const row = rows.filter((row) => row.time <= time).at(-1);
      if (row) setSelected(row);
      if (current.getCurrentTime() >= current.getMetaData().totalTime)
        setPlaying(false);
    }, 200);
    return () => clearInterval(timer);
  }, [playing, rows, artifact]);
  const visible = rows.filter(
    (row) =>
      (filter === "all" || filter === row.type) &&
      row.message.toLowerCase().includes(search.toLowerCase()),
  );
  function choose(row: TimelineRow) {
    setSelected(row);
    setPlaying(false);
    if (player.current) {
      const start = player.current.getMetaData().startTime;
      const created = Date.parse(artifact!.createdAt);
      player.current.pause(Math.max(0, created + row.time - start));
    }
  }
  const exportArtifact = useMemo(() => {
    if (!artifact) return undefined;
    const updated = {
      ...artifact,
      failure:
        observed && expected
          ? { observedText: observed, expectedText: expected }
          : undefined,
    };
    if (updated.version === "0.2")
      updated.evidence = {
        ...updated.evidence,
        privacy: { ...updated.evidence.privacy, reviewed },
        visual: includeVisual ? updated.evidence.visual : [],
        screenshots: includeScreenshots ? updated.evidence.screenshots : [],
        network: includeNetwork ? updated.evidence.network : [],
        events: includeConsole
          ? updated.evidence.events
          : updated.evidence.events.filter(
              (e) => !["console", "error"].includes(e.type),
            ),
        capabilities: {
          ...updated.evidence.capabilities,
          visual: includeVisual && updated.evidence.capabilities.visual,
          screenshots:
            includeScreenshots && updated.evidence.capabilities.screenshots,
          network: includeNetwork && updated.evidence.capabilities.network,
          bodies: includeNetwork && updated.evidence.capabilities.bodies,
          console: includeConsole && updated.evidence.capabilities.console,
        },
      };
    return updated;
  }, [
    artifact,
    observed,
    expected,
    reviewed,
    includeVisual,
    includeScreenshots,
    includeNetwork,
    includeConsole,
  ]);
  async function download() {
    if (!exportArtifact || !reviewed) return;
    try {
      if (!!observed !== !!expected)
        throw new Error("Enter both observed and expected behavior");
      const updated = exportArtifact;
      const bytes = await packArtifact(artifactSchema.parse(updated));
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(bytes).buffer], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "recording.tracecase";
      link.click();
      setDownloadNotice("Reviewed recording downloaded.");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      setError(String(error));
    }
  }
  return (
    <main
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) void load(file);
      }}
    >
      <header>
        <a className="brand" href="#">
          <img src="/tracecase-logo.png" width="32" height="32" alt="" />
          TraceCase
        </a>
        <span className="local">Local inspection · no upload</span>
        <label className="button">
          Open artifact
          <input
            aria-label="Open artifact"
            type="file"
            accept=".tracecase,.json"
            onChange={(e) => {
              if (e.target.files?.[0]) void load(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!artifact ? (
        <section className="empty">
          <p className="eyebrow">A BUG IS A RUNNABLE ARTIFACT</p>
          <h1>
            See what failed.
            <br />
            Replay the evidence.
          </h1>
          <p>
            Drop a .tracecase file here to inspect its actions, replay, console,
            and requests. Your recording stays in this browser.
          </p>
        </section>
      ) : (
        <>
          <section className="summary">
            <div>
              <p className="eyebrow">
                {evidence?.capabilities.mode || "PROTOTYPE"} CAPTURE
              </p>
              <h1>{artifact.title}</h1>
              <p>{artifact.entryUrl}</p>
            </div>
            <div className="counts">
              <strong>
                {artifact.steps.length}
                <small>actions</small>
              </strong>
              <strong>
                {evidence?.network.length || 0}
                <small>requests</small>
              </strong>
              <strong>
                {evidence?.events.filter((e) => e.type === "error").length || 0}
                <small>errors</small>
              </strong>
            </div>
          </section>
          {!!evidence?.capabilities.warnings.length && (
            <div className="warning">
              {evidence.capabilities.warnings.join(" · ")}
            </div>
          )}
          <nav className="section-nav" aria-label="Recording sections">
            <a href="#evidence">Evidence</a>
            <a href="#network">API replay</a>
            <a href="#review">Privacy review</a>
            <a href="#export">Export & handoff</a>
          </nav>
          <section className="workspace" id="evidence">
            <aside className="timeline">
              <h2>Timeline</h2>
              <input
                aria-label="Search timeline"
                placeholder="Search events…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter timeline"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "all",
                  "action",
                  "network",
                  "console",
                  "error",
                  "marker",
                  "gap",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <div className="rows">
                {visible.map((row, i) => (
                  <button
                    key={i}
                    className={
                      "row " +
                      row.type +
                      (row.type === "network" &&
                      (row.detail as { status: number }).status >= 400
                        ? " failed"
                        : "") +
                      (selected === row ? " selected" : "")
                    }
                    aria-pressed={selected === row}
                    onClick={() => choose(row)}
                  >
                    <time>{(row.time / 1000).toFixed(2)}s</time>
                    <span>{row.message}</span>
                  </button>
                ))}
                {!visible.length && <p>No matching events.</p>}
              </div>
            </aside>
            <section className="visual">
              <div className="panel-head">
                <h2>Visual replay</h2>
                <button
                  disabled={!hasPlayer}
                  onClick={() => {
                    if (!player.current) return;
                    if (playing) player.current.pause();
                    else player.current.play(player.current.getCurrentTime());
                    setPlaying(!playing);
                  }}
                >
                  {playing ? "Pause" : "Play"}
                </button>
              </div>
              <div className="player" ref={replayRoot} />
              {!evidence?.visual.length && (
                <p className="muted">This artifact has no visual recording.</p>
              )}
              <div className="screenshots">
                {evidence?.screenshots.map((shot, i) => (
                  <figure key={i}>
                    <img alt={`Screenshot at ${shot.reason}`} src={shot.data} />
                    <figcaption>
                      {shot.reason} · {(shot.time / 1000).toFixed(1)}s
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
            <aside className="detail">
              <h2>Event inspector</h2>
              <pre>
                {selected
                  ? JSON.stringify(selected.detail, null, 2)
                  : "Select an event to inspect its evidence."}
              </pre>
              <details>
                <summary>Environment & capabilities</summary>
                <pre>
                  {JSON.stringify(
                    evidence
                      ? {
                          environment: evidence.environment,
                          capabilities: evidence.capabilities,
                        }
                      : { viewport: artifact.viewport },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </aside>
          </section>
          <NetworkReplay artifact={artifact} />
          <section className="review" id="review">
            <div>
              <p className="eyebrow">FAILURE & PRIVACY REVIEW</p>
              <h2>Describe the failure. Define the fix.</h2>
              <label>
                Observed failure
                <input
                  placeholder="Exact visible failure text"
                  value={observed}
                  onChange={(e) => setObserved(e.target.value)}
                />
              </label>
              <label>
                Expected behavior
                <input
                  placeholder="Exact text expected after the fix"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </label>
            </div>
            <div>
              <p>
                {evidence?.privacy.redactions || 0} header/body values redacted
                · {evidence?.privacy.excludedInputs || 0} private input events
                excluded.
              </p>
              <p>
                Review input values, URLs, visible page text, console messages,
                screenshots and API payloads before sharing. Automatic redaction
                is a baseline, not a guarantee.
              </p>
              <div className="export-options">
                <span>Include in export:</span>
                {[
                  ["Visual replay", includeVisual, setIncludeVisual],
                  ["Screenshots", includeScreenshots, setIncludeScreenshots],
                  ["Network", includeNetwork, setIncludeNetwork],
                  ["Console", includeConsole, setIncludeConsole],
                ].map(([name, checked, setter]) => (
                  <label key={name as string}>
                    <input
                      type="checkbox"
                      checked={checked as boolean}
                      onChange={(e) =>
                        (setter as (value: boolean) => void)(e.target.checked)
                      }
                    />
                    {name as string}
                  </label>
                ))}
              </div>
              <label className="consent">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />{" "}
                I reviewed the evidence for sensitive content.
              </label>
              <button
                className="primary"
                disabled={!reviewed}
                onClick={() => void download()}
              >
                Export reviewed artifact
              </button>
              <p role="status">{downloadNotice}</p>
              <p className="hint">
                Run locally:{" "}
                <code>
                  tracecase run recording.tracecase --url http://localhost:5173
                </code>
              </p>
            </div>
          </section>
          {exportArtifact && (
            <ExportWorkbench
              key={artifact.createdAt + artifact.title}
              artifact={exportArtifact}
              reviewed={reviewed}
            />
          )}
        </>
      )}
    </main>
  );
}
