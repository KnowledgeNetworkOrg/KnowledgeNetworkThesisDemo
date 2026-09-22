# Importing a real curriculum

This folder turns Toronto Metropolitan University's published Computer Science
course outlines into a second corpus for the demo, so that the instruments can
be shown working on data nobody in this project wrote.

It matters because the demo's own corpus is hand-authored, and a hand-authored
corpus can always be accused of having been shaped to suit the instruments that
read it. This one was not: its structure, its prose and every one of its arrows
come from documents the university published for its own reasons, years before
this project existed.

## What is here

| File | What it is |
| --- | --- |
| `extract.py` | Step 1 — pulls plain text out of a folder of PDFs, saved web pages and one Word file. Does nothing else. |
| `courses.json` | Step 2 — the hand-reviewed result. **This is the file to edit.** |
| `generate.mjs` | Step 3 — writes the three corpus modules the app reads. |

```
python tools/courseimport/extract.py "<folder of outlines>" <scratch folder>
#   ... read the text, edit courses.json ...
node tools/courseimport/generate.mjs
npm run verify
```

The generated files — `src/corpus/coursedata.ts`, `coursedocs.ts`,
`coursewalks.ts` — are **committed**. Nothing in the app reads a PDF, a
spreadsheet or this folder at build time. The extraction ran once, a person
reviewed it, and what ships is the reviewed result.

## The source documents

Nineteen course outlines (also called Course Management Forms) and one
spreadsheet listing all 61 courses of the program with its requirement
categories. Terms range from Winter 2013 to Fall 2024; some documents still say
"Ryerson", which is what the university was called before 2022.

The outlines are not in this repository. They are the university's documents,
not ours, and several are marked read-only by the department. `courses.json`
names the source file for every course so any claim in it can be checked against
the original.

## The mapping, and why

The demo's graph has a level that carries relationship arrows — internally "a
topic". Everything above it is grouping; everything below it is detail you can
open into.

**A course is a topic.** That decision follows from where the real relationships
are: a university publishes prerequisites *between courses*, and publishes
nothing at all between the topics inside them. Had the topic level been "a
subject taught in week 4", every arrow on the map would have had to be invented.

That gives:

| Level | What it is | Where it comes from |
| --- | --- | --- |
| the whole map | the Computer Science program | — |
| subject areas | seven groups of courses | **the author's, not the university's — see below** |
| Required / Elective | the standing of a course | the program table |
| **a course** | the arrow-bearing level | the program table and the outlines |
| below a course | the course's own topic breakdown | the outline, verbatim |

**"Builds on" is a published prerequisite.** Thirty-three arrows, every one of
them a sentence in an outline. The other three relations the demo can draw —
"uses", "see also", "implemented with" — are **empty**, and deliberately so: a
course calendar does not publish them. That absence is a finding about
institutional data, not a hole to be filled in by hand. A test in
`src/corpus/coursecorpus.test.ts` fails if anyone ever fills it.

## What is the author's judgment rather than the university's

Three things, and only three. They are listed here because a reader of the
thesis is entitled to know exactly where the data stops and the reading starts.

1. **The seven subject areas.** The university's calendar groups courses by
   requirement, not by field. Programming & Languages, Algorithms & Theory,
   Mathematics & Science, Computer Systems, Software Engineering, Data &
   Intelligence, and People, Ethics & Interfaces are a reading of the catalogue.
   Every subject area's own document body says so on screen.
2. **Prerequisites stated as a choice.** "CPS 305 or COE 428" becomes one arrow
   to each. The graph has no way to say "or", and dropping either alternative
   would misreport the calendar. The exact published wording is kept in the
   course's document body so a reader can see what was actually said.
3. **The one-line blurbs under each topic.** A course outline gives a topic's
   *name* ("Parsing and grammars (9 hours)") and rarely more. The sentence under
   each one is written to explain the name. The names, the hour counts, the
   groupings and the order are the outline's.

## What the data cannot do, and why that is left visible

- **Nineteen courses have an outline; seventeen do not.** The seventeen are here
  because an outline names them as a prerequisite — without them the chains stop
  in mid-air. They carry a title and nothing else, and their document body says
  so in those words. They are not padding, and they are not pretending.
- **Two of the nineteen publish no topic breakdown at all** (CPS 803 and
  CPS 840). They do not open. This is reported rather than filled.
- **Some courses have no prerequisite and nothing depending on them** — CPS 714
  and CPS 831 state none, so they float. The hand-authored corpus guarantees no
  such orphans; real data does not, and the demo had to learn to survive that.
- **Seven prerequisites point outside Computer Science** (COE 428, MTH 210,
  MTH 304, MTH 314 and others). No Computer Science document describes them, so
  they carry a course code and no title.
- **CPS 840's outline is, apart from the number and the prerequisite line, the
  same document as CPS 803's** — "Selected Topics" was taught as Machine
  Learning that term. Both records say so.

## What loading it exposed in the app

The point of a second corpus is to find the places where the first one was being
assumed rather than read. Three, all now fixed:

- `src/model/nested.ts` marked every course-level territory as "not a leaf",
  which was true only because every hand-authored topic had children.
- `src/model/lens.ts` named one teaching-corpus node as its test hub and threw on
  import without it; it now picks the richest hub out of whatever data is loaded.
- The Walk Desk's opening road (`authordraft.ts`, `mockwalk.ts`) was a fixture of
  hand-written ids; it now builds the same shapes from the loaded corpus.

## Running the app on it

```
VITE_CORPUS=courses npm run dev
```

Unset means the hand-authored teaching corpus, which stays the default and is
the one every pinned test in the repo measures. `src/corpus/graph.ts` explains
why the switch is made at build time rather than while the app is running.

`node tools/studio-spike/browsertest-coursecorpus.mjs` opens the app against this
corpus in a real browser and fails if it does not come up.
