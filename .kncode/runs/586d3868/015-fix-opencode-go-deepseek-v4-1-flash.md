1. R3-16: fixed — host-rule blocks restored in `src/ds/presenter/PresenterHeaderBar.tsx:4-14` and `src/ds/presenter/PresentStartCard.tsx:16-31`.
2. R3-17: fixed — `src/ds/sidebar/BinMark.tsx:12-16` now names `lift={false}` as the way to drop the lift.

Assumptions: none.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R3-16","answer":"Fixed","because":"Carried the .d.ts host-rule blocks into both ports: PresenterHeaderBar.tsx now states the preview rule (no clock, keep the start control pressable, start from zero) and the ended rule (resume elsewhere, word its tooltip to match the chip); PresentStartCard.tsx now carries WHEN IT OPENS and WHAT THE HOST MUST DO (store sessions, pass openWalk, do what onStart says, mount as a modal).","duplicateOf":null},{"id":"R3-17","answer":"Fixed","because":"src/ds/sidebar/BinMark.tsx:12-16 now uses the DS wording: style merges under the lift so a caller cannot counter-nudge it, and lift={false} is named as the one way to drop the lift for a bin alone in a round button.","duplicateOf":null}]}
-->
