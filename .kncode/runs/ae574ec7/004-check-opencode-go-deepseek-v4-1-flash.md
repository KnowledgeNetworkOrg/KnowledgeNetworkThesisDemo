Failures:
- `tools/studio-spike/browsertest-presenter-start.mjs` check 6 — after clicking the stored session’s row and pressing Enter, the resumed lecture never starts: `stepTo` times out at line 197 waiting for `[data-presenter-chip]`. Reproduced in the standalone run and in both full-suite runs. Likely cause: focus remains on the session row’s `role="button"`, whose Enter handler prevents default and stops propagation, so the card’s window key handler does not start the lecture.

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` — passed (build, desktop typecheck, lint, 985 unit tests)
- `node tools/studio-spike/browsertest-presenter-start.mjs` — failed at check 6
- `node tools/studio-spike/browsertest-presenter.mjs` — passed, 103 checks
- `node tools/studio-spike/browsertest-presenter-panes.mjs` — passed, 70 checks
- `node tools/studio-spike/browsertest-presenterclicker.mjs` — passed, 13 checks
- `node tools/studio-spike/browsertest-rules-washes-baselines.mjs` — passed, 34 checks
- `node tools/studio-spike/browsertest-scrollbarclearance.mjs` — passed, 42 checks
- `npm run test:browser` — 38/39 passed; `browsertest-presenter-start.mjs` failed twice

Left out: nothing. No lockfile was changed by the installs.

Verify: ran — failed: `npm run verify` passed and five of the six plan drivers passed, but `browsertest-presenter-start.mjs` failed check 6, so the planned end-to-end run did not pass.

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"browsertest-presenter-start.mjs check 6 fails on the second start: after clicking the stored session\u0027s row and pressing Enter, the resumed lecture never starts, so the presenter chip never appears (stepTo times out waiting for [data-presenter-chip]). This reproduces on the standalone run and in both test:browser runs, so check 6\u0027s \u0027resumed lecture reaches the walk\u0027s last stop\u0027 and the following \u0027Finished the walk\u0027 assertion never execute.","file":"tools/studio-spike/browsertest-presenter-start.mjs","line":197,"breaks":"The plan\u0027s new end-to-end driver cannot complete checks 6-8 as written; the saved-walk continue/finish path is unverified end to end.","failure":"locator.innerText: Timeout 30000ms exceeded. Call log: waiting for locator(\u0027[data-presenter-chip]\u0027) at chipText (browsertest-presenter-start.mjs:46) via stepTo (:91) at :197. Likely cause: after the row click, focus stays on the row\u0027s role=button, whose Enter handler prevents default and stops propagation, so the card\u0027s window key handler never starts the lecture."}],"answers":[]}
-->
