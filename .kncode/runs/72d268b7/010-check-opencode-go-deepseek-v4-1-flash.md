Failures: none

Commands run:
`npm ci`
`npm ci --prefix desktop`
`npm run build`
`npm test`
`npm run verify`

Left out: `npm run test:browser` — it launches a browser and Vite dev servers, which this step forbids; it is not part of `npm run verify`.

Verify: ran — passed (`npm run build`, `npm test`, `npm run verify`; 67 files, 950 tests). The plan's manual end-to-end check (edit draft, reload the app, confirm the Load warning) was not run — it needs a browser and a running app.