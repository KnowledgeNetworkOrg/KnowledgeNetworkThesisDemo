The change doesn't pass `npm run verify` yet: one new type error in `DocumentPanel.tsx` breaks the typecheck, which also blocks the build. I ran `npx tsc -b --noEmit` and got that one error. The previous step ran only `vitest`, which doesn't typecheck, so it went unseen.

**Must fix:**
1. (new) `src/instruments/DocumentPanel.tsx:223` gives `error TS2345: Argument of type 'Walk | null | undefined' is not assignable to parameter of type '{ stops: … } | null'`.
   - **Cause:** `walkById` can return `undefined`, but `secondaryTagsAt` (`src/model/stopsecondary.ts:10`) accepts only a walk or `null`.
   - **Effect:** the typecheck and `vite build` steps of `npm run verify` fail. That breaks the card's line "`npm run verify` passes".
   - **Fix:** either widen the helper's parameter to accept `| null | undefined`, or write `walkById(bus.activeWalk.walkId) ?? null` at the call site.

**Optional:**
none

**Nit:**
none

I checked the two round-1 findings against the code. The tool only lets the reviewer who raised a finding answer it, so I couldn't record these answers:
- **R1-7** is fixed. `LensPane.tsx:300` checks `CORPUS_NAME === 'cs2023'` before comparing to the Science id, and `lensmessage.ts` now says "this place".
- **R1-8** is fixed. `DocumentPanel.tsx:265` says "secondary tags", and the stop-position rule lives in `secondaryTagsAt` with its own unit tests. The type error above comes from that helper's call site.

Assumptions: I reported the type error as a new finding rather than reopening R1-8, because R1-8's own points (the label and the helper) are done.

<!-- kncode-findings
{"reports":[{"id":"R2-10","raisedAgain":false,"bucket":"MustFix","what":"Typecheck fails: TS2345 at DocumentPanel.tsx(223,43). \u0060walkById\u0060 returns \u0060Walk | undefined\u0060, so \u0060activeWalk\u0060 is \u0060Walk | null | undefined\u0060, and \u0060secondaryTagsAt\u0060 takes only \u0060... | null\u0060. Fix it by widening the helper\u0027s parameter to \u0060| null | undefined\u0060, or by writing \u0060walkById(...) ?? null\u0060. The previous step ran only vitest, so the error went unseen.","file":"src/instruments/DocumentPanel.tsx","line":223,"breaks":"Card, done when: \u0022\u0060npm run verify\u0060 passes\u0022. verify runs the typecheck and \u0060vite build\u0060, and both fail on this error.","failure":null}],"answers":[]}
-->
