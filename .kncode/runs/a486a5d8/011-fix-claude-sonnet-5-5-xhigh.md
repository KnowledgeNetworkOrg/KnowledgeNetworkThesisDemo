1. R1-2 (nit): fixed. `tools/studio-spike/browsertest-cs2023marks.mjs:265` now ends "teaching does not". The test title at `src/model/standingnotice.test.ts:14` now reads "is null on teaching even when the sentence is there". Both are wording only. `npx vitest run src/model/standingnotice.test.ts` passes (4 tests). I did not run the browser driver.

2. The person's answer ("allowed to edit") asked for nothing beyond the finding above, so nothing further was done.

Noticed outside this card's scope:
- `src/instruments/DocumentPanel.tsx:31` says "The other corpora's walks stop on topics". With two corpora this means teaching alone. The card doesn't list it and the done-when grep doesn't match it, so I left it.

Assumptions: I took R1-2's suggested wording ("teaching does not") as written. I did not touch `.kncode/locked-files`.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R1-2","answer":"Fixed","because":"tools/studio-spike/browsertest-cs2023marks.mjs:265 now ends \u0022teaching does not\u0022, and the test title at src/model/standingnotice.test.ts:14 now reads \u0022is null on teaching even when the sentence is there\u0022. Wording only; standingnotice.test.ts still passes (4 tests).","duplicateOf":null}]}
-->
