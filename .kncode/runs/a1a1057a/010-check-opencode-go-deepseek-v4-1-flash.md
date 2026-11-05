Failures: none

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` — passed (build, desktop typecheck, lint, 70 files / 996 tests)
- `node tools/studio-spike/browsertest-presenter-start.mjs` — 57 checks passed
- `node tools/studio-spike/browsertest-presenter-panes.mjs` — 69 checks passed
- `node tools/studio-spike/browsertest-presenter.mjs` — 103 checks passed
- `node tools/studio-spike/browsertest-presenterclicker.mjs` — 13 checks passed
- `npm run test:browser` — 40/40 drivers passed in 246s

Left out: nothing

Verify: ran — passed (the plan's four commands all completed successfully; no failures)