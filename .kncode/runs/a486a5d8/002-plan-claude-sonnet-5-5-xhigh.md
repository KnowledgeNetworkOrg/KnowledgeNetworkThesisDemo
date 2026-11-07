I've read every file the card names. Nothing is edited yet, and `planFromWalks` and `genericSeed` have no other callers. The plan is below.

1. **`src/corpus/graph.ts`:**
   - Drop the `COURSES` import.
   - Make `CorpusName` `'teaching' | 'cs2023'`.
   - Make `CORPUS_NAME` `VITE_CORPUS === 'cs2023' ? 'cs2023' : 'teaching'`.
   - Make the `built` line `CORPUS_NAME === 'cs2023' ? CS2023 : TEACHING`, and change "the other two" to "the other one".
   - Rewrite the header: "Two corpora ship", no `courses` entry, and `VITE_CORPUS=cs2023` in the "CHOOSING ONE" paragraph.
2. **`docs.ts` and `walks.ts`:**
   - Make `DOC_BODY` and `WALKS` two-way ternaries, cs2023 first.
   - Drop the `COURSE_DOC` and `COURSE_WALKS` imports.
   - Fix the header comments ("three sets", the file names, the importer).
3. **`src/state/walk/mockwalk.ts`:**
   - Delete `planFromWalks()` and the "A seed for any other corpus" comment block.
   - Make `PLAN` `CORPUS_NAME === 'teaching' ? teachingPlan() : { title: 'An empty plan', stops: [] }`, and reword its doc comment.
   - Keep the `WALKS` import, because `groupFromWalk` still uses it.
4. **`src/state/walk/authordraft.ts`:**
   - Delete `genericSeed()`.
   - Make `SEED` `CORPUS_NAME === 'teaching' ? teachingSeed() : cs2023Seed()`.
   - Drop `topicIds` from the graph import, since `noUnusedLocals` would otherwise fail the build.
5. **Delete the dead files:**
   - `src/corpus/coursedata.ts`, `coursedocs.ts`, `coursewalks.ts` and `coursecorpus.test.ts`.
   - `tools/courseimport/` whole.
   - `tools/studio-spike/browsertest-coursecorpus.mjs`.
6. **Four tests that pass `'courses'`:**
   - `lensmessage.test.ts:24`: change `'courses'` to `'teaching'` and keep `enclosingTitle: 'Anything'`.
   - `standingnotice.test.ts:16` and `visited.test.ts:17`: delete only that one repeated line. Each test and its `'teaching'` line stay.
   - `lecturenotes.test.ts:491`: change `'courses'` to `'cs2023'`, so the key still differs from the `'teaching'` one on line 490.
7. **`browsertest-cs2023marks.mjs`:**
   - Make the L238 loop `['teaching']` only.
   - Change the L11 header to "Teaching must not."
8. **`browsertest-relationsrail.mjs`, last section (L624 to the end):**
   - Change `withApp('courses', { VITE_CORPUS: 'courses' }, …)` to `withApp('cs2023', { VITE_CORPUS: 'cs2023' }, …)`.
   - Change the kinds check to `see_also`.
   - Rename the banner, the check names and the L16–20 header comment: "course corpus" becomes `cs2023`, `depends_on` becomes `see_also`, and "course" becomes "unit".
   - Keep all 9 checks, with no weakening.
9. **Stale words:**
   - Comments: `corpusbuild.ts` L4, `graphshape.ts` L5, `cs2023corpus.test.ts` L3, `flat.ts` L200 (just the teaching corpus, 6 domains), `tools/cs2023import/generate.mjs` L11, and `devserver.mjs` L24 (name `browsertest-cs2023corpus`).
   - Docs: `README.md` L37 gets "the two corpora (teaching, hand-authored; cs2023, generated)". `CLAUDE.md` becomes "Two corpora" with the `courses` bullet removed.
   - `CLAUDE.md` is locked, so the run will stop for the owner's Allow.
   - Any line that records history gets written in plain words so the done-when grep stays empty.
10. **Verify:**
    - Run the done-when grep over `src tools .github desktop package.json README.md CLAUDE.md` and confirm it returns nothing.
    - Run `npm run verify`, then the three browser drivers.

Files: `src/corpus/graph.ts`, `src/corpus/docs.ts`, `src/corpus/walks.ts`, `src/corpus/corpusbuild.ts`, `src/corpus/graphshape.ts`, `src/corpus/cs2023corpus.test.ts`, `src/model/flat.ts`, `src/state/walk/mockwalk.ts`, `src/state/walk/authordraft.ts`, `src/model/lensmessage.test.ts`, `src/model/standingnotice.test.ts`, `src/model/visited.test.ts`, `src/present/lecturenotes.test.ts`, `tools/studio-spike/browsertest-cs2023marks.mjs`, `tools/studio-spike/browsertest-relationsrail.mjs`, `tools/studio-spike/devserver.mjs`, `tools/cs2023import/generate.mjs`, `README.md`, `CLAUDE.md`. Deleted: `src/corpus/coursedata.ts`, `coursedocs.ts`, `coursewalks.ts`, `coursecorpus.test.ts`, `tools/courseimport/` (`courses.json`, `extract.py`, `generate.mjs`, `README.md`), `tools/studio-spike/browsertest-coursecorpus.mjs`.

Out of scope: the on-screen dataset switch (the next card); the `teaching` corpus; any change to what `cs2023` shows; `.kncode/locked-files` (its stale entries do no harm).

Verify: `VITE_CORPUS=courses` is now treated as an unknown value, so the app opens on `teaching`. `VITE_CORPUS=cs2023` still opens the CS2023 app. The relations-rail driver's one-kind and no-relationship checks pass on `cs2023`.
```
npm run verify
node tools/studio-spike/browsertest-relationsrail.mjs
node tools/studio-spike/browsertest-cs2023marks.mjs
npm run test:browser
grep -rnE "coursedata|coursedocs|coursewalks|courseimport|coursecorpus|COURSE_(DOC|WALKS)|\bCOURSES\b|VITE_CORPUS=courses|'courses'" src tools .github desktop package.json README.md CLAUDE.md --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=out
```
The last grep must print nothing. `tools/courseimport/` must no longer exist.

Assumptions:
- `WALKS` stays imported in `mockwalk.ts` because `groupFromWalk` uses it.
- Any line I keep that records the history says it in plain words, with no retired file names.
- I leave `.kncode/locked-files` alone, as the card says.
- The owner will Allow the `CLAUDE.md` edit when the run stops for it.