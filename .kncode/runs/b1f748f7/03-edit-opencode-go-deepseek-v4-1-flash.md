Done. The desktop package can now produce a single portable Windows executable.

**What changed and why**

- `desktop/package.json` — added `electron-builder` (pinned to `26.15.3`, the version npm currently tags `latest`) as a devDependency and a `pack` script. The `desktop/package-lock.json` lockfile was regenerated to match, so CI's `npm ci --prefix desktop` stays valid.
- `desktop/electron-builder.yml` (new) — the packaging recipe: app id matching main.ts, product name "Graph Disclosure Lab", output to `desktop/release/`, the esbuild output (`out/**/*`) as the app, and the root `dist/` copied to the app's `resources/dist` (outside asar, because the loader fetches real files). Windows-only, portable target, x64, no icon configured.
- `desktop/pack.mjs` (new) — mirrors `start.mjs`: builds the web app at the repo root, builds the desktop shell, then runs `electron-builder --win portable --x64`.
- `desktop/main.ts` — when packaged, `DIST` now reads from `process.resourcesPath/dist`; from a checkout it stays the two-levels-up repo path. This is the branch the old comment anticipated.
- `desktop/.gitignore` — ignores the new `release/` output.
- `README.md` — a "Packaging a portable app" section: install both packages, run `npm --prefix desktop run pack`, find `desktop/release/GraphDisclosureLab-<version>-portable.exe`, and the unsigned-first-run SmartScreen warning with the "More info → Run anyway" step. Also states packaging stays a hand-run command with no CI job.

I did not run the full packaging (it downloads Electron and is exactly what the check step runs). I did verify: desktop TypeScript typecheck and esbuild bundle pass, the YAML parses, and `npm ci --prefix desktop` succeeds against the edited lockfile.

**Assumptions:** Product name is "Graph Disclosure Lab" and the artifact is `GraphDisclosureLab-<version>-portable.exe` (derived from the README's app name); `appId` reuses `com.knowledgenetwork.thesisdemo` from `setAppUserModelId`; the placeholder icon means no `win.icon` key, so electron-builder falls back to the default; `electron-builder` is pinned to `26.15.3`; and I removed a stray `knowledge-network-thesis-demo: file:..` dependency that `npm install --prefix desktop` auto-added from the repo root, since it was an npm quirk and unrelated to this card.