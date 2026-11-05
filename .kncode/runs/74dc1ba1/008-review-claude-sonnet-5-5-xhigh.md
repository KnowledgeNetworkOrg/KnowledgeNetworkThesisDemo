I'm finishing the review: both open findings are answered FIXED and the verdict is PASS. Here is the report.

Must fix:
none

Optional:
none

Nit:
none. R0-1 and R0-2 are the two findings that were open. I checked both against the code and both are fixed.

- **R0-1, fixed:** `src/state/walk/presented.test.ts:1-6` now says two callers ask the decision: the editor, against its last publish with a saved walk silencing it, and the viewer, against the bus's `routeSteps`. The new viewer block starts at line 41.
- **R0-2, fixed:** `src/state/walk/presented.ts:71-74` keeps the card's required sentence as written. It then adds that the guard also stops the viewer's remount on the way back from the presenter from adding a trail entry.

The card's requirements are all in the diff:
- **Guard:** `presented.ts:91` returns early when `publishableRoad(road, null, bus.routeSteps) === null`. It passes a literal `null` for the walk, records no `lastPublished`, and leaves the dependency array and `eslint-disable` line alone.
- **Bus type:** `PublishedRouteBus` includes `'routeSteps'`. `WalkViewer.tsx` and `WalkEditorView.tsx` are not edited, and both are handed the whole bus.
- **Editor path:** the `dedup` branch is unchanged.
- **Doc comment:** both required corrections are in. The first is the "publishes unless … already equal … records nothing" wording. The second is the `activeWalk` set-to-null wording, with the `clearRoute()` case stated.
- **Unit tests:** the empty-route case and the different-route case, both with `activeWalk` `null`, are in a new viewer block. The existing "same road, even as a fresh array" → `null` case remains.
- **Presenter check:** the optionals-toggle comment, click and wait are gone from the #484 draft case. A search of the file finds no "optionals" or "republish". The case still ends with `presentTo4AndLeave()` and then `compareDesk(beforeDraft, await deskNow())`.
- **Scope:** only the three files the card lists changed.

I read the code but did not run anything, so `npm run verify` and the three browser checks are unconfirmed on my side. The "Stop this walk" check in `browsertest-walkdock.mjs` and the #481 block in `browsertest-walkvisibility.mjs` should be unaffected. That follows from reading the code: when "stop this walk" is pressed, `routeSteps` is left as the played prefix, which differs from the draft, so the guard lets the publish through. While a saved walk plays, the viewer passes a `null` road and never reaches the guard.

FLAG: none

Noticed outside this card's scope: none.

Assumptions: I could not verify that the baseline run (toggle removed, `src/` unchanged, failing only on the trail count) happened, because the diff cannot show it. I treated it as the check step's job.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"src/state/walk/presented.test.ts:1-6 now names both callers (the editor against its last publish with a saved walk silencing it, the viewer against the bus\u0027s routeSteps) and says each has its own block; the new viewer describe block is at line 41.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"src/state/walk/presented.ts:71-74 keeps the card\u0027s required sentence intact and appends \u0022That guard also stops the viewer\u0027s remount on the way back from the presenter from adding a trail entry.\u0022 The reason for the guard is now in the doc comment.","duplicateOf":null}]}
-->
