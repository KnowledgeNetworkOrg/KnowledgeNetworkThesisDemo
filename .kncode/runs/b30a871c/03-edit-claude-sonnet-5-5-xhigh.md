I made all the planned edits, but I haven't verified any of them. My one allowed test run failed before it started, because this checkout doesn't have the browser-automation library (`playwright-core`) installed. Nothing ran, so nothing was measured.

**What changed**
- **The shared line.** The pane component now publishes the chosen number, `FIRST_LINE` = 25. It derives the other two from it: `FIRST_ROW_PAD` = 14 (a first row directly under the legend) and `FIRST_SCROLL_PAD` = 2 (a first row inside a scrolling body).
- **The legend row.** The pane header now publishes its own height as `LEGEND_ROW` = 11. It already drew at 11, so nothing looks different. All four constants are re-exported through the shared design-system entry point.
- **Document header.** It now reads the shared 14 instead of its own literal 14.
- **Map breadcrumb bar.** Its top padding was 14 minus 1 and is now exactly 14, per the design side's amended text.
- **Palette presets block.** The old top padding of 8 is replaced by `FIRST_SCROLL_PAD`. The palette's "presets" label should land at about 26 instead of 31. I left it about a pixel low on purpose, since the owner accepted that.
- **Document closed button.** The closed Relations button's top margin read a bare 14 and now reads the shared constant. The value is the same.
- **Left rail.** The rail was already at 14 from the earlier rail work, so I only rewrote the comments there that said the rest belonged to this card. The right rail keeps its 6, so the Relations head doesn't move.
- **Tests and notes.**
  - The existing pane and barrel tests now pin the four numbers and how they derive.
  - A new test at the top of `src/` fails if any host restates 25, 14 or 2, or declares its own copy of a constant.
  - A new browser test measures each pane's first line with the three panes docked.
  - The design-sync provenance file has dated notes for the four ported components.

**What to watch:** the document pane may not reach 25. It always draws a 16px preview-banner row above its header, and by my arithmetic that puts its first line near 41. I did not move that row. It comes from an earlier binding contract, and moving it is a question for the design side. The new browser test asserts 25 ±1 for the document, so if I'm right it will fail honestly rather than hide the gap.

**Verified:** nothing. The unit tests I added and edited have not been run either.

**Left to do:**
- Run the unit tests and the full `verify` in the check step.
- Install the browser library, run the new browser test and read the real numbers.
- If the document's first line is off 25, file the question to the design side.
- File the receipt and open the PR.

Assumptions:
- I used 14 for the breadcrumb (not 13) and bounded the palette's "presets" line loosely rather than at ±1, both following the design side's amended text.
- The browser test measures from each frame's outer top edge and also prints the reading inside the 1px border.
- I left every sync date in the provenance file as it was. The document header's has to stay put, because the design side has since added an unported `aside` slot there.
- The new browser test uses port 5266, which no other test uses.
- The "no host restates the numbers" checks live in a new test at the top of `src/`, because tests inside the design-system folder aren't allowed to read host files.