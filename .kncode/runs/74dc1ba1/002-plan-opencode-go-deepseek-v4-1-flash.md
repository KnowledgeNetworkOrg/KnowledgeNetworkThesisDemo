## Plan

1. In `tools/studio-spike/browsertest-presenter.mjs`, remove the optionals-toggle block (comment at lines 699–701 and the `getByRole('button', { name: /optionals:/ })` click plus its wait at 702–703) from the #484 draft case permanently, then run the file with `src/` untouched and confirm the draft case fails on trail count (focus and pins still equal); if focus or pins differ, stop and report.
2. In `src/state/walk/presented.ts`, widen `PublishedRouteBus` to `Pick<Bus, 'setRouteSteps' | 'activeWalk' | 'routeSteps'>` and adjust its comment.
3. In the hook's no-`dedup` branch, guard with `if (publishableRoad(road, null, bus.routeSteps) === null) return` before `bus.setRouteSteps(routeStepsOf(road))`; pass literal `null` (not `bus.activeWalk`), leave `lastPublished` untouched, leave the dependency array and `eslint-disable` as they are.
4. Update the hook's doc comment: replace the "Without `dedup` …" sentence with the publishes-unless-`routeSteps`-already-equal wording, and correct the "after any clear" sentence to say it republishes whenever `activeWalk` goes from set to null (a `clearRoute()` with no walk does not).
5. Keep the editor's `dedup` path unchanged (same `publishableRoad(road, bus.activeWalk, lastPublished)` call).
6. In `src/state/walk/presented.test.ts`, add viewer-path cases in the file's existing `describe`/`it` style for `activeWalk === null` with last-sent = the bus's route: a non-empty road against an empty route `[]` returns the road; a road against a different route (a saved walk's first stop) returns the road; keep the existing "same road, even as a fresh array" → `null` case.
7. Run `npm run verify`, then the three browser checks.

Files: `src/state/walk/presented.ts`, `src/state/walk/presented.test.ts`, `tools/studio-spike/browsertest-presenter.mjs`

Out of scope: `src/state/bus.ts`, `src/instruments/WalkViewer.tsx` and `src/instruments/walkdesk/WalkEditorView.tsx` are not edited; no helper is added; `bus.routeSteps` is not added to the effect's dependency list; `lastPublished` is not recorded on the no-`dedup` path; the editor's `dedup` path stays as it is.

Verify: Open the Plan preset, add the Trail pane, click a stop of the draft road in the editor, press ▶, present to stop 4, end, and close the presenter — the Trail pane's count reads the same as before ▶ (e.g. `2 visited` stays `2 visited`), with focus and pins unchanged.
```
npm run verify
node tools/studio-spike/browsertest-presenter.mjs
node tools/studio-spike/browsertest-walkvisibility.mjs
node tools/studio-spike/browsertest-walkdock.mjs
```

Assumptions: the two new viewer-path cases go in a new `describe('publishableRoad — the walk viewer, the bus’s own route as the last sent', …)` block following the existing naming pattern; the pre-change baseline run expects only the `and its trail has not grown` assertion to fail (a focus or pins failure stops the work); "different route (a saved walk’s first stop)" is modelled as `routeStepsOf(road(C))` with the road being `road(A, B)`, since the test file has no saved-walk step fixture beyond `routeStepsOf`.