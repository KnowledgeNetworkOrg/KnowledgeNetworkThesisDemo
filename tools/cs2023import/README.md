# cs2023import — the CS2023 map, from the thesis's data

Turns the thesis repository's map file into the `cs2023` corpus:

```
node tools/cs2023import/generate.mjs
VITE_CORPUS=cs2023 npm run dev
```

## The input, and where it came from

`cs2023_map.json` is a **pinned, byte-identical copy** of
`data/derived/map/cs2023_map.json` in the thesis repository (alwaysmiddle/MastersThesis):

| | |
|---|---|
| Thesis commit | `5542a3d` on the branch `claude/clever-meitner-x2n7lj` (alwaysmiddle/MastersThesis#1, not yet on the thesis `main`) |
| SHA-256 | `3786fe217d7f263879f97191f7f158eae5d496f901b2daca00f417b826abddab` |
| Copied | 2026-11-05 |

Never edit it here. A problem in the data goes back to the thesis side; a newer copy
replaces this one, with this table updated, and the generator is run again.

## What is whose

- **CS2023's own:** the areas, the knowledge units and the topics and subtopics below them,
  with their ids, labels (verbatim), tiers and pages; and the 520 *see also* edges, each one
  of CS2023's printed "(See also: …)" notes, drawn unit to unit in the printed direction.
  Of those, 9 rest on a printed target that matches its unit only inexactly (the edge's
  `match` field says so), and one printed target (MSF-Protection) matches no unit and is not
  drawn; the file's `meta.rules` records both.
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
  - colours: areas take the ring's hues in area order; the 17th area (SPD) wraps onto the
    1st's (AI) hue, the ring's own rule (`topicHue`). The 16th (SF) gets `mallow`, which is
    also the colour of a *see also* edge, this corpus's only edge type;
  - **Science is left out for now.** It holds no unit, only course stops, and the map cannot
    draw a domain with no topic. It joins with the routes, in the card that decides how it
    is drawn.

## What is not carried yet

- **Routes.** `cs2023walks.ts` is empty: the 61 TMU courses as routes over this map are a
  later card. (The Walk Desk's opening plan for any corpus but `teaching` is a placeholder
  seeded from the first topics; it is not data.)
- **Each edge's notes.** The file gives every edge its note ids, the topic each note sits
  under (`attached_to`) and its pages. `GEdge` has no place for them, so drawing unit to
  unit hides which topic a note was attached to; they stay in the JSON.
