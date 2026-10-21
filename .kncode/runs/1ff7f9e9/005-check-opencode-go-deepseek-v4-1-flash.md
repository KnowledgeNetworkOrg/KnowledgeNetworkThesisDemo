Failures:
- src/studio/apptoolbar.test.ts(19,56) error TS2769: No overload matches this call — 'load' does not exist in type 'Attributes'

Commands I ran:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run build` — failed at `tsc -b` (TS2769 above)
- `npm run typecheck` — failed with the same TS2769 error
- `npm run lint` — passed
- `npm run test` — passed (67 files, 935 tests)
- `npm run typecheck:desktop` — passed
- `npm run verify` — failed at `npm run build` with the same TS2769 error

Left out: `npm run test:browser` (not part of `verify`; it starts its own Vite servers and drives a real browser, so it cannot be run under this step's no-server / no-browser rule). The manual UI click-through in the plan was also not run — it needs a running app in a browser.

Verify: ran — failed: `npm run build`/`tsc -b` stops with TS2769 in `src/studio/apptoolbar.test.ts`; lint, vitest and desktop typecheck pass.

<!-- kncode-findings
{"reports":[{"id":"C0-10","raisedAgain":false,"bucket":"MustFix","what":"\u0060npm run build\u0060 and \u0060npm run typecheck\u0060 fail: \u0060createElement(AppToolbar, { load: { maps: [], onPick: () =\u003E {} } })\u0060 does not typecheck. TypeScript resolves the call to React\u0027s \u0060Attributes\u0060 overload and rejects the \u0060load\u0060 prop with TS2769, so \u0060tsc -b\u0060 stops before \u0060vite build\u0060. The new test file needs to pass props in a form the component\u0027s props type accepts (for example via a typed props variable or Jest/React render helper) so the whole-repo typecheck succeeds.","file":"src/studio/apptoolbar.test.ts","line":19,"breaks":"npm run verify / npm run build / npm run typecheck must pass; the plan\u0027s Verify line requires a clean build and typecheck.","failure":"src/studio/apptoolbar.test.ts(19,56) error TS2769: No overload matches this call \u2014 \u0027load\u0027 does not exist in type \u0027Attributes\u0027"}],"answers":[]}
-->
