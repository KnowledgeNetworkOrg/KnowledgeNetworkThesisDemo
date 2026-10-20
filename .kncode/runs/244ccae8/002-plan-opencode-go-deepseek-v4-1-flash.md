1. Re-read the binding OB-170 text and the `PaneDivider`/`Pane` contracts, and map which desk panes are column slots (stacks share one column).
2. Add a required `fit: PaneFit` to `Instrument`, declaring `narrowBelow`/`floor` for every column pane; use `railFloor('left')` for map and `railFloor('right')` for document, measure the walk editor and the other panes from their own content, and make a stack's fit the maximum of its members.
3. Give `Pane` a `fit` prop applying `minWidth: paneFit(fit).floor` to the frame, with a stable DOM hook so the browser driver can verify the declared floor.
4. Rework `StudioView`'s desk row: interleave a `PaneDivider` between adjacent column slots, keep every pane in one keyed list so benching still preserves state, derive drawn widths from the measured row plus per-composition fractions, and route drag, keyboard and reset through `clampDesk`/`deskBounds`, writing state only on `onDragEnd`.
5. Apply `#416`'s Plan preset change—walk editor | map | document, walk palette removed from that preset only—per the lane comment; leave `#412`'s hint wording for when it is settled.
6. Add unit tests for registry fits, stack-fit merging, fraction/clamp/reset arithmetic and `Pane`'s floor, plus a new browser driver for drag, floor stops, no resting hairline, keyboard reset and narrow-window behaviour.
7. Update the port record/barrel expectations, run the full verify and browser suite with existing drivers unchanged, then file the OB-170 receipt against the commit.

Files: `src/studio/instruments.tsx`, `src/studio/StudioView.tsx`, `src/studio/desk.ts` (new), `src/studio/desk.test.ts` (new), `src/ds/chrome/Pane.tsx`, `src/ds/chrome/pane.test.ts`, `src/ds/PROVENANCE.json`, `src/ds/barrel.test.ts`, `tools/studio-spike/browsertest-deskdividers.mjs` (new)

Out of scope: this repo's issue #170 (persisted data carrying no version field), which is a different thing entirely from OB-170; changing what panes draw rather than how they are sized.

Verify: In Explore, drag the map|document seam left—the boundary follows, the document stops at 396px with its Relations rail still usable, the hairline appears only on hover/drag/focus, and double-click restores the preset split; in Plan both seams drag and stop at each pane's declared floor.
```
npm run verify
npm run test:browser
```

Assumptions: OB-170's exact `done when:` is in the design project's `design-sync.md`, not this checkout, so I used `PaneDivider`'s host contract plus #416's divider clauses; the draggable boundaries are the composition row's width boundaries only (fixed palette and full-width strips excluded); map/document floors come from `railFloor('left'|'right')`; widths are in-memory per-composition fractions here, with reload persistence left to #368; #416's Plan preset is included per the lane comment, while #412's wording is deferred.