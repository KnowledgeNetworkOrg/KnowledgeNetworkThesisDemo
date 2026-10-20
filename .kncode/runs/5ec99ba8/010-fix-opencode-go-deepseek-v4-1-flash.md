1. **Must fix 1**: not fixed: the driver was run red (4 FAIL lines) and green (13 PASS lines), but `npm run verify` was not run — this step allows only the narrowest check and forbids the whole-repo suite; the check step runs it afterwards. `tools/studio-spike/browsertest-presenterclicker.mjs`.
2. **Must fix 2**: fixed (already in the tree from the prior round): both step branches are gated on `!ended`, so on the recap the keys fall through to the browser; `src/present/PresenterScreen.tsx:206-207`, and the driver's recap check passed (`PageDown scrolls the recap list once the lecture has ended`, `scrollTop 1`).

Person's asks:
- Red run by reverting and restoring: fixed, reverted only the step-key lines (206-207) and restored afterwards.
- Record the FAIL lines: fixed:
```text
FAIL  PageDown advances the record   stop 2 → 2
FAIL  and the deck does not scroll under it   deck scrollTop 1
FAIL  PageUp returns the record to the stop it left   stop 2 → 2
FAIL  ArrowDown advances the record   stop 2 → 2
4 failure(s)
```
- Restore the fix exactly, same as before: fixed, `PresenterScreen.tsx` SHA-256 is `C91744E842C9E4EEE743A48A5B81B608FDA7E635E6B24919672560D645283053` before the revert and after the restore.
- Green run and PASS lines: fixed:
```text
PASS  PageDown advances the record   stop 2 → 3
PASS  and the deck does not scroll under it   deck scrollTop 0
PASS  PageUp returns the record to the stop it left   stop 3 → 2
PASS  and the deck stays at the bottom where PageUp found it   deck scrollTop 244 of 244
PASS  ArrowDown advances the record   stop 2 → 3
PASS  ArrowUp returns the record   stop 3 → 2
PASS  PageDown scrolls the recap list once the lecture has ended   scrollTop 1
13 checks passed
```
- Confirm with `git diff` that the file is unchanged: not fixed: this step forbids git; the byte-identical hash above stands in for it.
- Put both outputs in the commit message: not fixed: this step forbids git and commits; both outputs are quoted above for the commit.
- Run `npm run verify`: not fixed: this step explicitly forbids the whole-repo suite even where the card or plan lists it; the check step runs build, lint and tests next.

Assumptions: `node_modules` was already installed in this workspace, so no `npm ci` was needed; the driver ran against Edge as written. The revert for the red run removed only the new step keys and left the rest of the handler intact, matching pre-#434 arrow-only behaviour.

FLAG: conflict: Must fix 1 and the person ask for `npm run verify`, but this step permits only the narrowest check and forbids the whole-repo suite — should verify be left to the check step, or run here?