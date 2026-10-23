The change implements every requirement and every "Done when" test in the card. I read the code and traced each new test by hand but did not run `npm run verify` or the tests, because this step may not create files. I found no Must fix, so the verdict is MINOR.

**What I checked against the card**
- **Version 1:** `unsaved` is an optional field on `DraftSnapshot`. `parseDraftData` accepts only a stored `true`, and `saveDraft` writes it only when true. The envelope stays at version 1, so there is no version bump.
- **Trap 1:** `persist` calls `draftUnsaved()` on the live stores and the latch, and never reads `dirtyStore`. Its subscriptions still sit before `refreshDirty`'s.
- **Trap 2:** `markSaved` clears the latch, resets the baselines, refreshes the dirty store, and calls `persist()` itself. `saveDraftAsWalk` and `forgetDraftUnsaved` both go through it.
- **Latch:** `restoredUnsaved` starts from `restored?.unsaved === true` and only `markSaved` clears it. `draftUnsaved()` is `(latch || differs from baseline) && draftWalkStops().length > 0`, which keeps the #479 A-5 guard.
- **Scope:** only the four files the card lists changed.

**Card tests**
- **Edit, reload:** the draft is still unsaved after a reload. It fails if `persist` stored a stale bit.
- **Edit, reload, edit, undo:** the draft is still unsaved. It fails without the latch, because undo would return to the restored baseline.
- **Save as a walk or `forgetDraftUnsaved`, then reload:** the draft is not unsaved. It fails if `markSaved` did not write the cleared bit.
- **Restore an unsaved draft, delete all its stops:** the draft is not unsaved.
- **Legacy payload:** the existing "a restored draft starts clean" test now also checks the stop id and count. The existing `loadDraft` round-trip test still holds, since `toEqual` ignores undefined properties.
- **`draftpersist.test.ts`:** there are new tests for parsing `unsaved` (only `true` counts) and for writing it only when true.

Must fix:
none

Optional:
1. `src/state/walk/authordraft.ts:164-170` — The "Unsaved work" comment still says unsaved means "edited since the baseline the app opened on (a restore or the seed)". That is no longer true: a restored draft stored with `unsaved: true` stays unsaved whatever the baseline says. The new lines at 174-175 explain the latch, but the section header describes the old behaviour.

Nit:
1. `src/state/walk/authordraft.unsaved.test.ts:104` — The reload test only checks `draft.stops.length > 1`. An exact length (the seed's 6 plus 1) or a check that the inserted node is present would show the edited tree itself was restored.
2. `src/state/walk/draftpersist.ts:40` — The `DraftSnapshot` doc comment ("what survives a reload. The stops tree, plus the road's VIEW of it") doesn't mention the `unsaved` bit, which is described only on its own field.

Assumptions: I took "hand-traced, not run" as sufficient for the tests, since I can't create files. Running `npm run verify` (the card's check) remains the real confirmation. I also read the extra storage write from `markSaved` on an unedited seed as intended, since the card asks for an explicit write there.

<!-- kncode-findings
{"reports":[{"id":"R0-1","raisedAgain":false,"bucket":"Optional","what":"The \u0022Unsaved work\u0022 comment block (authordraft.ts lines 164-170) was left as it was and now says the opposite of what the code does. It reads \u0022\u0027unsaved\u0027 here means edited since the baseline the app opened on (a restore or the seed)\u0022. A restore of a draft stored with \u0060unsaved: true\u0060 now stays unsaved, because \u0060restoredUnsaved\u0060 overrides the baseline. The comment says nothing of the persisted bit or the latch, so a reader is told the restore baseline decides everything.","file":"src/state/walk/authordraft.ts","line":164,"breaks":"Documentation accuracy only. No card line is broken and the behaviour is right. The lines at 174-175 explain the latch, but the section header still describes the pre-#482 semantics.","failure":null},{"id":"R0-2","raisedAgain":false,"bucket":"Nit","what":"The reload test asserts only \u0060draft.stops.length \u003E 1\u0060 after the insert, which is weak. An exact length (seed 6 \u002B 1) or a check that the inserted node is present would pin that the edited tree itself was restored, not just that something was.","file":"src/state/walk/authordraft.unsaved.test.ts","line":104,"breaks":"Test strength only. The card\u0027s \u0022edit the draft, reload the modules from storage, and the draft is still unsaved\u0022 is met by the \u0060useDraftUnsaved\u0060 assertion on the next line.","failure":null},{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"The \u0060DraftSnapshot\u0060 doc comment still says \u0022what survives a reload. The stops tree, plus the road\u0027s VIEW of it\u0022. The new \u0060unsaved\u0060 bit is described only on its own field, so the interface comment does not mention it.","file":"src/state/walk/draftpersist.ts","line":40,"breaks":"Wording only. No behaviour is affected.","failure":null}],"answers":[]}
-->
