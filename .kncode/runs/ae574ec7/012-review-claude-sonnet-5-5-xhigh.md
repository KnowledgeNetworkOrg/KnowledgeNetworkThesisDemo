I found no gaps against the card, and R2-4 is fixed. My verdict is PASS.

**What I ran**
- The present-folder unit tests, `layering.test.ts` and the driver guard: 75 of 75 pass.
- ESLint on the six changed source and test files: clean.
- `tsc --noEmit` on `tsconfig.app.json`: clean.
- `browsertest-presenter-start.mjs`: all 23 checks pass.
- I did not run `npm run verify` as a whole, and I did not run the five updated drivers. The change since round 2 touches none of them, but the R0-2 memoisation and R0-3 mint-once fixes may have landed after their saved logs. `browsertest-presenter-start.mjs` passing is the only live check I have for those two fixes.
- I skipped `browsertest-presenter.mjs` and the other drivers that write screenshots, because I was told not to create files.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**R2-4 — FIXED.** `src/present/presenterbus.ts` is back to the two-argument `presenterBus(deskBus, walkId)`, with no route imports, and the extra route test is gone. The lecture's own route now exists only in `PresenterScreen.tsx:127-136`. The wall map is the only reader of `route` and `routeSteps` there, because `playback.ts` doesn't read them. The route is built the same way `ProjectorScreen` builds it. The card lists `presenterbus.ts` only "if #484's view needs it passed in", so leaving it unchanged is allowed.

**Noticed outside this card's scope:**
- `QuickActionsDeck` still binds `m`, `f`, `e`, `j` and Escape on the document, so over a preview those keys can still reach the deck behind the scrim. The card asked only for `keys={false}` on `PresenterScreen`, which is done.
- Under dev StrictMode the simulated unmount writes the session's `last` at the start stop straight after a start. The driver output shows it: `last.stop` is 0 right after Enter in check 5. The card accepts this.

Assumptions: I took the optional `lectureId` prop with a mount-time id kept for the preview as allowed by "keep it only for the preview". I took `playSteps(null, presentedRoad)` as the right stop count for clamping a draft start.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R2-4","answer":"Fixed","because":"\u0060src/present/presenterbus.ts\u0060 now has only the two-argument \u0060presenterBus(deskBus, walkId)\u0060 and no route imports. The \u0060presenterbus.test.ts\u0060 route case is gone, leaving three tests. The lecture\u0027s own route exists only in the memoised \u0060mapBus\u0060 at \u0060PresenterScreen.tsx:127-136\u0060, so the two copies can\u0027t drift apart. I ran the present-folder tests with \u0060layering.test.ts\u0060 and the driver guard (75 pass). ESLint on the changed sources and \u0060tsc --noEmit\u0060 on \u0060tsconfig.app.json\u0060 are both clean. I also ran \u0060browsertest-presenter-start.mjs\u0060, and all 23 checks pass.","duplicateOf":null}]}
-->
