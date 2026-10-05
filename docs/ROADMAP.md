# Implementation roadmap

Based on the supplied research and product plan, with TraceCase as a working name.

## Milestone 0 — started

Implemented: TypeScript workspace, versioned validated JSON artifact, semantic click/fill/select recorder, ranked locator candidates, capture/inspect/run/verify CLI, Playwright replay, deterministic checkout demo, and automated 20-scenario capture/replay suite.

Remaining before a public milestone-0 release: broader real-world application recordings, navigation and capture-gap reporting, recorder UX hardening, privacy review, and naming/package availability checks. Automated checkout variations establish feasibility but do not replace 20 independent real-world recordings.

## Next

1. Chromium MV3 extension capture with explicit capability reporting and persistent event storage.
2. Versioned ZIP artifact with checksums, bounded parsing, and redaction pipeline.
3. Local viewer and correlated evidence timeline.
4. Network fixture capture and deterministic matching with divergence reporting.
5. Playwright regression-test export based on expected behavior.

Keep visual replay and executable replay distinct. No accounts, hosted storage, analytics, or AI service is required for the core workflow.
