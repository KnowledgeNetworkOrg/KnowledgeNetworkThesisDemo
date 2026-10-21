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

## House rules

Every agent follows `AGENTS.md`. Claude Code does not read that file by itself, so it is
loaded here:

@AGENTS.md

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
one, guard it the way `model/lens.ts` and `state/walk/authordraft.ts` do — derive
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
| `design-system/` | the design system's own copies of the files a design-system card ports |

Read the sources the task actually touches. Do not assume any one of them is
complete, and do not treat a page as authoritative just because it is written
down — when a document and the code disagree, the code and the issue thread win
unless the document records a decision that has not been implemented yet.

## Session start

1. Skim the open issues covering the area you are about to touch, if you can
   reach GitHub. A KnowledgeNetwork-Code run cannot; its card is in its prompt.
2. Read the files the task names, plus their neighbours in the same folder.
3. If a spike covers the area, read its `RESULTS.md` before re-deriving it.

## Design agent

A design agent works on the visual system in its own Claude Design project and
cannot write to this repo. Everything between it and this repo goes through
GitHub issues.

- **Its work arrives as a card**: an issue labelled `design-system` that carries
  its own `done when:`. The title keeps the `OB-nnn` id the design project gave
  it. That id is not an issue number here, and the two can coincide by accident.
- **The files a card ports are copied into `design-system/`** by a PR of their
  own, merged before the card runs (#443 is the first). They are the design
  system's copies: read them and compare against them, never edit them, and port
  only what the card asks for.
- **Answer on the card**: done (name the commit), declined (and why), blocked
  (and on what), or a question. A port divergence, where a `src/ds/**` port
  differs from its source, is a comment on the drift log **#74**. A study or a
  question of our own is its own issue. Cite the real commit sha whenever a diff
  base matters. A KnowledgeNetwork-Code run cannot post: it says these things in
  its reply, they reach its pull request, and the owner answers on the card.

The design-sync channel that came before this was retired on 2026-10-20. That
covers the `DesignSync` tool, receipts written into the design project,
`## OBLIGATIONS` in its `design-sync.md`, the `/design-pull` skill and
`design-handoff/`. It is in git history. The `OB-nnn` and `receipts/<sha>.md`
citations in code comments stay as history; there is nothing to read behind them
from here.

## This repo's role

- The app code (`src/`) and the spike tooling under `tools/`.
- Agents open PRs here.
- Verification is self-contained: `npm run verify` builds (typecheck and
  `vite build`), typechecks `desktop/` against the app's platform contract,
  lints, and tests, and reaches outside this repository for nothing. The
  desktop step needs `desktop/`'s own packages, installed once with
  `npm ci --prefix desktop`.
- The import rule between the folders is written in `src/layering.test.ts`.
