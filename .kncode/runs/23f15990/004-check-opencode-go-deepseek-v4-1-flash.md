Failures: none

Commands run:
- `npm ci --prefix desktop` (installed the Electron host's dependencies from its lockfile; no lockfile changed)
- `npm run verify` (build, `typecheck:desktop`, lint, `vitest run` — 72 files / 1023 tests)
- `node tools/studio-spike/browsertest-cs2023marks.mjs`
- `npm run test:browser` (41/41 browser drivers)

Left out: nothing (packaging/`npm --prefix desktop run pack` is a hand-run, Electron-downloading, Windows-only command outside CI, and no opt-in/credential suite exists here).

Verify: ran — passed (the cs2023 driver reported split / split+not matched on MTH 110, filled on CPS 803, split+exception on BLG 143, the secondary tag only at MTH 110 stop 5, the standing notice on cs2023, and no notice on `teaching` or `courses`; `test:browser` followed and passed 41/41).