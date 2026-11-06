1. Add pure helpers for stop marks (`split`/`filled`/`not matched`/`exception`) and for the cs2023 standing notice taken from a route's own description tail, with unit tests.
2. Carry `source`, `confidence`, `secondary` and `label` from built-in walks through `PlayStep`/`playSteps`; draft and saved authored walks stay mark-free.
3. Render compact mark badges with `data-stop-mark` around the hover-card `StopCard`, and render secondary labels in an unclamped full-width block beneath it so long labels wrap in full.
4. Add `activeWalk` to `DocumentPanel`'s bus slice; show secondary labels only when the active walk's current stop is the node being read, with none at MTH 110 stops 3 and 4.
5. Add mark badges to each “walks through here” card and one cs2023 standing notice under that section, using the same shared notice element as `TrailStrip`.
6. Show the standing notice once in `TrailStrip`'s active-walk row; do not add it to `WalkViewer`, to avoid showing it twice on one screen.
7. For deep stops, keep the existing nearest-ancestor map pin, tree-open and document behaviour; replace `LensPane`'s generic non-topic message with a cs2023 explanation naming the enclosing knowledge unit (or saying it is an area), and widen `bus.visited` for cs2023 to count every visited place.
8. Add `tools/studio-spike/browsertest-cs2023marks.mjs` to drive MTH 110, CPS 803 and BLG 143, verify the four marks, the secondary tag only at MTH stop 5, and the notice on cs2023, then verify no notice on `teaching` and `courses`.

Files: `src/model/stopmarks.ts` (new), `src/model/stopmarks.test.ts` (new), `src/model/standingnotice.ts` (new), `src/model/standingnotice.test.ts` (new), `src/instruments/StandingNotice.tsx` (new), `src/state/walk/playback.ts`, `src/state/walk/playback.test.ts`, `src/state/walk/stoppreview.tsx`, `src/state/walk/stoppreview.test.ts`, `src/instruments/DocumentPanel.tsx`, `src/instruments/TrailStrip.tsx`, `src/instruments/LensPane.tsx`, `src/state/bus.ts`, `tools/studio-spike/browsertest-cs2023marks.mjs` (new)

Out of scope: `design-system/` and `src/ds/**` are not edited, so no mark is added to the DS `WalkStrip` step/dot; the Walk Desk's draft road and saved authored walks gain no marks; the #511 Walk Desk road-box overlap and Science/MSF map-label issues are not touched; secondary tags are never drawn on the map; the `teaching` and `courses` screens must stay otherwise unchanged.

Verify: on the cs2023 build, activate MTH 110, CPS 803 and BLG 143 and observe split, filled, not-matched and exception badges, the “Placements are AI-suggested…” notice, and the secondary label only at MTH 110 stop 5; on `teaching` and `courses` the same screen shows no notice.
```
npm run verify
node tools/studio-spike/browsertest-cs2023marks.mjs
npm run test:browser
```

Assumptions: “step titles” means the app-owned titles in the hover card and “walks through here” cards, not the DS `WalkStrip` titles; deep stops keep the current ancestor pin/tree/document behaviour, with only the lens message and cs2023 `visited` count changing; the notice is the trailing sentence of each route's own `description` (no generator edit) and appears once in `TrailStrip` and once in `DocumentPanel`, not in `WalkViewer`; only the four notable marks are badged (`outline`/`clear`/`judgment call` stay unbadged); secondary labels are shown in an app-side unclamped block because `StopCard`'s note is clamped.