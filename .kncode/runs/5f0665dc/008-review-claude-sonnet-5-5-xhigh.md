The change implements the card, and I found nothing to fix. I did not run `npm run verify` or the browser drivers. They write to `tools/studio-spike/out/`, and I was told not to create files. I read the changed files, the data, and the other drivers' selectors.

**Must fix:** none

**Optional:** none

**Nit:** none new. All three round-0 nits are fixed in the code:
- **R0-1:** The new driver seeds one stored walk in `pkt.walks.saved` and reloads. It checks that `Saved walks` is the last heading, with one walk, in both the Trail list and the picker. It also checks that the three program headings are unchanged around it. The seeded walk matches what `walkstore.ts` accepts, so the check exercises `listWalks()` → `groupWalks` → `WalkList`.
- **R0-2:** The Trail heading at `WalkList.tsx:26` is now lighter and inset (`font-medium text-slate-400`, `pl-1`) against the bold `slate-500` "Walks" label, so a category reads as nested under it.
- **R0-3:** `WalkList.tsx:43` narrows with a type predicate, so `data-walk-group={g.heading}` no longer has the unreachable `?? ''` fallback.

How the change meets the card:
- **Grouping:** Both lists use the shared `WalkList` and `groupWalks`. Headings are the program's own `category` strings in first-meet order, as plain text, never buttons.
- **Data checks:**
  - `cs2023_map.json` gives REQUIRED 20, REQUIRED GROUP 1 3, Professionally-Related Table I 38, 61 routes in all.
  - The routes interleave (REQUIRED, GROUP 1, REQUIRED, Table I). Grouping regroups them in first-meet order, and CPS 109 stays first.
- **Flat corpora:** With no `category` anywhere, `groupWalks` returns one headingless group. `WalkList` then renders the original flat row, so teaching and courses keep their order and button text, and the picker holds only walk buttons.
- **Must-not-break:** Every route is a `▶ <title>` button in the DOM at once. The `▶` and `[data-walk-picker] button` selectors in the existing drivers don't depend on the structure that changed. No other driver references the list's wrapper classes.
- **Scope:** The active-walk row, `LoadPicker` and `StudioView.tsx` are untouched, and no filter was added. `Saved walks` appears only on a corpus that publishes categories.
- **Tests the card asks for:** `browsertest-cs2023lists.mjs` reads headings, counts and titles from `cs2023_map.json`, checks both cs2023 lists, then checks that teaching is flat. `run-browsertests.mjs` picks it up on its own. `walkgroups.test.ts` pins the ordering and the saved-walk fallback.

Noticed outside this card's scope: none.

Assumptions: I took "group by category, no filter" as the decision, matching the plan. I did not count the Trail strip's fixed 92px height with 61 routes as a defect, since the card leaves usability for the owner to judge. I took the previous step's reports that the tests, `tsc` and ESLint passed as given.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"browsertest-cs2023lists.mjs now seeds \u0060pkt.walks.saved\u0060 (envelope {v:1,data:[...]}, id \u0060authored-\u2026\u0060, stop \u0060SF\u0060, which is a cs2023 place so \u0060isWalkStop\u0060 keeps it), reloads, and \u0060checkSavedWalk\u0060 asserts in both the Trail list and the picker that \u0022Saved walks\u0022 is the last heading with one walk and the three program headings are unchanged (L206-213). The seed shape matches walkstore.ts\u0027s reader.","duplicateOf":null},{"id":"R0-2","answer":"Fixed","because":"WalkList.tsx:26 now styles the Trail heading \u0060mb-0.5 pl-1 text-[10px] font-medium text-slate-400\u0060, lighter and inset against the bold slate-500 \u0022Walks\u0022 label at TrailStrip.tsx:126, so a category reads as nested under it.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"WalkList.tsx:43 narrows the groups with a type predicate (\u0060WalkGroup \u0026 { heading: string }\u0060), so \u0060data-walk-group={g.heading}\u0060 at L47 has no \u0060?? \u0027\u0027\u0060 fallback and the dead branch is gone.","duplicateOf":null}]}
-->
