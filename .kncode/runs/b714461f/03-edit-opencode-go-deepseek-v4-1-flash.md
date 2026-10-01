Done. Summary of the change:

**What changed and why**

- `src/state/bus.ts` — wrote the ownership rule into the header: the route belongs to the desk, and its only writers are the presented road, an activated saved walk, `teach`, and the explicit clears; the explorer is not one. Added a separate `explorePath` channel with `setExplorePath` that writes only that field plus a trail entry, and removed the public `setRoute` action so no pane can publish a flat route (`activateWalk`/`teach` keep a private helper). `reset` now clears the explorer path too.
- `src/instruments/WalkView.tsx` — repointed the edge-following explorer and all five click handlers at `explorePath`/`setExplorePath`, added `data-explore-path` on the pane root as the test hook, and corrected the header comment that called this path the shared bus route.
- `src/state/walk/playback.ts` — fixed the stale "three writers" comment to name the true list (desk, saved walk, teach) and note the explorer's separate channel.
- `tools/studio-spike/browsertest-explorerroute.mjs` — new browser driver (port 5266, `browsertest-` prefix so the runner collects it) that applies Plan, clicks a start node and a link in the Walk pane, and asserts the explorer's own trail grows while the map's route length and pins stay the desk's.

**Verification (ran once, after the edits)**
- `npm run typecheck` — passes.
- `node tools/studio-spike/browsertest-explorerroute.mjs` — all 12 checks pass: route stayed at 7 and pins at 3 while the explorer grew 0→1→2 and clearing emptied only the explorer. This is the card's done-when; with the old code the first click would have collapsed the route to 1.
- I installed dependencies with `npm ci` first, since none were present in this checkout.

Assumptions: The explorer's trail still records a `'walk'` trail entry but no longer moves focus (matching the old `setRoute` behavior); the map deliberately does not draw `explorePath`, so explorer paths no longer appear as map pins; `data-explore-path` is present on both the empty and non-empty pane roots so the driver can read `0` before the first click; the driver's link-choice selector relies on the step card being the only titled button in the pane.