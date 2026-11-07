# cs2023import — the CS2023 map, from the thesis's data

Turns the thesis repository's map file into the `cs2023` corpus:

```
node tools/cs2023import/generate.mjs
VITE_CORPUS=cs2023 npm run dev
```

It writes three committed modules: `src/corpus/cs2023data.ts` (the tree and the
edges), `src/corpus/cs2023docs.ts` (one document body per node) and
`src/corpus/cs2023walks.ts` (the TMU courses as routes).

## The input, and where it came from

`cs2023_map.json` is a **pinned, byte-identical copy** of
`data/derived/map/cs2023_map.json` in the thesis repository (alwaysmiddle/MastersThesis):

| | |
|---|---|
| Thesis commit | `5542a3d`, on the thesis `main` (merged by alwaysmiddle/MastersThesis#1 as `47152b3`) |
| SHA-256 | `3786fe217d7f263879f97191f7f158eae5d496f901b2daca00f417b826abddab` |
| Copied | 2026-11-05 |

Never edit it here. A problem in the data goes back to the thesis side; a newer copy
replaces this one, with this table updated, and the generator is run again.

## What is whose

- **CS2023's own:** the areas, the knowledge units and the topics and subtopics below them,
  with their ids, labels (verbatim), tiers and pages; and the 520 *see also* edges, each one
  of CS2023's printed "(See also: …)" notes, drawn unit to unit in the printed direction.
  Of those, 9 rest on a printed target that matches its unit only inexactly (the edge's
  `match` field says so, and the thesis's
  `data/derived/cs2023/cs2023_see_also.csv` gives the reason), and one
  printed target (MSF-Protection) matches no unit and is not drawn (`meta.rules` says so).
  *Computer Science Curricula 2023*, ACM/IEEE-CS/AAAI.
- **AI-made, under the author's review:** everything above *as it reaches this file*. The
  tree was transcribed from CS2023 by an AI agent (opencode / DeepSeek; the thesis's
  `data/derived/cs2023/README.md`, whose `coder` column says so on every row), and the
  "See also" notes were extracted by one (Claude Code). Neither is reviewed yet, so the labels
  are *meant* to be CS2023's verbatim words, not yet checked to be. Also AI-made: which
  CS2023 places the TMU courses stop at, which decides which places below a unit are in the
  file. The file's `meta.status` says the same, and every document body in the app carries a
  line saying the data is AI-transcribed and not yet reviewed.
- **The thesis author's:** the design (CS2023 as the map, each course a route over it), and
  the Science exception group.
- **This generator's, proposed and not yet decided by the author:**
  - the knowledge unit is the app's "topic" level (default D1 in the thesis's
    `thesisdemo_brief.md` §5), directly under its area: CS2023 has no level between them,
    so none is added;
  - below a unit, only the places some course stops at and the places above them (D3; the
    file already holds only these);
  - colours: areas take the ring's hues in area order, Science included as the 18th area.
    CS2023's 17th area (SPD) wraps onto the 1st's (AI) hue and Science, the 18th, onto the
    2nd's (AL's, `fern`) — the ring's own rule (`topicHue`). The 16th (SF) gets `mallow`,
    which is also the colour of a *see also* edge, this corpus's only edge type;
  - **Science is drawn as the 18th area.** It is the author's exception group, outside
    CS2023, and holds no unit: only course stops sit on it. The map draws a domain with no
    topics as a hexagon at that domain's ring anchor, big enough to label and click, so
    Science is selectable and a route can stop there. What it looks like is still the
    author's to decide.

## The routes

`cs2023walks.ts` carries the 61 TMU courses as routes over the map: 60 with stops, one
(`CPS 40A/B`) with none, 637 stops in all.

- **A route per course.** `id` is the course code lower-cased with every run of
  non-alphanumerics made one `-` (`cps-109`, `cps-40a-b`); `title` is the code and title
  verbatim; `category` and `group` are the calendar's. The 61 ids are distinct.
- **Stops are outline items, in outline order,** each on the place the thesis file put it.
  A stop may sit on an area, a unit, or any topic or subtopic below a unit, and its route
  keeps it there rather than lifting it to a unit. A stop's `id` is that place.
- **A stop's words are the course's own.** `note` and `label` both carry the outline item's
  verbatim label. `source` is `outline`, `split` or `filled`; `confidence` is `clear`,
  `judgment call`, `not matched` or `exception`; `item` is the item's `item_id`.
- **Secondary tags are listed, never resolved.** A stop's `secondary` carries the 129 tags
  the data records (id, label, confidence); only 69 of them name a place in the tree, so
  they are text here and are not checked as node ids (default D4).
- **Repeats are kept.** 45 routes stop at the same place more than once, and every visit
  stays in position: playback and "walks through here" read stops by position, not by node.
- **CPS 40A/B has no stops by design.** Its description is the data's own route `note`
  verbatim, and a player opening it does nothing.
- **A measure over walks skips `split` and `filled` stops.** Those say where the data
  divided an item across places or filled a gap the outline left, not what the outline
  named; counting them would inflate the course.
- **Prerequisites are "builds on" links between routes.** `buildsOn` carries the
  calendar's prerequisite rows in the file's order: `course` is the required course,
  `walkId` the route it is (absent for the 16 outside courses, which carry `title`
  when the data has one), `group` the row's `alternative_group` verbatim (its `.B`
  suffix kept, because an "and" can sit inside one alternative), and `wording` the
  calendar's sentence, verbatim. An either/or keeps its rows and its one wording;
  nothing is split or merged. No `depends_on` edge is drawn on the map.

Every other route's description is the calendar's words plus the standing line
"Placements are AI-suggested and under the author's review." The generator composes no
other route text.

A stop below a unit, or on an area, survives the Walk Desk's stored draft and the saved
walks: `src/state/persistguard.ts` asks whether the place exists on this corpus, and
`src/state/walk/draftpersist.ts` and `src/state/walkstore.ts` read through it.

## What is not carried yet

- **Each edge's notes.** The file gives every edge its note ids, the topic each note sits
  under (`attached_to`) and its pages. `GEdge` has no place for them, so drawing unit to
  unit hides which topic a note was attached to; they stay in the JSON.
