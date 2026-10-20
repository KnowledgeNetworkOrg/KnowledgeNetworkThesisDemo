PASS

Commands run:
```
npm ci
npm ci --prefix desktop
npm run build
npm run test
npm run verify
```

Left out: `npm run test:browser` — the Spike browser drivers need Edge and Vite servers, and are not part of README's `verify` or CI. Desktop `smoke`/`pack` — needs Electron/packaging and is hand-run per README. No lockfile changed.

Verify: ran — passed. `npm run build` and `npm test` green (62 files, 897 tests); `npm run verify` green (build, desktop typecheck, lint, test). The on-screen part of Done-when (3) was not run — it needs a browser.