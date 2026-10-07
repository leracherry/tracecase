# Release workflow

The prepared version is `0.1.0-alpha.1`. Releases are GitHub draft releases, with no npm or Chrome Web Store publishing credentials required.

## What CI checks

Pushes to `main`, pull requests, and the reusable workflow run on pinned Ubuntu 24.04 with Node 22 and 24. Each job installs locked dependencies and Chromium, Firefox, and WebKit, validates documentation links and versions, type-checks, builds the extension/viewer/framework fixtures, runs browser tests, and checks the generated schema.

The Node 22 job also builds release archives and installs the CLI tarball into a clean temporary project. The smoke test validates artifacts, exports a Playwright test and agent context, connects an MCP client, checks public module entrypoints, reproduces the demo with live and recorded APIs, writes reports, opens its bundled viewer, and validates archive entrypoints/checksums. The Node 22 job also exercises the reusable artifact verification action against the demo. CI uploads the tested `release-bundle` artifact for 14 days.

## Rehearse without releasing

Run the **Release** workflow manually on `main`. It executes the same validation and packaging checks and uploads the release bundle. Manual runs do not create a tag or release.

Locally:

```sh
npm ci
npx playwright install chromium firefox webkit
npm run check
TRACECASE_CROSS_BROWSER=1 npm test
npm run release:pack
npm run release:smoke
```

Outputs are in `release/`; staging files are in `.releases/`. Both directories are ignored by Git.

## Prepare a version

1. Set the same semantic version in the root and all workspace `package.json` files, then refresh `package-lock.json` with `npm install`.
2. Update `CHANGELOG.md` and `docs/RELEASE_NOTES.md` with the version, behavior changes, and known limits.
3. Run the checks and merge/push the reviewed commit to `main`.
4. Confirm the CI checks are green before tagging that exact commit.

The Chrome manifest uses the numeric version (for example `0.1.0`) and retains the full prerelease version in `version_name`. Build scripts derive both from the root package version.

## Create a release draft

```sh
git tag -a v0.1.0-alpha.1 -m "TraceCase 0.1.0-alpha.1"
git push origin v0.1.0-alpha.1
```

The **Release** workflow validates that the tag matches the package version, reruns CI, requires the tagged commit to belong to `main`, verifies packaged checksums, and creates a draft release. Tags containing a hyphen are marked prereleases. Re-running can refresh assets on a draft but refuses to alter a published release.

Only the draft job has `contents: write`; build/test jobs use read-only repository permissions. Publishing the draft remains a maintainer action in GitHub. The workflow never runs `npm publish` and never submits to the Chrome Web Store.

## Assets

| Asset                            | Use                                                       |
| -------------------------------- | --------------------------------------------------------- |
| `tracecase-<version>.tgz`        | Installable CLI plus its built local viewer               |
| `tracecase-chrome-<version>.zip` | Unpacked Chromium MV3 extension; manifest at archive root |
| `tracecase-viewer-<version>.zip` | Static viewer, served locally                             |
| `SHA256SUMS`                     | Verify download integrity                                 |
| `release-manifest.json`          | Version, source commit, runtime and asset names           |
| `RELEASE_NOTES.md`               | User-facing notes and limitations                         |

Archives include the project license and third-party license notices.

CLI installation from a downloaded release:

```sh
npm install --global ./tracecase-0.1.0-alpha.1.tgz
npx playwright install chromium
tracecase --version
```

For the extension, unzip it and select the extracted directory in Chrome’s **Load unpacked** dialog. For the static viewer, serve the extracted directory on localhost; opening ES modules directly with `file://` is not supported.
