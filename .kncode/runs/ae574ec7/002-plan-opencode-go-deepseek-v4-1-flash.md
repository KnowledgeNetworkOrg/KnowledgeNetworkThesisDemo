1. Read the start-card contract and the presenter/studio wiring; confirm the session store, bus and playback APIs.
2. Add a pure `lectureLast(...)` builder to `src/present/lecture.ts` (walk id/title, stop, stop id, of, at, stop title, dotted address via `walkAddresses`) and test it in `src/present/lecture.test.ts`.
3. Extend `presenterBus(deskBus, walkId, lectureSteps?)` so it can publish the lecture's own flat route (ids plus optional flags) when the lecture's walk is not the desk's, keeping the current pass-through when no steps are given; add route-override assertions to `presenterbus.test.ts`.
4. In `PresenterScreen`, take `lectureId`, `sessionId` and `keys` as props; drop the mount-time lecture mint; return early from its key handler when `keys` is false; build the lecture route for the wall map; and write the session's `last` on confirm-end (reading the stored list, `writeSessionLast`, `saveSessions`, keeping the list in state) plus a guarded best-effort write on unmount while live.
5. In `StudioView`, add the start-card state (`sections` loaded with `loadSessions(sessionsKey())`, `selectedId` reset to null on every open), load each open, and wire add/rename/meets/delete through #483's functions with `saveSessions` outside updaters.
6. Change `pressPresent`: idle/preview opens the card; ended keeps the synchronous resume; live stays disabled. `onStart` creates a new session if asked, mints `lectureId`, resolves `walkId`/`draft`/unknown, clamps `stop`, opens the projector window synchronously, and stores the start record with an incrementing counter used as `PresenterScreen`'s key.
7. Extract one non-exported walk-list builder in `StudioView` serving both `loadMaps` and the card (stops carry `id`), pass `openWalk` only when the walk is found, omit `reading`, and render the card in a fixed scrim layer at `WARNING_DIALOG_METRICS.z` with pointer-down-to-cancel.
8. Pass `keys={startCard === null}` and the new props to `PresenterScreen`, and key it by the start counter so a start over the preview reseeds the mounted presenter while an ended resume does not.
9. Update the five drivers: wait for `[role="dialog"][aria-label="Start presenting"]` after each ▶ that starts a lecture and press Enter, putting the Enter inside the same `Promise.all` where a projector page event is awaited; leave the ended-resume press and #499's optionals step alone.
10. Add `tools/studio-spike/browsertest-presenter-start.mjs`, starting vite through `startVite()` and deriving the repo root from its own location, covering the eight `done when` checks (including cancel leaving storage untouched, the saved-walk continue/finished wording, reload persistence, and Escape/↓ over the preview).
11. Run `npm run verify` plus the six browser drivers and fix any fallout.

Files: `src/studio/StudioView.tsx`, `src/present/PresenterScreen.tsx`, `src/present/presenterbus.ts`, `src/present/presenterbus.test.ts`, `src/present/lecture.ts`, `src/present/lecture.test.ts`, `tools/studio-spike/browsertest-presenter.mjs`, `tools/studio-spike/browsertest-presenter-panes.mjs`, `tools/studio-spike/browsertest-presenterclicker.mjs`, `tools/studio-spike/browsertest-rules-washes-baselines.mjs`, `tools/studio-spike/browsertest-scrollbarclearance.mjs`, `tools/studio-spike/browsertest-presenter-start.mjs` (new)

Out of scope: `AppToolbar.tsx` is not changed; the walk list function must not be exported; the palette's Present preset must never open the card and the preview stays read-only; the #484 draft case in `browsertest-presenter.mjs` (the optionals toggle, ~line 700, reserved for #499) is left alone; presenting must not load the chosen walk onto the desk or move its focus/route/trail; `design-system/` files are never edited, and `StudioApp.jsx`'s styles and storage are not copied; no `reading` place is added.

Verify: On a fresh app, press ▶ and the Start card appears over the desk with "+ New session" lit; press Enter and the chrome drops, the lecture goes live and the projector window opens; end it, press ▶ again, and the card's Continue row names the walk and the stop just taught rather than starting over.
```
npm run verify
node tools/studio-spike/browsertest-presenter-start.mjs
node tools/studio-spike/browsertest-presenter.mjs
node tools/studio-spike/browsertest-presenter-panes.mjs
node tools/studio-spike/browsertest-presenterclicker.mjs
node tools/studio-spike/browsertest-rules-washes-baselines.mjs
node tools/studio-spike/browsertest-scrollbarclearance.mjs
```

Assumptions: `course` is passed as the open map's title (`byId.get(ROOT_ID)?.title ?? 'this map'`); the lecture's own route overrides the desk's also when the lecture plays the draft while the desk holds a saved walk; `lectureId` becomes a required `PresenterScreen` prop minted in `StudioView` (preview included); the unmount write is guarded by `projecting && !ended && N > 0 && sessionId != null`, so StrictMode's simulated unmount safely writes at most stop 0; "stop 4" means index 3; the new driver uses the first authored walk in the Trail pane and asserts it has at least five stops; the card's ↓ highlight is observed through the start row's border colour because the card exposes no aria state for it.