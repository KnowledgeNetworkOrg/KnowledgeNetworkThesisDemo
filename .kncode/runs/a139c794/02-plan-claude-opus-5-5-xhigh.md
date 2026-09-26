I have enough to plan; I didn't create or change any files. Here's what I found, then the plan.

**What this card does.** The Document pane gains a Relations panel on its right edge that you can hide and bring back. It shows a small radial drawing of the node's neighbours: direction around the circle is the kind of relationship, and distance from the centre is whether the link is direct or through a child. Under the drawing is a short statistical summary (counts, direct vs. indirect, a bar per relationship kind), not a list of cards. Hovering part of the drawing opens a relationship card over the prose, and the map lights the same relationship. Pointing at a neighbour on the map lights it in the drawing. Separately, the Document pane will preview whatever map cell you point at while nothing is selected, and show a "Nothing chosen" placeholder instead of falling back to the whole-corpus root.

**What's already in place.** The shared rail frame and the Explorer rail landed in the previous two steps. So did the card layer that keeps a card clear of a figure, and the published rule for deciding what lights up. The map already lights a neighbour's road when another pane publishes it as hovered. What's missing is the relations panel itself, its drawing and summary, the placeholder and preview-row parts, and all of the Document-pane wiring.

**Two surprises.**
- **Two design items contradict each other.** One says that after you un-select a node, the document keeps showing it. The other, which this card names as the authority, says it must show "Nothing chosen". Today it shows the corpus root, so neither is currently true.
- **The map can't light "the centre" on its own yet.** The map has only one "hovered" signal. Sending the centre through it would light every road around the selection at once, which is exactly the failure the design warns about. So a separate centre signal is needed.

## Plan

1. Copy five design-system parts into the app's copy: the relations panel, its radial drawing, the summary under it, the placeholder (with its new second line for "nothing can be done"), and the preview row. Export them and record where each came from.
2. Update the relationship card. It draws its left divider line only when a card has more than one target, and takes no space otherwise (OB-224). It also gains a sentence-style header such as "1 direct relationship", with the plural rule inside the component (OB-242). The list headers stay as they are.
3. Move the code that builds each node's relationship list, plus the "via children" roll-up, out of the Connections pane into a shared module that both panes read.
4. Add one short-lived "the centre is lit" signal to the shared message bus between panes, beside the existing "hovered node" signal.
5. Have the map spotlight the selected cell when that centre signal is on. Do it through the existing hover-decision function and extend its unit test. A lit neighbour keeps using the existing hover signal, so its road and cell light as they do today.
6. Restructure the Document pane:
   - it measures its own width;
   - the preview row is always present, even when empty;
   - with nothing chosen, it shows only the placeholder;
   - otherwise it shows a header row with the panel's "show Relations" button, then the prose column beside the panel.
   
   Its entry in the pane list switches to scrolling its own content.
7. While nothing is selected, the Document pane shows whatever map cell the pointer is on and returns to the placeholder when the pointer leaves. Selecting a node pins it. A guard stops the pane reacting to hovers it publishes itself, which it now does.
8. Hover card, using one card layer per pane:
   - it opens over the prose, sized to the space beside the drawing so it never covers it;
   - a relationship or a neighbour opens the sentence header plus the relationship card;
   - the centre dot opens the node's own document card.
9. Two-way lighting:
   - hovering in the drawing goes through the published rule and sends the "lit neighbour" and "lit centre" signals separately;
   - leaving, a node change, closing the panel, or unmounting clears both;
   - pointing at a neighbour on the map lights that neighbour's dots in the drawing.
10. Let the pane hold the dragged width of the panel's edge, and feed the same width to both the panel and the card sizing.
11. Add unit tests for the pure calculations: dot placement, the half-circle minimum for a single kind, the counts, the sentence wording, and the roll-up. Add the new exports to the export check.
12. Add a real-browser test for all six done-when blocks, including an unconnected course and the single-kind half circle in the course corpus. Adjust the existing legend-alignment test to select a node before measuring the document.
13. Run the full check and the browser tests, and look at the running page in both corpora. After the commit, file the receipt in the design project. It will name the pane's real file (the file-name question is still open) and flag the un-select contradiction.

**Files:** `src/ds/connections/RelationsRail.tsx` (new), `src/ds/connections/RelationOrbit.tsx` (new), `src/ds/connections/RelationStats.tsx` (new), `src/ds/chrome/PanePlaceholder.tsx` (new), `src/ds/chrome/PreviewBanner.tsx` (new), `src/ds/connections/RelationCards.tsx`, `src/ds/index.ts`, `src/ds/barrel.test.ts`, `src/ds/PROVENANCE.json`, `src/instruments/DocumentPanel.tsx`, `src/instruments/corpusrelations.ts` (new, plus its test), `src/instruments/ConnectionsPane.tsx` (import change only), `src/state/bus.ts`, `src/model/maphover.ts`, `src/model/maphover.test.ts`, `src/instruments/MapView.tsx`, `src/studio/instruments.tsx`, new unit tests beside the ported parts, `tools/studio-spike/browsertest-relationsrail.mjs` (new), `tools/studio-spike/browsertest-legendinset.mjs`.

**Out of scope:** nothing stated outright. The card says the Explorer rail shares the frame with this panel but not its content, and that the two Explorer items (OB-228, OB-227) don't carry OB-209's behaviours. I'm reading that as: leave the Explorer rail's content and the shared frame alone, and leave the Connections pane's retirement (OB-226) for its own step.

**Verify:** In the Explore layout on the running app:
- With nothing selected, the Document pane reads "Nothing chosen". Pointing at a map cell shows that node's document under a "preview" row, and moving off returns to the placeholder.
- After clicking a node, the Relations panel shows the drawing over the summary, with no list of cards.
- Hovering a dot opens a card over the prose headed like "1 direct relationship", while the map lights that road and neighbour.
- Pointing at that neighbour on the map lights its dot in the drawing, and moving away clears both sides.

```
npm run verify
node tools/studio-spike/browsertest-relationsrail.mjs
npm run test:browser
```

**Assumptions:**
- **Un-select contradiction:** I'll follow OB-209, so un-selecting shows "Nothing chosen", and I'll flag the clash with OB-240 in the receipt.
- **File name:** the real file is `DocumentPanel.tsx`. The items disagree on the name, so I'll state it in the receipt.
- **Nothing chosen:** the panel isn't drawn at all. Its own empty message ("No relationships") would wrongly suggest the node has none.
- **Roll-up rule:** the panel's "via children" count skips relationships where both ends sit inside the node's own subtree, as the design's reference shell does. Otherwise the corpus root would show every edge twice. The Connections pane keeps its current counting.
- **Centre signal:** it's a new bus field, because the existing single hover signal would light every road.
- **Map to drawing:** pointing at the map lights a dot only when the cell under the pointer is exactly that neighbour, and it never opens the card. A foreign hover lights things and stops there.
- **Centre dot card:** it opens the document card, as OB-229's text says, not the plain preview card the reference shell uses.
- **Panel width:** it's held in memory only; remembering it across reloads is a separate item (#368). The desk has no per-pane minimum widths, so when the pane is too narrow the panel shows its own "widen this pane" note.
- **Connections pane:** it stays mounted and otherwise unchanged. Its half of OB-209 is dropped along with the pane.