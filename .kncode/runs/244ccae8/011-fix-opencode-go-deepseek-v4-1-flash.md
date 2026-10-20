1. Must fix
- **1. fixed** — `src/studio/desk.ts:88` now clamps the measured widths directly; `src/studio/StudioView.tsx:503,527,579` derives the drawn sizes, drag base and `deskBounds`/`aria-valuenow` from the same numbers. `fitSizes` is removed, and `tools/studio-spike/browsertest-deskdividers.mjs:107` adds the launch drag at 1280 with the sidebar open.
- **2. not fixed:** left to the check step, per the owner's answer. This step cannot run the whole browser suite or the base-`72206e8` comparison; the check step must run all of `npm run test:browser`, including the named drivers, the base comparison, and skip the two Firefox drivers.

2. The person's asks
- **Must fix 1, first way:** fixed — see Must fix 1 above; drawing still uses the preset fractions, not `fitSizes`.
- **Optional 5, Walk·Stack fixed at 372px:** fixed — `src/studio/desk.ts:33` and `src/studio/StudioView.tsx:483` keep a fixed column at its own pixels, outside the fractions and the drag; a seam beside it is disabled.
- **Em dashes:** fixed in `StudioView.tsx:471`, `desk.ts:1`, `AnchorPane.tsx`/`Pane.tsx:424`, `pane.test.ts:139`, `instruments.tsx`, and the driver header.
- **Move `PaneDivider` and the JSON-parse test out of the "not adopted" block:** fixed — `barrel.test.ts:368,379`.
- **`Slot` doc:** fixed — `instruments.tsx` no longer justifies stacks by a retired preset.
- **PROVENANCE "cannot disagree" wording:** fixed — `PROVENANCE.json:777` now says only the driver reads `data-pane-fit`.
- **Receipt floors and launch check:** fixed — corrected receipt below.
- **Optionals 1–4:** left as instructed.
- **Full browser suite/base comparison:** not fixed here — check step, per the owner.

**Corrected receipt text**
```text
OB-170 — the desk's dividers drag, and each pane declares its own floor.

Commit: <owner to fill with the final merged sha>
Landed: src/studio/instruments.tsx (required PaneFit per instrument, stack fit is the strongest
member), src/studio/desk.ts (fraction/clamp arithmetic; a fixed pane stays out of both; seams
cost only the row's 12px gutter), src/studio/StudioView.tsx (PaneDivider between column slots;
the clamp runs on the widths drawn, so a pane under its floor gives nothing away; live widths on
drag, stored on a real release; reset per composition), src/ds/chrome/Pane.tsx (publishes
data-pane-fit; no CSS minimum), src/ds/PROVENANCE.json, src/studio/desk.test.ts,
src/ds/chrome/pane.test.ts, src/ds/barrel.test.ts, tools/studio-spike/browsertest-deskdividers.mjs.

Verified: tsc -b clean; vitest 61/61 across desk, pane and barrel tests;
browsertest-deskdividers 36/36, including the launch drag at 1280 with the sidebar open (a 2px
drag on each seam moves only the two panes beside it and aria-valuenow matches the drawn width),
no page-level horizontal overflow and every pane/handle reachable at 1280 with the sidebar open
and at 1100. The full `npm run test:browser`, studiodesk on base 72206e8 and the two Firefox
drivers are left to the check step.

Open assumptions:
- OB-170's own `done when:` text was not in the checkout; the PaneDivider/PaneFit contracts,
  #416's done-when and the owner's gate answer were used instead.
- The floors for panes without a rail are 240/280/300/372, recorded as the pane's own measurement
  point; the map and document take railFloor('left'|'right').
- Widths are in-memory per-composition fractions; reload persistence is #368.
- The Plan preset change is #416's and is carried deliberately by this lane.
```

Assumptions: I treated a fixed column's seam as disabled, since moving it would either change 372px or cascade into its neighbour. Walk·Stack remains the only fixed pane. I ran `npx tsc -b`, the three relevant vitest files, and `browsertest-deskdividers` only.

Noticed outside this card's scope: declaring the map and document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3); #425 and its receipt should record that.