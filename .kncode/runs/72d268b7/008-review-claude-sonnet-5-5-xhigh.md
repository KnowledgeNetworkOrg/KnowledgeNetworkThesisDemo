The change implements every requirement and every "Done when" line in the card. I read the code and traced each test by hand, but I did not run `npm run verify` or the tests, because this step may not create files. The previous step reported that the `authordraft.unsaved.test.ts` run passed (10 tests).

- **Version 1 is enough.** The `unsaved` field is optional on `DraftSnapshot`. `parseDraftData` accepts only a stored `true`, and `saveDraft` writes it only when true. The envelope stays at version 1, so a payload from an older build reads as saved.
- **`persist` writes the right bit.** `persist` computes the bit from the live stores and the latch with `draftUnsaved()` and never reads `dirtyStore`. Its subscriptions still sit before `refreshDirty`'s.
- **`markSaved` writes the cleared bit.** It clears the latch, resets the baselines, refreshes the dirty store and calls `persist()` itself. `saveDraftAsWalk` and `forgetDraftUnsaved` both go through it, and no other path clears the latch.
- **The latch.** `restoredUnsaved` is seeded from `restored?.unsaved === true`. The unsaved check is `(latch || differs from baseline) && draftWalkStops().length > 0`, which keeps the #479 A-5 guard.
- **Tests.** Five card tests are in `authordraft.unsaved.test.ts`: reload keeps the edit unsaved, edit-reload-edit-undo stays unsaved, save and `forgetDraftUnsaved` then reload both read as saved, and deleting every stop from a restored unsaved draft reads as saved. The legacy-payload case is the strengthened "a restored draft starts clean" test, which now also checks the stop count and id. `draftpersist.test.ts` adds a parse test (only a stored `true` counts) and a write-only-when-true test. The existing round-trip `loadDraft` test still holds.
- **Scope.** Only the four files the card lists changed. None is in `.kncode/locked-files`.

Of the three open findings, R0-1 is fixed: the "Unsaved work" comment at `authordraft.ts:164-171` now describes the persisted bit and the latch. R0-2 and R0-3 stay open as nits.

Must fix:
none

Optional:
none

Nit:
1. R0-2 — `src/state/walk/authordraft.unsaved.test.ts:104` — The reload test asserts only `stops.length > 1`. An exact length, or a check that the inserted node is present, would show the edited tree itself was restored.
2. R0-3 — `src/state/walk/draftpersist.ts:40` — The `DraftSnapshot` doc comment does not mention the `unsaved` bit. It is described only on its own field.

Assumptions: I took hand-tracing plus the previous step's reported run as enough for the tests, since I cannot run commands here. I read the extra storage write that `markSaved` makes on an unedited seed as intended, because the card asks for an explicit write there.

<!-- kncode-findings
{"reports":[{"id":"R0-2","raisedAgain":true,"bucket":"Nit","what":"The reload test still asserts only \u0060stops.length \u003E 1\u0060 after the insert. An exact length or a check that the inserted node is present would show the edited tree itself was restored.","file":"src/state/walk/authordraft.unsaved.test.ts","line":104,"breaks":"Test strength only. The card\u0027s \u0022still unsaved after reload\u0022 line is met by the next assertion.","failure":null},{"id":"R0-3","raisedAgain":true,"bucket":"Nit","what":"The \u0060DraftSnapshot\u0060 doc comment (\u0022what survives a reload. The stops tree, plus the road\u0027s VIEW of it\u2026\u0022) still does not mention the \u0060unsaved\u0060 bit. It is described only on its own field.","file":"src/state/walk/draftpersist.ts","line":40,"breaks":"Wording only.","failure":null}],"answers":[{"id":"R0-1","answer":"Fixed","because":"authordraft.ts:164-171 now says unsaved also means \u0022restored from a draft stored while unsaved\u0022, and lines 175-177 explain the latch. The comment matches the code.","duplicateOf":null}]}
-->
