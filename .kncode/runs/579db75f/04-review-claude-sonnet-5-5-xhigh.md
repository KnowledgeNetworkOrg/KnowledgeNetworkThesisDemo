PASS

**Must fix:**

none

**Optional:**

1. **Nothing was run, here or in the earlier step.** This working copy has no installed packages (`node_modules` and `desktop/node_modules` are both missing). So the build, unit tests, lint, desktop typecheck and browser drivers have not run. The card's last "Done when" line, "the drivers pass", can't be confirmed from this checkout. I traced every `pinPosition`, `wallPinState` and `wallArrowShown` test case by hand against the new code, and each expected value comes out right. Hand tracing doesn't replace a run. The drivers read only the `data-step` and `data-step-end` page attributes, which still print stop number + 1, so they should pass unchanged.

2. **The one remaining `+ 1` has no unit test.** The card allows it ("converting once at the attribute", `WalkPins.tsx:107-108`). Only the browser drivers lock it, because no unit test renders the pin component. If a later edit drops the `+ 1`, the unit suite stays green and only the drivers would catch it.

3. **The hand-built pins in the "SEPARATE" tests are still numbered from 1** (`walkpins.test.ts:267` and its callers, e.g. `pin(1, 0, 0)`). Nothing asserts on that number, so no test is affected. It's a leftover inconsistency with the new convention. The earlier step already noted this and left it deliberately.

4. **The pull request text must say the attribute stays counted from 1.** The card says three past receipts describe pins that way. The plan's step 8 covers this. It can't be seen in the diff, so the reviewer of the PR description should check it. The receipts themselves live in the design project, outside this repo, so leaving them alone is right.

What I checked and found complete:
- Every place that reads a pin's `step` or `stepEnd` outside the vendored design-system copy is updated: the pin creation, `pinPosition`, the wall view, the camera, and the pin component. The arrows, the draw rules and the wall fit never read those fields.
- The "counted from 1" wording is gone from the source comments. The one remaining hit, in a driver comment, describes the on-screen number and is still true.
- The wall-view conversion the card missed is fixed.
- The pin component's `marks` memo and the camera check do no arithmetic. This meets "pinMarks and the playback camera do no arithmetic".

Assumptions: I read "the drivers pass" as satisfied by leaving the drivers and their expected tables unedited, since the attributes they read are unchanged. I treated the `walkwall.ts` change and the `walkdraw.test.ts` fixture edits as in scope. They sit on the same seam, and the wall change is required once the pin numbers shift.

FLAG: unverifiable: Can someone run `npm run verify` and the listed browser drivers somewhere that has the packages and Edge installed before this merges?