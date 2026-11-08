I found nothing to fix, and the one open finding, R0-1, is resolved. I read the changed files and ran the typecheck and lint, but not `npm run verify`, the test suite or any browser driver. I didn't run the test suite or `npm run verify` because they write files, and this step may not.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Finding R0-1 (nit):** FIXED. `CLAUDE.md:42` now reads "will crash the *other* corpus on import". The section is retitled "Two corpora" and the `courses` bullet is gone.

**What I checked:**
- **Done-when grep:** it finds nothing over `src tools .github desktop package.json README.md CLAUDE.md`. The only matches in the whole repo are in `.kncode/` (the run's own notes and `.kncode/locked-files`), which are outside the grep's scope and which the card says to leave.
- **Deletions:** `tools/courseimport/` is gone, and so are `coursedata.ts`, `coursedocs.ts`, `coursewalks.ts`, `coursecorpus.test.ts` and `browsertest-coursecorpus.mjs`. `run-browsertests.mjs` finds drivers by folder listing, so no list needs editing.
- **Corpus choice:**
  - `graph.ts` has `CorpusName = 'teaching' | 'cs2023'` and `CORPUS_NAME = VITE_CORPUS === 'cs2023' ? 'cs2023' : 'teaching'`.
  - The `built` line is a two-way ternary with cs2023 first.
  - `DOC_BODY` and `WALKS` are two-way ternaries.
  - The `COURSES`, `COURSE_DOC` and `COURSE_WALKS` imports are gone.
  - The header says "Two corpora ship" and has no `courses` entry.
  - The `built` comment says "the other one".
- **Dead code:**
  - `planFromWalks` and its comment block are gone from `mockwalk.ts`.
  - `PLAN` is `CORPUS_NAME === 'teaching' ? teachingPlan() : { title: 'An empty plan', stops: [] }`, with its doc comment reworded.
  - `WALKS` and `byId` are still used there.
  - `genericSeed` is gone from `authordraft.ts`.
  - `SEED` is `teaching ? teachingSeed() : cs2023Seed()`, and `topicIds` is out of the import.
- **Tests:**
  - `lensmessage.test.ts` uses `'teaching'` and keeps `enclosingTitle: 'Anything'`.
  - `standingnotice.test.ts` and `visited.test.ts` lose only the repeated line.
  - `lecturenotes.test.ts` uses `'cs2023'`, which differs from `'teaching'` on the line above.
  - No test is dropped except `coursecorpus.test.ts`, which the card deletes.
- **Browser drivers:**
  - `browsertest-cs2023marks.mjs` loops over `['teaching']`, and its header says "Teaching must not."
  - `browsertest-relationsrail.mjs` runs its last section through `withApp('cs2023', { VITE_CORPUS: 'cs2023' }, …)`. The kinds check is `see_also`, the banner and check names say "unit" and cs2023, and nothing in the file mentions "course" any more.
  - I could not run either driver, so the card's note that all nine checks pass on cs2023 is the card's word, not mine.
- **Words:** `README.md` L37, `corpusbuild.ts` L4, `graphshape.ts` L5, `cs2023corpus.test.ts` L3, `flat.ts` L200, `generate.mjs` and `devserver.mjs` L24 (names `browsertest-cs2023corpus`) are all updated as the card lists.
- **Typecheck and lint:**
  - `tsc -p tsconfig.app.json --noEmit` passes, with `noUnusedLocals` on.
  - `eslint` on the changed `src` files and both changed drivers is clean.

**Noticed outside this card's scope:**
- `.kncode/locked-files` still lists `src/corpus/coursedata.ts` and `tools/courseimport/`. The card says to leave them.
- `src/model/nested.ts:316` and `src/instruments/relations.test.ts:42` still say "the course corpus", which the card lets stay.

Assumptions: I took the card's word that the relations-rail section passes on cs2023, since I did not run the browser drivers. I treated `cs2023`'s TMU course routes as unrelated to the retired corpus.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"CLAUDE.md:42 now reads \u0022will crash the *other* corpus on import\u0022. Checked in the file. The section is retitled \u0022Two corpora\u0022 and the \u0060courses\u0060 bullet is gone.","duplicateOf":null}]}
-->
