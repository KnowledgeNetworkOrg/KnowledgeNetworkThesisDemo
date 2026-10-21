- R0-4: fixed — `adherence.test.ts:354` budget raised to 103 with the dated note.
- R0-1: fixed — `authordraft.ts:202` now returns `'The walk draft'`.
- R0-2: fixed — added tests for dirty/undo/save/restore (`authordraft.unsaved.test.ts`), toolbar Load enablement (`apptoolbar.test.ts`), and both pick branches (`loadpick.test.ts`, via the extracted `loadpick.ts`).
- R0-3: fixed — `LoadDialog.tsx` refocuses the card when the warning clears; noted in `PROVENANCE.json`.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"authordraft.ts:202 now returns \u0027The walk draft\u0027, so UnsavedWarning\u0027s title starts with a capital.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"Added src/state/walk/authordraft.unsaved.test.ts (edit dirties, undo to baseline cleans, saveDraftAsWalk cleans, restored draft clean), src/studio/apptoolbar.test.ts (Load enabled only with \u0060load\u0060), and src/studio/loadpick.test.ts (map-only vs walk pick). Extracted the pick branch to src/studio/loadpick.ts so it is testable; StudioView calls it.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"LoadDialog.tsx now refocuses cardRef when \u0060pending\u0060 returns to null, restoring Escape and the Tab trap after the warning\u0027s Cancel; recorded as a local deviation in PROVENANCE.json.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"adherence.test.ts BUDGET raised from 84 to 103 with the dated \u0022\u002B19, bare in the DS\u0027s own .d.ts\u0022 note; the narrow run of that test passes.","duplicateOf":null}]}
-->
