REVISE

In plain terms: the change builds a relations column beside the document, but it doesn't build what the design system asked for. The previous step said it couldn't read the design system's binding task text. I could — the read-only design-sync tool works here — so I checked all six items against their exact "done when" lines. They differ from the change on almost every item. Two of the six are built the opposite way from what was asked: the "document follows a map hover" rule, and the rule that list headers stay unchanged. The design system also already ships the figure, the statistics panel, the preview banner and the empty-state placeholder the items require. The change ported none of them and drew home-made substitutes instead. No receipt was filed.

Must fix:

1. **The Document pane should follow a map hover while nothing is selected. The change makes it never follow.** OB-209's binding text says: with nothing selected, "hovering a map cell shows that node's document in the Document pane — header, ancestry, body and walks-through-here all on the hovered node — and moving the cursor off the map restores the resting reading." The card says the same: OB-209 "still owns … the Document pane following a map hover." Instead, `src/instruments/DocumentPanel.tsx:145` reads only the selection (`bus.focus ?? null`), and the header comment at lines 20–24 states the opposite rule. The half that is right — after a selection, a map hover changes nothing — should stay.

2. **The preview row is missing.** OB-209 clause 1 asks to port the design system's `PreviewBanner` (a row that names the hovered node) into `src/ds/chrome/`. Clause 2 asks to mount it always as the pane's first child, and done-when checks that `[data-preview-banner]` exists at rest and that the body doesn't jump when the banner fills. The component is not in `src/ds` and not mounted.

3. **With nothing chosen, the pane is blank instead of showing the placeholder.** OB-209 clause 6 asks for `<PanePlaceholder state="Nothing chosen" gesture="Point at a cell on the map to read its document, or click to keep it here." />` in place of the header, body and walks. `PanePlaceholder` must be ported, including its new `note` prop (clause 5b). At `DocumentPanel.tsx:172–204` the pane just renders nothing, so `[data-pane-placeholder]` never appears. The done-when checks this both on first load and after a de-select.

4. **The Connections pane still falls back to the root node when nothing is chosen.** It is still in the default Explore layout (`src/studio/instruments.tsx:363`). It still keeps its resting-node fallback (`src/instruments/ConnectionsPane.tsx:441–442`) and its hand-coloured sky-blue hover row (lines 498–504). OB-209's done-when says both panes show `[data-pane-placeholder]`, and that `grep -n "history.stack"` over both host files finds nothing. The card says "with nothing chosen, both panes sit empty." The binding text drops this half only once the pane is unmounted (OB-226), which hasn't happened. See the FLAG line.

5. **The figure is not the design system's figure, and the new rail isn't a port of the design system's rail.** OB-229 says "THE FIGURE IS `RelationOrbit`": angle is the relation kind, distance is the hop, and it reports a hover key. Its done-when 6 asks that a one-kind corpus fill only half the circle, checked on the course corpus. `DocumentPanel.tsx:66–135` instead draws the app's own relation star. The comment at `src/ds/connections/RelationsRail.tsx:17` says "The design system ships no graph", and so does the matching `PROVENANCE.json` entry — that's wrong. The design system ships `RelationOrbit.jsx` and `RelationStats.jsx`. Its `RelationsRail.jsx` wires both together: it takes `direct`, `via`, `hot`, `onHot` and `figureRef`, keeps the two filters inside itself, draws the hairline, and publishes `orbitBox`. The port instead passes arbitrary content through and exports a different `RelationsRailMath`.

6. **Hovering the figure shows the wrong card, and the centre has no hover at all.** OB-229 clause 2 says each hover opens a specific card:
   - A relationship opens the card for that relationship: the relation card `RelSourceGroup` under `REL_CARD_PARTS.GroupHeader`, passed as the preview layer's `card`.
   - A neighbour opens the card for every relationship with that neighbour.
   - The centre opens a `StopCard` document preview.

   `DocumentPanel.tsx:94` shows the generic node preview (title plus a summary sentence) for every neighbour. The centre circle at line 127 has no hover handler. The card's own title says "the pane's card becomes the figure's tooltip" — the pane's relation card, not a node summary.

7. **The space under the figure is a home-made sentence, not the design system's statistics panel.** OB-235's done-when asks for four things:
   - `RelationStats` is ported, exported, and rendered directly under the figure (done-when 1).
   - Its kind and hop filters live in the rail, go to both parts, and hovering a kind row washes that wedge of the figure (done-when 3).
   - Its relationship total equals the number of marks the figure draws (done-when 4).
   - An unconnected node shows the panel's own "No relationships" placeholder, with the second line "Nothing connects to this node", and the host adds no second empty state (done-when 6; also OB-229 done-when 5).

   `DocumentPanel.tsx:46–60` writes its own sentence instead, including its own empty-state text ("No typed links touch …") — the exact thing done-when 6 forbids.

