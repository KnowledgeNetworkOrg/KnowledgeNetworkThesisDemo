Everything the card and plan call for is in place, but none of it has been run: this checkout has no `node_modules`, so `tsc` and `vitest` couldn't run. I stopped there rather than run `npm ci`, since the check step builds and tests anyway. The browser driver and the two renamed drivers were never run either.

**What I changed:**
- **Choosing the corpus.** `src/corpus/graph.ts` has a new pure `parseCorpusName(search, buildDefault)` and an exported `CORPUS_NAMES`. `CORPUS_NAME` now comes from the address's `corpus` value when it is exactly `teaching` or `cs2023`. Otherwise it comes from `VITE_CORPUS`, then `teaching`. It reads `globalThis.location?.search`, so there is no import and no platform change. I rewrote the header, the `CORPUS_NAME` comment and the old "ternary leaves the other corpus out" note, since both corpora now ship in every build. I also changed "this build carries" to "this page shows" in the first-line comments of `docs.ts` and `walks.ts`.
- **Saved work per dataset.** New `src/state/corpuskey.ts` with `corpusKey(base, corpus = CORPUS_NAME)`. `teaching` keeps today's key and `cs2023` gets `base:cs2023`. It is used for `pkt.walks.saved` and `pkt.walkdesk.draft`. `notebookKey` in `lecturenotes.ts` now builds on `corpusKey(NOTES_KEY, corpus)`, so teaching stays `pkt.lecture.notes:draft` and cs2023 becomes `pkt.lecture.notes:cs2023:draft`. I left `legacyNotebookKey`, `copyPreparedOnce`, `sessionsKey`, categories, habits and prepared alone.
- **The switch.** New `src/studio/CorpusSwitch.tsx`: two small `PillButton`s inside `<span aria-label="studio-dataset">`, the current one `selected`. Pressing the other keeps the other query values, sets `corpus`, and reloads with `location.assign`. Pressing the current one does nothing. It is a third child of `AppHeader` in `StudioView.tsx`, and `AppHeader.tsx` is untouched.
- **Projector.** `projectorPath(corpus)` in `projector.ts` returns `?projector&corpus=<corpus>`. Both `platform.openWindow` calls in `StudioView.tsx` use it.
- **Tests.**
  - New: `corpusname.test.ts` and `corpuskey.test.ts`.
  - Extended: `projector.test.ts` and `lecturenotes.test.ts`. The existing teaching notebook rows are unchanged.
- **Browser drivers.** New `tools/studio-spike/browsertest-datasetswitch.mjs`. It checks:
  - teaching is marked with no `corpus` value;
  - a saved walk is absent on cs2023 and back with all its stops on return;
  - pressing the current dataset doesn't reload the page;
  - `?corpus=nonsense` opens teaching and the switch keeps `keep=1`;
  - starting a lecture on cs2023 opens a projector window whose address has `corpus=cs2023`.
  - In the two existing drivers, `browsertest-cs2023lists.mjs` now seeds `pkt.walks.saved:cs2023` and `browsertest-cs2023corpus.mjs` seeds `pkt.walkdesk.draft:cs2023`.
- **CLAUDE.md.** The "Two corpora" section now says both corpora ship in every build, the address wins over `VITE_CORPUS`, and saved work is per corpus. The card names this file, so the run will stop for your Allow.

**Assumptions:**
- **Store tests.** I didn't add cs2023-key tests to `walkstore.test.ts` or `draftpersist.test.ts`. Their `KEY` is fixed when the module loads, and under vitest it is always `teaching`'s. Their existing rows already assert the plain keys, and `corpusKey`'s own test covers the cs2023 form.
- **Matching and signatures.**
  - Matching is exact and lower case, so `Cs2023`, `courses` and an empty value fall through.
  - `projectorPath` takes a plain `string`, so `projector.ts` imports nothing from `corpus/`.
  - `notebookKey` has an optional third `corpus` argument so a test can ask for the cs2023 key.
- **The bundle size.** The before and after `npm run build` size for the PR text is not measured.
- **The driver's projector check.** In `browsertest-datasetswitch.mjs` I assume Enter on the start card works on cs2023 the way it does on teaching in `browsertest-presenter-start.mjs`. I couldn't confirm that here.