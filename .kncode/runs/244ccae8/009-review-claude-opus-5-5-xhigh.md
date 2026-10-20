Must fix:

1. **In the opening desk, touching a seam rearranges the whole desk.**
   - **The cause.** The panes are drawn from the raw fractions (`src/studio/StudioView.tsx:496`). But the drag runs `fitSizes` before it clamps (`src/studio/desk.ts:144`, reached from `StudioView.tsx:516`), and the handle's `now/min/max` also come from `fitSizes` (`StudioView.tsx:491`, `:564`). `fitSizes` raises every pane that is under its floor whenever the floors fit in the row. So the first pixel of any drag moves every pane that the drawing had left under its floor, not just the two beside the seam.
   - **Measured in Edge** at 1280×800 with the sidebar open, the state the app launches in:
     - At rest: map 459, unfoldgraph 322, document 231 (its floor is 396). The first seam already announces `aria-valuenow` 362 while the map is 459 wide.
     - After a +2px drag on the map|unfoldgraph seam: map 364, unfoldgraph 252, document 396. That boundary jumped 95px *against* the pointer, and the document, which is not next to that seam, grew by 165px.
     - On release this is stored, because the travel was not zero.
   - **Contracts it breaks:**
     - The person's answer says a floor "limits how far a drag can go (through clampDesk)". Here it moves panes the drag never touched.
     - The `clampDesk` contract says "a drag moves one boundary and never cascades … every other pane is identical".
     - The plan's Verify step says "the boundary follows".
   - **Same cause elsewhere:** Explore below about 1265px with the sidebar open, and any stored split after the window narrows.
   - **The fix:** the drawing and the clamp need one set of numbers. Either clamp the drawn widths directly with `clampDesk`, which already gives nothing from a pane at or under its floor, and compute `deskBounds` from them; or draw the `fitSizes` result. The driver should also check that a small drag at launch moves only the two adjacent panes, by roughly the pointer's travel. It misses this today because its Explore and Plan drags run with the sidebar closed, where nothing is under its floor.

2. **"every browser driver passes unchanged" is still not fully shown (again).**
   - **What I ran on this commit:** every driver that writes no files, 19 in all, and they all pass. They are deskdividers (30/30), deskwidths (Explore still 756/488 at 1280), maphover, presenter-panes, relationsrail, explorerrail, dropverdict, explorerroute, grouppins, groupgapped, newversionpick, optionalgroup, pickerviewport, firstline, legendinset, walkvisibility, previewclamp, edgecolor and drive-tooltips.
   - **Still not run:**
     - studiodesk, and its comparison run on base `72206e8` that the person asked for;
     - walkdock, presenter, groupedit, mapconnections, rules-washes-baselines and coursecorpus;
     - the nine `drive-*` scripts that write files.
   - These write screenshots, and the base run needs git, so neither this step nor the fix step can close this. It belongs to the check step and asks for no code change.

Optional:

1. **The `narrowBelow` values are declared but nothing reads them** (`src/studio/instruments.tsx:60-64`, `:152-310`). Declaring `narrowBelow` above `floor` says the pane draws a lesser reading below that width, but no pane reads `narrowBelow` or draws one. The `PaneFit` contract says such a pane "sets them equal". #416's done-when 3 still wants the walk editor's fit taken from its own content. (Raised in round 0.)
2. **Every pointer move re-renders the whole Studio** (`StudioView.tsx:521`). `setDeskLive` runs every pane's `render(bus)`, the map and the document included. (Raised in round 0.)
3. **`Pane`'s `fit` is marked ★ LOCAL in PROVENANCE** (`src/ds/PROVENANCE.json:777`), but per CLAUDE.md a port divergence needs a comment on drift-log #74. If the agent can't post it, it could go in the receipt for the owner. (Raised in round 0.)
4. **A reset on either seam restores the whole composition** (`StudioView.tsx:528`). In Plan, double-clicking the walk editor|map seam also undoes a drag on map|document. Either reset only that boundary or say so. (Raised in round 0.)
5. **Walk·Stack's fixed 372px is now a fraction of the row** (`src/studio/desk.ts:61`, `instruments.tsx:196-204`). Three effects:
   - While the palette flies the row isn't re-measured, so Walk·Stack scales with the row and snaps back to 372 when the palette lands.
   - After any stored drag it scales with the window.
   - A drag can widen it past 372, although its own comment says "growing it would only add empty board".

Nit:

1. Hyphens where the house style uses " — ":
   - `src/studio/StudioView.tsx:471` changes an existing "—" to " - ";
   - the `describe` names at `src/studio/desk.test.ts:20`, `:47`, `:88`;
   - `src/studio/desk.ts:1`;
   - `src/ds/chrome/Pane.tsx:424`;
   - `src/ds/chrome/pane.test.ts:137-139`;
   - `instruments.tsx` ("declare 0 - no …", "#416 - the writing desk");
   - the driver's header.
2. `src/ds/barrel.test.ts:315`:
   - The comment line is overlong and has no closing period.
   - `PaneDivider` is now adopted twice but still sits in the "ported but not adopted" block, which the file's own note says adopted items leave.
   - The new JSON-parse test also lives in that block.
3. `src/studio/instruments.tsx:335`: the `Slot` doc still justifies stacks with "the palette above the document", which no preset uses any more.
4. `src/studio/desk.ts:18`: `DESK_GUTTER` restates the row's `gap-3`.
5. `src/ds/PROVENANCE.json:777` says `data-pane-fit` exists so "the desk's clamp … read the number". The clamp reads the registry (`deskFits`) and only the driver reads the attribute. And "cannot disagree" is the opposite of Must fix 1.
6. The receipt text lists "240/280/300/320/360/372" as floors, but 320 and 360 are `narrowBelow` values. The floors are 240/280/300/372. Its "Verified" line will also need the new driver check from Must fix 1.

Dropped from round 0, now resolved:
- PROVENANCE parses, and `barrel.test.ts:370` guards it.
- The floor no longer forces a CSS minimum width.
- The strip sits over the gutter, so there is no page overflow (deskdividers checks this and passes).
- The receipt text is in the run log.
- A gesture that didn't move stores nothing.
- The maphover edit was accepted by the person.
- The `ensureActive` nit is dropped: the length guards discard the stale values.

Noticed outside this card's scope:
- Declaring the map and document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3). #425 and its receipt should say so, so the work isn't redone.

Assumptions: I did not read OB-170's `done when:`. It lives in the design project, and the `DesignSync` tool is reserved for the `/design-sync` skill. I judged the change against the `PaneDivider`/`PaneFit` contracts, #416 and the person's answer. I measured in headless Edge at 1280×800 with an inline script that wrote no files. I ran only drivers that write no files. I treated vite's existing pre-bundle cache as read-only.