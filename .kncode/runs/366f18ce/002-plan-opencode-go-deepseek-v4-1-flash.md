1. Add `LECTURE_NOTES_FIT: PaneFit` to `LectureNotes.tsx`, derived as `gutter*2 + duringMin + divider + preparedMin` (522), with both fields equal; pin the value in a unit test.
2. Add `QUICK_ACTIONS_FIT = { narrowBelow: 300, floor: 300, seed: 360 }` to `QuickActionsDeck.tsx`, and re-export both fits through `src/ds/index.ts`.
3. In `PresenterScreen.tsx`, measure the panes row (`settleRead` + `ResizeObserver`), hold the deck width (`null` = seed) plus a transient live width, and derive the drawn deck width from the measured row and `PANE_DIVIDER_METRICS.hit` on every render.
4. Remove the panes row's 12px gap, mount `PaneDivider` between notes and deck, clamp every drag/key gesture with `clampDesk` over `[LECTURE_NOTES_FIT, QUICK_ACTIONS_FIT]`, write the store only on `onDragEnd`, and reset to `null` (seed) on double-click/Enter.
5. Extend `browsertest-presenter-panes.mjs` with the 14px transparent `col-resize` strip, the 300/522px drag floors, the 360px reset, and a narrowed-window handle-visibility check.
6. Update the two `PROVENANCE.json` entries to record the new OB-254 exports.

Files: `src/ds/presenter/LectureNotes.tsx`, `src/ds/presenter/QuickActionsDeck.tsx`, `src/ds/index.ts`, `src/present/PresenterScreen.tsx`, `src/ds/presenter/panefit.test.ts` (new), `tools/studio-spike/browsertest-presenter-panes.mjs`, `src/ds/PROVENANCE.json`.

Out of scope: saving/persisting the divider width across a reload (#368); the OB-262 category-tag wrapper work (#406) does not cover this fit.

Verify: Open presenter mode at 1750px, drag the handle fully right and observe the deck measure 300px, fully left and observe the notes pane measure 522px, then double-click and observe the deck return to 360px; the strip is blank at rest and the handle stays visible at a 700px window.
```
npm run verify
npm run test:browser -- presenter-panes
```

Assumptions: `design-sync.md`/`PaneDivider.d.ts` are not in this checkout, so the card's constants and four host rules are treated as the contract; the deck width lives only in component state (`null` = 360 seed) because persistence is #368; the measured row includes the 14px strip; below 836px, where both floors cannot fit, the notes allocation gives way first so the handle stays on screen.