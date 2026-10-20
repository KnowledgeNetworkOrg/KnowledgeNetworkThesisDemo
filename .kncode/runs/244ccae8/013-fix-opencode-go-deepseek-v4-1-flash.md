1. **Must fix**
- 1. fixed — `src/studio/StudioView.tsx:504` now draws each flexible column at the exact pixel width derived from its fraction (`width` + `flex: 0 1 auto`, border-box), so the drawn width and the stored fraction are one number; `src/studio/StudioView.tsx:528,540` stores only when the clamped sizes differ from the gesture's base. `tools/studio-spike/browsertest-deskdividers.mjs:138` adds the stopped-seam check: after the unfold graph reaches its floor, 20 more ArrowRight presses leave the map, the boundary and the document unchanged. Driver passes 38/38.

2. **The person's asks**
- Clamp widths as drawn, with `deskBounds`/`aria` from the same numbers: fixed — `src/studio/StudioView.tsx:502-514,540-546`.
- Do not draw `fitSizes`, and remove it: fixed — no references remain; the preset fractions still drive the launch split.
- Launch drag case (1280×800, sidebar open, each seam): fixed — `tools/studio-spike/browsertest-deskdividers.mjs:107` and the new `:138-154`.
- Walk·Stack stays a fixed 372px outside the fractions and drag: fixed — `src/studio/desk.ts:33`, `src/studio/StudioView.tsx:483`.
- Em dashes in the touched files: fixed — `StudioView.tsx`, `desk.ts`, `Pane.tsx`, `pane.test.ts`, `instruments.tsx`, driver header.
- Move `PaneDivider` and the JSON-parse test out of the "not adopted" block: fixed — `src/ds/barrel.test.ts:368,379`.
- `Slot` doc no longer justifies stacks by a retired preset: fixed — `src/studio/instruments.tsx:335`.
- PROVENANCE "cannot disagree" wording: fixed — `src/ds/PROVENANCE.json:777`.
- Receipt floors (240/280/300/372) and launch check: fixed — updated receipt below, now including the stopped-seam check.
- Full `npm run test:browser`, studiodesk on base `72206e8`, Firefox skips: not fixed here — the check step, per your answer.
- Optionals 1–4: left as they are, for the closing comment.

4. **Noticed outside this card's scope**
- Declaring the map and document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3); #425 and its receipt should record that.

5. **Assumptions:** Flexible columns are sized by explicit pixel width from the measured row and the preset fractions rather than percentage flex-grow, which is what makes the drawn width and the stored fraction identical; the launch split moves by under 1px per pane and keeps the document under its floor. A fixed column's seam remains disabled. I ran `npx tsc -b` and `browsertest-deskdividers` only.

**Receipt text for OB-170 (owner files with the final sha)**
```text
OB-170 — the desk's dividers drag, and each pane declares its own floor.

Commit: <owner to fill with the final merged sha>
Landed: src/studio/instruments.tsx (required PaneFit per instrument, stack fit is the strongest
member), src/studio/desk.ts (fraction/clamp arithmetic; a fixed pane stays out of both; seams
cost only the row's 12px gutter), src/studio/StudioView.tsx (PaneDivider between column slots;
the clamp runs on the widths drawn, and the widths drawn are the stored fractions, so a pane
under its floor gives nothing away; live widths on drag, stored only when the clamp moved
something; reset per composition), src/ds/chrome/Pane.tsx (publishes data-pane-fit; no CSS
minimum), src/ds/PROVENANCE.json, src/studio/desk.test.ts, src/ds/chrome/pane.test.ts,
src/ds/barrel.test.ts, tools/studio-spike/browsertest-deskdividers.mjs.

Verified: tsc -b clean; vitest 61/61 across desk, pane and barrel tests;
browsertest-deskdividers 38/38, including the launch drag at 1280 with the sidebar open (a 2px
drag on each seam moves only the two panes beside it and aria-valuenow matches the drawn width),
the stopped-seam check (once the unfold graph reaches its floor, 20 further ArrowRight presses
move neither the boundary nor the document), no page-level horizontal overflow and every
pane/handle reachable at 1280 with the sidebar open and at 1100. The full `npm run test:browser`,
studiodesk on base 72206e8 and the two Firefox drivers are left to the check step.

Open assumptions:
- OB-170's own `done when:` text was not in the checkout; the PaneDivider/PaneFit contracts,
  #416's done-when and the owner's gate answer were used instead.
- The floors for panes without a rail are 240/280/300/372, recorded as the pane's own measurement
  point; the map and document take railFloor('left'|'right').
- Widths are in-memory per-composition fractions; reload persistence is #368.
- The Plan preset change is #416's and is carried deliberately by this lane.
```