One new Must fix: the round-1 fix breaks the typecheck. The verdict is REVISE.

I ran `npx tsc -p tsconfig.app.json --noEmit --incremental false`, which writes nothing, so no files changed. I did not run the browser driver or the unit tests.

Must fix:
1. `src/instruments/DocumentPanel.tsx:223` — `secondaryTagsAt(activeWalk, …)` receives `Walk | null | undefined`, but its `walk` parameter is typed `… | null`.
   - **Cause:** `walkById` returns `Walk | undefined`, and `bus.activeWalk ? walkById(...) : null` keeps the `undefined`.
   - **Error:** `error TS2345: Argument of type 'Walk | null | undefined' is not assignable to parameter of type '{ stops: ... } | null'`, with `strict: true`.
   - **Card line broken:** "`npm run verify` passes". `verify` builds with a typecheck, so it fails.
   - **How it got through:** the previous step ran only vitest, which does not typecheck.
   - **Fix:** let `secondaryTagsAt` accept `undefined` (`| null | undefined` in `src/model/stopsecondary.ts`), or write `walkById(...) ?? null` at the call site.

Optional:
none

Nit:
none

Open findings:
- **R1-7:** FIXED. `LensPane.tsx:300` is now guarded by `CORPUS_NAME === 'cs2023'`, `lensmessage.ts` says "this place", and `lensmessage.test.ts` pins both sentences.
- **R1-8:** FIXED. The label reads "secondary tags", and the stop-position rule is in `secondaryTagsAt` with unit tests. The call site does not typecheck, which is the Must fix above.

Noticed outside this card's scope: nothing.

Assumptions: I treated a typecheck failure as a Must fix because the card lists `npm run verify` as its first done-when line and `verify` includes the typecheck.

<!-- kncode-findings
{"reports":[{"id":"R2-9","raisedAgain":false,"bucket":"MustFix","what":"DocumentPanel.tsx:223 passes \u0060Walk | null | undefined\u0060 to \u0060secondaryTagsAt\u0060, whose \u0060walk\u0060 parameter is typed \u0060... | null\u0060, so it does not typecheck. \u0060walkById\u0060 returns \u0060Walk | undefined\u0060, and the ternary \u0060bus.activeWalk ? walkById(...) : null\u0060 keeps the \u0060undefined\u0060. \u0060npx tsc -p tsconfig.app.json --noEmit --incremental false\u0060 reports \u0022DocumentPanel.tsx(223,43): error TS2345: Argument of type \u0027Walk | null | undefined\u0027 is not assignable to parameter of type \u0027{ stops: ... } | null\u0027\u0022, with \u0060strict: true\u0060 in tsconfig.app.json. The R1-8 fix introduced it. Accept \u0060undefined\u0060 in \u0060secondaryTagsAt\u0060, or write \u0060walkById(...) ?? null\u0060.","file":"src/instruments/DocumentPanel.tsx","line":223,"breaks":"Card done-when: \u0022\u0060npm run verify\u0060 passes\u0022. verify builds with a typecheck, so it fails. The previous step ran only vitest, which does not typecheck.","failure":null}],"answers":[{"id":"R1-7","answer":"Fixed","because":"LensPane.tsx:300 now reads \u0060CORPUS_NAME === \u0027cs2023\u0027 \u0026\u0026 focus === \u0027X-Science\u0027\u0060, and lensmessage.ts says \u0022this place\u0022 instead of \u0022this stop\u0022. lensmessage.test.ts pins both sentences.","duplicateOf":null},{"id":"R1-8","answer":"Fixed","because":"The section label at DocumentPanel.tsx:265 now says \u0022secondary tags\u0022, and the stop-position rule is in \u0060secondaryTagsAt\u0060 (src/model/stopsecondary.ts) with unit tests. The call site does not typecheck; that is raised as a new Must fix.","duplicateOf":null}]}
-->
