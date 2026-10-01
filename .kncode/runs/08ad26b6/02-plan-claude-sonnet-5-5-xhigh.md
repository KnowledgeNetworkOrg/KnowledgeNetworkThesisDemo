I've finished reading and haven't changed anything. I read the lint setup, the 42 places where code switches a lint rule off, and the docs that mention oxlint.

**What I found.** The card describes the lint setup as "stock Vite template", but it has grown well past that. Four things in it are not covered by the card's acceptance checks:
- **Compiler rules:** the React-hooks plugin (version 7) brings a set of React-compiler rules. The code switches one of them, `set-state-in-effect`, off in about 15 places. A project skill note also depends on two others, `immutability` and `refs`.
- **Custom pattern bans:** custom bans written as code-pattern selectors do two jobs. They stop code branching on which platform is running (issue #211). They also forbid raw colours and pixel sizes in three files (issue #61).
- **Disable comments:** 42 `eslint-disable` comments sit in 24 files, about 25 of them for `exhaustive-deps`.
- **Stale docs:** the repo already says oxlint was "declined in #65" in `eslint.config.js` and `design-handoff/PROTOCOL.md`. A third place, `src/tokens/README.md`, wrongly says an oxlint config was "wired in #61".

My inference, not yet tested, is that oxlint covers `exhaustive-deps` and `react-refresh` but lacks the compiler rules and the pattern bans. If so, the answer is "keep ESLint", and the plan below produces the evidence for that. Dependencies aren't installed in this worktree, so the first step is `npm ci`.

1. Install dependencies, then record a baseline of `eslint .` findings per rule (it should be clean) and the unused-disable-comment count (should be 0).
2. Run oxlint, pinned to a version and not added to `package.json`. Use the `@oxlint/migrate` tool to translate `eslint.config.js`, since it lists the rules it can't translate.
3. Run oxlint over the same tree as ESLint (`src`, `tools`, `desktop`, root files) with unused-disable reporting on, then compare per-rule and per-file against step 1. A clean tree makes this diff almost empty on its own, so the next two steps carry the evidence.
4. Check the 42 disable comments. Each sits on a line where an ESLint rule fires. If oxlint reports one as unused, that rule is not firing in oxlint.
5. Plant one deliberate violation per rule family in a scratch copy outside the repo, and see which tool reports it. The families are:
   - missing hook dependency
   - hook called conditionally
   - a state setter called inside an effect
   - a ref read during render
   - a component file with a stray extra export
   - `platform.name === 'electron'`
   - raw hex or `10px` in `App.tsx`
   - recommended JS and TypeScript rules
6. Count it as parity only if every family fires with oxlint's own built-in rules. A mechanism that loads the ESLint plugins into oxlint would keep the ESLint packages, which the card's step 3 says to drop.
7. If parity fails (my expectation): leave `eslint.config.js` rules and dependencies alone. Record the version, the rule-by-rule table and the re-run recipe in a new findings file. Correct the stale sentences in `src/tokens/README.md` and in the `eslint.config.js` comment so they cite the evidence.
8. If parity holds (contingency): add `.oxlintrc.json` with the #211 and #61 rules re-expressed, delete `eslint.config.js`, and swap the ESLint packages for oxlint in `package.json`. Then regenerate the lockfile, change the `lint` script, and update the docs.
9. Run the full verify, then open a pull request. Under the repo's review rules, its description starts with my name in the form `<model>-<effort>` so a second agent can review it.

Files: `tools/oxlint-spike/RESULTS.md` (new), `tools/oxlint-spike/parity.mjs` (new; writes its planted violations to a temp folder so `npm run lint` never sees them), `eslint.config.js` (comment only), `src/tokens/README.md` (one sentence), `design-handoff/PROTOCOL.md` (optional pointer to the findings). Only if parity holds: `.oxlintrc.json`, `package.json`, `package-lock.json`, and `eslint.config.js` deleted.

Out of scope: the card says this does not block or belong to the design overhaul (#57), so nothing there changes. The card also lets ESLint be replaced, and its dependencies dropped, only if parity is proven. Otherwise the lint config and packages stay as they are. It states nothing else.

Verify: run `node tools/oxlint-spike/parity.mjs` and read its table, which has one row per rule family and a column for each tool saying whether it reported the planted violation. Every ESLint cell must say "fires", which proves the test is valid. Any "silent" in the oxlint column is a gap, and the verdict follows from it. Then confirm `npm run lint` still passes on the real tree.

```
npm ci
npm ci --prefix desktop
node tools/oxlint-spike/parity.mjs
npm run build
npm run lint
npm test
npm run verify
```

Assumptions:
- **Parity bar:** the card names only `exhaustive-deps` and `react-refresh`, but I'm also requiring the compiler rules and the pattern bans, since the code relies on them.
- **Native rules only:** I count only oxlint's own built-in rules, because the card's step 3 drops the ESLint packages.
- **Where "record the gap here" lands:** I can't comment on or close the issue, so it goes in the findings file and the pull request description, and you close the issue.
- **Earlier "declined" statements:** I treat them as a prior position and test again, since the card asks for evidence.
- **Docs fix:** correcting the false oxlint sentence in `src/tokens/README.md` is in scope, because it misstates the answer to this very question.
- **Tool use:** the git and GitHub steps are done by the tool, and `npm ci` and the oxlint runs are the only installs I'd need.