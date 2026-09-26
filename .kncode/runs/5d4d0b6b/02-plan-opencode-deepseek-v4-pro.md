I've read the card's subject files and their neighbours. Here is my plan.

## Plan

1. Read the DS's `## OBLIGATIONS` section via `design-pull` (read-only) to get the exact `done when:` clauses for OB-209/224/229/230/235/242, and OB-209's *current* amended text — not the retired split pane's proxies.
2. Port the DS `RelationsRail` into `src/ds/connections/RelationsRail.tsx` (a `RailFrame`-wrapped component like `ExplorerRail`, using `RelationsMark`), and export it from `src/ds/index.ts`.
3. Adopt it: mount the rail on the Document pane in `src/instruments/DocumentPanel.tsx`, reading `bus.focus` only — empty when nothing is chosen, and **not** re-aimed by a foreign (map) hover (OB-209's two clauses).
4. Build the figure (the app's own relation star, centred on the document) and make the shared `NodePreviewCard` its hover tooltip, anchored beside it (OB-229), with the two-way lighting channels between the figure/card and the map (OB-230).
5. Make the space under the figure a *reading* of the neighbourhood — a sentence about it — not a re-listed `RelationCards` (OB-235).
6. Fix the relation card's header to read as a sentence ("1 direct relationship", not "DIRECT 1") in `RelationCards.tsx` (OB-242).
7. Fix the relation card's left bracket to key off the target count, not the item count, in `RelationCards.tsx` (OB-224).
8. Write a browser test `tools/studio-spike/browsertest-relationsrail.mjs` covering the six obligations, including both halves of OB-230 (card→map and map→card) and the OB-209 empty/no-follow rule.
9. Run `npm run verify` and the browser suite, then file a receipt for each obligation via the design-pull write channel.

## Files:
- `src/ds/connections/RelationsRail.tsx` (new)
- `src/ds/connections/RelationCards.tsx`
- `src/ds/connections/ConnectionsRails.tsx` (figure-tooltip anchor, if the shared preview needs adjusting)
- `src/ds/connections/ConnectionsSplitPane.tsx` and/or `src/instruments/ConnectionsPane.tsx` (two-way card↔map lighting, OB-230)
- `src/instruments/DocumentPanel.tsx`
- `src/ds/index.ts`
- `src/ds/PROVENANCE.json`
- `tools/studio-spike/browsertest-relationsrail.mjs` (new)

## Out of scope:
The Explorer rail's content and the shared `RailFrame` chrome (already landed in step 2 — "share the frame but not their content"); OB-227 and OB-228, and the OB-226 "unmount the Connections pane" step (OB-209 carries its two clauses, those others do not).

## Verify:
A person on the running page: open a document, the relations rail shows its figure with a sentence reading under it; hovering a figure node shows a tooltip headed "1 direct relationship"; hovering both a figure node and the matching map cell lights the other in both directions; with everything deselected, both the map's rail and the document's rail sit empty; and hovering the map never re-aims the document's rail.

```
npm run verify
npm run test:browser -- relationsrail
```

## Assumptions:
- The binding `done when:` wording lives in the DS `design-sync.md` `## OBLIGATIONS`, which is read through the `design-pull` skill rather than present in this repo; I plan from the card's table and will confirm exact acceptance text before implementing.
- OB-242 and OB-224 are changes to the existing shared `RelationCards.tsx` (the "DIRECT 1" group header and the `items.length > 1` bracket at `RelationCards.tsx:344`), which the relations rail and the still-mounted split pane both read.
- A receipt is written into the design project via `design-pull`'s `finalize_plan`/`write_files` (per `design-handoff/PROTOCOL.md`), not into this repository.