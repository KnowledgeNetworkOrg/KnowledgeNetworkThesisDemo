Failures:
- `src/ds/adherence.test.ts > DS PaneHeader rule 2 — a clipping body rounds all four corners > no style rounds the bottom corners alone`
- `src/ds/adherence.test.ts > our DS ports document what the DS documents > leaves exactly 103 props undocumented across src/ds`
- `src/ds/adherence.test.ts > DS IconButton — every tooltip on a DOM element is folded > sets no raw title= on a DOM element`
- `src/studio/browsertestguard.test.ts > every hook a browser test reaches for still exists > data-* attributes`
- `src/studio/browsertestguard.test.ts > every hook a browser test reaches for still exists > every other literal aria-label`

Commands run:
- `npm ci --prefix desktop`
- `npm run build`
- `npm run typecheck:desktop`
- `npm run lint`
- `npm run test`
- `npm run verify`

Left out: `npm run test:browser` (opt-in browser suite that needs a long-running dev server/browser), and the plan's interactive presenter walkthrough (needs a browser and a running app).

Verify: ran — failed: `npm run verify` passes build, desktop typecheck and lint, but its `vitest run` fails the five tests above.

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"A style sets borderBottomRightRadius alone, which the adherence rule forbids for a clipping body.","file":"src/ds/presenter/FilmRoll.tsx","line":54,"breaks":"Adherence test expects no style to round the bottom corners alone; it returns the FilmRoll line.","failure":"src/ds/adherence.test.ts \u003E DS PaneHeader rule 2 \u2014 a clipping body rounds all four corners \u003E no style rounds the bottom corners alone"},{"id":"C0-2","raisedAgain":false,"bucket":"MustFix","what":"Present and scrollbar browser drivers select data-* attributes that no longer appear anywhere in src/ or tools/, including data-lecture-notes, data-note-composer and data-filmroll.","file":"src/studio/browsertestguard.test.ts","line":null,"breaks":"The browser-test guard expects every data-* selector to exist; it reports 28 dead selectors.","failure":"src/studio/browsertestguard.test.ts \u003E every hook a browser test reaches for still exists \u003E data-* attributes"},{"id":"C0-3","raisedAgain":false,"bucket":"MustFix","what":"Raw title attributes are set directly on DOM elements in LectureNotes and PresentStartCard instead of using the folded tooltip.","file":"src/ds/presenter/LectureNotes.tsx","line":170,"breaks":"The adherence test expects no raw title= on a DOM element; it reports nine occurrences.","failure":"src/ds/adherence.test.ts \u003E DS IconButton \u2014 every tooltip on a DOM element is folded \u003E sets no raw title= on a DOM element"},{"id":"C0-4","raisedAgain":false,"bucket":"MustFix","what":"The documented-props budget is exceeded: 240 undocumented props are found where the test expects 103, with many new presenter props counted.","file":"src/ds","line":null,"breaks":"The adherence budget assertion expects 103 undocumented props but receives 240.","failure":"src/ds/adherence.test.ts \u003E our DS ports document what the DS documents \u003E leaves exactly 103 props undocumented across src/ds"},{"id":"C0-5","raisedAgain":false,"bucket":"MustFix","what":"Browser drivers wait for aria-labels that no longer appear anywhere in src/ or tools/, including the note composer, category, prepared-notes and end-lecture labels.","file":"src/studio/browsertestguard.test.ts","line":null,"breaks":"The browser-test guard expects every literal aria-label to exist; it reports six dead labels.","failure":"src/studio/browsertestguard.test.ts \u003E every hook a browser test reaches for still exists \u003E every other literal aria-label"}],"answers":[]}
-->
