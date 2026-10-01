MINOR

**Must fix:**

none

The card asks for three things, and the code now does all three.
- **One shared convention.** The pin model counts stops from 0, the same as the design system. Pins are created with `step: i`, and the comments that said "1-based" are rewritten.
- **No arithmetic in the two named places.** The pin-marks builder (now called `marks`, in `WalkPins.tsx`) builds each mark as `{ from: s.step, to: s.stepEnd }`. The off-screen playback camera in `arrivallook.ts` tests `p.step <= arrival && arrival <= p.stepEnd`. Neither does any `+ 1` or `- 1`.
- **`pinPosition` no longer converts.** It compares the player's position directly with the pin's `step` and `stepEnd`.

The one `+ 1` left is on the two on-screen number attributes, `data-step` and `data-step-end`. The card itself allows this ("converting once at the attribute"), and it keeps what the drivers read unchanged.

**What I checked and found fine:**
- **Every reader of a pin's step numbers.** I searched all of `src/` outside the vendored design-system copy. Only five places read them: pin creation, `pinPosition`, the wall view (`wallPinState`), the camera and `WalkPins.tsx`. All five are updated. Neither the arrow drawing nor the label-fit code reads them.
- **The pin's identity key.** It is built from the cell plus the first stop number, so it now reads `cell-0` where it used to read `cell-1`. Nothing parses it. It is only used as a unique label, so this is harmless.
- **The browser drivers.** They read only the `data-step` and `data-step-end` attributes, which still print the stop number plus one. No driver reads the model's `step` field, so none needed editing.
- **The unit tests.** I re-read the edited cases in `walkpins.test.ts`, `walkwall.test.ts` and `walkdraw.test.ts` against the new code. Each value was shifted down by one consistently with the new numbering. The `wallArrowShown` cases also read correctly, although two of the assertions were reordered.

**Optional:**

1. **Nothing has been run (still open).** The card's last line, "the drivers pass", is not yet confirmed. The build, unit tests, lint and six browser drivers have not run in this review. This step cannot install packages or run commands that write files.
   - The check step needs `npm ci`, then `npm run verify`, then the browser drivers, which need Edge.
   - I expect the drivers to pass because the attributes they read are unchanged. That is my reading of the code, not a test result.

2. **No unit test covers the `+ 1` on the on-screen attributes (still open).** Only the browser drivers would notice if a later edit dropped it, because no unit test renders the pin component.

3. **The "SEPARATE" tests still number their hand-built pins from 1 (still open).** One example is `pin(1, 0, 0)` at `walkpins.test.ts:296`, which builds its pins with `step` set to the number passed in. Nothing asserts on that number, so no test is affected. It is only a leftover inconsistency with the new convention.

4. **The pull request text must say the on-screen step number still counts from 1 (still open).** The card says three past receipts describe pins that way, and the diff cannot show that. Whoever reads the PR description should check it. Leaving the receipts alone is right, because they live in the design project outside this repo.

5. **The card's names are stale.** It calls the pin-marks builder `pinMarks`, but it is now `marks` in `WalkPins.tsx`. The card's `MapView.tsx:868` reference moved to `arrivallook.ts`. This is only a wording difference, and the code follows the intent.

**Noticed outside this card's scope:** nothing.

Assumptions: I read "the drivers pass" as satisfied by leaving the drivers and their expected tables unedited, since the attributes they read are unchanged. I treated the wall-view change in `walkwall.ts` and the `walkdraw.test.ts` fixture edits as in scope. They sit on the same numbering seam, and the wall change is required once pin numbers shift. I ignored the `.kncode/` run notes in the repo as unrelated to this change.

FLAG: unverifiable: Can the check step run `npm ci`, `npm run verify` and the six browser drivers on a machine with Edge, so "the drivers pass" is confirmed rather than traced by hand?