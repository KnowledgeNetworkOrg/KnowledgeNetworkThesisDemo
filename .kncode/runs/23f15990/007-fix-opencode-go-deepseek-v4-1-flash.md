Optional:
- R0-1 fixed: `src/model/lensmessage.ts` gives the Science exception group its own wording; `LensPane.tsx` uses it, and `lensmessage.test.ts` covers Science, area, enclosing-unit and other-corpus cases.
- R0-2 fixed: `src/model/standingnotice.ts` now returns the description’s tail from the notice opener rather than matching a copied full sentence; `standingnotice.test.ts` checks every `CS2023_WALKS` route with stops, and the zero-stop route.
- R0-3 fixed: the app-owned titles carry the badges; the DS `WalkStrip` step title has no mark field and the card explicitly does not make that DS change. That reading is recorded in `src/state/walk/StopMarks.tsx` and stated here for the PR body.
- R0-4 fixed: `lensmessage.test.ts` covers the Lens branches and `visited.test.ts` covers the widened cs2023 `visited` set; `src/state/bus.ts` now uses the tested `visitedIds` helper.

Nit:
- R0-5 fixed: `filled` now uses violet, away from split’s jade, and the badge row has a paper backing, hairline border and pill padding.
- R0-6 fixed: the teaching/courses driver branch now requires an active route (“stop N of M”) before counting notices.

`node tools/studio-spike/browsertest-cs2023marks.mjs` passed; the focused unit tests, `npx tsc -b` and eslint on the changed files also passed.

Assumptions: “step titles” means the app-owned titles in the hover card and “walks through here”; the DS `WalkStrip` step title is deliberately not marked, as the card allows.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"Extracted the non-topic lens wording to src/model/lensmessage.ts, which now gives X-Science its own sentence (\u0022Science is outside CS2023 - it has no knowledge units for the lenses to read\u0022); LensPane uses it, with tests for the Science, area, enclosing-unit and other-corpus cases.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"src/model/standingnotice.ts no longer copies the full sentence: it returns the tail of the description from the notice opener, so the wording stays in the data. A new test over all CS2023_WALKS asserts every route with stops yields the exact notice and the zero-stop route yields none.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"The app-owned titles in the hover card and \u0022walks through here\u0022 carry the badges; the DS WalkStrip step title has no mark field and the card explicitly does not make that DS change. This reading is recorded in src/state/walk/StopMarks.tsx and stated for the PR.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"Added src/model/lensmessage.test.ts for the area, enclosing-unit, Science and unchanged-corpus wording, and src/model/visited.test.ts for the widened cs2023 visited set; src/state/bus.ts now uses the tested visitedIds helper.","duplicateOf":null},{"id":"R0-5","answer":"Fixed","because":"Filled now uses the violet hue, well away from split\u0027s jade, and the badge row has a paper backing with a hairline border and pill padding so it reads as attached rather than floating (src/state/walk/StopMarks.tsx).","duplicateOf":null},{"id":"R0-6","answer":"Fixed","because":"The teaching/courses branch now reads the trail strip and fails unless a route is active (\u0022stop N of M\u0022) before it counts standing notices (tools/studio-spike/browsertest-cs2023marks.mjs).","duplicateOf":null}]}
-->
