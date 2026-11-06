Nothing was under Must fix or Optional.

1. **R1-7** — fixed. `src/instruments/LensPane.tsx:300` now guards the id with `CORPUS_NAME === 'cs2023'`, and `src/model/lensmessage.ts:17-18` says "this place" instead of "this stop" (the lens centre is any focused node). `src/model/lensmessage.test.ts` pins both sentences.
2. **R1-8** — fixed. `src/instruments/DocumentPanel.tsx:265` now reads "secondary tags". The stop-position check moved into `secondaryTagsAt` in `src/model/stopsecondary.ts`, called at `DocumentPanel.tsx:223`, with unit coverage in `src/model/stopsecondary.test.ts` (the stop that carries the list, an earlier stop on the same node, a cursor on another node, no active walk/cursor).

`npx vitest run` on the three affected test files passed (3 files, 12 tests).

Assumptions: none.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R1-7","answer":"Fixed","because":"src/instruments/LensPane.tsx:300 now reads \u0060isScience: CORPUS_NAME === \u0027cs2023\u0027 \u0026\u0026 focus === \u0027X-Science\u0027\u0060, so the literal is guarded by the corpus name. src/model/lensmessage.ts:17-18 says \u0022this place\u0022 rather than \u0022this stop\u0022, because the lens centre is any focused node; src/model/lensmessage.test.ts pins both strings.","duplicateOf":null},{"id":"R1-8","answer":"Fixed","because":"src/instruments/DocumentPanel.tsx:265 labels the section \u0022secondary tags\u0022. The cursor-position rule now lives in \u0060secondaryTagsAt\u0060 (src/model/stopsecondary.ts), called at DocumentPanel.tsx:223, and src/model/stopsecondary.test.ts covers the carrying stop, an earlier stop on the same node, a cursor on another node, and no active walk/cursor.","duplicateOf":null}]}
-->
