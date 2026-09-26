MINOR

The code does what the card asks, and I found nothing that needs fixing before it can land. Both parts use one shared rule: a drag onto the road refuses to put a node directly next to its twin, and the "pick a node" menu greys out those same twins with the words "already adjacent" instead of hiding them. What is still missing is proof. Nothing has been run yet — no tests, no build, and not the new browser script. This was a read-only review: packages aren't installed in this copy, and installing them would write files, which this step forbids.

**How I checked.** I read every changed file and compared it with the card and the approved plan. I checked the new position arithmetic against the existing "move a block" operation, and it agrees, so dropping a node back in its own place is allowed. The two recorded colour fingerprints reproduce exactly. The one test that counts design-system rule breaks is unaffected. The changed files are exactly the plan's list; the node-chain component and everything else are untouched. I also checked whether any other part of the app, or any existing browser test, would behave differently now that the road refuses some drops. None would.

Must fix:
none

Optional:
1. **Two of the card's "Done when" lines are not met yet.** The browser script (`tools/studio-spike/browsertest-dropverdict.mjs`) exists, but it has never been run, so "the refusal reproduced live in a driver" isn't done. `npm run verify` hasn't run either, and no receipt has been filed. The later check and landing steps own these, and they must not be skipped.
2. **The receipt must declare one decision the approved plan didn't contain.** Some drops have no visible gap to draw a line in: inside a folded card, or into an empty version. There, an allowed drop shows the existing green ring instead of a line, and a refused drop shows only the pill and the no-drop cursor (`AuthorRoad.tsx:529-535`, `:1005`, `:1125`). The design text says "a solid moss line in every other" gap, so this is a deviation. It should be listed alongside the plan's own deviations:
   - The cursor is the browser's own drag cursor.
   - Only the landing is judged.
   - Hovering empty board now draws the line at the end of the road.
   - Other ways to create twins stay open: the palette's "+", Enter, grouping, indenting, ungrouping and deleting.
3. **The picker draws a reason even on a row that isn't greyed.** Its own documentation says a reason is "Ignored without `disabled`" (`NodePicker.tsx:40`). But the drawing code shows the reason whenever one is given (`NodePicker.tsx:428` and `:436`). Nobody sees this today, because the road always passes the two together. It should be gated on the row being disabled, so the component keeps its documented promise.
4. **The browser script only exercises gaps at the top level of the road.** Refusals inside a group, and the "pill only, no ring" refusal on a folded card, are covered only by unit tests of the rule. The card needs only one live reproduction, which the script provides. This is a coverage gap, not a failure.

Noticed outside this card's scope:
- This is inferred from the stacking order, not checked in a browser. The invisible drop zones between the steps inside an open group card sit underneath the card itself (`AuthorRoad.tsx:1230` puts the zones at layer 0; `:1118` puts the card at layer 5). So a drag over a gap between two steps inside a card is probably caught by the card, and it lands at the end of that version instead of at the hovered gap. This card didn't cause it. With the new line, though, the line now honestly shows the end-of-version landing spot, which may surprise someone expecting the hovered gap. It is worth one live look.

Assumptions: I didn't read the obligations' binding text in the design project. The tool for that is meant to be driven by the design-sync skill the user starts, so I judged against the card, the approved plan, and the clause quotes the code carries. I treated running the checks and filing the receipt as the later steps' work, not as fixes for this step.