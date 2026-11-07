1. Add a `WalkBuildsOn` interface and optional `buildsOn` field to `Walk` in `src/corpus/walks.ts`; document that its `group` is the prerequisite row's alternative group, not the route's own `group`.
2. Teach `tools/cs2023import/generate.mjs` to read `route_links` in order, resolve `walkId` with the existing `routeIdOf`, carry outside-course titles, keep `alternative_group` and `calendar_wording` verbatim, and fail if a `from` is not a route or a `to` is neither a route nor an outside course.
3. Regenerate `src/corpus/cs2023walks.ts` with the generator (expect 107 entries over 48 routes; the other 13 routes keep no field).
4. Add a `builds on` block to `src/corpus/cs2023corpus.test.ts` asserting 107 entries, 105 distinct (from, to) pairs, 71 with `walkId`/36 without, every course route-or-outside, 47 ungrouped/60 grouped, 29 raw groups/24 after dropping `.B1`/`.B2`, and per-route ordered equality with the pinned JSON so each `wording` is byte-identical.
5. In `src/instruments/TrailStrip.tsx`, render “Builds on: …” under the active route's standing notice: show each distinct wording once, turn route-bearing course codes inside that sentence into buttons calling `activateWalk(walkId, 0)`, and leave outside courses as plain text with their calendar title as a tooltip; do not add any `▶` mark.
6. Add `tools/studio-spike/browsertest-cs2023builds-on.mjs`, modelled on the marks driver: start a cs2023 vite, open the Trail pane, activate CPS 209, check “Builds on: CPS 109 or CPS 106”, verify CPS 109 is a button and CPS 106 is plain text, click CPS 109, and assert it becomes the active route; fail on page errors and exit nonzero.
7. Update `tools/cs2023import/README.md`: remove the now-untrue “prerequisites are not carried” line and document what `buildsOn` carries and what it does not draw.
8. Run the full verification and browser suite.

Files: `src/corpus/walks.ts`, `tools/cs2023import/generate.mjs`, `src/corpus/cs2023walks.ts` (regenerated), `src/corpus/cs2023corpus.test.ts`, `src/instruments/TrailStrip.tsx`, `tools/studio-spike/browsertest-cs2023builds-on.mjs` (new), `tools/cs2023import/README.md`.

Out of scope: no route-to-route graph view (“optional, later; not in this card”); no `depends_on` edge added to the map; the teaching and courses corpora's walks stay unchanged; only the chosen component changes, so `DocumentPanel` and `WalkViewer` are untouched; #506's grouping of the Walks button list is not changed; alternative groups are not split into separate prerequisites.

Verify: open the cs2023 build in a browser, activate CPS 209 from Trail, see exactly “Builds on: CPS 109 or CPS 106”, confirm clicking CPS 109 opens that route while CPS 106 remains plain text.
```
npm run verify
node tools/studio-spike/browsertest-cs2023builds-on.mjs
npm run test:browser
```

Assumptions: the card left the host component to the owner, so I assume the active-walk row in `TrailStrip` (the card's stated fit and not the part #506 changes). The line renders the calendar wording itself, with route courses as inline links and outside courses as text, because a separate chip list would duplicate the sentence. Course-code matching tolerates missing spaces (`CPS406` versus `CPS 406`) since the wording is verbatim. Entries are grouped by identical wording so the sentence appears once. The UI helper lives inside `TrailStrip.tsx` rather than a new file, since the card's file list names only the chosen component.