I found nothing that needs fixing, and the change does everything the card asks.

**Must fix:**
none

**C0-1 (the check failure in `browsertest-legendinset.mjs`)** is fixed in the code, as the person asked. Before measuring in the Explore step, the test now opens the Explorer rail if it is closed and clicks the first row that isn't the root. The selectors it uses, `[data-explorer-rail]` and `[data-explorer-corner]`, are real hooks in `src/instruments/MapView.tsx:910` and `:958`. Nothing else in that file changed.

**Checked against the card:**
- **The read-only view:** `presenterbus.ts` keeps all of the desk's bus except these:
  - `activeWalk` becomes `walkId ? {walkId, cursor: 0} : null`.
  - `draftCursor` becomes 0.
  - The six writers are replaced by functions that do nothing, defined once at module level.
- **The presenter:** `PresenterScreen` builds the view on every render and hands it to `useWalkPlayback` and, through `bus`, to `MapView`. The effect that reported the focus is gone. The opening stop comes from the clamped `startStop`. The notebook key reads the view's `activeWalk`, so it follows `walkId`. The header comment, the comment on the type and the comment on the removed effect are rewritten to match.
- **The clock:** `stopPlayback()` is exported from `playback.ts` and wraps the existing `setPlaying(false)`.
- **`StudioView`:** it captures `walkId` and `startStop` only on the two paths that open the presenter from idle. It keeps them in `presenter` state and passes them as props under the card's names. It calls `stopPlayback()` on both of those paths. The return effect keeps its `peekAt`, with a comment updated to say what it now does.
- **Untouched:** `src/state/bus.ts` is not edited.
- **The unit test:** `presenterbus.test.ts` covers the three things the card asks for: none of the desk's writers is called, `activeWalk` follows `walkId` (null and absent both give null), and focus, route and trail pass through unchanged.
- **The browser checks:** `browsertest-presenter.mjs` has both checks, one on a saved walk with at least 5 stops and one on Plan's draft road. Each reads focus, the pin pairs and the trail count before ▶ and again after presenting to stop 4, ending the lecture and closing the presenter. On `main` the focus read would fail, because the presenter there wrote `bus.focus`.

**Optional:**
none

**Nit:**
1. `src/present/PresenterScreen.tsx:115` and the line after it compute `clampStop(startStop ?? 0, play.steps.length)` twice. One local value would keep the opening stop and the covered stops in step.

**Noticed outside this card's scope**
The only file changed outside the card's list is `tools/studio-spike/browsertest-legendinset.mjs`, and the person's answer at the gate asked for that.

Assumptions: I did not run the tests myself, because I may only read in this step. I trusted the earlier step's statement that the `browsertest-legendinset.mjs` rerun passed. Two things the browser checks do go beyond the card's set-up: they zoom the map in to level 2 before the first read, and the draft check toggles the draft's optionals. The plan's assumptions explain both, and I accepted them because they only rule out noise from the code that runs when the desk comes back. They don't weaken what the checks test.

<!-- kncode-findings
{"reports":[{"id":"R0-4","raisedAgain":false,"bucket":"Nit","what":"\u0060clampStop(startStop ?? 0, play.steps.length)\u0060 is computed twice, once for each initial state (activeStop and covered). One local \u0060const opening = \u2026\u0060 would keep the two in step.","file":"src/present/PresenterScreen.tsx","line":115,"breaks":"No behaviour goes wrong. The same expression is repeated, so a later edit could change one copy and miss the other, and the opening stop and the covered stops would then disagree.","failure":null}],"answers":[]}
-->
