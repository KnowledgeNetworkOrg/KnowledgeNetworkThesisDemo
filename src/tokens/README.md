# `src/tokens/` — vendored Design-System token closure

These CSS files are a **vendored snapshot** of the `tokens/` folder in the
**KnowledgeNetwork Design System** (a Claude Design project), which is the
source of truth for style. They are kept **byte-identical** to the project so a
future `/design-pull` `get_file` can diff cleanly against them.

The recorded fingerprint of this snapshot — DS project id, per-file `sha256`
hashes, and sync date — lives in [`../ds/PROVENANCE.json`](../ds/PROVENANCE.json).
The DS has no native version; that stamp is the diffable marker. Re-hash and
compare against it to detect drift. Publishing the DS as a real versioned
dependency is tracked in issue #66.

**Do not hand-edit these files.** A value here is wrong the moment it disagrees
with the design project. To change one, change it in the design project and
re-vendor via `/design-pull`. This is issue #57 (roadmap #58); the drift guard
that enforces "code only reaches these through `var(--token)`" is the raw-hex /
raw-px bans in `eslint.config.js`, wired in #61. They port the DS's
`_adherence.oxlintrc.json` reference spec into native ESLint rules, scoped to the
files already token-clean; that oxlint file is not in this repo, and whether oxlint
could replace ESLint outright is #65 (`tools/oxlint-spike/RESULTS.md`).

## What is imported

**All of it, since #64 slice 5.** `src/index.css` takes the closure in
dependency order:

- the five **definition** files — `colors.css`, `elevation.css`, `spacing.css`,
  `typography.css`, `motion.css` — which only declare `:root` variables;
- `fonts.css`, which loads the webfonts those variables name (Quicksand /
  Nunito / JetBrains Mono);
- `kn-theme.css` (#93) — not a definition file, but the DS's Tailwind utility
  surface, the same values turned into real utility classes;
- `base.css` **last**, because it consumes the vars the others define.

`base.css` is the one with reach. It is the element reset: it applies the tokens
to `body` and `*` — font, colour, background, links, selection, focus ring and
scrollbars. **A re-vendor of `base.css` changes the running app immediately.**
Vendored 2026-08-18 (#111): the DS added the `data-kn-hover` recipe to the foot
of its `base.css` on 2026-08-17, and this copy now carries it. **The hook ships
inert** — nothing in `src/` sets the attribute yet. Replacing hand-rolled
`useState` hover state with it is H10, a separate change.

*Corrected 2026-08-18.* Until this edit the section said `base.css` and
`fonts.css` were "vendored but not yet imported … held for the chrome/global
adoption step (#64)". That stopped being true when #64 slice 5 landed and the
note was never updated, so a `base.css` re-vendor read as inert for weeks while
it was in fact the most far-reaching file in the closure.
