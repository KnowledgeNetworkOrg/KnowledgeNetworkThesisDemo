I've recorded PASS, and both open findings are resolved. I read the code but did not run `npm run verify`, the new browser driver, `npm run test:browser` or the generator. The cs2023 corpus test passed in the fixing step.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Findings answered:**
- **R0-3 (FIXED):** The comment at `src/instruments/TrailStrip.tsx:36-37` now says the last entry for a code decides. That matches `new Map(entries.map(...))` at line 39, which keeps the last entry for a repeated key.
- **R0-4 (FIXED):** In `src/corpus/cs2023corpus.test.ts`, the per-route loop now asserts `w.buildsOn` is `undefined` when a route has no prerequisite rows. An empty `buildsOn: []` on any of the 13 routes without rows would now fail. The 48-route count and the `toEqual` check on the others are unchanged.

**What I checked against the card:**
- **Field and generator:** `Walk.buildsOn` has the card's shape. The generator reads `route_links` in file order, builds `walkId` with `routeIdOf` and carries an outside course's title only when the data has one. It keeps `alternative_group` and `calendar_wording` verbatim, and throws if a `from` is not a route or a `to` is neither a route nor an outside course.
- **Tests:** The new test block covers every count the card lists, and the wording check is byte-identical per route against the JSON.
- **UI:** "Builds on" sits under the standing notice in `TrailStrip`'s active-route row, one line per distinct wording. Route codes are buttons calling `activateWalk(walkId, 0)`, outside courses are plain text with their title as a tooltip, and nothing carries the `▶` mark.
- **Driver and README:** The driver checks "Builds on: CPS 109 or CPS 106", that CPS 109 is a button opening at stop 1, and that CPS 106 is text only. It follows the marks driver, fails on page errors and exits nonzero. The README no longer says prerequisites aren't carried.
- **Scope:** Nothing outside the card changed. `DocumentPanel`, `WalkViewer` and the teaching and courses corpora are untouched.

**Noticed outside this card's scope:** nothing.

Assumptions: I took `TrailStrip`'s active-route row as the host the owner accepts, since the card leaves that to the PR review. I treated the possible scrolling of long wordings in the 92 px strip as accepted, since the card says that column scrolls.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-3","answer":"Fixed","because":"src/instruments/TrailStrip.tsx:36-37 now reads \u0022the last entry for a code decides whether it opens a route or stays text\u0022, which matches \u0060new Map(entries.map(...))\u0060 at line 39 keeping the last entry for a repeated key.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"In src/corpus/cs2023corpus.test.ts the per-route loop now does \u0060if (expected.length === 0) expect(w.buildsOn, w.id).toBeUndefined()\u0060, so an empty \u0060buildsOn: []\u0060 on any of the 13 routes without prerequisite rows fails. The 48-route count and the toEqual check for the others are unchanged.","duplicateOf":null}]}
-->
