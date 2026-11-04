Failures:
- `browsertest-presenterclicker.mjs` — check "the deck is the keyboard's pane and has room to scroll" (line 91): deck `max 0`; failed on both the first run and the quiet retry. The new 340px panes-row floor means the deck fits its content at the driver's 1750×560 window, so its short-window overflow premise no longer holds.

Commands run:
- `npm ci --prefix desktop`
- `npm run verify`
- `npm run test:browser`
- `node tools/studio-spike/browsertest-presenter-panes.mjs`
- `node tools/studio-spike/browsertest-presenter.mjs`

Left out: `npm --prefix desktop run smoke` and `npm --prefix desktop run pack` — hand-run, not part of `verify`/CI, and `smoke` needs the Electron binary download; `probe-*`/`shot-*` scripts are instruments, not tests (as `run-browsertests.mjs` states).

Verify: ran — passed (all three plan commands: `npm run verify`, the panes driver with 70 checks, and the presenter driver with 91 checks). The separate full-browser-suite failure above is what makes this FAIL.

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"browsertest-presenterclicker.mjs \u2014 check \u0022the deck is the keyboard\u0027s pane and has room to scroll\u0022 fails (deck max 0). The new 340px panes-row floor means that at the driver\u0027s 1750x560 window the quick-actions deck no longer overflows, so the test\u0027s short-window premise no longer holds; the driver needs a window short enough to overflow the deck now that the row keeps its floor (or another way to make the deck scroll).","file":"tools/studio-spike/browsertest-presenterclicker.mjs","line":91,"breaks":"npm run test:browser (37/38 passed; this driver failed on the first run and again on the quiet retry)","failure":"max 0 \u2014 expected the deck\u0027s scrollHeight to exceed its clientHeight"}],"answers":[]}
-->
