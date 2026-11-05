R2-4: fixed — removed the unused third parameter and its route imports from `src/present/presenterbus.ts:20`, and dropped the matching test case from `src/present/presenterbus.test.ts`. The lecture route now lives only in `PresenterScreen.tsx`'s memoised `mapBus`, so the two copies cannot drift apart.

`npx vitest run src/present/presenterbus.test.ts` passes (3 tests).

Assumptions: I took the finding's second option (remove the parameter and its test) rather than routing `PresenterScreen`'s memoised steps through the bus view, since that keeps `route`'s identity stable for `useWallFit` without extra memoisation in the bus.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-4","answer":"Fixed","because":"Removed the unused third parameter from presenterBus in src/present/presenterbus.ts:20 (and its now-unused route imports), and dropped the matching test case in src/present/presenterbus.test.ts, so route logic exists only in PresenterScreen.tsx\u0027s memoised mapBus.","duplicateOf":null}]}
-->
