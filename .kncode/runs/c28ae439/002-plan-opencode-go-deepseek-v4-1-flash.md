1. Re-read `src/present/PresenterScreen.tsx` around the frame, column and panes row (and confirm no #483–#486 edits landed since `48dcd9d`), including the `LECTURE_NOTES_FIT` import at line 39.
2. Write a throwaway probe under `tools/studio-spike/` (deleted before the change is finished) modelled on the existing `probe-*.mjs` drivers; start `devserver.mjs`, open the palette’s Present at 1280×720, and read `scrollWidth`/`clientWidth` for `[aria-label="studio-presenter"]` and for the column (`[data-presenter-panes]`’s parent), plus both right edges against `window.innerWidth` and the column’s widest descendant.
3. Repeat the probe live (toolbar ▶), and in Firefox as well as the Chromium/Edge the drivers use; if the notes pane is already 340px or taller at 1280×720, repeat at 1280×600 and use the squeezing size for done-whens 1, 2 and 4.
4. Delete the probe, keeping its eight numbers, browser/version and widest-child result for the pull request.
5. Change the column `<div>` (currently line 410): add `overflowY: 'auto'`, `overflowX: 'hidden'`, `scrollbarGutter: 'stable'`, keeping `flex: 1, minHeight: 0`.
6. Change the `data-presenter-panes` row (currently line 453) from `flex: 1, minHeight: 0` to `flex: '1 1 0', minHeight: LECTURE_NOTES_FIT.minHeight`.
7. Rewrite the comment above the column so it says the pane keeps `LECTURE_NOTES_FIT.minHeight` and the column scrolls below it.
8. Add a self-contained block to `tools/studio-spike/browsertest-presenter-panes.mjs` covering done-whens 1–4: framed and live at the chosen short viewport (pane ≥340px, column `scrollHeight > clientHeight`, pane bottom inside after scrolling the column, composer inside the pane’s foot, six typed flags overflow `[data-notes-during]`), a 1280×1200 tall window with no column scroll and a filled pane, and the open quick-actions shelf checked at its corners with `elementFromPoint`.
9. Run the grep checks for done-when 5, then `npm run verify` and both presenter browser drivers; if the shelf is clipped, record it in the pull request without widening the change.
10. Report in the pull request: step 0’s eight numbers, the widest child if any, the Firefox/Chromium result, the viewport chosen, the right-edge overflow findings (no fix), and the note that `LectureNotes.tsx:530–534` is left unchanged for drift log #74.

Files: `src/present/PresenterScreen.tsx`, `tools/studio-spike/browsertest-presenter-panes.mjs`

Out of scope: no edits to `design-system/`; the presenter-right-edge overflow is report-only and must not be fixed; `src/ds/presenter/LectureNotes.tsx:530–534` stays unchanged (note it on drift log #74); #483–#486 and any widening of scope for a clipped quick-actions shelf.

Verify: a person at 1280×720 opening the palette’s Present sees a notes pane at least 340px tall, can scroll the presenter column to the pane’s foot with the composer inside it, and sees six typed flags scroll inside the During column; the same works live, a tall window shows no column scrollbar, and the quick-actions shelf remains visible.
```
npm run verify
node tools/studio-spike/browsertest-presenter-panes.mjs
node tools/studio-spike/browsertest-presenter.mjs
```

Assumptions: the column is identified in the probe/test as the parent of `[data-presenter-panes]` because it has no data attribute; measurements are taken in Edge/Chromium and Firefox, following the card’s note about the owner’s Firefox screenshot; the short viewport is 1280×720 unless step 0 shows the pane already at its floor, in which case 1280×600 is used; if the shelf clips at 1280×720 I will report it rather than change layout, and flag the tension with done-when 7 instead of silently widening scope.