Failures: none

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` (build, desktop typecheck, lint, 68 files / 977 vitest tests — all passed)
- `node tools/studio-spike/browsertest-presenter-panes.mjs` (57 checks passed)

Left out: nothing

Verify: ran — passed