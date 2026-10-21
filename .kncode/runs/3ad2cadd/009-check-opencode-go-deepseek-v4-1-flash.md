Failures: none

Commands run:
```
npm ci
npm ci --prefix desktop
npm run build
npm run test
npm run verify
```
Also checked the card's done-when conditions (grep for `3px 6px -4px`, `--lift-group`, `--shadow-lift-group`, and the `VersionedGroup.tsx:1841` line) — all pass.

Left out: `npm run test:browser` and `npm --prefix desktop run smoke` (not part of `verify`, need a browser/running host); the plan's end-to-end box-shadow inspection needs the running app and a browser, so it was not run.

Verify: ran — passed (`npm run build`, `npm run test`, `npm run verify`).