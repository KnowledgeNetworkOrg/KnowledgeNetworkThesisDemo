The change does everything the card asks, and I found nothing to fix. I could not run `npm run verify` or any browser driver, and the rail driver's cs2023 checks in particular rest on the earlier reviewer's run. I read the changed files and ran the card's done-when grep.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Open finding R1-2** (the plural "the other corpora" leftover) is fixed in both places it named:
- `tools/studio-spike/browsertest-cs2023marks.mjs:265` now ends "teaching does not".
- `src/model/standingnotice.test.ts:14` now reads "is null on teaching even when the sentence is there".

The tool refused my answer, because only the reviewer that raised R1-2 may answer it. So it still shows as claimed fixed until that reviewer confirms.

**What I checked against the card:**
- **Done-when grep:** it finds nothing over `src tools .github desktop package.json README.md CLAUDE.md`, and the grep exits 1. `tools/courseimport/` has no files left.
- **Corpus choice:**
  - `graph.ts:39–40` has `CorpusName = 'teaching' | 'cs2023'` and `CORPUS_NAME = … === 'cs2023' ? 'cs2023' : 'teaching'`.
  - `graph.ts:102`, `docs.ts:15` and `walks.ts:68` are two-way ternaries with cs2023 first.
  - The `graph.ts` header says "Two corpora ship", has no `courses` entry, and points at `VITE_CORPUS=cs2023`.
- **Dead code:**
  - `mockwalk.ts:131` builds `PLAN` as `teaching ? teachingPlan() : { title: 'An empty plan', stops: [] }`, with its doc comment reworded.
  - `authordraft.ts:15` and `:111` build `SEED` as `teaching ? teachingSeed() : cs2023Seed()`, and `topicIds` is gone from that import.
- **Tests:** `standingnotice.test.ts` now has four tests and its `'teaching'` case is intact. I read only that one of the four edited tests.
- **Browser drivers:** in `browsertest-relationsrail.mjs`, the header (L17–20) and the last section (L624–686) run on `withApp('cs2023', { VITE_CORPUS: 'cs2023' }, …)`. The kinds check is `see_also`, the wording says "unit", and all nine checks are kept. `browsertest-cs2023marks.mjs` has the "Teaching must not." header.
- **Comments and docs:** the `course corpus` and `courses` matches left in `src/` are the ones the card lets stay (`nested.ts:316`, `relations.test.ts:42`).

**Noticed outside this card's scope:**
- `src/instruments/DocumentPanel.tsx:31` says "The other corpora's walks stop on topics". With two corpora that means teaching alone. The card doesn't list it and the grep doesn't match it.
- `.kncode/locked-files` still lists `src/corpus/coursedata.ts` and `tools/courseimport/`. The card says to leave them.

Assumptions: I took the earlier reviewer's report that both browser drivers pass as true, since I could not run them. I treated `cs2023`'s TMU course routes as unrelated to the retired corpus.