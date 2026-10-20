BLOCKED: the full browser suite needs Playwright Firefox revision 1538, but only revision 1543 is installed, so two drivers cannot launch; a third driver’s reduced-motion frame sampler saw only 2 frames in 250 ms on this machine.

Commands run:
```
npm ci
npm ci --prefix desktop
npm run verify
node tools/studio-spike/browsertest-relationsrail.mjs
node tools/studio-spike/browsertest-firstline.mjs
npm run test:browser
node tools/studio-spike/browsertest-emptyeditshift.mjs
node tools/studio-spike/browsertest-studiodesk.mjs
```
`npm run verify` passed: build, desktop typecheck, lint, and all 62 Vitest files / 898 tests. Both plan browser drivers passed. The full browser suite was 33/36: `browsertest-emptyeditshift` and `browsertest-scrollbarclearance` failed to launch missing Firefox 1538; `browsertest-studiodesk` failed its unrelated reduced-motion frame-count assertion. Lockfiles were not modified by `npm ci`.

Left out: desktop smoke (`npm --prefix desktop run smoke`) — an Electron launch not listed in README/verify; `probe-*`/`shot-*` scripts are instruments, not tests, and the browser runner skips them by design.

Verify: ran — passed (the plan’s `npm run verify`, `browsertest-relationsrail.mjs`, and `browsertest-firstline.mjs` all passed).