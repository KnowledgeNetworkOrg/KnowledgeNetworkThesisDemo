1. **R2-8** — fixed: `src/model/nav.test.ts` now tests `kindLabel` for every loaded `domainId` (reads `container`), every `topicId` (reads `topic`), and an unknown id (reads `leaf`); `npx vitest run src/model/nav.test.ts` passes, 16 tests.

Nothing else was raised by either reviewer.

Assumptions: The childless-domain case of `kindLabel` is still not reachable under vitest, since the teaching corpus has no childless domain; the test pins the rule on the domains and topics that are loaded, as the finding proposed.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-8","answer":"Fixed","because":"src/model/nav.test.ts now pins kindLabel: every id in domainIds reads \u0027container\u0027, every id in topicIds reads \u0027topic\u0027, and an unknown id reads \u0027leaf\u0027. The childless-domain case cannot be reached under vitest\u0027s teaching corpus, so the test pins the rule on the domains that are loaded.","duplicateOf":null}]}
-->
