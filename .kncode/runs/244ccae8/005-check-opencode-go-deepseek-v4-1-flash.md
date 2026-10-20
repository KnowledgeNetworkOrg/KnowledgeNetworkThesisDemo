BLOCKED: `browsertest-studiodesk` fails its reduced-motion palette-flight sampler on this machine (2–4 frames where it needs 5) and fails the same check on base `72206e8` (2–3 frames), so the browser suite cannot be green here; this is not caused by the change.

Commands run:
```
npm ci
npm ci --prefix desktop
npm run verify
npm --prefix desktop run build
npm run test:browser -- coursecorpus
npm run test:browser -- desk
npm run test:browser -- browsertest-d
npm run test:browser -- edgecolor
npm run test:browser -- explorer
npm run test:browser -- firstline
npm run test:browser -- group
npm run test:browser -- legendinset
npm run test:browser -- map
npm run test:browser -- newversionpick
npm run test:browser -- pickerviewport
npm run test:browser -- presenter
npm run test:browser -- previewclamp
npm run test:browser -- relationsrail
npm run test:browser -- rules-washes-baselines
npm run test:browser -- studiodesk
npm run test:browser -- walk
npm run test:browser -- drive-
Invoke-WebRequest <codeload tar.gz for 72206e8> -OutFile <temp>\kn348base.tar.gz
tar -xzf <temp>\kn348base.tar.gz -C <temp>\kn348base
npm ci  (in the temp 72206e8 copy)
npm run test:browser -- studiodesk  (in the temp 72206e8 copy)
```
`npm run verify` passed: build, desktop typecheck, lint, 63 test files / 909 tests. The grouped browser invocations cover all 25 non-Firefox `browsertest-*` and all 10 `drive-*` drivers; 34/35 passed, including `browsertest-deskdividers` 41/41, `studiodesk` failed on both this change and base. Neither lockfile changed (`npm ci` used for both packages). The base copy was fetched as a GitHub tarball because git is not allowed in this step.

Left out: `browsertest-emptyeditshift.mjs` and `browsertest-scrollbarclearance.mjs` (the two Firefox drivers, skipped per the gate note and #415); `probe-*` and `shot-*` (instruments, not tests, as `run-browsertests.mjs` states); desktop `smoke`/`pack` (hand-run Electron launch/packaging, not part of `npm run verify`).

Verify: ran — `npm run verify` passed; `npm run test:browser` passed for every non-Firefox driver except `browsertest-studiodesk`, which fails the pre-existing reduced-motion frame-count assertion identically on base `72206e8` (0/1, failed twice, 2 then 3 frames) and on this change (2–4 frames). The plan's drag/floor/hairline/reset/narrow-window checks are covered by `browsertest-deskdividers`, which passed.