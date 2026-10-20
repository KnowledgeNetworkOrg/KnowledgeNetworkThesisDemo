BLOCKED: the full browser suite cannot complete — `playwright-core` has no Firefox binary here, so `browsertest-emptyeditshift.mjs` and `browsertest-scrollbarclearance.mjs` fail at launch (`npx playwright install`); `browsertest-studiodesk.mjs` also failed its reduced-motion frame sampler on both attempts (3–4 frames, needs 5+), unrelated to this change.

Commands run:
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser -- presenter-panes
npm run test:browser
```
`npm run verify` passed: build, desktop typecheck, lint, 63 test files / 896 tests.  
Left out: nothing — every script was attempted; the two Firefox-driven browser tests could not launch.  
Verify: ran — passed (`npm run verify` and `npm run test:browser -- presenter-panes`, 1/1 in 36s).