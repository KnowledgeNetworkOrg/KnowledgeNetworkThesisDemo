PASS

Commands run:
```
npm run verify
npm run test:browser -- presenter-panes
npm run test:browser
node tools/studio-spike/browsertest-emptyeditshift.mjs
node tools/studio-spike/browsertest-scrollbarclearance.mjs
node tools/studio-spike/browsertest-studiodesk.mjs
```

Left out: `browsertest-emptyeditshift.mjs` and `browsertest-scrollbarclearance.mjs` — both stop at Firefox launch because Playwright expects `ms-playwright/firefox-1538` while only `firefox-1543` is installed; and `browsertest-studiodesk.mjs`'s reduced-motion sampler — headless Edge supplies 2–3 frames where it needs 5+, so that assertion could not be observed. All three are environmental and unrelated to this change. The full browser run was 33/36 passed.

Verify: ran — passed. `npm run verify` (build, desktop typecheck, lint, 63 files / 896 tests) and `npm run test:browser -- presenter-panes` (1/1 in 36s, including the 14px strip, 300/522/360px readings, and the narrowed-window handle check).