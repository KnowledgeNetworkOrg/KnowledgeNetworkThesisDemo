REVISE

**In short:** the measuring script is now well built, but it has still never run, so the card's question (can oxlint replace ESLint here?) has no answer yet. More edit-only rounds can't change that. Someone or something has to install the packages and run the script once.

Background: oxlint is a fast Rust-based linter (a tool that checks code for mistakes). The card asks whether it can fully replace ESLint, the linter this project uses now. The fixing step dealt with the last review's main structural complaint. The script now runs ESLint over the real code too, and compares the two tools rule by rule, file by file, and comment by comment. What's still missing is the run that would produce an answer.

**What I checked by reading:**
- **Comment count:** there are 34 "switch this rule off here" comments in 24 files, 20 for the hook-dependency rule and 14 for the state-in-effect rule. That matches what the findings file says.
- **Comment parsing:** the script's comment reader handles every form these comments take, including the comments that span several lines and the off/on pairs.
- **Planted mistakes:** each deliberately broken sample would trigger the ESLint rule it is meant to test.
- **Tests:** no existing test looks inside the new folder, so `npm test` is unaffected.
- **Parsing:** `node --check` on the script passes.

I did not install anything or run the script, because this step may not create files.

Must fix:
1. **The card is still unanswered.** The results section of the findings file (`tools/oxlint-spike/RESULTS.md:59-63`) still reads "_Not measured yet._", and line 122 says the script "has not yet been run end to end". These card lines therefore remain unmet:
   - "Install oxlint, run it over `src/`, and diff its findings against `eslint .`"
   - "Confirm nothing we rely on goes dark — specifically that `exhaustive-deps` and `react-refresh` equivalents are present and firing"
   - "close as 'keep ESLint,' record the gap here"

   Three things the script depends on have never been exercised:
   - oxlint's output format, including whether each finding carries line numbers.
   - the layout of oxlint's rule list.
   - where `@oxlint/migrate` (oxlint's tool for translating an ESLint config) writes its output.

   If any of these differs from what the script expects, the first run fails or gives misleading numbers. The fix needs `npm ci`, then `node tools/oxlint-spike/parity.mjs --write`, then repairing whatever the first run exposes, then committing the filled-in results. (again)

The previous review's second finding (no comparison on the real code) is fixed in the script's design: the new real-code comparison is at `parity.mjs:610-635` and the per-comment check is at `parity.mjs:443-466`. Since it has never run, it falls under finding 1 above, so I've dropped it as a separate point.

Optional:
1. **The verdict counts two things as gaps that aren't "going dark".** The card's test is "nothing we rely on goes dark". But the verdict also returns "keep ESLint" in two other cases:
   - oxlint reports extra findings that ESLint doesn't (`parity.mjs:669`).
   - oxlint's rule fires in the same file but on a different line from the one the comment covers. Line 462 counts this as lost, and line 668 lists it as a gap.

   Both are switching costs, not missing safety nets, and the findings file itself says the second one is "a different problem from a rule that is missing" (`RESULTS.md:92`). There's a likely real-world effect too. If `@oxlint/migrate` leaves oxlint's default rule group switched on, the extra findings would come from rules ESLint never had. The recorded "gap" would then mix real gaps with noise. I'd list those two under a separate "costs" line so the gap record stays clean. This won't change the likely verdict: oxlint has no equivalent of the custom pattern bans.
2. **A fourth copy of the old wording is still there.** `src/ds/PROVENANCE.json:68` still says "oxlint was declined (#65)", while the three edited files now describe #65 neutrally. If the measured verdict is "keep ESLint", that old sentence becomes correct. Once the run lands, all four places should state the measured answer the same way. (raised before as optional)
3. **The script's opening comment mislabels its sections.** It says "two kinds of measurement" and then lists three (`parity.mjs:6`). It also calls the real-code comparison "C" (`parity.mjs:19`, `:610`), while the report and the findings file call it "D" (`parity.mjs:715`). Anyone reading the code next to the results will look in the wrong section.

Assumptions: I counted the four changed files as in scope because the approved plan lists them; nothing else changed. I treated "record the gap here" as satisfied by the findings file plus the pull request description once the run exists, as the plan proposed, since an agent can't close the issue. I did not run `npm ci` or the script, because both create files and this step forbids that, so every judgement about runtime behaviour is from reading the code.

FLAG: unverifiable: Every step in this loop is limited to editing files. Will the next step be allowed to run `npm ci` and `node tools/oxlint-spike/parity.mjs --write` (which downloads oxlint from npm), or will you run it yourself and commit the results?