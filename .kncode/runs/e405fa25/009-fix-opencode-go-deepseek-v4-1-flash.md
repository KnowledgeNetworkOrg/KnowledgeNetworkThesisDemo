1. **R0-3** — fixed: `src/instruments/TrailStrip.tsx:36-37` now says the last entry for a code decides, matching how the `Map` is built.
2. **R0-4** — fixed: `src/corpus/cs2023corpus.test.ts:206` now asserts `w.buildsOn` is `undefined` for routes with no rows, so an empty array on the other 13 routes fails.

Nothing else was raised. Narrow check run: `npx vitest run src/corpus/cs2023corpus.test.ts` — 20 tests passed.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-3","answer":"Fixed","because":"src/instruments/TrailStrip.tsx:36-37 now says the last entry for a code decides, which matches Map construction.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"src/corpus/cs2023corpus.test.ts:206 now asserts buildsOn is undefined for the 13 routes with no rows.","duplicateOf":null}]}
-->
