BLOCKED: `browsertest-studiodesk.mjs`'s reduced-motion frame sampler saw only 2–3 frames where it requires ≥5; per the gate note this is machine/environment timing, fails identically on main, and is not caused by this change.

Commands run:
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser
node tools/studio-spike/browsertest-relationsrail.mjs
node tools/studio-spike/browsertest-firstline.mjs
```

`npm run verify` passed (build, desktop typecheck, lint, 62 Vitest files / 898 tests). The browser suite was 35/36; the only failure was the reduced-motion frame-count assertion in `browsertest-studiodesk.mjs`, which also failed its standalone retry. No lockfile was changed.

Left out: desktop smoke (`npm --prefix desktop run smoke` — needs an Electron launch and is not part of README/verify/CI); `probe-*`/`shot-*` scripts (instruments, not tests, and skipped by the browser runner by design).

Verify: ran — passed (`npm run verify`, `browsertest-relationsrail.mjs`, and `browsertest-firstline.mjs` all passed).