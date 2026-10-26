Failures: none

Commands:
```
npm ci --prefix desktop
npm run verify
node tools/studio-spike/browsertest-presenter-panes.mjs
npm run test:browser
```

Left out: `npm --prefix desktop run smoke` — the Electron host smoke test needs an Electron GUI session and is not part of `npm run verify`; `probe-*`/`shot-*` scripts are measurement/screenshot instruments, not tests, and `run-browsertests.mjs` excludes them by design.

Verify: ran — passed (`npm run verify`; `node tools/studio-spike/browsertest-presenter-panes.mjs`, 57 checks).