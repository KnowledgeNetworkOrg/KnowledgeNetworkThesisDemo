R2-14 fixed — `src/ds/PROVENANCE.json:400` synced to `2026-10-21` with a deviation line recording the `lift` adoption.
R2-15 fixed — `src/ds/presenter/LectureRecap.tsx:46,50,51` pass absent counts through as blank rather than `0`.

Checked: `lecturerecap.test.ts` (12 passing) and the ledger parses as valid JSON.

Noticed outside this card's scope: the browser drivers still assert v3 review behaviour (`data-flagged-slide` → `.isDisabled()`, "notes taken"); OB-304's rewrite has to replace them.

Assumptions: the DS's `recapStats` leaves an absent numeral blank, so an empty string reproduces that in the typed port without widening `RecapStat.value`.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-14","answer":"Fixed","because":"\u0060src/ds/PROVENANCE.json:400\u0060 now records \u0060syncedAt: 2026-10-21\u0060, and a new deviation line beside it names the \u0060lift\u0060 prop adoption and the \u0060lift={false}\u0060 flag-row case.","duplicateOf":null},{"id":"R2-15","answer":"Fixed","because":"\u0060src/ds/presenter/LectureRecap.tsx:46,50,51\u0060 now passes an absent \u0060slides\u0060/\u0060notes\u0060/\u0060flagged\u0060 through as an empty string instead of \u00600\u0060, so the numeral stays blank and only supplied counts print.","duplicateOf":null}]}
-->
