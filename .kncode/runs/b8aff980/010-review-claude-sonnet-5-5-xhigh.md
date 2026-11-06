Both open findings are resolved in the code, and I found no new Must fix or Optional. The only new point is one nit.

**Checks I ran** (nothing written to the repo):
- `npx tsc --noEmit -p tsconfig.app.json` prints no errors.
- `vitest` on `cs2023corpus.test.ts` and `src/model` passed, 300 tests in 17 files.
- `vitest` on `layering.test.ts`, `unreachedmodule.test.ts`, `firstline.test.ts` and `src/studio` passed, 48 tests in 8 files.
- `eslint` on the test, `nav.ts`, `DocumentPanel.tsx`, `MapTooltipCard.tsx`, `throughwalks.ts` and the browser driver is clean.
- I did not re-run the browser driver or the full `npm run verify`. I read the driver against the card's done-when lines and found no gap.

**Must fix:** none.

**Optional:** none.

**Nit:**
1. `src/model/nav.ts:98`: the new `kindLabel` has no unit test. `nav.test.ts` could pin that a top-level domain reads 'container', a topic reads 'topic', and an unknown id reads 'leaf'. Vitest loads the teaching corpus, which has no childless domain, so a test could not reach the Science case.

**Round-1 findings:**

| Id | Result | Where |
|---|---|---|
| R1-6 | FIXED | `src/corpus/cs2023corpus.test.ts:15` imports the pinned map as JSON and the `node:fs` import is gone. `tsc` is clean, which was the failure. |
| R1-7 | FIXED | `src/model/nav.ts:95-103` adds `kindLabel`. `DocumentPanel.tsx:213` and `MapTooltipCard.tsx:44` both use it, so Science reads CONTAINER in the pane and `container` in the hover card, like the other 17 areas. |

**Noticed outside this card's scope:** nothing new. Earlier rounds noted that the Walk Editor's road boxes overlap for long deep-stop titles, which belongs to #504.

Assumptions: the owner's decision that the desk opens on all 12 CPS 109 stops governs over the done-when phrase "with no non-unit stop", which cannot hold alongside it. I did not review Science's hue and hexagon as design choices, since the card leaves them to the owner in the PR.

<!-- kncode-findings
{"reports":[{"id":"R2-8","raisedAgain":false,"bucket":"Nit","what":"The new \u0060kindLabel\u0060 in src/model/nav.ts has no unit test. nav.test.ts could pin that a top-level domain reads \u0027container\u0027, a topic reads \u0027topic\u0027, and an unknown id reads \u0027leaf\u0027. Under vitest the loaded corpus is teaching, which has no childless domain, so a test could not reach the Science case.","file":"src/model/nav.ts","line":98,"breaks":"Nothing the card requires. This only leaves the label rule that R1-7 introduced unpinned.","failure":null}],"answers":[{"id":"R1-6","answer":"Fixed","because":"src/corpus/cs2023corpus.test.ts:15 now imports the pinned map as JSON (\u0060import pinned from \u0027../../tools/cs2023import/cs2023_map.json\u0027\u0060) and the \u0060node:fs\u0060 import is gone. \u0060npx tsc --noEmit -p tsconfig.app.json\u0060 prints no errors. The test file passes under vitest, and eslint is clean on it.","duplicateOf":null},{"id":"R1-7","answer":"Fixed","because":"src/model/nav.ts:95-103 adds \u0060kindLabel(id)\u0060, which returns topic, container for any top-level domain, or the node\u0027s own kind. DocumentPanel.tsx:213 and MapTooltipCard.tsx:44 both use it. Science now reads CONTAINER in the pane and \u0060container\u0060 in the hover card, as the other 17 areas do. The value is inside DocHeader\u0027s documented set.","duplicateOf":null}]}
-->
