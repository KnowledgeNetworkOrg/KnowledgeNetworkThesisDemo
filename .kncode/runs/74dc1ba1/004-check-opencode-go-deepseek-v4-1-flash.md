**Failures:** none

**Commands run**
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` (build → desktop typecheck → lint → full vitest suite: 69 files, 982 tests, all passed)
- `node tools/studio-spike/browsertest-presenter.mjs` (103 checks passed; #484 draft case reads focus/pins/trail identically after closing the presenter — trail `2 -> 2`)
- `node tools/studio-spike/browsertest-walkvisibility.mjs` (all checks passed, including #481)
- `node tools/studio-spike/browsertest-walkdock.mjs` (132 checks passed, including "stopping the saved walk hands the dock the draft back")
- `npm run test:browser` (whole browser suite: 38/38 passed, 227s)

**Left out:** nothing. The `probe-*` and `shot-*` scripts are measurement/screenshot instruments that the browser runner explicitly excludes, not tests.

**Verify:** ran — passed. The plan's three browser checks all passed, with the #484 draft case's focus, pins and trail count unchanged and no optionals toggle. The card's pre-change baseline run (toggle removed, `src/` unchanged) was not performed, as it would require reverting the code and this step forbids editing files.