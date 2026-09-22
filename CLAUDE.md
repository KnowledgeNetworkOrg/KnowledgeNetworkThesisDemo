# KnowledgeNetworkThesisDemo Orientation

This repository holds the **code** for the implementation-first thesis demo: the
React app under `src/` — the Graph Disclosure Lab, one Studio of composable
navigation instruments.

Its scope is the **teaching domain** of the knowledge network, iterated
independently of the coding and infrastructure projects. The coder-shaped
framing has been removed: there is no Coding preset and no architecture-map
generator. The four relations are pedagogical (`depends_on`, `uses`, `see_also`,
`implemented_with`), with `depends_on` — the prerequisite backbone — as the spine
of a generated curriculum.

## Two corpora

`src/corpus/graph.ts` chooses between them; it does not contain either. Every
instrument imports from it exactly as it always has.

- **teaching** (the default) — the hand-authored CS corpus in `teachingdata.ts`.
  Six domains, sixteen modules, 53 topics, 116 authored edges. **Every pinned
  count in the test suite measures this one**, so leave it the default.
- **courses** — 36 real courses from Toronto Metropolitan University's published
  outlines, GENERATED into `coursedata.ts` by `tools/courseimport/`. Read that
  folder's `README.md` before touching anything in it: it records what is the
  university's data and what is the author's judgment, and the distinction is
  load-bearing for the thesis. Run it with `VITE_CORPUS=courses npm run dev`.

A module that names a corpus node id in a literal will crash the *other* corpus
on import, which presents as a blank screen rather than an error. If you write
one, guard it the way `model/lens.ts` and `walkdesk/authordraft.ts` do — derive
the node from the loaded data, or branch on `CORPUS_NAME`.

## Where the knowledge lives

There is **no single source of truth**, deliberately. A knowledge network that
can only read one repository is not a knowledge network. Context for this
project is assembled from whichever sources actually hold it:

| Source | Holds |
| --- | --- |
| GitHub issues and PRs | in-flight work, why a change was made, what was tried and rejected |
| the code and its comments | the current model — the ops in `authordraft.ts`, the layout arithmetic in `AuthorRoad.tsx` |
| `tools/*-spike/RESULTS.md` | spike findings, next to the shots that produced them |
| `skills/` | packaged procedures, and material mirrored in from outside |
| `design-handoff/` | the running conversation with the design agent |

Read the sources the task actually touches. Do not assume any one of them is
complete, and do not treat a page as authoritative just because it is written
down — when a document and the code disagree, the code and the issue thread win
unless the document records a decision that has not been implemented yet.

## Session start

1. Skim the open issues covering the area you are about to touch.
2. Read the files the task names, plus their neighbours in the same folder.
3. If a spike covers the area, read its `RESULTS.md` before re-deriving it.

## Design agent

A design agent works on the visual system in a Claude Design project and cannot
write to this repo. `design-handoff/` is our side of that conversation; read
`design-handoff/PROTOCOL.md` once — it is short, and it is the whole contract.

Replies to the design agent go out as **GitHub issues**, not files — as of #75
the old `design-handoff/msg/NNNN` files and `from-code.md` are retired (three
side-by-side checkouts made hand-minted numbers and one overwrite-in-place status
file collide). A **port divergence** — a `src/ds/**` port differing from the DS
source — is a comment on the standing drift-log **#74**; a study, decision, or
question is its own issue; cite the **real commit sha** in the issue when a diff
base matters.

As of **2026-08-18** there is a second outbound channel: **receipts written
straight into the design project**, through the `DesignSync` tool's write methods
(`finalize_plan` → `write_files`). A receipt answers one obligation — done with a
commit sha, declined with a reason, blocked, or a question — and lands as
`receipts/<sha>.md`, one file per sync run. Issues stay the channel for anything
needing discussion, an attachment, or a third party. Inbound, the design agent
authors in its own project and marks binding work under `## OBLIGATIONS` in its
`design-sync.md`: **read that section before starting a run.**
`design-handoff/PROTOCOL.md` is the whole contract — read it once.

## This repo's role

- The app code (`src/`) and the spike tooling under `tools/`.
- Agents open PRs here.
- Verification is self-contained: `npm run verify` runs typecheck, lint, and
  tests, and reaches outside this repository for nothing.
- The import rule between the folders is written in `src/layering.test.ts`.
