1. In `topicvalues.ts`, set `GHOST_L = 0.800` and `GHOST_C = 0.070`, update the ghost docblock, and refresh the ghost prose in `hueslots.ts` and `textFit.ts` so it describes a pale tone inside the fill band (0.720–0.900), not below it and not outlined.
2. Update `topicpaint.test.ts`: assert `GHOST_L` 0.8, `GHOST_C` 0.07 and `oklch(0.800 0.070 <deg>)` for every hue; drop the old “darker than the darkest fill” test and its now-unused `nestedFamilyPaint` import.
3. In `MapLabels.tsx`, delete `GHOST_CASE`, `ghostCase` and the three spreads (country ghost, province ghost, deep `data-ghostlabel`), rewrite the surrounding comments, and leave active labels’ `LabelCut.case` outlines, opacity, hover fade and paint order untouched.
4. In `walkpins.ts`, carry each resolved stop’s own `flightTargetOf(stop).c` alongside the existing drawn-anchor `c`; keep merge, crowd, `visId`, `key`, size and stage 2 reading the ancestor.
5. Build single-stop pins from the own centre and nudge them with `cellPolyOf(stop, ownCentre)`; keep run pins on the ancestor centre/polygon, preserving today’s fan result for runs and letting stage 6 resolve any single-pin overlaps.
6. Extend `walkpins.test.ts` with: own-cell containment for every authored stop at every coarser level, lit-cell containment for the stop, merged-run pin `c`/`size`/`key` unchanged, and merge/crowd structure unchanged for every walk and level.
7. Run the full verification and fix any type, lint or test fallout.

Files: `src/ds/graph/topicvalues.ts`, `src/ds/graph/hueslots.ts`, `src/ds/graph/textFit.ts`, `src/ds/graph/topicpaint.test.ts`, `src/instruments/map/MapLabels.tsx`, `src/model/walkpins.ts`, `src/model/walkpins.test.ts`

Out of scope: `visId`, stage-2 merging, crowd count, pin `key`, the pin’s cell tooltip/OB-131 precedence, run-pin geometry, active-label outlines, ghost opacity/hover fade/paint order, and `MapView.tsx`; also accepted unchanged: zoomed-out single pins near an area edge, point-to-point arrow lengths, and stage-6 pins pushed past cell edges.

Verify: On the map at the owner’s screenshot level, the parent heading is pale with no white stroke, and during playback pin 7 lies inside the lit cell under Security.
```
npm run build
npm run test
npm run verify
```

Assumptions: “coarser level” means a level below the stop’s own `flightTargetOf` tier; single-stop pins are not fanned because the card permits only stage 6 to move them off their centre, while run pins keep today’s ancestor-keyed fan; the “lit cell” is the stop’s own territory polygon used by `outlineOf`; the stale ghost assertion in `tools/studio-spike/drive-maparrows.mjs` is outside this lane and not part of `npm run verify`.