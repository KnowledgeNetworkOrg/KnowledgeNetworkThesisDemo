Read the bus, both route-writing panes, the playback comment, the instrument registry and the browser-test harness. Plan below.

1. Write the ownership rule into `src/state/bus.ts`'s header: the route's only writers are the desk's presented road (`setRouteSteps` via `state/walk/presented.ts`), an activated saved walk (`activateWalk`, reached from the trail or a playback seek), the generated curriculum (`teach`), and the explicit clears (`clearRoute`, `reset`); the explorer is not a route writer, and the projector's private-window bus is the stated exception.
2. In `bus.ts`, add the explorer's own channel (`explorePath: string[]` + `setExplorePath`) that writes only that field, keeping the old trail-tag write so following a link still leaves a trail chip; remove the now-unused public `setRoute` action so no pane can publish a flat route (`activateWalk`/`teach` keep a private helper), and let `reset` clear the explorer path.
3. In `src/instruments/WalkView.tsx`, re-point the slice (`WalkViewBus`) and all five click handlers at `explorePath`/`setExplorePath`, add `data-explore-path={explorePath.length}` on the pane root as the driver's hook, and correct its header comment that calls the path a shared bus route.
4. Fix the stale "`bus.route` has three writers" comment above `routeIsWalk` in `src/state/walk/playback.ts` to the true list (desk, saved walk, teach) plus the explorer's separate channel.
5. Add a browser driver `tools/studio-spike/browsertest-explorerroute.mjs` (unique port 5266, derived repo root, `browsertest-` prefix so the runner collects it): apply Plan, read the desk's seeded route length from `[data-routepath][data-step-count]`, toggle the Walk pane on, click a start node, then assert `data-explore-path` grows to 1 while the map's step count and pins stay unchanged; click a link to extend and re-check; clear the walk and check only the explorer empties.
6. Verify end to end: run the build, lint, unit suite and the new driver; confirm the driver goes red if step 3 is temporarily reverted (the old code collapses the desk's 7 stops to the clicked node).

Files: `src/state/bus.ts`, `src/instruments/WalkView.tsx`, `src/state/walk/playback.ts`, `tools/studio-spike/browsertest-explorerroute.mjs` (new)

Out of scope: retiring or deleting `WalkView` — the card says it is the app's only interactive edge-following explorer and nothing replaces it, so this cannot be solved by deleting a writer; the projector window's `setRoute` on its own bus, explicitly "not part of the conflict"; #16's own decision and the #329 register; adding UI for `teach`/`clearRoute`/`reset` (their unreachability is recorded, not fixed here).

Verify: with the Plan preset open, click a start node in the Walk pane — the pane opens its own column of steps while the map's numbered route and the header's route count stay exactly what the desk published (today the map collapses to the clicked node), and "✕ clear walk" empties only the explorer.
```
npm run build
npm run lint
npm run test
node tools/studio-spike/browsertest-explorerroute.mjs
```

Assumptions: Option 2 is the chosen rule (the card names it the smallest change that removes the divergence); the new channel is named `explorePath`/`setExplorePath`; the explorer still records trail entries exactly as before, so only route ownership changes; the map keeps drawing only `bus.route`, so explorer paths no longer appear as map pins (drawing them as a second, clearly separate visual was not asked for and would be a follow-up); `setRoute` is removed from the public bus because no slice names it after this change.