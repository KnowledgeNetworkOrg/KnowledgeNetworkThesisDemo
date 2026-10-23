1. R0-1 fixed: updated the "Unsaved work" comment at `src/state/walk/authordraft.ts:164` to include the restored-unsaved bit and latch. No Must fix findings. R0-2 and R0-3 left alone as nits.
2. Narrow test run: `npx vitest run src/state/walk/authordraft.unsaved.test.ts` (10 passed).

Assumptions: left the two nit findings untouched, since the step allows leaving nits alone.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"Rewrote the \u0022Unsaved work\u0022 header comment at src/state/walk/authordraft.ts:164-171 so it now says a draft restored from storage while marked unsaved also counts, matching the restoredUnsaved latch rather than claiming the restore baseline decides everything.","duplicateOf":null}]}
-->
