# KnowledgeNetworkThesisDemo

Implementation-first thesis demo: turning course material into a navigable
knowledge-node network with an editable presentation path.

This repo is aimed at the **teaching domain** of the knowledge network, and
iterates independently of the coding and infrastructure projects.

The app today is the **Graph Disclosure Lab** — a client-only React
prototyping ground for graph-navigation UX, running over one hand-authored
corpus (a CS-topics domain, ~70 nodes, typed edges). It is organized as one
**Studio**: every navigation view (map, walk, unfold, tree, document, plex,
trail, lenses) is a pickable instrument on a shared sync bus, and presets
(teaching / cockpit) are curated instrument compositions. It exists to answer
navigation-UX questions before they get built into the product roadmap's later
slices (canvas organization, presentation path, presentation preview).

The four authored relations are pedagogical, and named for what they mean:
`depends_on` ("builds on" — the prerequisite backbone, a DAG, and the spine of
a generated curriculum), `uses`, `see_also`, and `implemented_with`.

Two earlier roadmap slices — a graph-model backend and PPTX import — have not
started. There is currently no backend and no PPTX import in this repo.

## Getting Started

```powershell
npm install
npm run dev
```

## Project Structure

```text
KnowledgeNetworkThesisDemo/
├── src/
│   ├── corpus/              # the hand-authored graph: nodes, deep layers, documents, walks
│   ├── model/               # pure derivations — layouts, lenses, visibility, nav helpers
│   ├── instruments/         # one file per navigation view (map, walk, tree, plex, trail, …)
│   ├── studio/              # StudioView — the instrument palette + presets + sync bus
│   ├── App.tsx, main.tsx
│   └── index.css
├── skills/                  # packaged procedures, and material mirrored in from outside
├── tools/*-spike/           # spike verification scripts + RESULTS.md write-ups
└── package.json
```

## Where things are written down

This project keeps no single source of truth. What you need is spread across
the sources that actually hold it:

- **GitHub issues and PRs** — in-flight work and the reasoning behind changes.
- **The code and its comments** — the current model. The layout arithmetic in
  `AuthorRoad.tsx` and the ops in `authordraft.ts` document themselves.
- **`tools/*-spike/RESULTS.md`** — spike findings, beside the shots that
  produced them.
- **`.claude/skills/`** — packaged procedures. `design-pull/` is the one that
  carries weight: the pull-direction sync with the **KnowledgeNetwork Design
  System** Claude Design project, which is the source of truth for style.
  (Named off Claude Code's built-in `/design-sync`, which pushes the wrong way
  and cannot be overridden by a project skill of the same name — see that
  skill's own header.) (A
  top-level `skills/` folder used to hold a local mirror of that system. It was
  removed with #44 and the folder is gone — this bullet described it until
  2026-08-18.)

## Scripts

```powershell
npm run dev
npm run build
npm run lint
npm run verify
```

`verify` also typechecks the Electron host in `desktop/`, which is its own npm
package with its own lockfile. Install its packages once first:

```powershell
npm ci --prefix desktop
```

Without them, `verify` stops at `Cannot find module 'electron'`.

## License

BSD-2-Clause - see [LICENSE](LICENSE).
