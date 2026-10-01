MINOR

**Must fix:**

none

The card asks for three things. Both of these hold in the code as it stands:
- **One shared convention:** the pin model now counts stops from 0, the same as the design system.
- **No arithmetic in the two named places:** the pin-marks builder and the off-screen playback camera do no arithmetic. The only `+ 1` left sits on the two on-screen attributes `data-step` and `data-step-end`, which the card itself allows ("converting once at the attribute").

I searched everything outside the vendored design-system copy for code that reads a pin's `step` or `stepEnd`. Only five places read them: pin creation, `pinPosition`, the wall view, the camera and the pin component. All five are updated. The arrow drawing, the pin-band selection and the pin-key format never use those numbers as stop counts, so nothing was missed. I also traced the changed `pinPosition`, `wallPinState` and `wallArrowShown` test cases by hand against the new code, and every expected value comes out right.

**Optional:**

1. **Nothing has been run (still open from the earlier review).** This checkout still has no `node_modules`, so the build, unit tests, lint and browser drivers have not run. The card's last line, "the drivers pass", is unconfirmed.
   - **Why I couldn't run them:** installing the packages creates files, and this step forbids that. The review step is not the place to run it.
   - **What the run needs:** `npm ci`, then `npm run verify`, then the browser drivers, which need Edge. I did not check whether Edge is installed here.
   - **Why I expect the drivers to pass:** they read only `data-step` and `data-step-end`, and those still print the stop number plus one, exactly as before. That is my reading of the code, not a test result.

2. **The `+ 1` on the on-screen attributes has no unit test (still open).** Only the browser drivers would notice if a later edit dropped it, because no unit test renders the pin component.

3. **The hand-built pins in the "SEPARATE" tests are still numbered from 1 (still open).** One example is `pin(1, 0, 0)` in `walkpins.test.ts`, around line 267. Nothing asserts on that number, so no test is affected. It is a leftover inconsistency with the new convention.

4. **The pull request text must say the on-screen step number still counts from 1 (still open).** The card says three past receipts describe pins that way. The diff can't show this, so whoever reviews the PR description should check it. Leaving the receipts alone is right, since they live in the design project outside this repo.

**Noticed outside this card's scope:** nothing.

Assumptions: I read "the drivers pass" as satisfied by leaving the drivers and their expected tables unedited, since the attributes they read are unchanged. I judged the wall-view change in `walkwall.ts` and the `walkdraw.test.ts` fixture edits to be in scope, because they sit on the same numbering seam and the wall change is required once pin numbers shift. I treated the `.kncode/` run notes in the repo as unrelated to this change.

FLAG: unverifiable: Can the verification step run `npm ci` and `npm run verify`, and the six browser drivers on a machine with Edge, so "the drivers pass" is confirmed rather than hand-traced?