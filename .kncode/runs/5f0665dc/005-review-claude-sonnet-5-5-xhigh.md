The change implements the card. I found no Must fix or Optional findings, only three nits, and submitted PASS.

I did not run the browser suite myself, because the drivers write screenshots into `tools/studio-spike/out/`, and I was told not to create files. I ran ESLint on the changed files, which was clean. I ran vitest on `walkgroups.test.ts`, the layering test, the browser-test guard, the unreached-module test and the first-line test. All 28 tests passed.

Each "done when" line is covered:
- **Grouping:** Both lists use the shared `WalkList` and `groupWalks`, with the program's own `category` strings as headings in first-meet order. Headings are plain text, never buttons.
- **Flat corpora:** On teaching and courses, `groupWalks` returns one headingless group and `WalkList` renders the original flat row. Nothing in `coursewalks.ts` or `teachingwalks.ts` carries a `category`.
- **Saved walks:** They go under `Saved walks`, last, and only on a corpus that publishes categories.
- **Out of scope:** The Trail's active-walk row and the toolbar's `LoadPicker` are untouched.
- **Existing drivers:** Every route is still a `▶` button, CPS 109 is still first, and the picker's flat case still holds only walk buttons. I read the existing drivers' selectors and `.first()` calls and none depends on the new structure, so they should be unaffected.
- **New driver:** `browsertest-cs2023lists.mjs` follows the conventions, reads headings and counts from `cs2023_map.json`, and checks both cs2023 lists, then teaching's two flat lists.

In `cs2023_map.json` the routes are not contiguous by category: REQUIRED GROUP 1 sits between two runs of REQUIRED. Grouping therefore regroups them (REQUIRED ×20, then GROUP 1 ×3, then Table I ×38). That matches the card's "order the data first meets them", and the driver derives its expected counts from the data, so it holds.

Must fix: none

Optional: none

Nit:
1. `tools/studio-spike/browsertest-cs2023lists.mjs:150` — the `Saved walks` heading is checked only on the helper in `walkgroups.test.ts`. No browser check saves a walk and looks for it under `Saved walks` in either list. The done-when does not require one.
2. `src/instruments/WalkList.tsx:22` — the Trail's group heading is styled the same as the "Walks" label above it, so "REQUIRED" reads as a peer of "Walks" rather than nested under it.
3. `src/instruments/WalkList.tsx:43` — `g.heading ?? ''` can never reach `''`, because the grouped branch only renders non-null headings.

Noticed outside this card's scope: none.

Assumptions: I took the previous step's report as the only evidence that `npm run verify` and the build passed; I did not re-run them. I read "group by category, no filter" as the decision, matching the plan. I did not count the Trail strip's 92px height with 61 routes as a defect, since the card leaves usability to the owner.

<!-- kncode-findings
{"reports":[{"id":"R0-1","raisedAgain":false,"bucket":"Nit","what":"The \u0060Saved walks\u0060 heading (owner ruling 2026-11-06) is pinned only at the helper level in \u0060walkgroups.test.ts\u0060. \u0060browsertest-cs2023lists.mjs\u0060 never saves a walk, so the wiring through \u0060listWalks()\u0060 into the Trail list and the picker is not exercised in a browser. The done-when does not require it.","file":"tools/studio-spike/browsertest-cs2023lists.mjs","line":150,"breaks":"Not a card requirement. The behaviour is implemented and unit-tested; a saved walk on cs2023 appearing last under \u0060Saved walks\u0060 has no end-to-end check.","failure":null},{"id":"R0-2","raisedAgain":false,"bucket":"Nit","what":"The Trail\u0027s group heading (\u0060mb-1 text-[10px] font-bold text-slate-500\u0060) uses the same style as the \u0022Walks\u0022 label directly above it, so in the 92px strip \u0022Walks\u0022 and \u0022REQUIRED\u0022 look like two equal-level labels. A slightly different treatment would show that the category is nested under \u0022Walks\u0022.","file":"src/instruments/WalkList.tsx","line":22,"breaks":"Layout only. The owner is asked to judge usability at 61 routes.","failure":null},{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"\u0060data-walk-group={g.heading ?? \u0027\u0027}\u0060 can never take the \u0060\u0027\u0027\u0060 branch. The grouped branch only renders when \u0060heading\u0060 is a non-null string, so the fallback is dead code.","file":"src/instruments/WalkList.tsx","line":43,"breaks":"Wording and tidiness only.","failure":null}],"answers":[]}
-->
