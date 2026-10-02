# Handoff to the design agent

A design agent works on this product's visual system inside a Claude Design
project (**KnowledgeNetwork Design System**). It is the **source of truth for
style**; code adopts it through `/design-pull`, component by component, never a
wholesale replace. This is issue #57 (roadmap #58).

This file is the contract for how code and that agent exchange work. As of **#75**
the code→design channel is **GitHub issues**, not the `design-handoff/msg/NNNN`
files and `from-code.md` that used to live beside this one — those are retired
(recoverable from git history). The move is a concurrency fix: three checkouts
of this repo run side by side, and both hand-minted message numbers and a single
overwrite-in-place status file collide across them. GitHub mints the number and
holds one store outside every checkout.

As of **2026-08-18** there is a second code→design channel beside it: **receipts
written into the design project itself**, through the `DesignSync` tool's write
methods. Issues carry anything needing discussion, an attachment or a third
party; receipts carry the per-item answer to an obligation. This is what answers
the open question in #75 — not by giving the design agent comment access, but by
making the file it *can* write obligating, and giving us a file we *can* write to
reply in. Both capabilities were already in the table below; only the status
vocabulary was missing.

## Who writes where

| | this repo | the design project |
| --- | --- | --- |
| **Claude Code** | read + write | read any file; write receipts freely; all other writes only through an approved `/design-pull` plan |
| **design agent** | read (pushed refs, a mounted tree, **and this repo's issues**) | read + write |

Each agent writes only in its own home; both read both. No file is authored
twice, and there is no merge to resolve.

## code → design: GitHub issues

- **One issue per message or topic.** GitHub mints the number — no hand-minted
  sequence to collide across checkouts. A correction is a **new issue that names
  the old one**, never a silent rewrite; status never goes inside the message.
- **Port divergences** — where a vendored DS port (`src/ds/**`) differs from the
  DS source (a contract gap, a re-tint, a dropped affordance) — go to the
  standing **drift-log #74**, one comment per divergence, mirrored terse in
  `src/ds/PROVENANCE.json`.
- **Studies, decisions, questions** — each its own issue. Attachments (a
  wireframe jpg) attach to the issue.
- **Code state / diff base:** cite the **real commit sha** in the issue or PR.
  The design agent's GitHub tools hand it a *tree* hash, not a usable commit sha,
  so name the sha explicitly whenever a diff base matters. This is the job the
  old `from-code.md` did; naming a sha in an issue avoids its wart (a status file
  must name a sha, but committing it mints a new one, so the name was always one
  commit stale).
- **`needs:`** is the only field that creates an obligation (`needs: decision |
  answer | implementation | none`). It is stated in an issue body for
  code→design, and in a `## OBLIGATIONS` item for design→code (below). Those two
  channels are binding; prose anywhere else — a readme, `sync-log.md`, a run
  summary — is not.

## design → code: obligations in `design-sync.md`

The design agent **cannot write this repo**. It authors in its Design System
project; code reads that through `/design-pull` (`list_files` / `get_file` to
read the current tokens and components, then `finalize_plan` + `write_files` to
push a reviewed change). There is no local mirror — read the project directly.

That project's `design-sync.md` carries a `## OBLIGATIONS` section. **Items in
that section are binding on the same terms as an issue marked
`needs: implementation`.** Nothing elsewhere in that project obligates us — not
the readme, not `sync-log.md`, not the prose around an item. **Read the section
at the start of every run**, before fetching anything.

Each item is a heading with a stable id that never changes and is never reused:

```
### OB-014 — road pane insets its scroller at both ends
needs: implementation
against: 16657c5
files: src/instruments/walkdesk/AuthorRoad.tsx
done when: [data-road-root] computes marginTop: 12px and marginBottom: 12px
```

**`against:`** is the sha the item was written from. If HEAD has moved past it,
re-read the files it names before acting — the item may already be satisfied.
**`done when:`** is the whole acceptance test; if it is not checkable, say so in
the receipt rather than guessing at intent.

## code → design: receipts

A receipt is the answer to an obligation, and the only channel that reaches the
design agent without the owner carrying it. **Clear or question an item by
writing a receipt, never by editing `design-sync.md`** — that file is theirs to
author. Receipts are ours: the only thing we write in their project outside a
port.

**One file per run**, named for the commit the run ended at:
`receipts/<sha>.md`. `sync-receipts.md` at that project's root is a fixed
signpost pointing at the folder; it is written once and never appended to.

One entry per item per run:

```
## OB-014 — done
commit: 5fff671
date: 2026-08-18
note: computed on [data-road-root]; confirmed on the running page.
```

The status is one of:

- **done** — cite the commit sha. Not the tree hash.
- **declined** — say why. A declined item is answered, not ignored; the design
  agent strikes it as closed-by-decline.
- **blocked** — say what on, naming the item or issue it waits for.
- **question** — add `needs: answer` and ask one question, specifically. The item
  stays open. Do not half-implement around an ambiguity; a question costs one
  round trip, a wrong guess costs a port.

A run that touched no obligations writes no file. **Silence means untouched, not
done.**

**Why one file per run, and not one appended file.** `write_files` replaces a
whole file — the tool has no append. Appending to a single `sync-receipts.md`
therefore means read-modify-write on one shared file from three side-by-side
checkouts, which is the exact failure that retired `msg/NNNN` and `from-code.md`
in #75: two runs overlap and one silently drops the other's receipts. It also
walks into `get_file`'s 256 KiB cap as the file grows, since entries are never
deleted. A per-run file needs no read, cannot clobber, and takes its name from
the sha rather than a hand-minted number — the same argument that sent
code→design to GitHub, applied to their store instead.

**Corrections.** A correction is a new entry in a later run's file that names the
old one, never an edit to a filed receipt — the same rule as issues, for the same
reason: an amendment to something already read reaches nobody. The one exception
is the design agent answering a `question` receipt, which it appends under its
own still-open item.

**Neither side is notified.** That is the honest cost of a file channel: a run
reads `## OBLIGATIONS` before starting, a design session reads the newest
receipts before starting. Neither is optional.

## The coupling that must not drift

The design project's `tokens/spacing.css` `--road-*` block transcribes layout
constants from `src/instruments/walkdesk/AuthorRoad.tsx`. The road's layout is
measure-free arithmetic, so those numbers *are* the layout, and a token that
disagrees is a wrong drawing of a right screen — **wherever anything still reads
the token.**

**Re-audited 2026-08-18: the block is inert.** Nothing in `src/` reads any
`--road-*` token; the only mentions outside `spacing.css` are comments in
`kn-theme.css`. A disagreement here currently draws nothing wrong. PROVENANCE
recorded exactly this for `--road-head-h` on 2026-08-11 — "no source reads the
token" — and this section never caught up. Treat the block as a **record** of
the road's constants, and re-read this paragraph before trusting it if something
starts consuming them again.

Two of the anchors it names are gone, which matters before anyone reconciles a
value against them:

- **`PAD` no longer exists in `AuthorRoad.tsx`.** The only `PAD`s in `src/` are
  `LensPane.tsx` (44) and `WalkColumns.tsx` (14) — different files, different
  meanings. `--road-pad: 10px` must not be reconciled against either.
- **`RAIL_W` no longer exists anywhere in `src/`**, though `spacing.css` still
  carries `--rail-w: 186px  /* RAIL_W */`.
- Still live, still correct: `NODEW` 150, `NODEH` 34, `AGAP` 26, `MARGIN` 16,
  `SLOTH` 18.
- `--road-head-h` holds a **deliberate local deviation** — 72px here against the
  DS's 44px, because the head grew a description row in #70/#86. The road owns
  its own constants; do not adopt 44 back.

Documented coupling drifts; tested coupling does not. The old `tokens.test.ts`
value-for-value parity guard was removed with #44, and the guard that replaced it
is **not** what this section used to claim. Oxlint was **not adopted** (#61 ported
the rules into ESLint; #65 asked whether oxlint could replace ESLint outright and
the answer was no, see `tools/oxlint-spike/RESULTS.md`), so there is no `_adherence.oxlintrc.json` in this
repo — that file lives in the design project as a reference spec only, and it was
never wired into `npm run verify`. What actually exists:

- **`eslint.config.js`** — #61 authored the DS's raw-hex / raw-px bans as native
  ESLint `no-restricted-syntax` rules, scoped to token-clean files and growing
  per migrated file. Not repo-wide.
- **`src/ds/adherence.test.ts`** — #108 guards the DS host rules: a pane body
  paints no background, a clipping body rounds all four corners, a switched-off
  border side uses longhands, and a pinned budget of undocumented props.

Neither covers the `--road-*` numbers. That coupling stays documented, not
enforced — a promise to keep by hand.
