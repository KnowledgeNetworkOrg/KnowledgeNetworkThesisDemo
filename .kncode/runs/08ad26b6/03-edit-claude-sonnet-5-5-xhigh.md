I did not measure whether oxlint can replace ESLint, so the card is not decided yet. This step only let me edit files, and the measurement needs dependencies installed and oxlint downloaded. What I built is one command that does the measurement and writes the answer down.

**What I added**
- **The test script** (`tools/oxlint-spike/parity.mjs`). It writes one deliberately broken file for each kind of rule the repo depends on into a temporary folder outside the repo, so the normal lint never sees them. It then runs ESLint with the repo's real config, and oxlint with every built-in rule switched on. The kinds are:
  - a missing hook dependency
  - a hook called conditionally
  - a state setter called inside an effect
  - a ref read during render
  - a value mutated in place
  - a component file with a stray extra export
  - the platform-name ban
  - the raw colour and pixel bans
  - three of the standard rules
- **What it prints.** A table of which tool caught which violation, plus two more checks. It compares ESLint's active rule names against oxlint's rule list. It also runs oxlint over the real code to see whether any of the 34 "ignore this lint rule here" comments get reported as unused, which would mean oxlint isn't flagging that line.
- **How it decides.** It counts only oxlint's own rules, because the card says to drop the ESLint packages if oxlint wins. If ESLint itself misses a planted violation, it reports the test as invalid instead of blaming oxlint. It installs oxlint into a temporary folder and never touches `package.json`.
- **The findings file** (`tools/oxlint-spike/RESULTS.md`). It records what the repo's linting actually depends on, which is more than the card's two named rules. It states the pass bar and how to re-run, and says what to do under each outcome. Its "Measured" section currently says "Not measured yet." Running the script with `--write` fills it in with the verdict on the first line.
- **Three stale sentences.** The comment in `eslint.config.js`, `src/tokens/README.md` and `design-handoff/PROTOCOL.md` claimed oxlint was "declined in #65" or "wired in #61". Neither is true: #65 is this open question, and no oxlint config exists in the repo. Each now says what actually happened and points at the findings file.

**What I checked.** The script parses without errors, and no existing test objects to the new files. I did not run the script, so none of the table's cells has been seen. My expectation that oxlint will lack the React-compiler rules and the custom pattern bans, so the answer is "keep ESLint", is still only a guess.

**What's next.** Run `npm ci`, then `node tools/oxlint-spike/parity.mjs --write`. The script is untested and may need small fixes on its first run, mainly oxlint's output format and flag names. If it says parity holds, the card's step 3 (replace the ESLint setup) is still to do. If it says keep ESLint, the written file is the record, and the card can be closed.

Assumptions: I counted 34 "ignore this lint rule here" comments in 24 files (20 for the hook-dependency rule, 14 for state-in-effect) rather than the plan's 42, because that is what I measured. I set the bar as the card's two named rules plus the compiler rules and the custom bans, since the code relies on them. I left oxlint's version unpinned (`latest`, recorded in each run, with `OXLINT_VERSION` to pin) because I couldn't confirm a specific version exists. I put "record the gap" in the findings file, since I can't comment on or close the issue.