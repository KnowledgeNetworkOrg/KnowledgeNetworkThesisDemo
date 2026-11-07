1. **What I changed and why**

- Added `WalkBuildsOn` and an optional `buildsOn` field to `Walk` in `src/corpus/walks.ts`, documenting that its `group` is the prerequisite row's alternative group, not the route's own group.
- Taught `tools/cs2023import/generate.mjs` to read `route_links` in file order, resolve routes with the existing `routeIdOf`, carry outside-course titles, keep `alternative_group` and `calendar_wording` verbatim, and fail when a row names neither a route nor an outside course.
- Regenerated `src/corpus/cs2023walks.ts` (107 entries over 48 routes; the other 13 routes have no field).
- Added `cs2023corpus.test.ts` assertions for the row count, distinct pairs, route/outside resolution, `walkId` counts, group counts (including the `.B` suffix), and per-route ordered equality with the pinned JSON.
- Rendered “Builds on: …” in the active-route row of `TrailStrip`: one line per distinct wording, route courses as inline buttons calling `activateWalk(walkId, 0)`, outside courses as plain text with their title as a tooltip, and no `▶` mark.
- Added `tools/studio-spike/browsertest-cs2023builds-on.mjs`, modelled on the marks driver, checking CPS 209's wording, the CPS 109 link, the CPS 106 plain text, and the route switch.
- Updated `tools/cs2023import/README.md` to describe `buildsOn` and removed the now-untrue “prerequisites are not carried” entry.

Verification: the generator ran successfully; a direct check against the regenerated module confirmed 107 rows, 48 routes, 71 route links, 36 outside courses, 29 raw groups and 24 after dropping `.B`; both new/changed `.mjs` files pass `node --check`. `vitest` and the browser driver could not run because this checkout has no `node_modules`.

Assumptions: I placed “Builds on” in the active-walk row of `TrailStrip`, as the plan chose; outside-course titles are tooltips; course-code matching tolerates missing spaces (for example `CPS406` against `CPS 406`) while keeping the wording itself verbatim; helper code lives inside `TrailStrip.tsx` rather than a new file.