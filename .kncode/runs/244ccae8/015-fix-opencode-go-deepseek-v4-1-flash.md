1. **Must fix 1: fixed.** Flexible columns are now drawn with a row-relative width, `width: calc((100% - ${gutters + fixedTotal}px) * ${fraction})` with `flex: 0 1 auto` (`src/studio/StudioView.tsx:506-520`), so the panes grow with the palette's closing row instead of holding a pixel snapshot; the measurement effect still only feeds the handles' bounds (`:429-445`, `:495-504`). Added the flight trace and assertions in `tools/studio-spike/browsertest-deskdividers.mjs:100-114,183-192`: worst gap between the last pane and the row's right edge was 0.0px across 40 frames, the 220px widening arrived over many frames (largest 71.3px, under half), and the driver now passes 41/41.

2. Person's asks:
- Clamp the widths as drawn, with `deskBounds`/`aria` from the same numbers: fixed (unchanged from round 3; `src/studio/StudioView.tsx:530-546`, `src/studio/desk.ts:88`).
- Do not draw `fitSizes`, remove it: fixed, no references remain.
- Launch drag case (1280×800, sidebar open, each seam, only two panes move, `aria-valuenow` matches the drawn width): fixed (`tools/studio-spike/browsertest-deskdividers.mjs:118-136`).
- Walk·Stack stays a fixed 372px outside the fractions and drag: fixed (`src/studio/desk.ts:33`, `src/studio/StudioView.tsx:483`).
- Em dashes: fixed, including the driver's failure separator this round (`tools/studio-spike/browsertest-deskdividers.mjs:34`).
- Move `PaneDivider` and the JSON-parse test out of "not adopted": fixed (`src/ds/barrel.test.ts:368,379`).
- `Slot` doc: fixed (`src/studio/instruments.tsx:335`).
- PROVENANCE wording: fixed (`src/ds/PROVENANCE.json:777`).
- Receipt floors (240/280/300/372) plus the new launch and flight checks: fixed, receipt below.
- Full `npm run test:browser`, studiodesk on base `72206e8`, Firefox skips: not fixed here, the check step, per your answer.
- Optionals 1–4: left as they are, to be recorded in the closing comment.

**Receipt text for OB-170 (owner files with the final sha)**
```text
OB-170 — the desk's dividers drag, and each pane declares its own floor.

Commit: <owner to fill with the final merged sha>
Landed: src/studio/instruments.tsx (required PaneFit per instrument, stack fit is the strongest
member), src/studio/desk.ts (fraction/clamp arithmetic; a fixed pane stays out of both; seams
cost only the row's 12px gutter), src/studio/StudioView.tsx (PaneDivider between column slots;
the clamp runs on the widths drawn, and those widths are fractions of the row, so a pane under
its floor gives nothing away and the desk follows a palette flight frame by frame; live widths
on drag, stored only when the clamp moved something; reset per composition), src/ds/chrome/Pane.tsx
(publishes data-pane-fit; no CSS minimum), src/ds/PROVENANCE.json, src/studio/desk.test.ts,
src/ds/chrome/pane.test.ts, src/ds/barrel.test.ts, tools/studio-spike/browsertest-deskdividers.mjs.

Verified: tsc -b clean; vitest 61/61 across desk, pane and barrel tests;
browsertest-deskdividers 41/41, including the launch drag at 1280 with the sidebar open (a 2px
drag on each seam moves only the two panes beside it and aria-valuenow matches the drawn width),
the stopped-seam check (once the unfold graph reaches its floor, 20 further ArrowRight presses
move neither the boundary nor the document), the palette-close flight (the last pane stays on
the row's right edge across 40 frames and the 220px widening is spread over them, no frame
carrying half), no page-level horizontal overflow and every pane/handle reachable at 1280 with
the sidebar open and at 1100. The full `npm run test:browser`, studiodesk on base 72206e8 and the
two Firefox drivers are left to the check step.

Open assumptions:
- OB-170's own `done when:` text was not in the checkout; the PaneDivider/PaneFit contracts,
  #416's done-when and the owner's gate answer were used instead.
- The floors for panes without a rail are 240/280/300/372, recorded as the pane's own measurement
  point; the map and document take railFloor('left'|'right').
- Widths are in-memory per-composition fractions; reload persistence is #368.
- The Plan preset change is #416's and is carried deliberately by this lane.
```

Assumptions: I took the palette-close movement to be measured at the desk row's left edge (the right edge is pinned while the sidebar collapses), so the flight check asserts the gap at the right stays zero and the left-edge travel is spread across frames rather than any one frame carrying half. The 2px launch drag and its ±2px tolerance are kept as the person asked for "a small drag".

Noticed outside this card's scope: declaring the map and document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3); #425 and its receipt should record that.