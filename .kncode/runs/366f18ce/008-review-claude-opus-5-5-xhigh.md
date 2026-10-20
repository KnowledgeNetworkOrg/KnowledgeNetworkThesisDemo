Must fix:
none

Round 0's Must fix 1 is resolved. `src/present/PresenterScreen.tsx:335` now always passes `[LECTURE_NOTES_FIT, QUICK_ACTIONS_FIT]`, and `deckCeiling` (`:337`) still holds the deck at 300 below 836px. Below that width `deskBounds` reports `now = min = max`, which is the truth.

I checked each card clause against the code:
- **Done-when 1:** both fits exist with the bound values, and `panefit.test.ts` pins them (14·2 + 220 + 14 + 260 = 522). The host reads the fits rather than typing 522 or 300.
- **Store and gestures:** the store is `deckWidth`, with `null` meaning the seed. Drags and key nudges go through `clampDesk`. The store is written on `onDeckDragEnd` only, and only for a real move. Reset sets it back to `null`.
- **Gap and divider:** the 12px gap is gone and the 14px `PaneDivider` is mounted.
- **Done-when 4:** the drawn width is derived from `panesW` on every render.

`tsc -p tsconfig.app.json --noEmit` and ESLint on the six changed source files are clean.

Optional:
1. `src/present/PresenterScreen.tsx:316-325`: the row is still measured with `useRef` plus `useEffect(…, [ended, N])`. This is the pattern `usePaneWidth`'s docblock (`src/ds/connections/RailFrame.tsx:84-89`) records as a past bug.
   - **What goes wrong:** `framed={!presenting}` (`src/studio/StudioView.tsx:478`) changes the root from `<Pane>` to a bare `<div>` when preview goes live. That remounts the panes row, but the effect does not re-run, so the `ResizeObserver` stays on the removed preview row.
   - **Why it works today:** the width is only correct because Chromium fires the observer once when the old row is removed, and because `settleRead`'s window-resize listener reads `panesRef.current`.
   - **If that one notification is missed:** `panesW` keeps the preview width. In the test's own flow, the drag-left would then stop the notes about 568px wide instead of at 522.
   - **Fix:** use `usePaneWidth()` from `@/ds`, or add `framed` to the deps.
2. `src/ds/barrel.test.ts:310-313`: the "ported but not adopted" ledger still says of `PaneDivider` / `PANE_DIVIDER_METRICS` / `clampDesk` / `deskBounds` that "No host draws one yet". `PresenterScreen.tsx` now imports all four from `@/ds`. The file's own rule (`:13`) is "To adopt one: import it from '@/ds' in app code and remove it from these imports". Leave `paneFit` there, since nothing in the app imports it.
3. `tools/studio-spike/browsertest-presenter-panes.mjs:93-163`: nothing in the thread says `npm run test:browser -- presenter-panes` has been run. The fixing step reports only the Must fix. So the DOM readings behind done-when 2–4 have still not been observed. I did not run it either, because vite writes files. Run it before calling this ready.
4. The browser test should check three more things (same file):
   - **`:152-156`:** after restoring 1750px, the test resets straight away. It never checks that the deck comes back to its dragged ~1190px, so it doesn't prove that done-when 4's narrow clamp was not stored.
   - **No click-without-a-move case:** `browsertest-explorerrail.mjs:254-267` covers this case for the rail seam.
   - **`:150`:** the narrow-window check measures the handle against the row's box instead of `window.innerWidth`, but "out of view" is about the window.
5. `tools/studio-spike/browsertest-presenter-panes.mjs` (after the drag block): this is the first `PaneDivider` on a screen where → and ← step the lecture.
   - **The risk:** if a mouse drag leaves the separator focused, its `onKeyDown` takes the arrows, and the screen's handler (`PresenterScreen.tsx:201`) yields on `defaultPrevented`.
   - **Likely fine in Chromium:** a cancelled `pointerdown` probably skips the mouse focus step there, but I could not confirm that from a source.
   - **Add a check:** a test that → still advances the stop right after a mouse drag would settle it. The test's next block clicks into the composer and blurs, which would hide the problem.

Nit:
1. `src/present/PresenterScreen.tsx:330`: `LECTURE_NOTES_FIT.floor ?? LECTURE_NOTES_FIT.narrowBelow ?? 0` redoes what the published `paneFit(...)` does. `paneFit(LECTURE_NOTES_FIT).floor` keeps the host on the clamp's own rule.
2. `src/present/PresenterScreen.tsx:313-314`: "the notes give way, so the handle stays on screen". The deck sits on the right and the notes have `minWidth: 0`, so the handle stays visible whichever pane gives way. The comment should give the real reason the notes were chosen.
3. Two places claim more than the card says:
   - `src/ds/presenter/QuickActionsDeck.tsx:29-31` and `src/ds/PROVENANCE.json:827` give the reason "a deck that still reads as two columns of four". The card says only "300 is chosen".
   - PROVENANCE's "Both floors are chosen" calls `narrowBelow` a floor, which it isn't.
4. `tools/studio-spike/browsertest-presenter-panes.mjs:126` and `:159` have misleading messages:
   - `:126` says "only that boundary moved — the row is still notes + strip + deck". That is always true of a flex row.
   - `:159` says "the drag moved the deck…", but the check runs after the reset.
5. `src/present/PresenterScreen.tsx:28`: "the professor can narrow it to its floor". The divider also widens the deck, up to the notes' floor.

Noticed outside this card's scope:
- **The 522 floor doesn't fit the notes pane's own columns.** `LECTURE_NOTES_FIT` = 522, as the card binds, but the sum leaves out the live body's own padding (`legendInset` 21 left, 14 right) and the 2px frame.
  - **Effect:** with the pane at 522, the inner row is about 485px. `maxDuring` falls back to `duringMin` (220), so the prepared column draws about 223px, under its 260 floor.
  - **Where it goes:** that is the DS's number, so it belongs in the OB-254 receipt or on #74, not in a change here.

Assumptions: I took `.kncode/locked-files` as absent, because `.kncode/` holds only `runs/`. I treated the reset (`deckWidth = null`, with the seed clamped in the render-time derivation) as meeting "Reset returns to the seed". In every row width I checked, it gives the same width `clampDesk` would. I did not run the browser test or vitest, because both write files and this step may not.

Sources:
- [W3C pointer-events list — Jacob Rossi on cancelling pointerdown](https://lists.w3.org/Archives/Public/public-pointer-events/2012OctDec/0075.html)
- [WebKit — compatibility mouse events not prevented by pointerdown preventDefault](https://webkit.googlesource.com/WebKit/+/73e37b0215937eddb0ec293678c9035c3711b394)
- [WebKit pointerdown-prevent-default expected output](https://webkit.googlesource.com/WebKit/+/master/LayoutTests/pointerevents/mouse/pointerdown-prevent-default-expected.txt)