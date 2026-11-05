I found no gap against the card. Both earlier findings are fixed, and I found one new optional point. The verdict is MINOR.

I read the code and ran ESLint on the four changed source files, which was clean. I did not run the browser drivers or the unit tests myself. The saved logs in the repo show 985 of 985 unit tests passing, all six drivers passing and 23 of 23 checks in the new driver. Those logs are timestamped 22:43–22:53, so they may predate the R0-2 and R0-3 fixes.

**Must fix:**
none

**Optional:**
1. `src/present/presenterbus.ts:25` — the new third parameter of `presenterBus(deskBus, walkId, lectureSteps?)` is never used by the app.
   - `PresenterScreen.tsx:119` still calls `presenterBus(deskBus, walkId)` and builds the lecture's own route itself (`mapBus`, lines 127–136).
   - The route logic therefore exists twice, and the new `presenterbus.test.ts` case covers the copy the wall doesn't use.
   - Fix by passing the memoised steps through the bus view, or by dropping the parameter and its test.

**Nit:**
none

**R0-2 — fixed.** `PresenterScreen.tsx:127-136` memoises the lecture's route on the stops' ids and optional flags, so `route` and `routeSteps` keep their identity across the once-a-second re-render. `MapView` memoises on both and passes `bus.route` to `useWallFit`, so the wall no longer re-fits every tick.

**R0-3 — fixed.** `StudioView.tsx:375` mints the lecture id once, before `setPresenter`. The updater only stores it.

**Noticed outside this card's scope:**
- `QuickActionsDeck` still binds `m`, `f`, `e`, `j` and Escape on the document, so over a preview those keys can reach the deck behind the scrim. The card asked only for `keys={false}` on `PresenterScreen`, which is done.
- The best-effort write on unmount also fires from StrictMode's simulated unmount in dev, so a brand-new session gets a `last` at its start stop before anything is taught. It is harmless and the card accepts it.

Assumptions: I took the optional `lectureId` prop with a mount-time id kept for the preview as allowed by the card's "keep it only for the preview". I took `presenterSnapshot()` no longer feeding the start (the card's choice decides walk and stop) as intended. I treated the two `answer_finding` entries as reviewer answers: FIXED.

<!-- kncode-findings
{"reports":[{"id":"R2-4","raisedAgain":false,"bucket":"Optional","what":"The new third parameter of \u0060presenterBus(deskBus, walkId, lectureSteps?)\u0060 is not used by the app. \u0060PresenterScreen\u0060 calls \u0060presenterBus(deskBus, walkId)\u0060 and builds the lecture\u0027s route itself (\u0060mapBus\u0060), so the route logic exists twice. Only \u0060presenterbus.test.ts\u0060 exercises the \u0060presenterbus.ts\u0060 copy. Either have \u0060PresenterScreen\u0060 pass its memoised steps through the bus view (and drop the \u0060mapBus\u0060 spread), or remove the parameter and its test.","file":"src/present/presenterbus.ts","line":25,"breaks":"Dead production code. The new \u0060presenterbus.test.ts\u0060 case (\u0022gives the view the lecture\u0027s own route\u2026\u0022) passes without covering the route the wall actually draws, which comes from \u0060PresenterScreen.tsx:127-136\u0060. The two copies can drift apart. Nothing visible goes wrong today.","failure":null}],"answers":[{"id":"R0-2","answer":"Fixed","because":"PresenterScreen.tsx:127-136 now memoises the lecture\u0027s own route steps on the stops\u0027 ids and optional flags (ownIds/ownOptionals strings) and derives ownRoute from that memo, so \u0060mapBus.route\u0060 and \u0060routeSteps\u0060 keep their identity across the once-a-second clock re-render. MapView memoises on \u0060bus.routeSteps\u0060 and \u0060bus.route\u0060 and passes \u0060bus.route\u0060 to useWallFit, so the wall no longer re-fits each tick. Same shape as ProjectorScreen\u0027s idsKey/optKey.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"StudioView.tsx:375 now calls \u0060mintNoteId(Date.now())\u0060 once in startLecture, before \u0060setPresenter\u0060; the updater at :376-381 only stores the result and is pure under StrictMode.","duplicateOf":null}]}
-->
