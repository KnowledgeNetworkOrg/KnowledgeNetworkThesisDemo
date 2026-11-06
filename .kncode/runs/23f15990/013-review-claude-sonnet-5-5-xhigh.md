The one open finding, R2-9, is fixed, and I found nothing new, so the verdict is PASS. I did not run the browser driver (`browsertest-cs2023marks.mjs`) or `npm run test:browser`, because the driver writes a screenshot, which this step may not create.

I ran the typecheck, eslint on the changed files, and the unit tests. The typecheck is clean. eslint is clean. `vitest` over `src/model`, `src/state/walk` and `src/layering.test.ts` passes: 32 files, 471 tests.

Must fix:
none

Optional:
none

Nit:
none

R2-9 is FIXED. `src/model/stopsecondary.ts:10` now accepts `| null | undefined` for `walk`, so `walkById`'s `Walk | undefined` at `src/instruments/DocumentPanel.tsx:223` typechecks. That clears the card's "`npm run verify` passes" line for the build and typecheck step.

Everything the earlier rounds checked still holds in the current diff:
- **Marks:** the four notable marks are drawn as badges in the hover card and in "walks through here"; `outline`, `clear` and `judgment call` stay plain.
- **Secondary tags:** they are keyed to the active walk's cursor through `secondaryTagsAt`, so MTH 110 stops 3 and 4 show none and stop 5 shows its tag. The hover card shows them in an unclamped block.
- **Notice:** it is gated on `cs2023`, appears once in `TrailStrip`'s active-walk row and once in "walks through here", and is not in `WalkViewer`.
- **Deep stop:** the map pin, tree-open and document behaviour are unchanged. The Lens pane has its own cs2023 wording (including Science), and `visited` is widened for cs2023 by the tested `visitedIds` helper.
- **Scope:** `src/ds/**` and `design-system/` are untouched.
- **Driver:** the new driver covers all three routes and the no-notice check on `teaching` and `courses`.

Noticed outside this card's scope: nothing.

Assumptions: I read "step titles" as the app-owned titles in the hover card and "walks through here", not the DS `WalkStrip` titles. I did not re-check the card's "owner decides" points beyond what the earlier rounds recorded; the PR body is where those readings get stated.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-9","answer":"Fixed","because":"src/model/stopsecondary.ts:10 now types \u0060walk\u0060 as \u0060\u2026 | null | undefined\u0060, so DocumentPanel.tsx:223 passing walkById\u0027s \u0060Walk | undefined\u0060 typechecks. I ran \u0060npx tsc -p tsconfig.app.json --noEmit --incremental false\u0060 with no errors. eslint on the changed files is clean, and vitest over src/model and src/state/walk plus the layering test passes (471 tests).","duplicateOf":null}]}
-->
