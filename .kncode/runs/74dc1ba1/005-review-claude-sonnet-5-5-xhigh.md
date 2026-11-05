Every requirement and "Done when" line in the card is implemented in the diff. The only gaps are two nits. I read the code but could not run anything: `node_modules` is not installed, and the browser checks need a dev server.

What I checked against the card:
- **Guard:** the no-`dedup` branch in `src/state/walk/presented.ts` now returns early when `publishableRoad(road, null, bus.routeSteps) === null`. It passes a literal `null` for the walk, records no `lastPublished`, and leaves the dependency array and `eslint-disable` line alone.
- **Bus type:** `PublishedRouteBus` now includes `'routeSteps'`. `WalkViewer.tsx` and `WalkEditorView.tsx` are not edited.
- **Editor path:** the `dedup` branch is unchanged.
- **Doc comment:** the "publishes unless the bus's `routeSteps` already equal the road's, and records nothing" sentence is in. The "after any clear" sentence is corrected to "whenever `activeWalk` goes from set to null", and a `clearRoute()` with no walk active does not trigger it.
- **Unit tests:** `presented.test.ts` has the empty-route case and the different-route case, both with `activeWalk === null`. The existing "same road, even as a fresh array" → `null` case stays.
- **Presenter check:** the optionals-toggle click, its wait and its comment are gone from the #484 draft case, and no stray "optionals" or "republish" text is left in the file. Focus, pins and trail are compared by the existing `compareDesk`.
- **Other browser checks:** the #481 block in `browsertest-walkvisibility.mjs` is unaffected. The viewer passes `null` while a saved walk plays, so the guard never runs there. "Stop this walk" still hands the draft back, because `deactivateWalk` leaves `routeSteps` as the played prefix, which differs from the draft, so the guard lets the publish through.
- **Scope:** only the three files the card lists changed.

Must fix:
none

Optional:
none

Nit:
1. `src/state/walk/presented.test.ts:1` — the header comment still describes only the editor's publish and does not mention the new viewer-path block.
2. `src/state/walk/presented.ts:71` — the new "Without `dedup`" sentence says what the guard does but not why. One clause naming the remount on the way back from the presenter would stop someone removing it later. The card dictated the wording, so this is only a suggestion.

Assumptions: I did not verify that the baseline run (presenter check with the toggle removed and `src/` unchanged, failing only on the trail count) was done. The previous step says it was not, and the diff cannot show it. I treated it as the check step's job. I accepted `routeStepsOf(road(C))` as the "saved walk's first stop" case against a `road(A, B)` draft.

<!-- kncode-findings
{"reports":[{"id":"R0-1","raisedAgain":false,"bucket":"Nit","what":"The file\u0027s header comment still describes only the editor\u0027s publish (\u0022which road, if any, may go on the bus while a saved walk is active or when the editor has already sent this exact road\u0022). The new viewer-path block, where last-sent is the bus\u0027s own route, is not mentioned there.","file":"src/state/walk/presented.test.ts","line":1,"breaks":"Wording only. The header was accurate before this change and is now incomplete.","failure":null},{"id":"R0-2","raisedAgain":false,"bucket":"Nit","what":"The new \u0022Without \u0060dedup\u0060\u0022 sentence says what the guard does but not why it is there: the always-mounted viewer remounts on the way back from the presenter and would otherwise add a trail entry. One clause on that would stop a later reader from removing the guard. The card dictated the replacement wording, so this is only a suggestion.","file":"src/state/walk/presented.ts","line":71,"breaks":"Wording only. No card line is broken; the card\u0027s required replacement text is present.","failure":null}],"answers":[]}
-->
