Failures: none

Commands run:
- `npm ci` — passed (221 packages)
- `npm ci --prefix desktop` — passed (288 packages)
- `npm run verify` — passed (build, desktop typecheck, lint, 75 test files / 1039 tests)
- `node tools/studio-spike/browsertest-cs2023builds-on.mjs` — passed
- `npm run test:browser` — passed, 42/42 in 263s
- `npm --prefix desktop run smoke` — extra, outside the described suite; 9 checks passed, 3 failed (see note)

Left out: `npm --prefix desktop run pack` (hand-run packaging, not a test; Windows-only and downloads Electron) and the `probe-*`/`shot-*` spike scripts (`run-browsertests.mjs` explicitly treats them as instruments, not tests). No suite is gated on an opt-in flag or credential. Both lockfiles were installed with `npm ci` and neither was edited.

Verify: ran — passed: `npm run verify`, the new `browsertest-cs2023builds-on.mjs` driver, and `npm run test:browser` all pass.

Note: the desktop `smoke` script is a separate hand-run Electron script, not part of `npm run verify` or the README's test instructions. I ran it once for completeness; it fails `pressing ▶ opens the projector window`, `the lecture starts — the presenter screen is live`, and `the deck works in the new host — → advances` because it predates the Present → start-card flow (`browsertest-presenter-start.mjs` documents that newer flow). Those failures predate this change and are outside this card's files, so I did not press them as findings.