MINOR

**Must fix:**

none

The card's requirements are all implemented, as far as I can tell from reading the code. I could not run anything in this step, so "the drivers pass" is still unconfirmed.

- **One shared convention.** Pins now count stops from 0, the same as the design system. They are created with `step: i`, and the comments that said "1-based" are rewritten.
- **No arithmetic in the two places the card names.** The pin-marks builder in `WalkPins.tsx:70` (the card calls it `pinMarks`; it is now `marks`) builds the mark straight from `s.step` and `s.stepEnd`. The off-screen playback camera in `arrivallook.ts:76` tests `p.step <= arrival && arrival <= p.stepEnd`.
- **`pinPosition` no longer converts.** It compares the player's position straight against the pin's numbers.

**What I checked and found fine:**
- **Every code reader of a pin's step numbers.** I searched all of `src` outside the vendored design-system copy. Only pin creation, `pinPosition`, the wall view's `wallPinState`, the camera and `WalkPins.tsx` read them, and all five are updated. The unrelated `step` field in `route.ts` is a different thing (the top-level step number in a grouped walk), so it is correctly untouched.
- **What feeds those functions is 0-based.** The wall's `lit` is the stop index on the presenter screen and `state.stop - 1` on the projector. `play.position` is the player's 0-based position.
- **The browser drivers.** They read only the `data-step` and `data-step-end` attributes, never the model. Those attributes still print the stop number plus one, so no driver needed editing. I confirmed that none of the scripts under `tools/` import the pin model.
- **The unit tests.** I re-computed the edited `pinPosition` and wall-view cases by hand against the new code. They all hold, and every value is shifted down by one consistently. The reordered `wallArrowShown` assertions are equivalent to the originals.
- **The pin's identity key.** It is now `cell-0` where it used to be `cell-1`. It is only a unique React key and nothing parses it.

**Optional:**

1. **Nothing has been run (still open).** The card's last line, "the drivers pass", is not confirmed by this step. The build, unit tests, lint, desktop typecheck and the six browser drivers need `npm ci` and Edge. My expectation that they pass comes from reading the code, not from a test result.
2. **No unit test covers the `+ 1` on the on-screen attributes (still open).** Only the browser drivers would notice if a later edit dropped it, because no unit test renders the pin component.
3. **The hand-built pins in the "SEPARATE" tests still count from 1 (still open).** One example is `pin(1, 0, 0)` at `walkpins.test.ts:296`. Nothing asserts on that number, so no test is affected. It is only a leftover inconsistency with the new convention.
4. **The pull request text must say the on-screen step number still counts from 1 (still open).** This is what keeps the three past receipts true, and the diff cannot show it. Someone should check the PR description includes it.
5. **The card's names are stale (still open, wording only).** `pinMarks` is now `marks` in `WalkPins.tsx`, and the card's `MapView.tsx:868` reference now lives in `arrivallook.ts`. The code follows the card's intent.

**Noticed outside this card's scope:** nothing.

Assumptions:
- I judged the wall-view change in `walkwall.ts` and the `walkdraw.test.ts` fixture edits to be in scope. They sit on the same numbering seam, and the wall change is required once pin numbers shift.
- I counted the reworded failure message in `describeOverlap` (it now says "stop index") as harmless.
- I ignored the `.kncode/` run notes, which are not part of the diff.