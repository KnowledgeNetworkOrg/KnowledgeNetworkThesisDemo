I found no gaps, so the verdict is PASS. I read the code only. I did not run `npm run verify` or either browser driver, because a build or a driver run would write files.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Checked against the card and your answer**
- **Pure function:** `publishableRoad(road, activeWalk, lastSent)` in `presented.ts` returns `null` when `activeWalk` is set or when `JSON.stringify(routeStepsOf(road))` equals `JSON.stringify(lastSent)`. Otherwise it returns the road.
- **Hook:** `usePublishPresentedRoute` only runs the dedup path when called with `{ dedup: true }`, and only `WalkEditorView.tsx` does that. It records `lastPublished` and re-runs on `road`, `bus.activeWalk` and `dedup`.
- **Viewer unchanged:** `WalkViewer.tsx` still calls the hook as on `main`, as you decided. In the viewer, the added `activeWalk` dependency changes nothing: its road is `null` while a saved walk plays, and it republishes on the `null` → road flip exactly as before.
- **Types and scope:** `PublishedRouteBus` is widened with `activeWalk`, and `ActiveWalkState` and `RouteStep` import from real modules. `authordraft.ts`, `package.json` and `WalkViewer.tsx` are untouched, and no DOM test environment was added.
- **Tests:** `presented.test.ts` covers the three cases the card lists. The duplicate "after a clear" test is now the first-publish case, `publishableRoad(road, null, null)`. The "same road, even as a fresh array" test covers the equal-to-`lastPublished` case.
- **Driver:** the trail-count check is gone, as you asked. The pin-set check reads `data-step` with `data-step-end`, so the saved walk's one-stop pin reads `1-1` whatever the camera level. It reopens the palette before each pick (`openPalette`), and the dead steps and the duplicate `trail` locator are gone.
- **Docblock:** it says the quiet-after-clear rule applies to the editor only, because the viewer republishes the draft as soon as `activeWalk` becomes null. The em dash is back.

**Noticed outside this card's scope**
- `src/state/walk/authordraft.ts:208` still says the editor publishes "on every change". That is now stale. #482 owns the file.
- After a map-only Load, the always-mounted viewer republishes the draft straight away. So the card's "Owner looks" line 2 does not hold in the live app, as the previous round found. You moved it to a follow-up card.

Assumptions: I took your instruction to remove the trail-count check as replacing that done-when bullet. I treated `{ dedup: true }` as the way to keep the viewer on `main`'s behaviour while changing only the editor.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-3","answer":"Fixed","because":"The trail-count check is gone from browsertest-walkvisibility.mjs, as the person asked. The pin-set check at lines 158-171 is the done-when check that fails on main.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"browsertest-walkvisibility.mjs:162 now reads \u0060${data-step}-${data-step-end}\u0060 for each pin. WalkPins.tsx:106-108 renders both attributes, so the saved walk\u0027s one-stop prefix reads \u00271-1\u0027 and cannot match a merged draft pin.","duplicateOf":null},{"id":"R0-5","answer":"Fixed","because":"The presented.ts:65-68 docblock now limits quiet-after-clear to the editor. It says the always-mounted viewer, on the no-dedup path, republishes the draft as soon as activeWalk becomes null, after any clear. That matches the effect deps.","duplicateOf":null},{"id":"R0-6","answer":"Fixed","because":"presented.test.ts:39-43 now covers publishableRoad(road, null, null) returning the road. The duplicate \u0022after a clear\u0022 test is gone, and \u0022same road, even as a fresh array\u0022 covers the equal-to-lastPublished case.","duplicateOf":null},{"id":"R0-7","answer":"Fixed","because":"The em dash is back at presented.ts:77. The module variable has a comment at line 49, and the parameter is renamed \u0060lastSent\u0060, so it no longer shadows it.","duplicateOf":null},{"id":"R0-8","answer":"Fixed","because":"The dead Trail/Plan/Trail steps and the duplicate trail locator went with the trail check. The driver now has a single \u0060trail\u0060 locator at line 70.","duplicateOf":null}]}
-->
