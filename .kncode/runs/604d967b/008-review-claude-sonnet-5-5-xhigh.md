**Must fix:**

none

The Must fix from round 0 is resolved. `src/model/walkpins.ts:285` keeps the OB-087 arc when the drawn cell is the stop itself, which covers the OB-109 clamp. `ownC` comes from the same `flightTargetOf` call as `anchor.c`, so those pins' positions are unchanged. The regression test at `src/model/walkpins.test.ts:~277-300` covers it.

I checked each card line against the code:
- **OB-271 ghost colour.** `GHOST_L` is 0.800 and `GHOST_C` is 0.070, and `topicpaint.test.ts` asserts the two values and the string format.
- **OB-271 outlines.** `grep GHOST_CASE|ghostCase` finds nothing in `src`. The three spreads are gone, and active names keep `LabelCut.case`.
- **OB-274 placement.** Single-stop pins sit on `ownC` with the polygon `cellPolyOf(stop, ownC)`. Run pins keep the ancestor centre, polygon and fan slot.
- **OB-274 unchanged fields.** `visId`, `key`, size, merging and crowd still read the drawn ancestor.

I read the code and tests but did not run them, to avoid writing files. The previous step reported 38 passing tests in `walkpins.test.ts`.

**Optional:**

1. `src/model/walkdraw.ts:107` (reached from `walkpins.ts:285`) — **Arrow suppressed between optionality twins (raised in round 0, still open).**
   - `sameSpot` still treats neighbouring pins with equal `visId` as one spot and draws no arrow between them.
   - That was safe when twins were fanned a few px apart on one ancestor centre. Now two one-stop twins each sit at their own stop's centre, which can be a whole cell apart, so the walk visibly jumps with no arrow.
   - It only arises in user-authored walks with an optional boundary inside one drawn ancestor. The authored walks have no optional stops, so no test catches it.
   - `walkdraw.ts` is not a card file. Either key `sameSpot` on position, or accept it and note it on the closing comment.
2. `src/model/walkpins.ts:293` — **No label clearance for a stop with no territory of its own (raised in round 0, still open).**
   - The poly is now `cellPolyOf(route[step], ownC)`, which returns `null` for a stop with no own territory. `flightTargetOf` still places such a stop on its owning topic's cell.
   - When `visId` is an ancestor, the old code had that ancestor's polygon for label clearance and the new code has none, so `pinSpotClear` skips clearance.
   - Authored stops are topics, so this is latent. `?? cellPolyOf(g.visId, g.c)` is a cheap guard.
3. `src/ds/PROVENANCE.json:148` — **Port note not updated (raised in round 0, still open).** The OB-223 entry still records `GHOST_L 0.640 / GHOST_C 0.110` and the "below the family-fill band" rationale. Other ports in the file leave a dated note, so this port should too.
4. `tools/studio-spike/drive-maparrows.mjs:526` — **Spike driver still asserts the old tone (raised in round 0, still open).**
   - It checks `/^oklch\(0\.640 0\.110 …/`, so it fails against the new tone.
   - It is also the harness for Done-when (3) and has no check that ghosts carry no `stroke`.
   - It is outside `npm run verify`.
5. `src/model/walkpins.test.ts` — **Run-pin test never builds a run sharing an ancestor with a single.**
   - The "only c moves" test relies on authored walks. A run and a one-stop pin on one drawn ancestor is the case where the single skips its fan slot and the run must still land where it does today.
   - The same gap covers one stop revisited non-adjacently at a coarse level. Both pins are now coincident on `ownC` and rely only on stage 6, which is capped at 12 rounds.
   - A built case for each would pin both.

**Nit:**

1. `src/model/walkpins.ts:28` — The pipeline summary still says "FAN pins that want the exact same point get spread around it", without the one-stop carve-out that the stage 4 comment at 257-265 now describes (raised in round 0).
2. `src/model/walkpins.ts:277-287` — The OB-274 comment sits above `if (together > 1)`, but the `ownC` logic is split across `if (single && …) … else …` and a trailing `else if (single)`. Hoisting `const onOwn = single && g.visId !== route[g.steps[0]]` would read more plainly. For an `onOwn` pin, `radius` and `angle` are computed and then discarded.
3. `src/ds/graph/textFit.ts:94-95` — The dated 2026-09-18 measurement ("fell to 1.31:1 where it crossed a ghost stroke") was rewritten to "another name's ink". The measurement was of the ghost stroke, so keep that history and add the OB-271 note beside it (raised in round 0).
4. `src/ds/graph/hueslots.ts:130-132` — "far enough from the children's ink that a case would only add noise" is an unmeasured claim. The card's reason is that the halo dates from when the ghost was faint (raised in round 0).
5. `src/instruments/map/maplabelfit.ts:39` — The `ancLabelO` docblock still says "one opaque mid-tone per hue". The tone is now pale, inside the fill band.
6. `src/model/walkpins.test.ts` — The first OB-274 test only asserts containment when the pin is exactly at `own.c`. A pin moved by stage 6 isn't checked, and a count of how many pins were checked would show it isn't vacuous. The "lit cell" test uses `cellPolyOf` rather than the lit outline (`outlineOf`). `pinSpotClear` returns either an in-polygon point or `from`, so that assertion can't fail beyond "the stop's centre is in its own polygon" (raised in round 0).

**Noticed outside this card's scope:** none beyond the spike-driver and PROVENANCE items above.

Assumptions: I took `walkStopCell` to light `outlineOf(stop)`, which is the stop's territory polygon, so `cellPolyOf(stop)` is the right containment test for Done-when (2). I treated the arc slot a skipped single leaves empty as intended, since it keeps run pins' `c` identical to today's.