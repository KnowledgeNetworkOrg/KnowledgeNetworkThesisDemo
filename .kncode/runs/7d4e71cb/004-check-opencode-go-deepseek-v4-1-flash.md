Failures:
- `browsertest-legendinset.mjs` — check "document: the body's first letter shares the legend's left edge (±1px)": glyph Δ 267.69px, content-box Δ 267.69px · legend "Document" vs body "Nothing chosen" (explore). Failed on the first run and on the isolated retry.

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` (build + desktop typecheck + lint + vitest: 69 files, 980 tests, all passed)
- `node tools/studio-spike/browsertest-presenter.mjs` — 103 checks passed
- `node tools/studio-spike/browsertest-presenter-panes.mjs` — 57 checks passed
- `node tools/studio-spike/browsertest-walkvisibility.mjs` — all checks passed
- `node tools/studio-spike/browsertest-walkdock.mjs` — 132 checks passed
- `npm run test:browser` — 37/38 drivers passed; `browsertest-legendinset.mjs` failed twice

Left out: nothing (the corpus switch `VITE_CORPUS=courses` is a dev-mode option, not a separate suite; no opt-in or credentialed suite exists in the scripts).

Verify: ran — passed (all four plan browser checks and `npm run verify` succeeded; the unrelated full-suite failure is the legendinset Document-pane check).

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"browsertest-legendinset.mjs fails its Document-pane alignment check: the body\u0027s first letter does not share the legend\u0027s left edge (\u0394 267.69px), in Explore.","file":"tools/studio-spike/browsertest-legendinset.mjs","line":null,"breaks":"document: the body\u0027s first letter shares the legend\u0027s left edge (\u00B11px)","failure":"FAIL \u2014 glyph \u0394 267.69px, content-box \u0394 267.69px \u00B7 legend \u0022Document\u0022 vs body \u0022Nothing chosen\u0022 (explore). Failed on the first run and on the isolated retry."}],"answers":[]}
-->
