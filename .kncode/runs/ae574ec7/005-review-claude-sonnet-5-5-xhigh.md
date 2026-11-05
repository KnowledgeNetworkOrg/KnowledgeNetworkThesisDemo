I found no gaps against the card: every requirement and every "done when" line is implemented, and the tests it lists exist. I read the code and did not run `npm run verify` or any driver, so I'm relying on the earlier check's results for those. The verdict is MINOR.

Must fix:
none

Optional:
1. `src/present/PresenterScreen.tsx:123-124`: `mapBus = presenterBus(deskBus, walkId, play.steps)` builds new `route` and `routeSteps` arrays on every render.
   - **Why it matters:** the screen re-renders every second from the clock tick, and `useWallFit` compares `route` by identity (`src/instruments/map/wallfit.ts:89`). When the lecture's walk differs from the desk's, which is the case this card adds, the wall re-applies its fit and recomputes `walkPins` about once a second. Its header says "only a change to the walk re-fits".
   - **Impact:** nothing visibly moves because the wall is a still picture. It is wasted work and a weakened invariant.
   - **Suggested fix:** memoise the route on an ids-plus-optional-flags key, as `ProjectorScreen.tsx` does with `idsKey` and `optKey`.

Nit:
1. `src/studio/StudioView.tsx:378`: `mintNoteId(Date.now())` runs inside the `setPresenter` updater. `mintNoteId` bumps a module-level counter, so the updater is impure, and StrictMode runs it twice. The card says to mint the id "here" in `onStart`. Mint it once above the `setPresenter` call, next to the session id.

Noticed outside this card's scope:
- `QuickActionsDeck` binds `m`/`f`/`e`/`j` and Escape on the document. While the card is open over a preview, those keys can still act on the deck behind the scrim, because `keys={false}` only stops `PresenterScreen`'s own handler. The card asked for exactly that prop, and none of its own keys (Enter, R, P, ↑↓, Escape) clash except Escape when the deck's shelf is open.

Assumptions: I treated `lectureId` staying an optional `PresenterScreen` prop, with a mount-time id kept for the preview, as allowed by the card's "keep it only for the preview". I treated the previous step's change to check 6, clicking the Continue row instead of pressing Enter on a focused session row, as acceptable. Check 6 only needs the resume to start, and the card names "click" for the session row.

<!-- kncode-findings
{"reports":[{"id":"R0-2","raisedAgain":false,"bucket":"Optional","what":"The lecture\u0027s own route is rebuilt as fresh arrays on every PresenterScreen render. \u0060mapBus = presenterBus(deskBus, walkId, play.steps)\u0060 makes new \u0060route\u0060 and \u0060routeSteps\u0060 each time, and the screen re-renders every second from the clock tick. \u0060useWallFit\u0060 compares \u0060route\u0060 by identity (\u0060have.route === route\u0060) and its header says \u0022only a change to the walk re-fits\u0022. The fix is a stable route: memoise it on an ids-plus-optional-flags key, as \u0060ProjectorScreen\u0060 does with \u0060idsKey\u0060 and \u0060optKey\u0060.","file":"src/present/PresenterScreen.tsx","line":124,"breaks":"Whenever the lecture\u0027s walk differs from the desk\u0027s (the case this card adds), the wall map re-applies its fit, re-computes \u0060walkPins\u0060 and re-renders MapView\u0027s camera state about once a second. That breaks the OB-163 rule that the wall\u0027s frame is set once. Nothing visibly moves, since the wall is a still picture, so this is waste and a fragile invariant rather than a visible bug.","failure":null},{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"\u0060mintNoteId(Date.now())\u0060 runs inside the \u0060setPresenter\u0060 updater. \u0060mintNoteId\u0060 bumps a module-level \u0060seq\u0060, so the updater is impure, and StrictMode runs updaters twice. The card says to mint the lectureId \u0022here\u0022 in \u0060onStart\u0060. Mint it once above the \u0060setPresenter\u0060 call, next to the session id.","file":"src/studio/StudioView.tsx","line":378,"breaks":"In dev under StrictMode the updater runs twice and burns an extra \u0060seq\u0060 value. Only one result is committed, so the lecture still gets a unique id and nothing misbehaves.","failure":null}],"answers":[]}
-->
