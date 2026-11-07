1. **Failures:** none

2. **Commands run:**
- `Test-Path node_modules; Test-Path desktop/node_modules; node --version; npm --version`
- `npm ci --prefix desktop`
- `npm run verify` → build (tsc + vite), desktop typecheck, lint, vitest: 76 files / 1044 tests passed
- `node tools/studio-spike/browsertest-cs2023lists.mjs` → passed
- `npm run test:browser` → 43/43 passed in 265s
- Read-only inspection of `.github/workflows/code-verify.yml`, `package.json`, `README.md`, `CLAUDE.md`, `desktop/package.json`

**Left out:** `desktop`'s `smoke` script and packaging (`pack`): neither is part of `verify` or CI; `smoke` launches Electron, which would keep running after its command, and packaging downloads Electron. No test suite required a credentialed/opt-in service, and no lockfile was changed (`npm ci` used).

3. **Verify:** ran — passed. `npm run verify`, `node tools/studio-spike/browsertest-cs2023lists.mjs`, and `npm run test:browser` all succeeded; the driver confirmed 20 / 3 / 38 under `REQUIRED`, `REQUIRED GROUP 1`, `Professionally-Related Table I` with CPS 109 first, and teaching flat.