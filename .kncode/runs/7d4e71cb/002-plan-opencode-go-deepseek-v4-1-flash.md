1. Add `src/present/presenterbus.ts`: a pure `presenterBus(deskBus, walkId)` that spreads the desk bus, overrides `activeWalk`/`draftCursor`, and replaces the six writers with stable module-level no-ops.
2. Rewrite `src/present/PresenterScreen.tsx`: add `walkId`/`startStop` props, build the view each render, hand it to `useWalkPlayback` and the wall `MapView`, initialise `activeStop`/`covered` from the clamped `startStop`, key the notebook off the view, delete the focus-reporting effect, and correct the header/type/effect comments.
3. Add `src/present/presenterbus.test.ts`: spy desk bus, prove the six view writers never call the desk's writers, prove `activeWalk` follows `walkId` (null gives null), and prove `focus`/`route`/`trail` pass through by reference.
4. Add and export `stopPlayback()` in `src/state/walk/playback.ts`, wrapping the existing `setPlaying(false)`.
5. Update `src/studio/StudioView.tsx`: capture `walkId` and `startStop` from `bus.activeWalk`/`usePresentedRoad`/`playSteps`/`lectureStart` when the presenter opens, keep them in the `presenter` state, call `stopPlayback()` on both open paths, pass the two props, and rewrite the return-effect comment.
6. Extend `tools/studio-spike/browsertest-presenter.mjs` with two round-trip checks: one with an active saved walk and one with the Plan draft, reading `[data-focus]`, the `data-step`/`data-step-end` pin set and the Trail count before ▶ and after ending/closing the presenter.
7. Run the full verification and the four named browser tests.

Files: `src/present/presenterbus.ts` (new), `src/present/presenterbus.test.ts` (new), `src/present/PresenterScreen.tsx`, `src/state/walk/playback.ts`, `src/studio/StudioView.tsx`, `tools/studio-spike/browsertest-presenter.mjs`

Out of scope: `src/state/bus.ts` must not be edited; `WalkViewer`/`MapView` shared-hook behaviour must stay unchanged; giving the presenter's wall the lecture's own route is #485, not this card; the `walkId`/`startStop` prop names must not be renamed.

Verify: Open Explore, add the Trail, activate a saved walk, advance it on the map dock, note the focused node, pin set and "Trail — N visited"; present to stop 4, end and close the presenter; the desk still shows the same focus, pins and trail. Repeat from Plan with the draft road and no active walk.
```
npm run verify
node tools/studio-spike/browsertest-presenter.mjs
node tools/studio-spike/browsertest-presenter-panes.mjs
node tools/studio-spike/browsertest-walkvisibility.mjs
node tools/studio-spike/browsertest-walkdock.mjs
```

Assumptions: `walkId: undefined` behaves like null (the draft road); both open paths (toolbar ▶ from idle and palette Present) capture the snapshot and call `stopPlayback`, while resume/preview-after-end keep the captured values; the presenter's notebook key follows `view.activeWalk`; in the browser checks I zoom to L2 before the baseline and, for the draft case, toggle the draft's optionals after focusing an early stop, so the return peek's level change and the benched `WalkViewer`'s route republish cannot be mistaken for the presenter changing the desk.