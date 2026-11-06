Verdict: REVISE. The R0-5 fix breaks the typecheck, so `npm run verify` fails. All five round-0 findings are now resolved in the code, and I found one new Must fix and one new Optional.

**What I ran** (nothing written):
- `npx vitest run src/corpus/cs2023corpus.test.ts` passed (16 tests).
- `npx vitest run src/layering.test.ts src/state` passed (161 tests).
- `eslint` on the changed files was clean.
- `npx tsc --noEmit -p tsconfig.app.json` failed (see Must fix).
- I did not re-run the browser driver, because it writes screenshots under `tools/studio-spike/out/`. I read it and checked its draft key and v1 envelope against `draftpersist.ts`.

**Must fix:**
1. `src/corpus/cs2023corpus.test.ts:13` imports `readFileSync` from `'node:fs'` (added for the R0-5 fix). `tsconfig.app.json` has `types: ["vite/client"]` and does not exclude this file, so `tsc` reports `error TS2307: Cannot find module 'node:fs'`. `npm run build` runs `tsc -b`, so `npm run verify` fails, which breaks the card's "`npm run verify` passes". The tests pass under vitest, which is why only the typecheck shows it.
   - Fix: read the pinned JSON without Node types, with `import pinned from '../../tools/cs2023import/cs2023_map.json'` (`resolveJsonModule` is on).
   - `tsconfig*.json` is locked and the card doesn't name it, so adding the test to the exclude list isn't open to this run.

**Optional:**
1. `src/instruments/DocumentPanel.tsx:213` gives Science the kind `area`, a value outside DocHeader's documented set (topic/container/leaf). The other 17 areas still read CONTAINER, and the map hover card (`src/instruments/map/MapTooltipCard.tsx:44`) still prints `leaf` for Science. That puts three labels on one level. Use one label for every top-level area, or flag it with "how Science is drawn" for the owner or #504.

**Nit:** none.

**Round-0 findings:**

| Id | Result | Where |
|---|---|---|
| R0-1 | FIXED | `generate.mjs:61-62` requires exactly one Science exception and throws if any node has it as a parent |
| R0-2 | FIXED | The README names `persistguard.ts`, `draftpersist.ts` and `walkstore.ts`; the driver stores a CPS 109 draft, reloads and re-checks all 12 stops |
| R0-3 | FIXED | `DocumentPanel.tsx:213` (the new label inconsistency is the Optional above) |
| R0-4 | FIXED | `walkstore.ts:3-5` and `draftpersist.ts:12,66` now say "place" |
| R0-5 | FIXED | The per-route count comparison can now fail; its `node:fs` import is the new Must fix |

**Noticed outside this card's scope:** nothing new. The round-0 notes still stand: the overlapping Walk Editor boxes for long deep-stop titles belong to #504, and the Science hexagon sits close to the MSF label.

Assumptions: the owner's decision that the desk opens on all 12 CPS 109 stops governs over the stale done-when phrase "with no non-unit stop". I did not review Science's hue and hexagon as design choices, since the card leaves them to the owner in the PR.

<!-- kncode-findings
{"reports":[{"id":"R1-6","raisedAgain":false,"bucket":"MustFix","what":"The test imports \u0060readFileSync\u0060 from \u0027node:fs\u0027 (line 13) to read the pinned map JSON. tsconfig.app.json has \u0060types: [\u0022vite/client\u0022]\u0060 and does not exclude this file, so \u0060tsc\u0060 fails with TS2307 \u0022Cannot find module \u0027node:fs\u0027\u0022. \u0060npm run build\u0060 runs \u0060tsc -b\u0060, so \u0060npm run verify\u0060 fails too. Read the JSON without node types: \u0060import pinned from \u0027../../tools/cs2023import/cs2023_map.json\u0027\u0060 (\u0060resolveJsonModule\u0060 is on). tsconfig*.json is locked and the card does not name it, so the exclude list cannot be edited to get around this.","file":"src/corpus/cs2023corpus.test.ts","line":13,"breaks":"Card done-when: \u0022\u0060npm run verify\u0060 passes\u0022. Running \u0060npx tsc --noEmit -p tsconfig.app.json\u0060 gives src/corpus/cs2023corpus.test.ts(13,30): error TS2307.","failure":null},{"id":"R1-7","raisedAgain":false,"bucket":"Optional","what":"The R0-3 fix makes Science\u0027s document header read AREA, a value outside DocHeader\u0027s documented set (topic/container/leaf). The other 17 areas still read CONTAINER, so the same level carries two labels. MapTooltipCard.tsx:44 still prints \u0060leaf\u0060 for Science on hover (it shows \u0060kind\u0060 for non-topics). Pick one label for every top-level area, or flag it as part of \u0022how Science is drawn\u0022 for the owner or #504.","file":"src/instruments/DocumentPanel.tsx","line":213,"breaks":"Card \u0022Owner looks: how Science is drawn\u0022: Science shows as AREA in the pane, \u0060leaf\u0060 in the tooltip, and its sibling areas show CONTAINER.","failure":null}],"answers":[{"id":"R0-1","answer":"Fixed","because":"tools/cs2023import/generate.mjs:61-62 now throws unless there is exactly one \u0060exception\u0060 area and throws if any tree node has it as a parent, so Science\u0027s \u0022holds no unit\u0022 text and the hexagon path are guarded.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"README.md (lines ~94-95) names persistguard.ts, draftpersist.ts and walkstore.ts; browsertest-cs2023corpus.mjs step 6 (lines 178-197) stores a CPS 109 draft under pkt.walkdesk.draft, reloads, reopens the desk and compares all 12 stops. The key and v1 envelope match draftpersist.ts (KEY, VERSION).","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"DocumentPanel.tsx:212-213 gives a childless top-level node the kind \u0060area\u0060, so Science\u0027s header no longer reads LEAF. The new label is inconsistent with the other 17 areas (CONTAINER); I raise that separately as a new Optional.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"walkstore.ts:3-5 now says \u0022a real place \u2014 a topic, or on cs2023 any existing node\u0022, and draftpersist.ts:12 and :66-67 say \u0022a place that still exists\u0022.","duplicateOf":null},{"id":"R0-5","answer":"Fixed","because":"cs2023corpus.test.ts:121 now compares each repeated route\u0027s stop count with the pinned JSON\u0027s, so it can fail. The way it reads the JSON (node:fs) breaks the typecheck; that is a new problem, reported as a new Must fix.","duplicateOf":null}]}
-->
