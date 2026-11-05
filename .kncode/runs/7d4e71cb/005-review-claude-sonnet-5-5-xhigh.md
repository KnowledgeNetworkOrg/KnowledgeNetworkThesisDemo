I've finished the review of #484 and recorded a PASS verdict. I read the code only: I did not run `npm run verify` or any of the browser tests.

Must fix:
none

Optional:
none

Nit:
1. `src/present/PresenterScreen.tsx:232` — the comment "ended / resumed is reported up too" no longer has anything for "too" to refer to, because the focus-reporting effect it followed is gone. Drop the "too".
2. `src/present/PresenterScreen.tsx:115` and `:117` — `clampStop(startStop ?? 0, play.steps.length)` is written twice. Compute it once so the two initial states can't drift apart.

Noticed outside this card's scope: nothing. The `browsertest-legendinset.mjs` edit is the one the person approved at the gate. It picks a topic in the Explore preset before measuring the Document pane, and nothing outside that preset changed.

What I checked against the card:
- **`presenterBus`:** `src/present/presenterbus.ts` is a pure function that spreads the desk bus. It sets `activeWalk` from `walkId` and `draftCursor` to 0. It swaps the six writers for module-level no-ops, and `src/state/bus.ts` is untouched.
- **`PresenterScreen`:**
  - It builds the view each render and hands it to `useWalkPlayback` and the wall `MapView`.
  - The focus-reporting effect is deleted.
  - `walkId` and `startStop` are added, with `startStop` clamped.
  - The notebook key follows the view's `activeWalk`.
  - The header, `PresenterScreenBus` and effect comments are rewritten.
- **`stopPlayback`:** it is exported from `playback.ts` and called on both open paths (toolbar ▶ and the palette's Present).
- **`StudioView`:**
  - `walkId` and `startStop` are captured when the presenter opens and kept in `presenter` state.
  - The return-effect comment is updated.
  - The effect itself is kept.
- **Unit test:** `presenterbus.test.ts` covers the six no-op writers, `activeWalk` following `walkId` (null gives null), and `focus`, `route` and `trail` passing through.
- **Browser checks:** `browsertest-presenter.mjs` gains the saved-walk case and the Plan-draft case. They read `[data-focus]`, the `data-step`/`data-step-end` pin set and the trail count before ▶ and after closing the presenter. The selectors, the "Presenting stop 4" flow and the close button match the existing code.
- **Other browser tests:** `browsertest-studiodesk.mjs` focuses a node before it opens the presenter, so its #214 return check still holds.

Assumptions: the "fails on `main`" requirement is judged from the code, not run. On `main` the presenter wrote `bus.focus` and grew the trail, so the new reads would differ after leaving.

<!-- kncode-findings
{"reports":[{"id":"R0-2","raisedAgain":false,"bucket":"Nit","what":"The comment \u0022ended / resumed is reported up too\u0022 now has nothing before it to be \u0022too\u0022 to, because the focus-reporting effect it followed was deleted. Reword it, for example \u0022ended / resumed is reported up: the shell hides its chrome ...\u0022.","file":"src/present/PresenterScreen.tsx","line":232,"breaks":"Card: \u0022Keep the code\u0027s words true\u0022. Wording only; behaviour is unaffected.","failure":null},{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"\u0060clampStop(startStop ?? 0, play.steps.length)\u0060 is written out twice, once in each lazy initial state. Compute it once in a local before the two \u0060useState\u0060 calls (or a small \u0060useState\u0060 initialiser helper) so the two states cannot drift apart.","file":"src/present/PresenterScreen.tsx","line":115,"breaks":"Layout/duplication only; the two expressions are identical today.","failure":null}],"answers":[]}
-->
