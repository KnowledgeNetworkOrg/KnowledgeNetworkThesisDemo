I've made the changes for both rules: a road now refuses a drop that would put the same node twice in a row, and the "pick a node" menu greys out those same nodes with the reason instead of hiding them. I have **not** run the tests, the type checker or the new browser check: packages aren't installed in this copy and this step was edit-only. The only check that ran is a syntax pass over the new script and the plain TypeScript files, and it passed. That pass cannot check the three drawing-code files (the road, the picker and the new file), so those still need the full verification.

Both rules read one shared function that the design system published, so the drag and the menu can't disagree about what is refused.

**What changed**

- **The shared rule and its two drawings.** I copied them from the design system into a new file, `src/ds/graph/DropVerdict.tsx`. The drawings are the landing line and the "⊘ already adjacent" pill. Unit tests pin the obligation's own example (`adjacentDuplicates(['a','b','b',null,null,'a'])` returns `[2]`) and the first and last slots.
- **Colours.** The five new verdict colours went into the colour file and its Tailwind copy, along with the amended red heading, which now means "destruction, and refusal". The file that records what was copied from the design system has new entries and fingerprints.
- **The picker.** A refused option stays in the list, greyed, with "already adjacent" in small grey text under the name. Hovering and clicking it do nothing. A greyed parent still has pickable children.
- **The shared drag file** (`authordnd.ts`) now:
  - keeps a record of what is being dragged, because a real browser drag hides its contents until release;
  - works out which nodes a gap may not take, removing a moved block from its list first;
  - checks the rule again on drop and silently does nothing if the drop is refused, which catches the map's hand-made drops.
- **The road.** Every place a drag can hover now works out the landing gap and whether it's allowed:
  - Allowed: a solid green line replaces that gap's arrow. This is also the replacement for the old orange bar.
  - Refused: the gap doesn't accept the drop, a dashed berry-red line appears, and the pill hangs 4px under the held node and moves with it.
  - This includes empty board space, which drops at the end of the road. So dragging over empty space now shows a line at the end of the road, which it didn't before.
  - Each empty slot's menu greys its two neighbours.
- **The palette.** Its two drag starts now fill in the shared drag record.
- **Tests.**
  - Unit tests cover twins above and below, dropping a node back in place, empty slots and groups blocking nothing, the first and last slots, and the picker case.
  - A new browser check fakes a browser drag in two steps, as the card warned. It confirms that only the twin's two gaps are refused, that releasing changes nothing and shows no message, and that the picker greys exactly the right rows.

**Still to do:** the next steps are running `npm run verify` and `npm run test:browser -- dropverdict`, then filing the design-system receipt once a commit exists.

Assumptions:
- **Only the hovered gap shows a line.** Other gaps keep their arrows.
- **Only the landing is judged.** A node dropped back in its own place is allowed, and a move that leaves two twins touching behind it isn't refused.
- **Cursor.** The "no-drop" cursor is the browser's own drag cursor; a page can't set its own cursor during a real drag.
- **File type.** The shared file is `.tsx` rather than the `.ts` the design system named, because it contains drawing code.
- **New decision: drops with no visible gap.** Dropping "inside" a folded card, or into an empty version, has no gap to draw a line in. There, an allowed drop keeps the existing green ring, and a refused one shows only the pill and the no-drop cursor, with no ring.
- **Map drags.** The pill sits under the pointer, as if the held node were one road-stop tall.
- **Picker scope.** From the design system's current picker I copied only the greyed-row behaviour. Its step-number feature and scrollbar padding are still not copied.
- **Colour fingerprints.** The fingerprints I recorded are of this repo's colour files. I copied the new regions from the design system but didn't re-prove the rest of each file matches byte for byte, and the record says so.
- **Other ways to create twins stay open.** The palette's "+", grouping, indenting, ungrouping and deleting can still put a node next to its twin. This card only covers drops and the picker.