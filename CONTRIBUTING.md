# Contributing

Use Node.js 22.12+ and `npm ci`, then install Chromium with `npx playwright install chromium`.

```sh
npm run check
npm test
npm run format
```

Keep changes focused. Add tests for behavioral changes and privacy/security boundaries. Framework fixtures live in `fixtures/frameworks`; extension tests load the production build in isolated Chromium profiles. Never commit real user recordings, authentication state, or credentials. Use synthetic fixtures.

Changes to the artifact schema should preserve supported versions, regenerate `docs/tracecase.schema.json`, and update the format documentation. Keep workspace versions aligned when preparing a release; see [releasing](docs/RELEASING.md).

The project uses the MIT license. Security reports should follow [SECURITY.md](SECURITY.md).
