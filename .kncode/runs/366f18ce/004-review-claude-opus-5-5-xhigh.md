Must fix:
1. `src/present/PresenterScreen.tsx:333`: the card says the host "clamps every gesture with `clampDesk` over `[LECTURE_NOTES_FIT, QUICK_ACTIONS_FIT]`". When the measured row is under 836px, the code swaps the notes pane's fit for `{ narrowBelow: 0, floor: 0 }`. That breaks the card's rule and also `PaneFit`'s own contract ("A desk may not override them").
   - **What a user notices:** `deskBounds` (line 342) then reports `aria-valuemin=0` and `aria-valuemax` equal to the notes width. But `deckCeiling` pins the deck at 300, so the handle cannot move at all. A screen-reader user is told the boundary has a range, and the arrow keys do nothing.
   - **The swap does nothing for the drag:** with the real fits, `clampDesk` already returns the same widths there (the notes are under 522 and the deck is at 300, so neither side has width to give). `deskBounds` would also report `now = min = max`, which is the truth.
   - **Fix:** always pass `[LECTURE_NOTES_FIT, QUICK_ACTIONS_FIT]`, and keep `deckCeiling`. That keeps the plan's "the notes give way below 836px" layout.

Optional:
1. `src/present/PresenterScreen.tsx:315-325`: the row is measured with `useRef` plus `useEffect(…, [ended, N])`. That is the pattern `usePaneWidth`'s docblock (`src/ds/connections/RailFrame.tsx:84-89`) records as a past bug.
   - **Why it matters:** `framed` flips from `<Pane>` to a bare `<div>` on preview→live, which is the normal path and the one the browser test takes. The flip remounts the panes row, but the effect doesn't re-run, so the `ResizeObserver` stays attached to the old, removed row.
   - **Why nothing breaks today:** two things cover it. `settleRead`'s window-resize listener reads `panesRef.current`, and Chromium probably sends a resize notice when the old row is removed (not confirmed).
   - **Fix:** use `usePaneWidth()` from `@/ds` (a callback ref plus a read on every render), or add `framed` to the deps.
2. `src/ds/barrel.test.ts:310-320`: the "ported but not adopted" list still says of `PaneDivider` / `PANE_DIVIDER_METRICS` / `clampDesk` / `deskBounds` that "no host draws one yet". `PresenterScreen.tsx` now imports all four from `@/ds`. The file's own rule is "To adopt one: import it from '@/ds' in app code and remove it from these imports". Leave `paneFit` there, since nothing in the app imports it.
3. `tools/studio-spike/browsertest-presenter-panes.mjs:93-163`: the previous step only ran `node --check` on this file, and never ran `npm run verify`. So the DOM readings behind done-when 2–4 (300 / 522 / 14px blank strip / narrow window) have never actually been observed. I ran `tsc -p tsconfig.app.json --noEmit` and ESLint on the five changed sources, and both are clean. I did not run the browser test, because vite writes files. Run `npm run test:browser -- presenter-panes` before calling this ready.
4. `tools/studio-spike/browsertest-presenter-panes.mjs:139-163`: three checks would make the test stronger.
   - Done-when 4 says the drawn width "is derived, not stored". The test resets straight after restoring 1750px. It never checks that the deck comes back to its dragged width (~1190px) once the window is wide again, so it doesn't prove the narrow clamp wasn't stored.
   - Add the click-without-a-move case that `browsertest-explorerrail.mjs:254-267` covers for the rail seam.
   - Line 150 checks the handle against the row's box, not `window.innerWidth`, though "out of view" is about the window.
5. `tools/studio-spike/browsertest-presenter-panes.mjs` (after the drag block): this is the first `PaneDivider` on a screen where → and ← step the lecture. If a mouse drag leaves the separator focused, its `onKeyDown` takes the arrows and nudges the divider, and the screen's handler yields on `defaultPrevented`. I couldn't settle whether a cancelled `pointerdown` still moves focus in Edge. A check that → still advances the stop right after a mouse drag would settle it.

Nit:
1. `src/present/PresenterScreen.tsx:330-331`: `LECTURE_NOTES_FIT.floor ?? LECTURE_NOTES_FIT.narrowBelow ?? 0` redoes what the published `paneFit(...)` already does. `paneFit(LECTURE_NOTES_FIT).floor` keeps the host on the same rule as the clamp.
2. `src/present/PresenterScreen.tsx:313-314`: "the notes give way, so the handle stays on screen". The deck sits on the right and the notes have `minWidth: 0`, so the handle stays visible whichever pane gives way. The comment should give the real reason the notes were chosen.
3. `src/ds/presenter/QuickActionsDeck.tsx:29-31` and its PROVENANCE entry: the reason "a deck that still reads as two columns of four" is the porter's own; the card says only "300 is chosen". PROVENANCE's "Both floors are chosen" calls `narrowBelow` a floor, which it isn't.
4. `tools/studio-spike/browsertest-presenter-panes.mjs:126` and `:159`: "only that boundary moved — the row is still notes + strip + deck" is always true of a flex row. The message at `:159` ("the drag moved the deck…") describes a check that runs after the reset.

Noticed outside this card's scope:
- **The 522 floor doesn't fit the notes pane's own columns.** `LECTURE_NOTES_FIT` = 522, as the card binds, but the sum counts only the internal row. It leaves out the live body's own padding (`legendInset` 21 left, 14 right) and the 2px frame. When the drag stops the pane at 522, its inner row is about 485px, so the prepared column draws around 23px under its 260 floor. That is the DS's number, so it belongs in the OB-254 receipt or on #74, not in a change here.

Assumptions: I treated the card's `[LECTURE_NOTES_FIT, QUICK_ACTIONS_FIT]` clamp rule as binding at every window width, including the case where both floors can't fit. I kept the plan's "deck holds 300, notes give way" layout below 836px, since the card says nothing about it. I took `.kncode/locked-files` as absent, because `.kncode/` holds only `runs/`.

Sources:
- [WebKit pointerdown-prevent-default test](https://webkit.googlesource.com/WebKit/+/master/LayoutTests/pointerevents/mouse/pointerdown-prevent-default.html)
- [jQuery ticket 10345](https://bugs.jquery.com/ticket/10345)
- [csswg-drafts #7808 — firing observations on insert/remove](https://lists.w3.org/Archives/Public/public-css-archive/2022Sep/0946.html)
- [csswg-drafts #11280 — browsers trigger on disconnected elements](https://lists.w3.org/Archives/Public/public-css-archive/2024Nov/1053.html)
- [web.dev — ResizeObserver](https://web.dev/articles/resize-observer?hl=en)