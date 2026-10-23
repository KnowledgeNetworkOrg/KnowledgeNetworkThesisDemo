1. Add `publishableRoad(road, activeWalk, lastPublished)` to `presented.ts`, returning `null` when a saved walk is active or the serialized route steps equal the last published road.
2. Add a module-level `lastPublished` in `presented.ts`; widen `PublishedRouteBus` with `activeWalk` and make `usePublishPresentedRoute` call the pure function, record what it published, and re-run on road or active-walk changes.
3. Update the hook's docblock to state the saved-walk opt-out, the no-republish rule, and the post-clear behaviour.
4. Add `src/state/walk/presented.test.ts` covering: active walk for new and edited roads, equal-to-last including the empty-route-after-clear case, and a changed road.
5. Extend `browsertest-walkvisibility.mjs` with a saved-walk pin-set check across Present→Plan and a Trail count check across Plan→Present→Plan.
6. Run `npm run verify` and the two browser drivers, fixing any type or test failures.

Files: `src/state/walk/presented.ts`, `src/state/walk/presented.test.ts`, `tools/studio-spike/browsertest-walkvisibility.mjs` (`WalkEditorView.tsx` only if the widened type requires it, which it should not).

Out of scope: `src/state/walk/authordraft.ts` (#482 owns it); `package.json` and adding a DOM test environment; `WalkViewer.tsx` needs no edit.

Verify: Load a saved walk from the Trail, press the palette's Present, then pick Plan — the map still draws the saved walk's pins instead of the draft road; then start in Plan, press Present, pick Plan again, and the trail count stays put.
`npm run verify`
`node tools/studio-spike/browsertest-walkvisibility.mjs`
`node tools/studio-spike/browsertest-presenter.mjs`

Assumptions: `lastPublished` holds the last `RouteStep[]` published and is compared via `JSON.stringify`; the trail check focuses the draft's first stop before Present so the presenter's own focus write is deduped at the log tip and only the remount publish can change the count.