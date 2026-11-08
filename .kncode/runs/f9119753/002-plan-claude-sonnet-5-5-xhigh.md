1. Add `parseCorpusName(search, buildDefault)` to `src/corpus/graph.ts`. It is a pure function that returns the `corpus` query value only if it is exactly `teaching` or `cs2023`. Any other value falls through to `VITE_CORPUS`, then to `teaching`. Export `CORPUS_NAMES`, then set `CORPUS_NAME = parseCorpusName(globalThis.location?.search ?? '', buildEnv?.VITE_CORPUS)`. It takes no imports and no platform seam. Keep `CORPUS_NAME` a ternary-free constant. Rewrite the header paragraph (L18-22) and the comments at L33-34 and L99-101 to say both corpora ship in every build and the choice is made at run time.
2. Add `src/corpus/corpusname.test.ts` covering no value, `corpus=cs2023`, `corpus=teaching`, `corpus=nonsense`, `corpus=courses`, uppercase and other query values around it. Also check the `VITE_CORPUS` fallback and that the address wins over it.
3. Add `src/state/corpuskey.ts` with `corpusKey(base, corpus = CORPUS_NAME)`. It returns `base` for `teaching` and `base + ':' + corpus` otherwise. Add `corpuskey.test.ts` beside it.
4. Use `corpusKey` for the stored keys:
   - `KEY` in `src/state/walkstore.ts`.
   - `KEY` in `src/state/walk/draftpersist.ts`.
   - `notebookKey` in `src/present/lecturenotes.ts`, built as `corpusKey(NOTES_KEY) + ':' + …`.
   - Leave `legacyNotebookKey`, `copyPreparedOnce`, `sessionsKey`, categories, habits and prepared as they are.
   - Give `notebookKey` an optional third `corpus` parameter, so a test can ask for the cs2023 key.
5. Extend `walkstore.test.ts`, `draftpersist.test.ts` and `lecturenotes.test.ts`. The existing teaching rows stay and pass. New rows assert that the cs2023 key is `…:cs2023`, and that the teaching key is today's.
6. In `src/present/projector.ts`, add a pure `projectorPath(corpus)` that returns `'?' + PROJECTOR_QUERY + '&corpus=' + corpus`. Call it from both `platform.openWindow` calls in `StudioView.tsx` (L351 and L373). Test it in `projector.test.ts`, including that `isProjectorLocation` still recognises the path.
7. Create `src/studio/CorpusSwitch.tsx`. It wraps two `PillButton`s from `@/ds`, `teaching` and `cs2023`, in `<span aria-label="studio-dataset">`, with the current one `selected`. It uses no raw colours or pixels. Pressing the other one builds the address from `new URLSearchParams(window.location.search)`, sets `corpus`, and calls `window.location.assign`. Pressing the current one does nothing. Draw it as a third child of `AppHeader` in `StudioView.tsx`, and do not edit `AppHeader.tsx`.
8. Write `tools/studio-spike/browsertest-datasetswitch.mjs` with `startVite()` and no `VITE_CORPUS`. The runner collects it by its prefix, so `browsertestguard.test.ts` accepts it. It checks:
   - A page with no `corpus` value shows `teaching`, with the header pill pressed.
   - A walk seeded under `pkt.walks.saved` survives a switch to cs2023 and back, and is absent while cs2023 is showing.
   - `?corpus=nonsense` opens `teaching`.
   - Starting a lecture from cs2023 (toolbar ▶, then Enter) opens a projector window whose address carries `corpus=cs2023`.
   - It uses no literal port.
9. Update the two existing drivers. `browsertest-cs2023lists.mjs` L127 changes to `pkt.walks.saved:cs2023`, and its later teaching page keeps the plain key. `browsertest-cs2023corpus.mjs` L181 changes to `pkt.walkdesk.draft:cs2023`.
10. Update `CLAUDE.md` "Two corpora": choose by address (`?corpus=cs2023`) or by `VITE_CORPUS`, the address wins, and both ship in every build. This file is locked, so the run will stop for the owner to Allow.
11. Run `npm run build` before and after the change and note how much the main bundle grew. Then run `npm run verify` and the browser drivers. The PR text gets the bundle growth, the projector known limit and the list of keys left as they are.

Files: `src/corpus/graph.ts`, `src/corpus/corpusname.test.ts` (new), `src/state/corpuskey.ts` (new), `src/state/corpuskey.test.ts` (new), `src/state/walkstore.ts`, `src/state/walkstore.test.ts`, `src/state/walk/draftpersist.ts`, `src/state/walk/draftpersist.test.ts`, `src/present/lecturenotes.ts`, `src/present/lecturenotes.test.ts`, `src/present/projector.ts`, `src/present/projector.test.ts`, `src/studio/CorpusSwitch.tsx` (new), `src/studio/StudioView.tsx`, `tools/studio-spike/browsertest-datasetswitch.mjs` (new), `tools/studio-spike/browsertest-cs2023lists.mjs`, `tools/studio-spike/browsertest-cs2023corpus.mjs`, `CLAUDE.md`

Out of scope: Switching without a reload. Showing two datasets side by side or overlaid. Loading a dataset from a file (all still open on #349). The `courses` corpus (retired by #519/#521). Moving or converting work already saved. Splitting `pkt.lecture.prepared`. Also not to be touched: `AppHeader.tsx` or any other `src/ds/**` port, the platform seam (`Platform` types), any `desktop/` change, any `localStorage` access outside `readPersisted`/`writePersisted`, and the `pkt.lecture.sessions`, `categories`, `habits` and `prepared` keys. Loading a corpus on demand and the bigger first load are accepted, not fixed here.

Verify: Start `npm run dev` with no `VITE_CORPUS` and open the app. It shows `teaching`, with the header's `teaching` pill pressed. Save a walk, then press the `cs2023` pill. The address becomes `?corpus=cs2023`, the cs2023 routes appear, and the saved walk is gone. Press `teaching` and the walk is back with all its stops. `?corpus=nonsense` opens `teaching`. Starting a lecture from cs2023 opens a projector window at `?projector&corpus=cs2023`. `node tools/studio-spike/browsertest-datasetswitch.mjs` automates this.
```
npm run verify
node tools/studio-spike/browsertest-datasetswitch.mjs
node tools/studio-spike/browsertest-cs2023lists.mjs
node tools/studio-spike/browsertest-cs2023corpus.mjs
npm run test:browser
```

Assumptions:
- `projectorPath(corpus)` takes the corpus as an argument, and `StudioView` passes `CORPUS_NAME`. That keeps `projector.ts` free of a value import from `corpus/`.
- `notebookKey` gets an optional `corpus` argument defaulting to `CORPUS_NAME`, so the cs2023 key can be unit-tested. `CORPUS_NAME` is a fixed `teaching` constant under vitest. Existing callers are unchanged.
- The walkstore and draft cs2023 keys are covered by `corpusKey` tests and by the browser driver. I won't add module-mocking unit tests for them, because the card only requires that the existing teaching rows still pass.
- "Known corpus" matching is exact and lower case. `Cs2023`, `courses` and the empty string all fall through to `VITE_CORPUS`, then to `teaching`.
- The switch reads `window.location` directly in the component, as the card specifies. It is the only new place outside `platform/` that touches the address.
- The bundle growth is measured with `npm run build`, once on the base commit and once after. It goes in the PR text, not in code.