BLOCKED: `browsertest-studiodesk`'s reduced-motion palette-flight sampler renders only 2–4 frames where it requires 5 on this machine; it fails alone as well as in the suite, and the earlier check recorded the same failure on base `72206e8`. Everything else, including `npm run verify` and 36/37 browser drivers, passed. Not caused by this change.

Commands run:
```
npm run verify
npm run test:browser
node tools/studio-spike/browsertest-studiodesk.mjs
```
`npm run verify` passed: build, desktop typecheck, lint, 63 test files / 909 tests. `npm run test:browser` ran all 37 drivers (including the two Firefox ones) with 36 passing and `browsertest-studiodesk` failing on both its first run and the runner's quiet retry; `browsertest-deskdividers` passed 41/41. The direct rerun of `studiodesk` failed again with 2 frames, so the "fixed by other session" claim is not reflected in this checkout. No lockfile changed (`package-lock.json` and `desktop/package-lock.json` still carry their original timestamps; no install was run).

Left out: `probe-*` and `shot-*` (instruments, not tests, as `run-browsertests.mjs` states); desktop `smoke`/`pack` (hand-run Electron launch/packaging, not part of `npm run verify`). No opt-in or credentialed suites exist here.

Verify: ran — `npm run verify` passed; `npm run test:browser` failed: `browsertest-studiodesk` reduced-motion sampler saw 3/4 frames (needs 5) in the suite and 2 frames alone, with palette coverage 0 on every sampled frame, matching the pre-existing failure on base `72206e8`. The plan's Explore/Plan drag, floor, hairline, reset and narrow-window checks are covered by `browsertest-deskdividers`, which passed.