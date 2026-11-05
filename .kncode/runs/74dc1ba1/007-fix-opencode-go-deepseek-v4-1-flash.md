1. R0-1: fixed — rewrote the header comment at `src/state/walk/presented.test.ts:1` to name both callers (editor against its last publish, viewer against the bus's `routeSteps`).
2. R0-2: fixed — added a clause at `src/state/walk/presented.ts:71` saying the guard also stops the viewer's remount on the way back from the presenter from adding a trail entry.

Ran `npx vitest run src/state/walk/presented.test.ts` once (7 passed); only comments changed.

Assumptions: kept the card's required replacement sentence intact and appended the "why" clause after it rather than rewriting the sentence.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"Rewrote the header comment in src/state/walk/presented.test.ts:1 to name both callers and say each has its own block below.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"Added a clause to the hook\u0027s doc comment at src/state/walk/presented.ts:71-75: the guard also stops the viewer\u0027s remount on the way back from the presenter from adding a trail entry.","duplicateOf":null}]}
-->
