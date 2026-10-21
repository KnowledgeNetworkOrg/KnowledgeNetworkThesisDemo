# KnowledgeNetworkThesisDemo

The React app under `src/`: the Graph Disclosure Lab, one Studio of composable
navigation instruments for the teaching domain of the knowledge network. The
four relations are pedagogical (`depends_on`, `uses`, `see_also`,
`implemented_with`); `depends_on`, the prerequisite backbone, is the spine of a
generated curriculum.

## House rules

Every agent follows `AGENTS.md`. Claude Code does not read that file by itself, so it is
loaded here:

@AGENTS.md

## Checking a change

`npm run verify` builds (typecheck and `vite build`), typechecks `desktop/`
against the app's platform contract, lints, and tests. It reaches outside this
repository for nothing. It needs both package sets installed once, each
where its `node_modules` is missing: `npm ci` for the root and
`npm ci --prefix desktop` for `desktop/`.

The import rule between the folders under `src/` is written in
`src/layering.test.ts`.

## Two corpora

`src/corpus/graph.ts` chooses between them; it does not contain either. Every
instrument imports from it.

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

## Where to look

1. The files the task names, plus their neighbours in the same folder. The code
   and its comments hold the current model (the ops in `authordraft.ts`, the
   layout arithmetic in `AuthorRoad.tsx`).
2. If a spike covers the area, its `tools/*-spike/RESULTS.md`, before
   re-deriving it.
3. The open issues and PRs covering the area, if you can reach GitHub: why a
   change was made, what was tried and rejected. A KnowledgeNetwork-Code run
   cannot; its card is in its prompt.

No one source is complete, and a page is not authoritative just because it is
written down. When a document and the code disagree, the code and
the issue thread win, unless the document records a decision that has not been
implemented yet.

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

The design-sync channel that came before this (the `DesignSync` tool, receipts,
`## OBLIGATIONS`, `/design-pull`, `design-handoff/`) was retired on 2026-10-20.
The `OB-nnn` and `receipts/<sha>.md` citations in code comments are history;
there is nothing to read behind them from here.
