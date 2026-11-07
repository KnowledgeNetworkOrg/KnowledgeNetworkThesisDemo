I found nothing to fix, and I recorded a PASS verdict. I read the code and did not run `npm run verify` or the browser drivers.

**Earlier findings, checked against the code:**
- **C0-1:** fixed. The expected entry at `src/corpus/cs2023corpus.test.ts:193` now gets `course` and `wording` in the same literal, so the type error is gone.
- **C0-2:** fixed. `src/instruments/TrailStrip.tsx:63` now sets the tooltip with `title={wrapTip(entry.title)}`.
- **R0-3:** fixed. The comment at `src/instruments/TrailStrip.tsx:36-37` now says the last entry for a code decides, which is how the `Map` behaves.
- **R0-4:** fixed. The test now checks that the 13 routes with no prerequisite rows have no `buildsOn` field at all (`toBeUndefined`).
- The tool did not let me answer R0-3 and R0-4 myself; only the reviewer who raised them can.

**The card, against the code:**
- **Generator** (`tools/cs2023import/generate.mjs`): reads `route_links` in the file's order and makes each `walkId` with `routeIdOf`. It sets `title` only for outside courses, and copies `alternative_group` and `calendar_wording` unchanged. It fails if a row's `from` is not a route, or its `to` is neither a route nor an outside course.
- **Regenerated `src/corpus/cs2023walks.ts`:** routes with no rows get no field, because `JSON.stringify` drops the `undefined` value.
- **`Walk` type** (`src/corpus/walks.ts`): `buildsOn` is optional. Its comment says that the entry's `group` is the prerequisite's alternative group, not the route's own `group`.
- **Display** (`TrailStrip`): the line sits on the active-route row. Each wording shows once. Courses that are routes are buttons that call `bus.activateWalk(id, 0)`. Outside courses are plain text, with their title as a tooltip. The new buttons carry no `▶` mark.
- **Tests:** they check every count the card lists (107/105, 71/36, 47/60, 29/24) and that each wording matches the JSON byte for byte.
- **Browser driver:** `tools/studio-spike/browsertest-cs2023builds-on.mjs` exists and follows the marks driver. It checks the exact line "Builds on: CPS 109 or CPS 106", that CPS 109 is a button that opens its route at stop 1, and that CPS 106 is text with no link.
- **README:** the "prerequisites are not carried" line is removed, and what `buildsOn` carries is described.

Must fix:
none

Optional:
none

Nit:
none

Assumptions: the host component was the owner's call ("proposed in the PR"), so I took the active-walk row in `TrailStrip` as the proposal for the owner to rule on rather than a gap. The guard in the 2026-11-05 comment ("the teaching and courses corpora have no `buildsOn`") is not in the signed-off card's done-when list, so I did not require a test for it.