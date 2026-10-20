PASS

Commands run:
```
npm ci
npm ci --prefix desktop
npm run build
npm run typecheck:desktop
npm run lint
npm run test
node tools/studio-spike/browsertest-presenterclicker.mjs
```

Left out: the rest of the browser drivers (`npm run test:browser`); they are excluded from CI and from `npm run verify`, and the plan's check names only the presenter-clicker driver.

Verify: ran — passed (13/13 checks; PageDown/PageUp move the stop, deck does not scroll, recap scrollers work after the lecture ends).