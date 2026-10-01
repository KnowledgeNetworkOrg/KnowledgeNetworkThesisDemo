# Oxlint as the repo's sole linter — parity check (#65)

The question: could `oxlint` (a Rust linter) replace ESLint here, with nothing we
rely on going dark? Not blocking #57. Decided on evidence, by running both tools
over the same planted violations — not by comparing rule lists.

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

That is 34 `eslint-disable` comments in 24 files (counted 2026-10-01). Each sits on
a line where an ESLint rule fires, so each is a free test of whether a second tool
fires there too.

## The bar for "parity"

Every row of the planted-violations table must fire in **oxlint's own built-in
rules**. Three further conditions: every rule active in ESLint for a `src` file has
a same-named oxlint rule, and oxlint reports none of the disable comments as unused.

Native rules only, because the card's step 3 drops the ESLint devDependencies. oxlint
can load ESLint plugins and run them, but a setup that does so still needs the plugins
installed, which is "keep ESLint" under a different name. If a row only fires that
way, it is a gap for this card.

Generous to oxlint on purpose: it runs with every category and every plugin that
needs no framework we do not use. A "silent" row therefore means no rule fires, not
that one was left switched off.

## Measured

<!-- parity:begin -->
_Not measured yet._ Run `node tools/oxlint-spike/parity.mjs --write` (after
`npm ci`) to fill this block. Nothing in this repository has recorded a measured
oxlint result so far.
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
- **B** compares rule *names* from `eslint --print-config` against `oxlint --rules`.
  A same-named rule can still behave differently (the TypeScript flavour of
  `no-unused-vars` is the usual example), which is why A exists; B only finds rules
  that are missing outright.
- **C** runs oxlint over the real `src`, `tools` and `desktop` with unused-directive
  reporting on. A comment oxlint calls unused is a rule that did not fire on that
  line for oxlint, though it does for ESLint.
- oxlint is installed into a temp folder and is not added to `package.json`. Pin the
  version with `OXLINT_VERSION=1.2.3`; the run records the version it used.

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
- It measures the oxlint version it installs, on the day it runs; the result is
  only as current as the stamp on the block.
