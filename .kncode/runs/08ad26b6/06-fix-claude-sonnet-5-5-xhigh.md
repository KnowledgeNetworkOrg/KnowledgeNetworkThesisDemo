1. **Not fixed:** the card still has no answer. The only way to answer it is to run the script, which needs `npm ci` and a download of oxlint. This step allows file edits only, so I couldn't run it. Finding 1 also asks for a commit of the filled-in results. The results block still says "_Not measured yet._", and the findings file now says the script has not been run end to end. I did fix the false claim in `eslint.config.js` that the question was "measured in" the findings file. It now says the script is the re-runnable check and the findings file holds what it last measured.

2. **Fixed:**
   - **ESLint on the real code:** the script now runs ESLint over the real tree twice, plain and with `--no-inline-config`. It records ESLint's own errors, warnings and unused-comment warnings, and its findings per rule and per file.
   - **A comparable oxlint setup:** it installs `@oxlint/migrate` in a temp folder and uses it to translate `eslint.config.js` for oxlint. It strips any ESLint plugins and drops rules oxlint doesn't know, and records both lists. It then runs oxlint over two temp copies of the repo's lintable files: one as is, and one with every `eslint-disable` rewritten so there is nothing to obey.
   - **Per-comment check:** for each of the 34 disable comments, the script checks whether ESLint itself fires on the covered lines. If it doesn't, the comment is labelled stale and left out of the verdict. Otherwise oxlint is scored as fires on that line, fires elsewhere in the file, or silent. This also covers the reviewer's optional point about the `react-hooks/` prefix.
   - **Verdict logic:** it now includes the per-rule and per-file comparison and the migrated config's gaps. The same-name rule-inventory check from before is kept.
   - **Dropped:** the unused-comment report from oxlint's own flag, which was the shaky evidence.
   - **Findings file:** it now lists the full bar for parity and describes each section of the report.
   - **Optional miscount:** I also fixed it. The old "Three further conditions" line listed two, and the bar now lists five.

   The check I ran was `node --check` on the script, which passed. That proves it parses. It does not prove oxlint's flags, its output format or the migrate tool's behaviour, since none of that has run.

FLAG: unverifiable: Can the next step run `npm ci` and then `node tools/oxlint-spike/parity.mjs --write`, so the card gets a measured verdict and the script's first run can be debugged?

Noticed outside this card's scope: `src/ds/PROVENANCE.json` (line 68) still says "oxlint was declined (#65)". Once the run produces a verdict, that sentence and the doc sentences that describe #65 as open should state the answer.

Assumptions: I read the reviewer's "needs a run" as a limit of this step, so I changed the script instead of the verdict. I put the parity bar's two extra conditions (migrated config carries every rule, oxlint finds nothing ESLint doesn't) in the script, because the reviewer asked for a comparison under "a matching setup". I treated a stale comment as out of the verdict, but a lost one counts against oxlint.