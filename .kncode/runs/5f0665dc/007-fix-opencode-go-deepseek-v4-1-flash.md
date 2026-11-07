1. R0-1 — fixed. `tools/studio-spike/browsertest-cs2023lists.mjs` seeds `pkt.walks.saved` with one authored walk (stop `SF`, a real cs2023 place), reloads, and checks in both the Trail list and the picker that `Saved walks` is the last heading with one walk while the three program headings are unchanged (`seedSavedWalk`/`checkSavedWalk`, used at L206-L213).
2. R0-2 — fixed. `src/instruments/WalkList.tsx:26` — the Trail heading is now `mb-0.5 pl-1 text-[10px] font-medium text-slate-400`, lighter and inset against the bold `slate-500` "Walks" label above it, so a category reads as nested under it.
3. R0-3 — fixed. `src/instruments/WalkList.tsx:43` narrows the groups with a type predicate (`WalkGroup & { heading: string }`), so `data-walk-group={g.heading}` at L47 needs no fallback and the unreachable `''` branch is gone.

Checked with `npx tsc -b`, ESLint on the changed files, and vitest on `walkgroups.test.ts` plus `browsertestguard.test.ts` (17 tests, all passing).

The find-and-replace had no writer method for `.kncode/locked-files`; the driver's save path is still covered by `drive-persistence.mjs`, and R0-1's browser check exercises the store-to-list wiring rather than the desk's save button.

Assumptions: the seeded walk uses `SF` because the corpus loader rejects stops that are not cs2023 places, so the driver proves the read path (`listWalks()` → `groupWalks` → `WalkList`) without rebuilding the desk's save flow.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"tools/studio-spike/browsertest-cs2023lists.mjs now seeds pkt.walks.saved with one authored walk (stop SF, a cs2023 place), reloads, and checks in both lists that the last heading is \u0022Saved walks\u0022 holding one walk while the three program headings stay unchanged: seedSavedWalk/checkSavedWalk, used at L206-L213.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"src/instruments/WalkList.tsx:43 narrows the groups with a type predicate (WalkGroup \u0026 { heading: string }), so the wrapper uses data-walk-group={g.heading} directly at L47 and the unreachable \u0022\u0022 fallback is gone.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"src/instruments/WalkList.tsx:26 \u2014 the Trail heading is now mb-0.5 pl-1 text-[10px] font-medium text-slate-400, lighter and inset against the bold slate-500 \u0022Walks\u0022 label above it, so a category reads as nested under it.","duplicateOf":null}]}
-->
