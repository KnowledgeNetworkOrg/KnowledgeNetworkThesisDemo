The plan is below. In short: the design system has published one shared rule ("the same node may not sit twice in a row") plus the two drawings for it, and this card wires that rule into both places a node can land — a drag onto the road, and the "pick a node" menu — so they can never disagree.

Two things I found shape the plan:

- **Real browser drags hide their contents until you let go.** To judge a gap while the pointer is still moving, the road needs a shared "what is being dragged right now" record that the road and the palette both fill in when a drag starts. The map fakes its drags with events that already carry the node id, so it needs no change.
- **The road accepts any stray drop by adding it at the end.** A refused gap therefore has to stop the drop from reaching that catch-all, and the drop code has to check the rule again on release. Otherwise a refused drop would quietly land at the bottom of the road.

1. Copy the design system's shared rule and drawings into a new file, `src/ds/graph/DropVerdict.tsx`. It holds the rule itself (which neighbours a slot may not take) and the two drawings: the landing line and the "already adjacent" pill. Export it, and pin the obligation's own example in a unit test: `adjacentDuplicates(['a','b','b',null,null,'a'])` → `[2]`, plus the edge slots.
2. Add the five new "verdict" colours (green for "lands here", berry-red for "refused", with the pill's wash, hairline and ink) to the local colour file and the Tailwind mirror. Take the amended berry heading ("destruction and refusal"), and log the copy in the file that records design-system provenance.
3. Teach the local picker the design system's greyed row. A refused option stays in the list, greyed, with its reason in small grey text under the name. It refuses both hover and click, and a greyed parent keeps pickable children.
4. Put one host-side check in the shared drag file, `authordnd.ts`:
   - It lists the ids in the landing list. The block being moved is taken out first, and empty slots and groups count as "no id".
   - It asks the published rule whether the dragged node would sit next to its twin.
   - It adds the shared in-flight drag record.
   - It makes the drop code re-check the rule and do nothing, silently, when refused.
5. Switch the palette's two drag starts and the road's own drag starts to record into that shared drag record.
6. In the road, every place a drag can hover works out the same thing: the gap it would land in, and allowed or refused. That covers the gaps between stops, the upper and lower halves of a stop, a group card's head, and the catch-all at the end.
   - Refused: the gap won't take the drop, the cursor becomes "no-drop", the gap's arrow is swapped for a dashed berry line, and the pill hangs 4px under the held node, moving with it.
   - Allowed: a solid green line replaces the current orange bar. Nothing else appears.
7. Give each unfilled "pick a node" slot a menu where its two neighbours are greyed with "already adjacent". The slot itself is left out of the list and the same rule decides, so the menu and the drag always agree.
8. Add unit tests for the check:
   - A twin directly above or below is refused.
   - Dropping a node back where it was is allowed.
   - A neighbour with no id (an empty slot or a group) blocks nothing.
   - The first and last slots work.
   - Palette drags and group drags follow the same rule.
9. Write a new browser check that splits the fake drag across two moments, as the card warns. It confirms three things:
   - Drag behaviour: a dashed line and the pill at the twin's gaps, solid lines and no pill elsewhere, and no drop taken.
   - Release: the road and its undo history are unchanged, and no message appears.
   - Picker: only the two neighbours are greyed, clicking them does nothing, other rows still pick, and with an empty slot on one side only the filled side is greyed.
10. Run the full verification and the new browser check. After the commit exists, file the receipt in the design project (both items "done", with the deviations below), subject to your approval of that write. Head the pull request with my name, per the review rules.

Files: `src/ds/graph/DropVerdict.tsx` (new), `src/ds/graph/DropVerdict.test.ts` (new), `src/ds/graph/NodePicker.tsx`, `src/ds/index.ts`, `src/ds/PROVENANCE.json`, `src/tokens/colors.css`, `src/tokens/kn-theme.css`, `src/state/walk/authordnd.ts`, `src/state/walk/authordnd.test.ts`, `src/instruments/walkdesk/AuthorRoad.tsx`, `src/instruments/walkdesk/Palette.tsx`, `tools/studio-spike/browsertest-dropverdict.mjs` (new). Possibly `src/ds/barrel.test.ts`, if its "exported but unused" list needs the design system's bundled `DropVerdict` object.

Out of scope: the card itself states nothing. The obligation text it binds to rules out the following:
- a message on release (no toast, no log line)
- any colour on the held node
- a green pill, or a `--verdict-yes-wash` token
- a rule against repeating a node anywhere in the walk (only side-by-side repeats are refused)
- comparing the contents of two groups
- a private copy of the rule
- changes to the node-chain component (`NodeChain.tsx`), since the road owns its own drag
- changes to the Tailwind mirror (`kn-theme.css`) by the picker item

Verify: in the running app on the Plan preset, drag a stop onto the gap directly above or below another copy of the same stop. That gap shows a dashed berry line, "⊘ already adjacent" hangs just under the held node, and letting go leaves the road exactly as it was, with no message. Every other gap shows a solid green line and accepts the drop. Then open a "pick a node" slot between two filled stops: exactly those two rows are greyed with "already adjacent", clicking them does nothing, and any other row picks.
npm run verify
npm run test:browser -- dropverdict

Assumptions:
- **Hovered gap only.** Only the gap under the pointer shows a line, and the other gaps keep their arrows. That is my reading of "a struck berry line in that gap and a solid moss line in every other".
- **Only the landing is judged.** The moved block is taken out of its own list first, so dropping a node back in its own place is allowed. A move that leaves two twins touching behind it is not refused, the same as deleting or ungrouping today. I'll say so in the receipt.
- **Palette and map drops follow the same rule, pill included.** The map draws its dragged node centred on the pointer, so the pill anchors under the pointer there.
- **The cursor is the browser's own drag cursor.** During a real browser drag a page cannot set its own cursor style. So "grabbing" and "no-drop" are delivered through the browser's own allowed/not-allowed drag cursor. I'll note this in the receipt as the closest faithful version of that clause.
- **File names.** The design system names the new file `DropVerdict.ts`, but it contains drawing code, so it lands as `.tsx`. Its "`src/ds/tokens`" means this repo's `src/tokens/`.
- **Other ways to create twins stay open.** The palette's "+" and Enter insert, group, indent, ungroup and delete can still put a node next to its twin. None of those is a drop or a picker, so this card leaves them alone, and I'll flag them as a follow-up.