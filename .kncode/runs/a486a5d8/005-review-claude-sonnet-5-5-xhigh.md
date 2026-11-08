I found no gaps against the card. I could not run `npm run verify` or any browser driver: the worktree has no `node_modules`, and I may not install or run those. I checked by reading the changed files and running the card's grep. The verdict is PASS, with one wording nit.

**Must fix:**
none

**Optional:**
none

**Nit:**
1. `CLAUDE.md:42`: the paragraph after the corpus list still says a corpus-id literal "will crash the *other* corpora". With two corpora it should read "the other corpus". The card doesn't ask for this edit, so it is wording only.

**What I checked against the card:**
- **Done-when grep:** it returns nothing over `src tools .github desktop package.json README.md CLAUDE.md`. `tools/courseimport/` is gone, and so are `coursedata.ts`, `coursedocs.ts`, `coursewalks.ts`, `coursecorpus.test.ts` and `browsertest-coursecorpus.mjs`.
- **Corpus choice:**
  - `graph.ts` has `CorpusName = 'teaching' | 'cs2023'`.
  - `CORPUS_NAME` is `VITE_CORPUS === 'cs2023' ? 'cs2023' : 'teaching'`.
  - `built` is a two-way ternary with cs2023 first.
  - The comment reads "the other one".
  - The header is rewritten and no longer mentions `courses`.
  - `DOC_BODY` and `WALKS` are two-way ternaries, and the course imports are dropped.
- **Dead code:**
  - `mockwalk.ts` has no `planFromWalks`, and `PLAN` is `teaching ? teachingPlan() : { title: 'An empty plan', stops: [] }`. `WALKS` stays imported because `groupFromWalk` uses it.
  - `authordraft.ts` has no `genericSeed`, `SEED` is `teaching ? teachingSeed() : cs2023Seed()`, and `topicIds` is gone from its imports.
  - Nothing else calls either function.
- **Tests:**
  - `lensmessage.test.ts` now uses `'teaching'` and keeps `enclosingTitle: 'Anything'`.
  - `standingnotice.test.ts` and `visited.test.ts` lose only the repeated line.
  - `lecturenotes.test.ts` uses `'cs2023'`, which differs from the `'teaching'` key.
  - No test is dropped except `coursecorpus.test.ts`, which the card deletes.
- **Browser drivers:**
  - `browsertest-cs2023marks.mjs` loops over `['teaching']` and its header says "Teaching must not."
  - `browsertest-relationsrail.mjs` runs its last section on `cs2023` with the kinds check on `see_also`, and all nine checks are kept. The header, banner and check names say cs2023, `see_also` and "unit".
  - `devserver.mjs` names `browsertest-cs2023corpus`.
- **Words:** `README.md` L37, `CLAUDE.md` ("Two corpora", `courses` bullet removed), and the comments in `corpusbuild.ts`, `graphshape.ts`, `cs2023corpus.test.ts`, `flat.ts` and `tools/cs2023import/generate.mjs` are updated as the card lists.

**Noticed outside this card's scope:**
- `src/model/nested.ts:316` and `src/instruments/relations.test.ts:42` still say "the course corpus", which no longer exists. The card lets these stay.
- `.kncode/locked-files` still lists `src/corpus/coursedata.ts` and `tools/courseimport/`. The card says to leave them.

Assumptions: I treated "the TMU courses" mentions in `cs2023`-related comments as unrelated to the retired corpus. I took the previous step's claim that the nine rail checks pass on `cs2023` from the card's own note, since I could not run the driver.

<!-- kncode-findings
{"reports":[{"id":"R0-1","raisedAgain":false,"bucket":"Nit","what":"The paragraph after the corpus list still says a corpus-id literal \u0022will crash the *other* corpora\u0022. With two corpora there is only one other, so it should read \u0022the other corpus\u0022. Wording only.","file":"CLAUDE.md","line":42,"breaks":"The card retitles the section to \u0022Two corpora\u0022 and drops the \u0060courses\u0060 bullet, but does not mention this paragraph. The plural \u0022other corpora\u0022 now describes a single corpus. No behaviour is affected.","failure":null}],"answers":[]}
-->
