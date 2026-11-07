The app now knows two corpora, `teaching` and `cs2023`, and `courses` is gone. I couldn't run the typecheck or any test: this worktree has no `node_modules`, so `tsc` and `vitest` don't resolve. I ran only the done-when grep, which prints nothing, and `tools/courseimport/` no longer exists. `npm run verify` and the three browser drivers haven't been run.

- **Corpus choice.**
  - **`graph.ts`:** `CorpusName` is `'teaching' | 'cs2023'`. `CORPUS_NAME` is `VITE_CORPUS === 'cs2023' ? 'cs2023' : 'teaching'`, so `VITE_CORPUS=courses` falls through to `teaching`. The `COURSES` import is gone and the `built` line is a two-way ternary. The header now says "Two corpora ship", and the "other two" comment now reads "the other one".
  - **`docs.ts` and `walks.ts`:** `DOC_BODY` and `WALKS` are two-way ternaries, cs2023 first, with the course imports dropped and the header comments reworded.
- **Dead code.**
  - **`mockwalk.ts`:** I removed `planFromWalks()` and its comment block. `PLAN` is now `CORPUS_NAME === 'teaching' ? teachingPlan() : { title: 'An empty plan', stops: [] }`.
  - **`authordraft.ts`:** I removed `genericSeed()`. `SEED` is now `CORPUS_NAME === 'teaching' ? teachingSeed() : cs2023Seed()`, and `topicIds` is dropped from its graph import.
  - **Deleted files:** `coursedata.ts`, `coursedocs.ts`, `coursewalks.ts`, `coursecorpus.test.ts`, `tools/courseimport/` and `browsertest-coursecorpus.mjs`.
- **Tests.**
  - `lensmessage.test.ts` now passes `'teaching'` and keeps `enclosingTitle: 'Anything'`.
  - `standingnotice.test.ts` and `visited.test.ts` lose only the repeated `'courses'` line.
  - `lecturenotes.test.ts` uses `'cs2023'` for the second `sessionsKey`, so it still differs from the `'teaching'` key.
- **Browser drivers.**
  - **`browsertest-cs2023marks.mjs`:** the loop is `['teaching']` only, and the header says "Teaching must not."
  - **`browsertest-relationsrail.mjs`:** the last section now runs on `cs2023` via `withApp('cs2023', { VITE_CORPUS: 'cs2023' }, …)`, and the kinds check expects `see_also`. All nine checks are kept. The banner, the check names and the header comment now say cs2023, `see_also` and "unit".
- **Words.**
  - **Docs:** `README.md` L37 now reads "the two corpora (teaching, hand-authored; cs2023, generated)". `CLAUDE.md` is retitled "Two corpora" with the `courses` bullet removed.
  - **Comments:** I updated `corpusbuild.ts`, `graphshape.ts`, `cs2023corpus.test.ts`, `flat.ts`, `tools/cs2023import/generate.mjs` and `devserver.mjs` (which now names `browsertest-cs2023corpus`).

Assumptions:
- **`CLAUDE.md`:** it is locked, so the run should stop at the owner's Allow/Drop for it. I made only the two changes the card names.
- **`CLAUDE.md` wording not changed:** the paragraph after the list still says a corpus-id literal "will crash the *other* corpora". It should now read "corpus", but the card didn't ask for that change.
- **Check names in the rail driver:** I wrote "a unit with N relationships draws N marks" and "a unit that has no "see also" link and that nothing links to…". The card only said "course" becomes "unit", and "prerequisites" would be wrong for `see_also` links. Only the check text changed.
- **`.kncode/locked-files`:** left alone, as the card says; its `coursedata.ts` and `tools/courseimport/` entries are now stale but harmless.
- **`graphshape.ts` and `corpusbuild.ts`:** their "second corpus" comments now name `cs2023data.ts`.