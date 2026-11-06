1. **R2-9** — fixed: widened `secondaryTagsAt`'s `walk` parameter to `| null | undefined` at `src/model/stopsecondary.ts:10`, so `walkById`'s `Walk | undefined` is accepted. `npx tsc -p tsconfig.app.json --noEmit --incremental false` passes.
2. **R2-10** — duplicate of R2-9; same type error at `src/instruments/DocumentPanel.tsx:223`, fixed once in the helper.

No other Must fix, Optional or Nit findings were open.

Assumptions: none.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-9","answer":"Fixed","because":"Widened \u0060secondaryTagsAt\u0060\u0027s \u0060walk\u0060 parameter to \u0060| null | undefined\u0060 in src/model/stopsecondary.ts:10, which accepts walkById\u0027s \u0060Walk | undefined\u0060. \u0060npx tsc -p tsconfig.app.json --noEmit --incremental false\u0060 now reports no errors.","duplicateOf":null},{"id":"R2-10","answer":"Duplicate","because":"Same type error at the same call site; fixed once by widening the helper parameter.","duplicateOf":"R2-9"}]}
-->
