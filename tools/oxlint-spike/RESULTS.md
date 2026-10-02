# Oxlint as the repo's sole linter — parity check (#65)

The question: could `oxlint` (a Rust linter) replace ESLint here, with nothing we
rely on going dark? Not blocking #57. Decided on evidence, by running both tools
over planted violations and over the real tree — not by comparing rule lists.

**The answer is the first line of "Measured" below.** It is generated, not typed:
`node tools/oxlint-spike/parity.mjs --write` runs both tools and rewrites that block.
Until that command has been run once, the block says so and there is no verdict —
nothing below it is a finding yet.

## What this repo's lint actually asks for

The card describes the config as "the stock Vite template". It has grown past that.
`eslint.config.js` carries four things the card's two named rules do not cover:

| What | Where it comes from | Evidence it is relied on |
| --- | --- | --- |
| `js.configs.recommended` and `tseslint.configs.recommended` (not type-aware) | the Vite template | the card; `eslint.config.js` |
| `react-hooks/exhaustive-deps` and `rules-of-hooks` | `eslint-plugin-react-hooks` 7, `configs.flat.recommended` | 20 `eslint-disable` comments name `exhaustive-deps` |
| The React-compiler rules that same preset switches on — `set-state-in-effect`, `refs`, `immutability`, and the rest | the same preset (version 7 added them) | 14 `eslint-disable` comments name `set-state-in-effect`; `.claude/skills/design-pull/SKILL.md` tells a porter what `immutability` and `refs` forbid |
| `react-refresh/only-export-components` | `reactRefresh.configs.vite`; switched off for `src/ds/**` and `tools/**` | `eslint.config.js` comments explain both exemptions |
| `no-restricted-syntax` selectors: the host-shape ban (#211, all of `src/**`) and the raw-hex / raw-px bans (#61, three files) | custom esquery selectors written in `eslint.config.js` | the config comments (#211 is "the machine half" of a sentence in `src/platform/types.ts`); `design-handoff/PROTOCOL.md` lists the #61 bans as one of the two guards that exist |

That is 34 `eslint-disable` comments in 24 files (counted 2026-10-01). Each is meant
to sit on a line where an ESLint rule fires, which would make each a free test of
whether a second tool fires there too. That is assumed until the run checks it:
ESLint only warns about an unused disable comment (so `npm run lint` passes with a
stale one), and the script re-runs ESLint with `--no-inline-config` to find out which
comments really cover a finding. A stale one is reported as stale and is not held
against oxlint.

## The bar for "parity"

Every row of the planted-violations table must fire in **oxlint's own built-in
rules**. Five further conditions, all checked by the script:

1. Every rule active in ESLint for a `src` file has a same-named oxlint rule.
2. The config `@oxlint/migrate` writes from `eslint.config.js` carries every one of
   those rules, without leaving ESLint plugins in it.
3. For every disable comment where ESLint itself reports a finding on the covered
   line, oxlint's rule of the same name fires on that same line.
4. Every rule ESLint reports on the real tree (comments neutralised) is also reported
   by oxlint.
5. With the comments in place, oxlint reports nothing on the real tree that ESLint
   does not — otherwise swapping the linters turns `npm run lint` red.

Native rules only, because the card's step 3 drops the ESLint devDependencies. oxlint
can load ESLint plugins and run them, but a setup that does so still needs the plugins
installed, which is "keep ESLint" under a different name. If a row only fires that
way, it is a gap for this card.

Generous to oxlint on purpose: it runs with every category and every plugin that
needs no framework we do not use. A "silent" row therefore means no rule fires, not
that one was left switched off.

## Measured

<!-- parity:begin -->
**Verdict: KEEP ESLINT — 2 of 11 planted violations oxlint does not report (host-branch (#211), raw hex / px (#61)); 5 active ESLint rules with no same-named oxlint rule; 4 active ESLint rules that @oxlint/migrate did not carry into the oxlint config; 3 of 34 disable comments cover a rule that oxlint never reports in that file; 16 of 34 disable comments would have to move, because oxlint reports the same rule on a different line of the file; oxlint reports 1 finding on the real tree that ESLint does not.**

Measured 2026-10-02 with oxlint 1.86.0, @oxlint/migrate 1.86.0, eslint 9.39.3, node v22.23.1.

#### A. One planted violation per rule family

| family | what is planted | ESLint (this repo's config) | oxlint (native rules, everything on) |
| --- | --- | --- | --- |
| exhaustive-deps | an effect that reads `step` but lists no dependencies | fires (react-hooks/exhaustive-deps) | fires (react-hooks(exhaustive-deps)) |
| rules-of-hooks | a hook called inside an `if` | fires (react-hooks/rules-of-hooks) | fires (react-hooks(rules-of-hooks)) |
| set-state-in-effect | a state setter called straight inside an effect body | fires (react-hooks/set-state-in-effect) | fires (react(set-state-in-effect)) |
| refs | a ref read during render | fires (react-hooks/refs) | fires (react(refs)) |
| immutability | a property of a prop assigned to during render | fires (react-hooks/immutability) | fires (react(immutability)) |
| only-export-components | a component file that also exports a plain function | fires (react-refresh/only-export-components) | fires (react(only-export-components)) |
| host-branch (#211) | `platform.name === 'electron'` anywhere under src/ | fires (no-restricted-syntax) | SILENT — other rules reported here: import(prefer-default-export), eslint(one-var), import(no-named-export) |
| raw hex / px (#61) | a raw `#ff0000` and `10px` in src/App.tsx (one of the three scoped files) | fires (no-restricted-syntax) | SILENT — other rules reported here: import(prefer-default-export), react(jsx-filename-extension), unicorn(filename-case), import(no-named-export) |
| recommended: no-debugger | a `debugger` statement (core recommended) | fires (no-debugger) | fires (eslint(no-debugger)) |
| recommended: no-explicit-any | an `any` type (typescript-eslint recommended) | fires (@typescript-eslint/no-explicit-any) | fires (typescript(no-explicit-any)) |
| recommended: no-unused-vars | a local that is never used (typescript-eslint recommended) | fires (@typescript-eslint/no-unused-vars) | fires (eslint(no-unused-vars)) |

#### B. Active ESLint rules oxlint cannot run, or that the migrated config dropped

ESLint has 85 rules active for a `src` .tsx file; oxlint lists 808 rules.

No same-named oxlint rule exists for:
- `no-octal`
- `react-hooks/component-hook-factories`
- `react-hooks/config`
- `react-hooks/gating`
- `no-restricted-syntax`

oxlint has the rule, but `@oxlint/migrate` did not put it in the config it wrote:
- `no-var`
- `prefer-const`
- `prefer-rest-params`
- `prefer-spread`

#### C. The config `@oxlint/migrate` made from `eslint.config.js`

ESLint plugins it left in the config (stripped here — native rules only): none.

Rules in it that oxlint does not know (dropped so the run could proceed): none.

What the tool printed:

```
⚠️  Warnings (4):
   * ESLint AND glob patterns (nested arrays in files) are not supported in oxlint: ["**/*.{ts,tsx}","**/*.ts"]
   * ESLint AND glob patterns (nested arrays in files) are not supported in oxlint: ["**/*.{ts,tsx}","**/*.tsx"]
   * ESLint AND glob patterns (nested arrays in files) are not supported in oxlint: ["**/*.{ts,tsx}","**/*.mts"]
   * ESLint AND glob patterns (nested arrays in files) are not supported in oxlint: ["**/*.{ts,tsx}","**/*.cts"]
```

#### D. The real tree, ESLint against oxlint

ESLint over the real tree (`eslint .`, comments in place): 0 errors, 0 warnings, and 0 of its own "unused eslint-disable" warnings. With the comments ignored (`--no-inline-config`) it reports 35 findings — that is what the repo's 34 `eslint-disable` comments in 24 files are holding back.

**Each comment, checked against both tools.** A comment is *stale* when ESLint itself reports nothing on the line it covers (not oxlint's fault, and left out of the verdict). Otherwise the question is whether oxlint's rule of the same name fires on that line, with the comment neutralised.

| rule named in the comments | comments | stale (ESLint finds nothing there) | oxlint fires on that line | oxlint fires elsewhere in the file | oxlint silent |
| --- | ---: | ---: | ---: | ---: | ---: |
| `exhaustive-deps` | 20 | 0 | 5 | 15 | 0 |
| `set-state-in-effect` | 14 | 0 | 10 | 1 | 3 |

**Findings per rule over the whole tree, comments neutralised in both tools.**

| rule | ESLint | oxlint (migrated config) |
| --- | ---: | ---: |
| `exhaustive-deps` | 21 | 21 |
| `set-state-in-effect` | 14 | 16 |
| `immutability` | 0 | 4 |
| `only-export-components` | 0 | 1 |
| `refs` | 0 | 2 |
| `use-memo` | 0 | 1 |

Per file, where ESLint reports more than oxlint (comments neutralised):
- `src/ds/chrome/Pane.tsx` — `set-state-in-effect`: 1
- `src/ds/nav/WalkStrip.tsx` — `set-state-in-effect`: 1
- `src/ds/presenter/FilmRoll.tsx` — `set-state-in-effect`: 1

oxlint over the real tree with the comments in place reports 1 finding, of which 1 ESLint does not report.
- `src/studio/PaletteGlyph.tsx` — `only-export-components`: 1
<!-- parity:end -->

## How to read it, and re-run it

```
npm ci
node tools/oxlint-spike/parity.mjs --write
```

- **A** plants one file per rule family in a scratch folder in the OS temp directory
  (never in the repo, so `npm run lint` cannot see them) and runs both tools over it.
  ESLint uses this repo's own `eslint.config.js`. An ESLint cell reading `SILENT`
  makes the verdict TEST INVALID: the planted code is wrong, and oxlint's column
  means nothing until it is fixed.
- **B** compares rule *names* from `eslint --print-config` against `oxlint --rules`,
  and then against the rules `@oxlint/migrate` actually wrote into the oxlint config.
  A same-named rule can still behave differently (the TypeScript flavour of
  `no-unused-vars` is the usual example), which is why A exists; B only finds rules
  that are missing outright or that the translation dropped.
- **C** shows what `@oxlint/migrate` made of `eslint.config.js`: the ESLint plugins it
  left in (stripped, since only native rules count) and the rules oxlint does not know
  (dropped so the run can proceed), plus the tool's own output.
- **D** is the card's "diff its findings against `eslint .`". ESLint runs over the real
  tree plain and with `--no-inline-config`; oxlint runs the migrated config over two
  copies of the repo's lintable files in a temp folder (one as is, one with every
  `eslint-disable` rewritten so there is nothing to obey; the repo itself gains no
  config file). It reports ESLint's own errors, warnings and unused-comment warnings;
  a per-comment table (stale in ESLint / oxlint fires on the line / fires elsewhere in
  the file / silent); findings per rule for both tools; and the files where they differ.
  "Fires elsewhere in the file" is kept apart from "silent" on purpose: it means oxlint
  has the rule but reports it on a different line than ESLint does, so the comment
  would have to move — a different problem from a rule that is missing.
- oxlint and `@oxlint/migrate` are installed into a temp folder and are not added to
  `package.json`. Pin them with `OXLINT_VERSION=1.2.3` and
  `OXLINT_MIGRATE_VERSION=1.2.3`; the run records the versions it used.
- Exit code 2 means the script could not measure everything (a section above says
  "Could not run") or the planted test is invalid; the verdict line says which.

## If the verdict is "keep ESLint"

This file and the pull request description are the record the card asks for: the
silent rows in table A are the gap, and the version is stamped on the block. Leave
`eslint.config.js` and the ESLint packages as they are. Re-running the command above
is the whole re-evaluation, so revisit it when oxlint gains a rule that a silent row
needs — not before.

## If the verdict is "parity holds"

Card step 3 applies: replace `eslint.config.js` with `.oxlintrc.json`, fold in the #61
adherence rules, and drop the ESLint devDependencies. `npx @oxlint/migrate
eslint.config.js` is the place to start, and the thing to check is what it leaves out:
the `no-restricted-syntax` selectors are the part most likely to need hand work. That
move forecloses type-aware typescript-eslint rules later; the card names this cost.

## Limits of this check

- It plants one violation per family, not one per rule. A rule that fires on the
  planted shape and misses a variant of it would not show up in A.
- B is by name only, as above.
- The script's first end-to-end run was on 2026-10-02 (oxlint 1.86.0, Windows, Node
  22). It found four faults in the script itself, all fixed before the block above was
  written: an absolute path handed to `@oxlint/migrate`, which joins it onto its own
  folder; `oxlint --rules` printing nothing when piped unless given `--format json`;
  and two planted cases (`set-state-in-effect`, `immutability`) that ESLint itself
  did not report in the shape first written. It has not been run on another system or
  against another oxlint version, so a different version may need the script touched
  again.
- It measures the oxlint version it installs, on the day it runs; the result is
  only as current as the stamp on the block.