8. **The header change landed on the wrong headers, and the plural is worked out in the wrong place.** OB-242's done-when:
   - "2. The list headers inside `RelationCards` are UNCHANGED — still caps, count, caret."
   - "3. No pluralisation logic exists at a call site."

   The change rewrote `RelGroupHeader` for every list (`src/ds/connections/RelationCards.tsx:211`). It picks singular or plural at the two call sites (lines 493 and 510). The spec asks for three things instead: `RelGroupHeader` gains a `sentence` prop, `REL_CARD_PARTS.groupHeaderSentence(label, count)` owns the wording, and only the figure's hover card passes `sentence`. Two tests now check for the forbidden behaviour: the edit to `tools/studio-spike/browsertest-connections.mjs` and section 7 of the new test (which expects the list header to read as a sentence). Both need to go back to checking the list headers are unchanged.

9. **Relation cards still keep a blank gap where the left divider line used to be.** OB-224 done-when 1, as amended: "the slot takes NO WIDTH when the hairline is not drawn — it must not be replaced with a zero-width spacer … 7px of blank sat in front of the connector." `RelationCards.tsx:351` still renders a 1px spacer, which with the two row gaps around it is those 7px. The comment at lines 347–348 argues for keeping it, which the amendment explicitly rejected. The condition that decides when to draw the line (`targets.length > 1`) is correct.

10. **The card-to-map lighting is one signal, not the two the item asks for.** OB-230's title is "two channels, not one." Its done-when asks for:
    - Hovering a target pill, an arrow, or a one-target row lights that relationship on the map — "the edge and its target node — and nothing else."
    - The centre node lights "only on the centre's own signal."
    - Leaving clears both signals.

    These should come from the relation card's `onHighlightTarget` and `onHighlightCenter`, combined by the published `connectionsHighlight` and read by `MapView.tsx`. The change sends one general hover id from the figure's circles (`DocumentPanel.tsx:95`). No card in the rail can be hovered, since the node preview ignores the mouse. The map is unchanged and never lights an edge, and nothing in the app calls `connectionsHighlight`.

11. **The browser test doesn't actually confirm the two-way lighting.** The card requires "the two-way lighting between card and map confirmed on the running page." At `tools/studio-spike/browsertest-relationsrail.mjs:136` the figure-to-map check only asks whether any spotlight exists — it ignores which node it passes in. At line 164 the map-to-figure check asserts the node's opacity is `'1'`, but a node nobody is hovering is also at opacity 1. So both checks pass even if nothing responds.

12. **No receipt was filed.** The card's "Done when" ends "and a receipt is filed." The design-sync write channel is available in this environment — I used its read methods for this review. The receipt must also answer the design system's open question about the file name: the app's file is `DocumentPanel.tsx`, while OB-229, OB-241 and OB-242 call it `DocumentPane.tsx`.

Optional:

1. The rail only draws when the Document pane is at least 396px wide. In the default Explore layout the pane is about 325–386px unless the window is roughly 1550px or wider, which is why the new test uses a 2400px viewport. At ordinary window sizes a person sees the "widen this pane" refusal, not the rail. This is the design system's own rule, but the owner should know before judging the page.
2. The design system's rail shows the relationship count on its header and on its closed button (`count={count}` on `RailFrame` and `RelationsRailCorner`). The port drops it. That count belongs to OB-234 ("keeping its count"), which is outside this card, but a faithful re-port picks it up for free.
3. `neighbourhoodReading` counts each symmetric "see also" link as both outgoing and incoming. The out and in numbers can therefore add up to more than the total, e.g. "7 links … 1 reach out, 7 come in". This goes away if it is replaced by `RelationStats` as finding 7 requires.

FLAG: scope: Should this card give the still-mounted Connections pane its "Nothing chosen" placeholder, drop its resting-node fallback and swap in the shared preview banner (OB-209's Connections half), or does that half wait for OB-226 to unmount the pane?

Assumptions: I treated the design system's `design-sync.md` obligations as binding over the card's summary table, because the card says "The binding text is the Design System's `## OBLIGATIONS`". I read them today through the design-sync read methods and wrote nothing to the design project. I treated OB-209's Connections half as still live because that pane is still mounted (hence the FLAG). I treated OB-241 (header row and corner controls), OB-234 (the count on the closed button) and OB-250 (seam dragging) as outside this card. I did not run the app, the unit tests or the browser tests; every finding comes from reading the diff, the current files and the design-system sources.