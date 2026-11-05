Must fix: none.

Every requirement and every "Done when" line is implemented. I could not run the four browser drivers, because that would spawn vite and write screenshots. I did run these:
- `npx vitest run`: 996 tests pass, 37 of them in `lecturenotes.test.ts`.
- `eslint` on the four changed source files: clean.
- `tsc` for the app, with no output files: clean.
- `node --check` on all four drivers: clean.

Optional:
1. `tools/studio-spike/browsertest-presenter-start.mjs:398` (check 7). It tests the stored numbers, not what is drawn.
   - It compares them with the DS defaults hard-coded as `!== 150` and `!== 220`.
   - If the prepared-height drag has no room to move, the stored value is the measured height. That can be exactly 150, and the check then fails for no real reason.
   - After the reload it only compares the stored numbers with each other. That shows `localStorage` kept them, not that the pane comes back at those sizes.
   - Better: measure the prepared region's height and the chat column's width before the drag, assert that they changed, and measure them again after the reload.
   - This is the one finding I recorded with `report_finding`.

Nit: none.

Noticed outside this card's scope: nothing.

Assumptions:
- I read `counts.slides` as the number of distinct stops that have an open flag. The card does not say whether resolved flags count. This matches the open-only derived `flags` list and the review pane's own "N slides · M flags" count.
- Passing `onClose={onLeave}` to the header bar in every state is equivalent to passing it only when ended. The bar draws the pill only when `ended && onClose`, and otherwise keeps the faded ■.
- I could not check the new driver checks against a running browser. I checked their selectors, titles, ring and menu roles, and the flow through the start card by reading the `src/ds` ports.

<!-- kncode-findings
{"reports":[{"id":"R0-1","raisedAgain":false,"bucket":"Optional","what":"Check 7 proves the stored values, not the drawn sizes. It compares the dragged heights with the DS defaults hard-coded as 150 and 220, and after the reload it only compares the stored numbers with each other. If the prepared-height drag is clamped to nothing, the stored value equals the measured height, which can be exactly 150, and the check fails for no real reason. The numbers also only show that localStorage kept them, not that the pane redraws at those sizes after the reload.","file":"tools/studio-spike/browsertest-presenter-start.mjs","line":398,"breaks":"Done-when 7: \u0022The chat width and the prepared height (drag \u0060[aria-label=\u0022resize the prepared notes and the flags\u0022]\u0060) survive a reload.\u0022 Measure the prepared region\u0027s and the chat column\u0027s height and width before the drag, assert that they changed, and re-measure them after the reload.","failure":null}],"answers":[]}
-->
