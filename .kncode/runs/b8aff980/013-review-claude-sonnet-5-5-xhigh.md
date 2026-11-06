R2-8 is fixed, and I found nothing new, so the verdict is PASS.

`src/model/nav.test.ts:129-143` now pins `kindLabel`:
- Every loaded `domainId` reads `container`.
- Every `topicId` reads `topic`.
- An unknown id reads `leaf`.

Each loop first asserts its list is non-empty, so it can't pass on nothing. I ran `nav.test.ts` and `cs2023corpus.test.ts`, and both pass (32 tests).

The one branch it can't reach is a childless domain, because vitest loads the teaching corpus, which has none. The finding already said so.

I also re-read the rest of the card's code and found no gap:
- `throughWalksAt` gives one entry per visit.
- `DocumentPanel` keys each entry by `walk.id:idx`.
- `walks.ts` keeps the "every stop exists" guard on cs2023 and drops "is a topic" there.
- `PLAN` is empty on cs2023.
- `cs2023Seed()` opens the desk on CPS 109's own stops.
- The generator requires exactly one Science exception and throws if it gains a child.
- The corpus test pins the counts the card lists.

I did not re-run the browser driver or `generate.mjs` this round. Earlier rounds covered both.

Must fix:
none

Optional:
none

Nit:
none

Noticed outside this card's scope: nothing new. The overlapping Walk Editor road boxes for long deep-stop titles belong to #504, as earlier rounds noted.

Assumptions: the owner's decision that the desk opens on all 12 CPS 109 stops governs over the done-when phrase "with no non-unit stop", which can't hold alongside it. I did not review Science's hue and hexagon as design choices, since the card leaves those to the owner in the PR.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-8","answer":"Fixed","because":"src/model/nav.test.ts:129-143 now pins kindLabel: every domainId reads \u0027container\u0027, every topicId reads \u0027topic\u0027, and an unknown id reads \u0027leaf\u0027. Each loop first asserts its list is non-empty, so it cannot pass on nothing. I ran nav.test.ts and cs2023corpus.test.ts and both pass (32 tests). The childless-domain branch stays out of reach under vitest because teaching has no childless domain, as the finding said.","duplicateOf":null}]}
-->
