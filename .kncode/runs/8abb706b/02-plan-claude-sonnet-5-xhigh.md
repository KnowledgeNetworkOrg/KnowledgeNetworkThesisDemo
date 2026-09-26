I read the six obligations in the design project and the code they touch. I created and changed nothing.

**In plain terms:** the Document pane gets a "Relations" rail, a side column with a small circular figure of the node's neighbours, and a written summary of them under it. Hovering the figure opens a card over the text, and it also lights the matching arrow on the map. Five design-system pieces this depends on aren't in the repo yet. The Document pane, the map's hover code and the card component all need edits.

**1. Plan**
1. Read the design project's source for the five missing pieces (the hover banner, the "Nothing chosen" placeholder, the orbit figure, the stats reading and the whole Relations rail), then port them into `src/ds` and record them in `PROVENANCE.json`. The design project's `.jsx` files are the truth and I've only read their contracts so far.
2. In the card component, make the left bracket follow the target count and take no width when absent (OB-224). Add the sentence header "1 direct relationship" (OB-242) with its plural rule inside the component. List headers stay as they are.
3. Move the code that builds a node's relationships (one entry per target and kind, plus the "via children" roll-up) out of the old Connections pane into a shared module. The Document pane and the Connections pane, which stays mounted, then read one copy.
4. Rebuild the Document pane as prose on the left and the Relations rail on the right, centred on whatever node the pane is showing (OB-229). It renders no standing list of cards.
5. Add the hover card on the pane's one preview layer. Hovering a relationship opens its card, hovering a neighbour opens all of that neighbour's cards, and hovering the hub opens the node's document preview. The card is sized to the gutter so it never covers the figure.
6. Fill the space under the figure with the reading (counts, kind bars, hop bar), including the "No relationships" state (OB-235).
7. Do OB-209 and OB-260 in one pass: the pane follows a map hover when nothing is chosen, with an always-mounted preview row. Add a "pointer is inside this pane" test, because the pane now has hoverable content. Drop the "fall back to the corpus root" behaviour and show "Nothing chosen" instead.
8. Card lights map (OB-230): the figure's hovered mark lights that one road and its target on the map, and the hub lights the centre. Add a separate bus channel for the centre light, and have the map read it.
9. Map lights card (OB-230): hovering a neighbour cell on the map lights its mark in the figure, without opening the card.
10. Add the closed-state button in the Document pane's upper row, mirroring the Explorer's.
11. Add unit tests, plus a new browser driver on its own port that checks each obligation's `done when` on the real page. Run the Explorer driver too, as a regression check.
12. Run the full build and tests, look at the running page on both corpora, then file a receipt in the design project once the commit exists.

Files: `src/ds/chrome/PreviewBanner.tsx` (new), `src/ds/chrome/PanePlaceholder.tsx` (new), `src/ds/connections/RelationOrbit.tsx` (new), `src/ds/connections/RelationStats.tsx` (new), `src/ds/connections/RelationsRail.tsx` (new), `src/ds/connections/RelationCards.tsx`, `src/ds/index.ts`, `src/ds/barrel.test.ts`, `src/ds/PROVENANCE.json`, `src/ds/adherence.test.ts` (only if its pinned count moves), new unit tests under `src/ds/connections/`, `src/instruments/DocumentPanel.tsx`, `src/instruments/MapView.tsx`, `src/instruments/ConnectionsPane.tsx` (adapter moved out), a new shared relations adapter next to `corpustree.ts`, `src/state/bus.ts`, `src/studio/instruments.tsx` (Document pane body layout), `tools/studio-spike/browsertest-relationsrail.mjs` (new).

Out of scope: nothing stated in the card itself. The obligations it points to set limits I'll keep:
- The Connections pane stays mounted, since unmounting it is a different item (OB-226).
- The list headers inside the card component stay as caps and count.
- The card's right-hand spine is unchanged.
- The Connections pane's own preview rule is untouched.
- No standing card list appears anywhere in the rail.

Verify: run the app in Explore, select a node that has relationships, and open the rail. Then check all of the following:
- The figure is centred on that node, with the reading under it and no card list.
- Hovering one mark opens a card over the prose that doesn't overlap the figure and reads "1 direct relationship".
- On the map, exactly that one road and its target light and the other roads dim, while the centre stays unlit. Hovering the hub lights the centre only. Leaving clears both.
- Hovering a neighbour cell on the map lights its mark in the figure.
- With nothing selected, both panes show "Nothing chosen" on first load and after a de-select. Hovering a map cell then fills the Document pane with that node's document.
- On the course corpus, an unconnected course shows "No relationships / Nothing connects to this node".

```
npm ci --prefix desktop        # once, if desktop/ packages aren't installed
npm run verify                 # typecheck + vite build, desktop typecheck, lint, unit tests
node tools/studio-spike/browsertest-relationsrail.mjs
node tools/studio-spike/browsertest-explorerrail.mjs
npm run test:browser           # whole browser suite
VITE_CORPUS=courses npm run dev   # look at the unconnected-course state by eye
```

Assumptions:
- **Card is not hoverable:** the hover card is pointer-transparent by its own contract, so lighting the map is driven by the figure's hovered key, not by hovering the card. A relationship mark lights its road and target only (OB-230 clause 1). The centre lights only on the hub (clause 2).
- **Map to card:** the old list filter no longer exists, so I read "the reverse direction" as a map hover on a neighbour lighting its mark in the figure.
- **New bus channel:** the centre light needs its own channel. The bus carries one hover id, and hovering the centre's id would light every road. The visual is unspecified, so I'll use a modest emphasis on the selected cell.
- **Empty state:** with nothing chosen, I show only the "Nothing chosen" placeholder and not the rail. A "No relationships" message there would describe a node that doesn't exist.
- **Not claimed:** the pane-minimum clause of the "mount two rails" item (OB-238) stays blocked, since the app has no minimum-width concept yet (their #348). I'll wire the seam width because the card sizing needs it, but report the seam-drag item (OB-253) only if I actually drive it.
- **Rail start state:** the rail starts open (component default). The Explorer starts closed only because of a map-label overlap, which doesn't apply here.
- **Receipt timing:** the receipt goes in the design project after the commit exists, citing that commit. It will also mark OB-260 done, since it falls out of OB-209.