1. **What I changed and why**

- Added `src/instruments/walkgroups.ts`, a pure helper that groups walks by their published `category` in first-meet order, keeps each group's internal order, and appends uncategorised walks under a `Saved walks` heading only when the corpus publishes categories. A corpus with no categories stays one flat group.
- Added `src/instruments/walkgroups.test.ts` covering flat order, first-meet heading order, the saved-walk fallback, and the empty list.
- Added `src/instruments/WalkList.tsx`, a shared list used by both surfaces. It renders the exact original flat button row when there are no headings, or plain-text `data-walk-heading` labels inside `data-walk-group` wrappers when grouped. Every route remains a `▶`/walk button in the DOM, so the existing drivers' counts and `.first()`/`.nth()` calls keep working.
- Replaced the flat maps in `TrailStrip.tsx` and `walkdesk/WalkUtilityBar.tsx` with `WalkList`, keeping the same button text, order on flat corpora, and insert-on-click behaviour.
- Added `tools/studio-spike/browsertest-cs2023lists.mjs`, which reads expected headings/counts from `cs2023_map.json`, verifies both cs2023 lists show 61 routes as 20 / 3 / 38 under the three published headings with CPS 109 first, then switches to the teaching build and verifies both lists stay flat with two walks.

I ran the new grouping test, a TypeScript build, and the new browser driver; all passed.

Assumptions: grouping is used rather than a filter; headings use the JSON's exact strings without added counts; the Walk Editor picker is grouped as the second of the two lists; `Saved walks` appears only on corpora that publish categories; teaching has two walks in the driver's flat-list assertion; the Trail's active-walk row and the toolbar `LoadPicker` are untouched.