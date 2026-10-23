**Must fix:**
none

**Optional:**
none

**Nit:**
1. R0-2 — `src/state/walk/authordraft.unsaved.test.ts:104`: the reload test only asserts `stops.length > 1`; an exact length or the appended node would pin that the edited tree itself was restored.
2. R0-3 — `src/state/walk/draftpersist.ts:40`: the `DraftSnapshot` header comment still presents the payload as only "the stops tree, plus the road's VIEW", omitting the new `unsaved` bit.

R0-1 is verified fixed: the "Unsaved work" header at `src/state/walk/authordraft.ts:164-171` now states that a draft restored while marked unsaved also counts, matching `restoredUnsaved`.

Checks run: `npx tsc -b`, `npx eslint` on the four changed files, and the full `npm test` (950 tests, 67 files) all pass. The version stays at 1, `saveDraft` omits the field unless `true`, `persist` computes the bit from the stores (not `dirtyStore`), and `markSaved` clears the latch and writes explicitly.

Assumptions: R0-2 and R0-3 were re-raised as still-open nits since the code at those lines is unchanged.

<!-- kncode-findings
{"reports":[{"id":"R0-2","raisedAgain":true,"bucket":"Nit","what":"The reload test still asserts only \u0060probe(reloaded).draft.stops.length \u003E 1\u0060, so it does not pin that the edited tree itself came back rather than just some non-empty tree. An exact length (seed \u002B 1) or the presence of the appended node would be stronger.","file":"src/state/walk/authordraft.unsaved.test.ts","line":104,"breaks":"Test strength only. The card\u0027s \u0022the draft is still unsaved\u0022 is asserted on the next line, so no requirement is unmet.","failure":null},{"id":"R0-3","raisedAgain":true,"bucket":"Nit","what":"The \u0060DraftSnapshot\u0060 interface doc comment still describes the payload as \u0022the stops tree, plus the road\u0027s VIEW of it\u0022 and does not mention the new \u0060unsaved\u0060 bit; only the field\u0027s own doc comment covers it.","file":"src/state/walk/draftpersist.ts","line":40,"breaks":"Wording only; no behaviour is affected.","failure":null}],"answers":[]}
-->
