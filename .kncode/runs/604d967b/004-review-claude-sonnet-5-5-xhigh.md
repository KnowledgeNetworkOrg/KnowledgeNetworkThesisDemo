**Must fix:**

1. `src/model/walkpins.ts:276-286` — Single-stop pins on a stop's own drawn cell are no longer fanned. This breaks the card line "A stop **coarser** than the level (OB-109's clamp) is untouched; it already sits on its own centroid" and "Nothing else changes".
   - **What changed:** `if (!single) c = <arc>` and then `if (single) c = g.ownC` drop the OB-087 fan for every one-stop pin, including the case where the drawn cell is the stop itself (`visId === route[step]`, so `ownC === g.c`). Separate visits to the same stop used to sit on an even arc. They now start coincident and rely only on stage 6.
   - **Why it matters:** stage 6 is capped at 12 rounds. I replayed `separate()` for n coincident pins at the sizes `pinSizeFor(n)` gives, in a throwaway script outside the repo. Seven or eight revisits to one stop still overlap by about 0.4 and 2.6 px. That breaks the OB-128 guarantee ("no two pins drawn inside each other"), which the old fan gave for free.
   - **Fix:** keep the fan arc for a single pin whose drawn cell is the stop itself, and use `ownC` only where the drawn ancestor differs from the stop. Done-when (1) covers only levels coarser than the stop, so it still holds.

**Optional:**

1. `src/model/walkpins.ts:292` and `src/model/walkdraw.ts:107,170` — `sameSpot` (equal `visId` on neighbouring pins) suppresses the arrow and treats the pair as one stop. That was right when optionality twins were a few px apart on a fan. Now each twin sits at its own centre, which can be a cell apart, so the walk visibly jumps with no arrow. This happens in user-authored walks with an optional boundary at a coarse level. The card doesn't carve this out, and `walkdraw.ts` isn't a card file, so at least note it or key `sameSpot` on position.
2. `src/model/walkpins.ts:292` — `cellPolyOf(route[g.steps[0]], g.ownC)` returns `null` for a stop with no territory of its own, where `flightTargetOf` falls back to the owning topic's cell. `pinSpotClear` then silently skips label clearance, where the old ancestor polygon would have applied. Authored stops are topics, so it's latent, but `?? cellPolyOf(g.visId, g.c)` is a cheap guard.
3. `src/ds/PROVENANCE.json:148` — This deviation note still records `GHOST_L 0.640 / GHOST_C 0.110` and "one tone below the family-fill band, L 0.720". Every other port in the file leaves a dated note, so this port should too.
4. `tools/studio-spike/drive-maparrows.mjs:526` — It still asserts `/^oklch\(0\.640 0\.110 …/`, and it is the harness for Done-when (3). It will fail against the new tone, and it has no check that ghosts carry no `stroke`. It's outside `npm run verify`, so this is not a blocker.

**Nit:**

1. `src/model/walkpins.ts:28` — The pipeline summary still says "FAN pins that want the exact same point get spread around it", without the one-stop carve-out the stage body now describes.
2. `src/model/walkpins.ts:276-286` — For a single pin, `radius` and the arc `angle` are computed and then discarded. Branching `if (single) c = g.ownC else if (together > 1) …` reads more plainly (and a fix for the Must fix will rewrite this anyway).
3. `src/ds/graph/textFit.ts:94-105` — The docblock rewrites a dated measurement ("fell to 1.31:1 where it crossed a ghost stroke") into "another name's ink". The 2026-09-18 measurement was of the ghost stroke, so keep the history and add the OB-271 note instead.
4. `src/ds/graph/hueslots.ts:130` — "far enough from the children's ink that a case would only add noise" is an unmeasured claim. The card's reason is that the halo dates from when the ghost was faint.
5. `src/model/walkpins.test.ts` — The "lit cell" test uses `cellPolyOf` rather than the lit outline (`outlineOf`/`walkStopCell`). Because `pinSpotClear` returns either an in-polygon point or `from`, its assertion can't fail. It guards little beyond the first test.

**Noticed outside this card's scope:** none.

Assumptions: I did not run the test suite, because the rules forbid creating files and vitest writes a cache. I judged the new tests by reading them and replayed `separate()` in isolation. I read "untouched" for clamped stops as covering their fan placement, not only their centroid. I assumed the authored walks have no same-stop revisits, from a rough script over `teachingwalks.ts` whose parse was incomplete.