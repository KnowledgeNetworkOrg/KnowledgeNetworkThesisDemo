The change implements every requirement and every "Done when" line in the card, and I found nothing that must be fixed. I read the code and ran eslint on the changed files, which was clean. I did not run `npm run verify`, the new browser driver or `npm run test:browser`, and I did not diff a fresh generator run against the generated file.

**Must fix:**
none

**Optional:**
none

**Nit:**
1. `src/instruments/TrailStrip.tsx:36` — the comment says "each course's first entry decides", but `new Map(entries.map(...))` keeps the last entry for a repeated code. This is harmless because a course code always carries the same `walkId` and `title` across rows (CPS 305 in CPS 616 and CPS 842, for example), but the comment should say "last" or be dropped.
2. `src/corpus/cs2023corpus.test.ts:195` — the test asserts that 48 routes carry `buildsOn` and that every route's list equals the JSON's. It uses `w.buildsOn ?? []`, so an empty `buildsOn: []` on the other 13 routes would pass. The card says those routes "get no field", and the test could assert `toBeUndefined()` for them.

**What I checked:**
- `src/corpus/walks.ts` has the optional `WalkBuildsOn` field, matching the card's shape, with a comment saying `group` is the prerequisite row's alternative group and not the route's own `group`.
- `tools/cs2023import/generate.mjs` reads `route_links` in file order and builds `walkId` with `routeIdOf`. It keeps the group and wording verbatim and carries `title` only for outside courses that have one. It throws if a `from` is not a route, or a `to` is neither a route nor an outside course.
- `src/corpus/cs2023walks.ts` differs from the generator's output only by the added `buildsOn` blocks.
- The test block covers 107 entries over 48 routes, 105 distinct (from, to) pairs, 71 with `walkId` and 36 without, 47 ungrouped against 60 in 29 groups (24 without the `.B` suffix), and wording byte-identity by per-route equality with the JSON.
- `src/instruments/TrailStrip.tsx` puts "Builds on:" under the standing notice in the active-route row, one line per distinct wording. Route codes are buttons calling `activateWalk(walkId, 0)`, and outside courses are spans with a `wrapTip` tooltip. There is no `▶` mark, so the existing drivers' `▶` counts are unaffected.
- I checked the pinned JSON directly. Every route has exactly one distinct wording, and the course codes in each wording are exactly the codes in its rows, so the wording-splitting regex finds every code. The two outside courses without a title (CPS 211 and CPS 311) get no tooltip.
- `tools/studio-spike/browsertest-cs2023builds-on.mjs` follows the marks driver and asserts "Builds on: CPS 109 or CPS 106". It checks CPS 109 is a button and opens at stop 1 of the CPS 109 route, and CPS 106 is plain text with no link. It fails on page errors and exits nonzero on any failed assertion, and its filename means `npm run test:browser` picks it up.
- `tools/cs2023import/README.md` drops the "Prerequisites … not carried" line and documents what `buildsOn` carries.
- Nothing outside the card's scope changed. `DocumentPanel` and `WalkViewer` are untouched, and the teaching and courses corpora gain no field.

**Noticed outside this card's scope:** nothing.

Assumptions: I took "Builds on" in the active-route row of `TrailStrip` as the owner's choice of host, since the card leaves it to the PR review and the plan chose it. I treated the long-wording lines that may need scrolling in the 92 px strip as accepted, since the card says that column scrolls. I could not post the two nits as findings tied to a card line, so the second one cites the "other 13 routes get no field" line and the first has no card line.

<!-- kncode-findings
{"reports":[{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"The comment says \u0022each course\u0027s first entry decides\u0022, but \u0060new Map(entries.map(...))\u0060 keeps the last entry for a repeated key. Harmless, because a course code always carries the same walkId/title across rows, but the comment is inaccurate.","file":"src/instruments/TrailStrip.tsx","line":36,"breaks":"No card line. The comment describes the wrong tie-break for repeated course codes; behaviour is unaffected.","failure":null},{"id":"R0-4","raisedAgain":false,"bucket":"Nit","what":"The test asserts 48 routes carry \u0060buildsOn\u0060, and that \u0060w.buildsOn ?? []\u0060 equals the expected rows. It never asserts the other 13 routes have no \u0060buildsOn\u0060 field, so an empty \u0060buildsOn: []\u0060 on them would pass.","file":"src/corpus/cs2023corpus.test.ts","line":195,"breaks":"Card line: \u0022(107 entries over 48 routes; the other 13 routes get no field)\u0022. The \u0022no field\u0022 part is not pinned.","failure":null}],"answers":[]}
-->
