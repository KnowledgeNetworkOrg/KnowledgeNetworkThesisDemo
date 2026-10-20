1. **Must fix**
1. fixed — `src/ds/PROVENANCE.json:796` no longer contains the raw line break and parses; `src/ds/barrel.test.ts:370` now JSON-parses the file so a stray control character fails the suite.
2. fixed — the floor is no longer a CSS `minWidth` (`src/ds/chrome/Pane.tsx:528-531`, `src/studio/StudioView.tsx:495`); it only clamps drags. When the floors together exceed the row, `src/studio/desk.ts:90` shrinks the panes in their fractions instead of overflowing. The 14px strip now lies over the existing 12px gutter via negative margins (`src/studio/desk.ts:22`, `src/studio/StudioView.tsx:577`), so a seam costs only the gutter. `browsertest-deskdividers.mjs` asserts no page-level sideways scroll and reachable panes/handles for the opening composition and Plan at 1280 with the sidebar open and at 1100 (`:70`, `:104`, `:190`, `:194`). That driver passes 30/30.
3. not fixed here — proving the whole suite and the base-`72206e8` comparison is an evidence task, and this step forbids whole-repository and git runs. The driver covering this change passes; `npm run test:browser` and the base comparison need the check step. `browsertest-maphover.mjs`'s setup-only edit is kept as accepted.
4. fixed — the receipt text is below, with the open assumptions; the owner fills the final sha.

2. **The person's answer**
- maphover setup-only edit accepted: fixed — no change made; the preset change stays.
- Repair PROVENANCE and add a JSON-parsing vitest: fixed — as Must fix 1.
- Floors clamp drags, no page overflow, strip over the gutter, driver assertions: fixed — as Must fix 2.
- Full browser suite and base-`72206e8` studiodesk run: not fixed here — forbidden by this step's whole-repository/git rules; belongs to the check step.
- Receipt in the run log with assumptions: fixed — receipt below.
- Optional 1, store nothing when the gesture did not move: fixed — `src/studio/StudioView.tsx:524` stores only when `delta !== 0`.

4. **Noticed outside this card's scope**
- Declaring the map/document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3); #425 and its receipt should be updated so it is not redone.

5. **Assumptions:** OB-170's `done when:` text was not in this checkout, so I judged against the `PaneDivider`/`PaneFit` contracts, #416's done-when and the person's answer. The non-rail floors (240/280/300/320/360/372) are chosen measurements; `narrowBelow` above `floor` is each pane's declared lesser-reading point. Persistence of widths remains out of scope (#368).

**Receipt text for OB-170 (owner files with the final sha)**
```
OB-170 — the desk's dividers drag, and each pane declares its own floor.

Commit: <owner to fill with the final merged sha>
Landed: src/studio/instruments.tsx (required PaneFit per instrument, stack fit is the strongest
member), src/studio/desk.ts (fraction/clamp arithmetic, seams cost only the row's 12px gutter),
src/studio/StudioView.tsx (PaneDivider between column slots; live widths on drag, stored on a
real release; reset per composition), src/ds/chrome/Pane.tsx (publishes data-pane-fit; no CSS
minimum), src/ds/PROVENANCE.json, src/studio/desk.test.ts, src/ds/chrome/pane.test.ts,
src/ds/barrel.test.ts, tools/studio-spike/browsertest-deskdividers.mjs.

Verified: vitest 62/62 across desk, pane and barrel tests; browsertest-deskdividers 30/30,
including no page-level horizontal overflow and every pane/handle reachable at 1280 with the
sidebar open and at 1100. The full `npm run test:browser` is left to the check step.

Open assumptions:
- OB-170's own `done when:` text was not in the checkout; the PaneDivider/PaneFit contracts,
  #416's done-when and the owner's gate answer were used instead.
- The floors for panes without a rail are chosen (240/280/300/320/360/372), recorded as the
  pane's own measurement point; the map and document take railFloor('left'|'right').
- Widths are in-memory per-composition fractions; reload persistence is #368.
- The Plan preset change is #416's and is carried deliberately by this lane.
```