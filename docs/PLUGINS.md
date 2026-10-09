# Plugin API 1

[Documentation home](README.md)

Plugins are trusted local JavaScript modules explicitly selected with repeatable `--plugin` flags. They are never discovered in artifacts, loaded from remote URLs, or automatically enabled by a recording.

```sh
tracecase context recording.tracecase --plugin ./examples/plugins/sanitize-title.mjs
tracecase verify recording.tracecase --url http://localhost:5173 --plugin ./my-adapter.mjs
```

```ts
interface TraceCasePlugin {
  apiVersion: 1;
  name: string;
  transformArtifact?(artifact: Artifact): Artifact | Promise<Artifact>;
  beforeReplay?(
    context: BrowserContext,
    artifact: Artifact,
  ): void | Promise<void>;
}
```

The installable CLI package exports types at `tracecase/plugins`, validated readers at `tracecase/artifact`, and schema types/validators at `tracecase/schema`. Modules export their plugin object as `default`. Up to eight plugins are allowed.

## Custom redaction and metadata

`transformArtifact` receives a copy. Each result is validated before the next plugin runs. Use it to apply organization-specific redaction, normalize actions, or enrich existing schema fields such as title and capability warnings. The original recording file is unchanged. The hook runs before inspection, exports, MCP startup and replay, and before the CLI recorder writes its file. Extension capture uses built-in pre-persistence redaction plus local [declarative privacy rules](REDACTION.md#custom-browser-privacy-rules); this hook is not a browser-extension capture hook.

## Framework and API adapters

`beforeReplay` receives the fresh browser context after standard recorded routing is installed and before any page is opened. Adapters can add initialization scripts, context settings and explicit custom route matching. Later Playwright routes take precedence; call `route.fallback()` to delegate to the recorded matcher. See `examples/plugins/api-adapter.mjs`.

Custom fulfilled/passed-through routes are outside built-in fixture coverage. Reports list active plugin names; their presence means coverage must be interpreted with the adapter's behavior in mind. Plugin code has the permissions of the CLI process, and hooks are not copied into generated standalone tests. A bad transform or hook fails the operation; validation is not a code sandbox.

## Compatibility

`apiVersion: 1` is required. Artifacts never contain executable plugin declarations. Additive optional hooks may be introduced in a later minor tool release; incompatible changes require a new API version. Browser capture adapters, third-party marketplace discovery and opaque extension fields remain future work.
