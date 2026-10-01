REVISE

Must fix:
1. **The card's question still has no answer.** The card asks for a decision based on evidence: run oxlint, compare it with ESLint, and either switch linters or close with "keep ESLint" and record what oxlint can't do. This change adds a tool that would do that measurement, but it has never been run. The results block in the findings file (`tools/oxlint-spike/RESULTS.md:46-49`) still says "_Not measured yet._" So none of these card lines is met:
   - "Install oxlint, run it over `src/`, and diff its findings"
   - "Confirm nothing we rely on goes dark — specifically that `exhaustive-deps` and `react-refresh` equivalents are present and firing"
   - "record the gap here"

   The edited comment at `eslint.config.js:84-85` also says the question was "measured in tools/oxlint-spike/RESULTS.md", which is not true yet. The script is also untested: its handling of oxlint's output format and flag names has never been exercised. The fix is to run `npm ci`, then `node tools/oxlint-spike/parity.mjs --write`, fix whatever breaks on that first run, and commit the filled-in results.

2. **The comparison on the real code that the card asks for isn't built.** Card line: "diff its findings against `eslint .` on the same tree." The script never runs ESLint on the real code at all. ESLint only runs on the temporary deliberately-broken files (`parity.mjs:300`). The oxlint run over the real code (`parity.mjs:348-375`) throws away every finding except "this ignore-comment is unused". That has two effects:
   - **Nothing is compared rule by rule or file by file**, which the plan's step 3 promised. There's no ESLint baseline (plan step 1). The `@oxlint/migrate` translation (plan step 2) is never used, and that translation is what would give oxlint a setup comparable to ESLint's. With every oxlint rule switched on, a real-code comparison would just be noise.
   - **The ignore-comment check rests on a claim nobody checked.** `RESULTS.md:25` says each of the 34 comments "sits on a line where an ESLint rule fires". ESLint 9 only *warns* about an unused ignore-comment, and `npm run lint` still passes with warnings. So a stale comment that ESLint also considers unused would be blamed on oxlint, and `parity.mjs:401` would turn that into a "KEEP ESLINT" verdict.

   The fix is to run `eslint . --format json` on the same folders and record its per-rule counts and its own unused-comment count. Then compare that with oxlint's per-rule counts under a matching setup.

Optional:
1. **An "unused" report from oxlint may mean a naming mismatch, not a missing rule.** oxlint may not recognise the `react-hooks/` prefix in a comment like `eslint-disable-next-line react-hooks/exhaustive-deps`. In that case its own hook-dependency rule would still fire on that line, the warning wouldn't be suppressed, and the comment would be called unused. The script (`parity.mjs:366-374`) and `RESULTS.md` would then record "the rule did not fire there", which is the wrong reason, and on exactly the rule the card cares most about. The script should check whether oxlint reported a matching warning on the suppressed line before drawing that conclusion. I haven't confirmed how oxlint handles the prefix; this is inference.
2. **A fourth copy of the stale sentence was missed.** The change corrected "oxlint was declined in #65" in three places, but `src/ds/PROVENANCE.json:68` still says "oxlint was declined (#65)". Also, all three rewritten sentences describe #65 as an open question. Once the run produces a verdict, they should state the answer, and if the answer is "keep ESLint", the old wording was nearly right.
3. **A miscount in the findings file.** `RESULTS.md:32` says "Three further conditions:" but lists two.

**What I checked.** I read the lint config, the new script and findings file, and the three doc edits. I recounted the ignore-comments and confirmed the file's figure of 34 comments in 24 files: 20 for the hook-dependency rule, 14 for state-in-effect. I checked that the deliberately broken samples match the repo's custom bans and their exact message text. I also confirmed the new script works out the repo's location from its own path, so the test that guards spike scripts won't object to it.

Assumptions: I did not run the script. Dependencies aren't installed in this worktree, and this step may not create files. Every judgement about how the script will behave is from reading it. I treated the card's step 1 (compare findings on the real code) as required even though the planted samples are the stronger evidence, because the card states it explicitly. I counted the doc corrections as in scope because the plan lists them.

FLAG: unverifiable: The implementing step said it could only edit files, not install packages or download oxlint. Can the next step run `npm ci` and `node tools/oxlint-spike/parity.mjs --write`? Without that run the card cannot be answered.