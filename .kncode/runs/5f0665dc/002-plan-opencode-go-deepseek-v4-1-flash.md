1. Add a pure `groupWalks()` helper that groups by `category` in first-meet order, preserves order inside each group, appends uncategorised walks under `Saved walks` only when the corpus publishes categories, and returns one flat (headingless) group otherwise; cover it with unit tests.
2. Add a shared `WalkList` component that renders the existing flat button row when there are no headings, or `data-walk-group` wrappers with plain-text `data-walk-heading` labels plus the same buttons when grouped, with trail/picker styling variants.
3. Replace TrailStrip's no-walk `walks.map` with `WalkList`, keeping every `▶ <title>` button mounted, CPS 109 first, and leaving the active-walk row untouched.
4. Replace the WalkUtilityBar picker's `walks.map` with `WalkList`, keeping insert-on-click and ensuring a flat corpus's picker still has only walk buttons.
5. Add `tools/studio-spike/browsertest-cs2023lists.mjs`: check the cs2023 Trail and picker headings/counts against `cs2023_map.json`, all 61 routes, CPS 109 first, then stop vite and check teaching is flat, with screenshots and error exit.
6. Run the verification set and fix anything that regresses, especially the existing cs2023, marks, visibility and persistence drivers.

Files: `src/instruments/walkgroups.ts` (new), `src/instruments/walkgroups.test.ts` (new), `src/instruments/WalkList.tsx` (new), `src/instruments/TrailStrip.tsx`, `src/instruments/walkdesk/WalkUtilityBar.tsx`, `tools/studio-spike/browsertest-cs2023lists.mjs` (new)

Out of scope: no filter, only grouping by published `category`; no headings the program does not publish; Trail's active-walk row (stop marks, standing notice, "Builds on") is unchanged; the toolbar's `LoadPicker` in `StudioView.tsx` stays flat and is not touched; teaching and courses keep flat lists; no collapsed headings or lazy lists that hide route buttons.

Verify: In the cs2023 build, the Walks column and the Walk Editor picker visibly show three plain-text headings — `REQUIRED`, `REQUIRED GROUP 1`, `Professionally-Related Table I` — containing 20 / 3 / 38 route buttons respectively, while switching to the teaching build still shows the two flat walk buttons with no headings.
```
npm run verify
node tools/studio-spike/browsertest-cs2023lists.mjs
npm run test:browser
```

Assumptions: "group by category" wins over "or add a filter"; headings use the JSON's exact strings with no added counts; the cs2023 picker is grouped too, as one of the two lists; `Saved walks` appears only on corpora that publish categories; the Trail strip's fixed height is unchanged and its list scrolls; 61 buttons includes the empty CPS 40A/B route.