MINOR

**In short:** the change does what the card asks. I checked all six design items against their binding text, which I read directly from the design project. Every "done when" line this code can satisfy is implemented and has a test. Nothing outside the card was changed. What remains is one step that can only happen after the commit, filing the receipt, plus a few smaller points worth reading.

**How I checked.** I read the new relationship panel, its round drawing, the summary under it, the Document pane, the map's hover logic, the shared message bus between panes, and the new tests. I pulled the six items' current text from the design project. I compared the Connections pane and the map against a sibling checkout to confirm how far the edits reach: the Connections pane only swaps an import, and the map only gains the centre light. I did not run the build, the unit tests or the browser tests myself; the previous step reports they passed.

Must fix:
none

Optional:
1. **The receipt is still owed, and the card isn't finished without it.** The card's done-when ends with "a receipt is filed". It can only be written once the commit exists. Two points the previous step planned to put in it are already settled on the design side:
   - The file-name question is answered. The design project already records that the file is called `DocumentPanel.tsx`, and it corrected the other items. The note in the design-provenance record saying three items still use the old name (`src/ds/PROVENANCE.json:974`) is out of date.
   - The clash with OB-240 is already known there. OB-240's own text puts its "the document keeps the node after un-selecting" clause on hold until the owner rules, and says not to build it.

   The two design defects are real in the design's current source and are worth reporting:
   - the preview row drops its test marker when nothing is being previewed;
   - two marks sharing one key are drawn on the same spot.
2. **One browser check proves nothing, and its fallback message is wrong** (`tools/studio-spike/browsertest-relationsrail.mjs:320-323`).
   - The check "hovering a relationship opens the card for THAT relationship" compares a value with itself, so it always passes.
   - If the pointer misses the line, the test records an information line saying the case is "covered by the unit tests". No unit test covers how the Document pane picks what goes on the card.
   - The next check expects the exact header "1 direct relationship". It would fail wrongly if the line under the pointer were an indirect one.

   So the first half of OB-229 clause 2 is not really proven in the browser: hovering one line should open the card for just that relationship. The per-neighbour case and the centre-dot case are proven.
3. **The map lights the drawing only when the zoom levels happen to match** (`src/instruments/DocumentPanel.tsx:213`). Lighting works in both directions, but unevenly:
   - Drawing to map: the map lifts a hovered neighbour to whatever level it is showing, so this works at any zoom.
   - Map to drawing: this matches only on the exact node. At a zoom where the map shows modules or domains, pointing at the cell that contains a neighbour lights nothing in the drawing.

   The plan chose this, and the browser test checks it at the topic level, where it works. It is a limit worth knowing about.
4. **The corpus root's panel reads "No relationships — Nothing connects to this node."** This follows from the rule that skips relationships with both ends inside the node's own subtree, which the design's reference shell also uses, and a unit test locks it in (`src/instruments/corpusrelations.test.ts:40`). But "Nothing connects to this node" is an odd thing to say about the node that contains everything. It's worth one sentence in the receipt.
5. **The two panes disagree in the Explore layout until the Connections pane is retired.** With nothing selected, the Document pane now shows "Nothing chosen", while the Connections pane beside it still falls back to the corpus root. OB-209 explicitly lets the Connections half go when that pane is removed, so this is not a gap. It will still be visible on screen until that later step lands.

Noticed outside this card's scope
- Nothing. The map edit is only the centre light plus a comment, the Connections pane edit is only the moved import, and the other touched files belong to the card.

Assumptions: I treated filing the receipt as a step after the commit rather than a defect in this change, so it sits under Optional instead of Must fix. I did not re-run any tests or the browser suite; I relied on the previous step's report that they passed. I judged OB-209's own "what dies with the Connections pane" clause as the authority for leaving the Connections pane's corpus-root fallback and its old sky-blue preview row in place, since the card says OB-209's text, not OB-226's description of it, is what binds.