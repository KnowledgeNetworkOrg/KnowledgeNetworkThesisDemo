**Failures:**
- `src/corpus/cs2023corpus.test.ts(193,15): error TS2741: Property 'wording' is missing` — the annotated object literal is created with only `course`, and the required `wording` is assigned afterwards; `npm run build` (and therefore `npm run verify`) stops here.
- `src/ds/adherence.test.ts > DS IconButton — every tooltip on a DOM element is folded > sets no raw title= on a DOM element` — the test finds a raw `title=` at `src/instruments/TrailStrip.tsx:63` (`<span title={entry.title}>`).

**Commands run:**
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` (fails at `tsc -b` with the TS2741 above)
- `npm run test` (1038 passed, 1 failed: the adherence test above)
- `npm run lint` (passed)
- `npm run typecheck:desktop` (passed)
- `node tools/studio-spike/browsertest-cs2023builds-on.mjs` (passed)
- `npm run test:browser` (42/42 passed)

Left out: nothing that is a described suite. The desktop `smoke`/`pack` scripts are not part of `verify` or the README's test instructions (packaging is hand-run, Windows-only and needs an Electron download), and no test suite here is gated on an opt-in flag or credential. Both lockfiles were installed with `npm ci`; neither was edited.

**Verify:** ran — failed: `npm run verify` stops at the TypeScript build error in the new `cs2023corpus.test.ts`, and vitest has the `sets no raw title=` failure from the new `TrailStrip` markup; the plan's other two checks (the new driver and `npm run test:browser`) both pass.

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"Build fails: src/corpus/cs2023corpus.test.ts(193,15) TS2741 \u2014 Property \u0027wording\u0027 is missing in type \u0027{ course: string; }\u0027 but required in type \u0027{ course: string; walkId?: string; title?: string; group?: string; wording: string; }\u0027. The annotated object literal is created with only \u0060course\u0060 and \u0060wording\u0060 is assigned afterwards, which TypeScript rejects.","file":"src/corpus/cs2023corpus.test.ts","line":193,"breaks":"npm run build / npm run verify","failure":"src/corpus/cs2023corpus.test.ts(193,15): error TS2741: Property \u0027wording\u0027 is missing"},{"id":"C0-2","raisedAgain":false,"bucket":"MustFix","what":"Unit test fails: \u0060sets no raw title= on a DOM element\u0060 finds a raw title attribute at src/instruments/TrailStrip.tsx:63 (\u0060\u003Cspan title={entry.title}\u003E\u0060). The design-system adherence test forbids raw \u0060title=\u0060 on DOM elements; the outside-course tooltip should use the project\u0027s tooltip/wrapTip mechanism instead.","file":"src/instruments/TrailStrip.tsx","line":63,"breaks":"npm run test (and therefore npm run verify)","failure":"src/ds/adherence.test.ts \u003E DS IconButton \u2014 every tooltip on a DOM element is folded \u003E sets no raw title= on a DOM element"}],"answers":[]}
-->
