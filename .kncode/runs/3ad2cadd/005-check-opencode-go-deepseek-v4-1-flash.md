Failures: none

Commands ran:
`npm ci`
`npm ci --prefix desktop`
`npm run build`
`npm run test`
`npm run verify`
`grep -rn "3px 6px -4px" src` (via search tool)

Left out: `npm run test:browser` — it is a separate opt-in browser suite driven by `tools/studio-spike/run-browsertests.mjs` and needs Playwright browsers; no browser suite is part of `verify`.

Verify: ran — passed (`npm run build`, `npm run test`, `npm run verify` all succeeded; 925 tests passed). The manual app/DevTools inspection in the plan was not run — it needs a running app and browser, which this step cannot start.