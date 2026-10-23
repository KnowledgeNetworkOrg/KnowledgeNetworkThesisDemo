1. R0-3 fixed — trail-count check removed from `tools/studio-spike/browsertest-walkvisibility.mjs`; the pin-set check is the #481 driver proof.
   R0-4 fixed — `browsertest-walkvisibility.mjs:162` reads `${data-step}-${data-step-end}`, level-independent.
   R0-5 fixed — `src/state/walk/presented.ts:65-68` now limits quiet-after-clear to the editor and states the viewer republishes once `activeWalk` is null.
   R0-6 fixed — `src/state/walk/presented.test.ts:39-43` replaces the duplicate clear test with `publishableRoad(road, null, null)` returning the road.
   No "Must fix" findings.
2. Remove trail-count check — fixed.
   Read `data-step` with `data-step-end` — fixed at `browsertest-walkvisibility.mjs:162`.
   Docblock says editor-only quiet after clear — fixed at `presented.ts:65-68`.
   Replace duplicate "after a clear" test with first publish — fixed at `presented.test.ts:39-43`.
   Restore the em dash — fixed at `presented.ts:77`.
   Delete dead steps at old lines 184–188 — fixed; that block went with the trail check.
   Nit R0-7's comment and shadowing — fixed at `presented.ts:43,49`.
3. (no flag)

Noticed outside this card's scope: `src/state/walk/authordraft.ts:208` still says the editor publishes on every change; #482 owns that file, so I left it.

Assumptions: the pin run is serialized as `step-end` (for example `1-6` versus `1-1`), which keeps the comparison independent of camera level and pin merging.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-3","answer":"Fixed","because":"Removed the trail-count check from tools/studio-spike/browsertest-walkvisibility.mjs; the pin-set check is now the #481 driver check (lines 158-171).","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"tools/studio-spike/browsertest-walkvisibility.mjs:162 now reads \u0060data-step\u0060 together with \u0060data-step-end\u0060 as \u0060${step}-${stepEnd}\u0060, so a merged pin reads \u00221-6\u0022 vs the walk\u0027s \u00221-1\u0022.","duplicateOf":null},{"id":"R0-5","answer":"Fixed","because":"src/state/walk/presented.ts:65-68 now says the quiet-after-clear rule is the editor only, and the unchanged viewer republishes the draft once activeWalk becomes null after any clear.","duplicateOf":null},{"id":"R0-6","answer":"Fixed","because":"src/state/walk/presented.test.ts:39-43 replaces the duplicate \u0022after a clear\u0022 test with the first-publish case, \u0060publishableRoad(road, null, null)\u0060 returning the road.","duplicateOf":null},{"id":"R0-7","answer":"Fixed","because":"src/state/walk/presented.ts:77 restores the em dash, line 49 comments the module-level \u0060lastPublished\u0060, and the pure function\u0027s parameter is now \u0060lastSent\u0060 (line 43) so it no longer shadows it.","duplicateOf":null},{"id":"R0-8","answer":"Fixed","because":"Removing the trail-count block also removed the dead Trail/Plan/Trail steps (old lines 184-188) and its duplicate \u0060trail\u0060 locator; tools/studio-spike/browsertest-walkvisibility.mjs ends the #481 section after the pin check.","duplicateOf":null}]}
-->
