Here is the plan. A short orientation first, since two findings change the shape of the work.

**What I found.** All three items change the head of the version-group card (the boxed card on the road editor that holds several alternative versions of a sequence of steps).

- **The menu's wash delay is mostly done already.** When the earlier "menu highlight shouldn't animate" item landed on 2026-09-16, this repo also split the menu row's highlight from its delete-button timer. The highlight now clears instantly and the ✕ lingers for half a second. The design system then filed this item for its own copy. What's left here is to copy one documentation rule into the shared "recede timer" helper and to check the host screens. That check finds nothing: the road editor's own version menu no longer exists.
- **The tally change has a knock-on in the road editor.** The road works out each card's height before drawing it, using a description of the card built by the card's own helper. That description never mentions the ungroup button. After the change it would reserve room for two buttons while the card draws three, so long titles could run under the buttons. The obligation expects this and allows a one-line fix in the road editor.
- **The step-number fix is confined to the two components.** The card's number and the numbered pills inside it will both end in a dot, with no change to how the road passes numbers in.

**Plan**

1. Step numbers (OB-245): in the card, add the design system's `dotted()`, `localIndex()` and `drawnIndex()` helpers so the head always draws "2." whether it is given "2" or "2.". Use the same dotted string in `groupSpec()`, `titleColumn()` and the description indent, so the predicted width matches what is drawn.
2. Step numbers (OB-245), continued: in `NodeChain`, the component that numbers the steps inside a card, always append the trailing dot and delete the rule that guessed the dot from how the prefix was typed.
3. Tally (OB-222): replace the head row's "count, then button strip" with the design system's single right-hand slot. The count and the buttons share one box, 55px wide with an ungroup button and 37px without. One condition fades the buttons in and the count out. When the card is narrow, the box is top-aligned.
4. Tally (OB-222), continued: add `ctlCluster3: 55` to the card's metrics table. Add `closable` to the card's size description, set from whether the card has an ungroup button. Change `titleColumn()` to subtract the wider of the button strip and the count, plus one gap, instead of both plus two gaps.
5. Tally (OB-222), clause 6: when edit mode is on, the pencil button's face becomes the blue "editing" wash and edge, replacing the grey that read as "disabled".
6. Road editor: give its size-description builder a placeholder ungroup handler, the same trick it already uses for the description handler, so every road card is described as closable.
7. Wash (OB-206): copy the design system's "one gesture, two states" rule into the recede helper's documentation in `IconButton.tsx`. Record in the receipt that the host sweep found no row with a timer between the pointer leaving and the background clearing.
8. Tests: add a fast unit test that pins five things:
   - the metrics table's new 55px value;
   - that `closable` is set from the ungroup button;
   - that "2" and "2." give identical descriptions and heights;
   - that `NodeChain` numbers "2.1." "2.2." for either prefix spelling, and "1." "2." "3." with none;
   - the new title width, which should be exactly the old one plus the count's width minus 12px.
9. Browser checks, extending existing drivers:
   - The group-edit test gains four checks. At rest, the count sits flush against the right padding. On hover, the count fades out and the buttons fade in, and the title, number and buttons don't move. The pencil's "on" face is blue. The head reads "2." over "1." "2." "3.".
   - The wash test gains a check that the row's background clears while its ✕ is still visible, then the ✕ goes about half a second later.
10. Re-baseline the drivers that check the card against its predicted size:
    - Add `closable: true` to the three hand-built descriptions on `shot-foldab`'s test page.
    - Run `shot-foldab` once before that fix: it should report drift, which proves the geometry moved. Run it again after: it should agree again.
    - Run `shot-cardhead` to check that no card head overlaps its steps, and re-shoot the screenshots of both drivers.
11. Add dated entries to the provenance ledger for the card, `NodeChain` and `IconButton` (the ledger records which design-system file each port came from and every deviation). Post a comment on drift-log #74 only if a deviation is introduced (see the pencil assumption below).
12. After the change is committed, write one receipt to the design project, `receipts/<sha>.md`, marking OB-206, OB-222 and OB-245 done with the real commit sha and the measured numbers.

Files: `src/ds/group/VersionedGroup.tsx`, `src/ds/graph/NodeChain.tsx`, `src/ds/chrome/IconButton.tsx` (documentation only), `src/instruments/walkdesk/AuthorRoad.tsx` (the size-description builder only), `src/ds/PROVENANCE.json`, a new `src/ds/group/grouphead.test.ts`, `tools/studio-spike/foldab/main.tsx`, `tools/studio-spike/browsertest-groupedit.mjs`, `tools/studio-spike/browsertest-rules-washes-baselines.mjs`, `tools/studio-spike/shot-cardhead.mjs` (its "always-visible tally" header comment is now false). Plus `receipts/<sha>.md` in the design project, which is not a repo file.

Out of scope: `VersionedGroup` must not be split or restructured; these three items change its behaviour, not its shape (card, citing #324 and #338). From the obligations themselves:
- No change to the road's number call sites or `leafIndex()`, and no "fix" by appending a dot where the road passes the number.
- The recede timer stays at 500ms.
- No token file, no `tailwind/kn-theme.css`, no `src/ds/index.ts`.

Verify: on the running app, open the Walk Editor under the Plan preset and look at a card holding versions.
- At rest, its node count sits right against the card's right edge with no empty strip beside it.
- Hovering the card fades the three buttons in exactly where the count was while the count fades out, and nothing else shifts.
- The card's number reads "2." like the "1." "2." "3." on the pills inside it.
- With the pencil pressed, the pencil sits on a blue wash instead of grey.
- In its version menu, each row's highlight vanishes the instant the pointer leaves, while that row's red ✕ lingers for about half a second.

```
npm run verify
npm run build
npm run test:browser
node tools/studio-spike/shot-foldab.mjs
node tools/studio-spike/shot-cardhead.mjs
```

Assumptions:
- **The wash item is treated as done on the component side.** I won't rename our variables to match the design system's, or swap our hand-drawn ✕ for its shared button component. Our behaviour already meets every "done when" line, and the rename would be reshaping, not behaviour.
- **"About 40px wider" is an estimate.** The design system's own formula widens the title by the count's width minus 12px, roughly 26–30px for "3 nodes". I'll report the measured figure rather than tune to 40.
- **The pencil's blue edge may need a small deviation.** The design system sets the edge with a border-colour override on top of a full border setting. If React warns about mixing the two, which the browser tests count as a failure, I'll set the full border instead. It draws the same thing, and I'd log it on #74 and in the provenance ledger.
- **One local number stays.** The repo's own measured narrow-tally row height (18.84px, where the design system uses 14.85) is kept as it is.
- **Open issues not skimmed.** The GitHub CLI is off-limits in this step, so I haven't read the open issues in this area.