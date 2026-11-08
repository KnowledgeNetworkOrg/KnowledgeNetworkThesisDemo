I found no gaps against the card. All four open findings from round 0 are resolved, and I raised nothing new. This review was by reading the code, because this step is read-only and I could not run the tests, lint or browser drivers.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Answers on the open findings:**
- **R0-2: fixed.** `walkstore.test.ts` and `draftpersist.test.ts` each end with a per-corpus describe.
  - Each one mocks `corpuskey` to return `base + ':cs2023'` and re-imports the store.
  - It seeds the plain and `:cs2023` keys with different content and asserts the store reads only the `:cs2023` one.
  - A save lands under `:cs2023` and leaves the plain key untouched.
  - If either store stopped building its key through `corpusKey`, these tests would fail. The existing teaching rows are unchanged.
- **R0-3: fixed.** In `src/corpus/graph.ts` (L54-58) the doc comment now sits directly above `export const CORPUS_NAME`.
- **R0-4: fixed.**
  - `browsertest-datasetswitch.mjs` now has a `catch` that records "driver threw: …". The checks made before a throw still print, and the exit code is still 1.
  - The checks are numbered 1–6 in order, and the header comment lists the same six.
  - I could not run the driver here. The earlier full check passed it before this edit.
- **R0-5: dropped.** The fixer's reason holds.
  - `AppHeader`'s children span is `display:flex; gap:var(--space-2)`, so it spaces only its direct children, and the `studio-dataset` wrapper is one of them.
  - Inside a plain span the two `PillButton`s would sit with no space between them. The token-only `gap: var(--space-1)` separates them.
  - The card requires the literal wrapper span and forbids editing `AppHeader.tsx`. The style uses no raw colour or pixel value.

**What I checked against the card:**
- **Address parsing:** `parseCorpusName` and `CORPUS_NAMES` in `graph.ts` take no imports. The address wins over `VITE_CORPUS`, then `teaching`. `nonsense`, `courses`, other casing and an empty value fall through. The header and inline comments are updated, and the stale "ternary so the build can drop the other corpus" note is gone.
- **Layering:** `corpuskey.ts` is in `state/`, and `lecturenotes.ts` and `projector.ts` are in `present/`. The `MAY_IMPORT` table allows every import in the change, and nothing outside `platform/` touches `localStorage`.
- **Stored keys:** `corpusKey` is used for `pkt.walks.saved`, `pkt.walkdesk.draft` and `notebookKey`. `legacyNotebookKey`, `copyPreparedOnce`, `sessionsKey`, categories, habits and prepared are untouched. The existing teaching notebook rows are unchanged.
- **Projector:** `projectorPath` is called from both `openWindow` sites. `isProjectorLocation` still recognises the path.
- **Switch:** `CorpusSwitch` is the third child of `AppHeader`, wrapped in `studio-dataset`. The current pill is `selected`, and pressing it does nothing. Other query values are kept. `AppHeader.tsx` and `src/ds/**` are unchanged.
- **Drivers and docs:** the two existing drivers follow the key rename. Every hook the new driver uses exists in `src/` or the registry. Its `startVite()` call has no `VITE_CORPUS`, and it uses no literal port. `CLAUDE.md` is updated as the card names it.

**Noticed outside this card's scope:** none.

Assumptions: I took `projectorPath(corpus: string)` as acceptable, since the plan chose it to avoid a value import from `corpus/`. I took the card's bundle-growth, projector known-limit and unchanged-keys statements as PR text, which this diff cannot hold. The last full check only measured the after figure (main bundle 1,604.26 kB, 396.51 kB gzip). The PR author still has to build the base commit to give the before figure.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-2","answer":"Fixed","because":"Both \u0060src/state/walkstore.test.ts\u0060 and \u0060src/state/walk/draftpersist.test.ts\u0060 now end with a per-corpus describe. Each one mocks \u0060corpuskey\u0060 to return \u0060base \u002B \u0027:cs2023\u0027\u0060 and re-imports the store. It seeds the plain and \u0060:cs2023\u0060 keys with different content and asserts the store reads only the \u0060:cs2023\u0060 one. A save lands under \u0060:cs2023\u0060 and leaves the plain key untouched. If either store stopped building its key through \u0060corpusKey\u0060, these tests would fail. The existing teaching rows are unchanged.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"In \u0060src/corpus/graph.ts\u0060 (L54-58) the \u0060/** which corpus this page is showing ... */\u0060 doc comment now sits directly above \u0060export const CORPUS_NAME\u0060. \u0060buildEnv\u0060 and \u0060pageAddress\u0060 are declared before it.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"\u0060tools/studio-spike/browsertest-datasetswitch.mjs\u0060 now has a \u0060catch\u0060 that records \u0022driver threw: ...\u0022, so the checks made before a throw still print after the \u0060finally\u0060, and the exit code is still 1. The checks are numbered 1-6 in order, and the header comment lists the same six. I could not run the driver in this read-only step. The earlier full check passed on the driver before this edit.","duplicateOf":null},{"id":"R0-5","answer":"Dropped","because":"I accept the fixer\u0027s reason. \u0060AppHeader\u0060\u0027s children span is \u0060display:flex; gap: var(--space-2)\u0060, so it spaces only its direct children. The \u0060studio-dataset\u0060 wrapper is one such child. Without the token-only \u0060gap: var(--space-1)\u0060, the two \u0060PillButton\u0060s would sit side by side with no space between them. The card requires the literal \u0060\u003Cspan aria-label=\u0022studio-dataset\u0022\u003E\u0060 wrapper and forbids editing \u0060AppHeader.tsx\u0060. The style uses no raw colour or pixel value, and the \u0022cleaner still\u0022 line in the card is a preference, not a requirement.","duplicateOf":null}]}
-->
