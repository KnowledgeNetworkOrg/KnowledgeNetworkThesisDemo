The change does everything the card asks, and I found nothing that blocks it. `npm run verify` passes (75 test files, 1035 tests), the done-when search finds nothing, and `tools/courseimport/` is gone.

Checked against the code:
- **Corpus choice:** `graph.ts:39–40` and `:102`, `docs.ts:15` and `walks.ts:68` are two-way, cs2023 first, and the `COURSES` / `COURSE_DOC` / `COURSE_WALKS` imports are gone.
- **Removed code:**
  - `mockwalk.ts:131` builds `PLAN` with no `planFromWalks`, and its doc comment is reworded.
  - `authordraft.ts:15` and `:111` build `SEED` with no `genericSeed`, and `topicIds` is dropped from that file's import.
- **Deleted files:** the four `src/corpus/course*` files and `browsertest-coursecorpus.mjs` are gone.
- **The four tests:**
  - `lensmessage.test.ts:24` now uses `'teaching'` with `enclosingTitle: 'Anything'`.
  - `standingnotice.test.ts` and `visited.test.ts` each lost only the repeated line.
  - `lecturenotes.test.ts:491` now uses `'cs2023'`.
- **Browser drivers:**
  - In `browsertest-cs2023marks.mjs`, the loop is `['teaching']` and the header says "Teaching must not."
  - In `browsertest-relationsrail.mjs`, the header and the last section now run on cs2023 and check `see_also`, and its checks are all still there.
  - I ran both drivers. `browsertest-relationsrail.mjs` printed "all checks passed", including the one-kind and no-relationship checks, now on cs2023. `browsertest-cs2023marks.mjs` printed its PASS line.
- **Comments and docs:** `corpusbuild.ts`, `graphshape.ts`, `cs2023corpus.test.ts`, `flat.ts:199–200`, `generate.mjs`, `devserver.mjs:24` (`browsertest-cs2023corpus`, which exists), `README.md:37` and `CLAUDE.md` are all updated.
- **R0-1:** `CLAUDE.md:42` now reads "the *other* corpus". The tool lets only the reviewer that raised it answer it, so it is not recorded as answered from here.

Must fix:
none

Optional:
none

Nit:
1. `tools/studio-spike/browsertest-cs2023marks.mjs:265`: the pass message still ends "the other corpora do not", but the loop now covers only teaching. The test title at `src/model/standingnotice.test.ts:14`, "is null on the other corpora", has the same leftover plural. Wording only.

Assumptions: I did not run the full `npm run test:browser`, only the two drivers the card names. The card's `CLAUDE.md` edit and the one-word R0-1 fix are left for the owner's Allow, as the card says.

<!-- kncode-findings
{"reports":[{"id":"R1-2","raisedAgain":false,"bucket":"Nit","what":"The pass message still says \u0022the other corpora do not\u0022, but the loop now covers only teaching. It could read \u0022teaching does not\u0022, to match the header the card rewrote (\u0022Teaching must not.\u0022). The test title at src/model/standingnotice.test.ts:14, \u0022is null on the other corpora\u0022, has the same leftover plural.","file":"tools/studio-spike/browsertest-cs2023marks.mjs","line":265,"breaks":"Wording only: after the card retires courses, \u0022the other corpora\u0022 describes a single corpus, teaching. No behaviour is affected.","failure":null}],"answers":[]}
-->
