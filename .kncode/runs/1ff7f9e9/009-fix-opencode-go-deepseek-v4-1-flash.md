1. Fixed the TS2769 overload error in `src/studio/apptoolbar.test.ts` by typing the props object as `NonNullable<Parameters<typeof AppToolbar>[0]>` and passing it to `createElement<typeof props>(AppToolbar, props)`, which makes TypeScript pick the component overload rather than React's `Attributes` overload. `npm run typecheck` (the `tsc -b` step that failed) now passes clean.

Assumptions: none.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"C0-10","answer":"Fixed","because":"In src/studio/apptoolbar.test.ts:18-22 the props are now built as a typed variable (\u0060NonNullable\u003CParameters\u003Ctypeof AppToolbar\u003E[0]\u003E\u0060) and passed with an explicit type argument to \u0060createElement\u003Ctypeof props\u003E\u0060, so TypeScript selects the component overload instead of React\u0027s \u0060Attributes\u0060 overload. \u0060npm run typecheck\u0060 (tsc -b) now completes with no errors.","duplicateOf":null}]}
-->
