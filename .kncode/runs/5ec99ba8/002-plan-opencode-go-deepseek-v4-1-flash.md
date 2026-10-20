1. Write a dedicated browser driver that opens the presenter, starts the lecture, records the stop and scroll position, presses `PageDown` / `PageUp`, and asserts the stop advances and returns with no pane scroll.
2. Run that driver against unmodified `PresenterScreen.tsx` to record the required red failure.
3. In `PresenterScreen.tsx`, add `PageDown` / `ArrowDown` as next and `PageUp` / `ArrowUp` as back; keep `Backspace` as “stop roaming”; leave Space/Enter unbound because they activate focused tiles, buttons and finder rows.
4. Keep the existing guards and `preventDefault`-only-when-claimed behaviour, and update the handler comment to name the clicker keys and the Space/Enter decision.
5. Rerun the driver green, then run the full build, lint and test suites.

Files: `src/present/PresenterScreen.tsx`, `tools/studio-spike/browsertest-presenterclicker.mjs` (new)

Out of scope: the clicker working while another window has focus (#205).

Verify: open the presenter in the app, start the lecture with ▶, press `PageDown` — the displayed stop advances to the next one and the roll/projector follows; press `PageUp` — it returns to the previous stop, and nothing under the deck scrolls. Before the fix, the new driver fails on the `PageDown` assertion.
```
npm run build
npm run lint
npm run test
node tools/studio-spike/browsertest-presenterclicker.mjs
```

Assumptions: Space and Enter are deliberately not bound because they activate focused presenter controls and Enter already picks in the finder; `PageDown`/`PageUp` follow existing arrow semantics, so while roaming they move the roam rather than the record; `session.ts` is left untouched as unused reference material.