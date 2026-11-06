1. Add `blank: boolean` to `ProjectedState` and to `NOTHING_PROJECTED` in `src/present/projector.ts`, plus a small pure `blankKey(key, { ended, modified })` decision helper so the B rule is testable without rendering React.
2. Extend `src/present/projector.test.ts`: add `blank` to the live fixture, assert `NOTHING_PROJECTED.blank` is false, and test that B/b toggles only while live while W, ended, or modified presses do nothing.
3. In `src/present/PresenterScreen.tsx`, add `const [blank, setBlank] = useState(false)` beside `mapUp`, handle B in the existing keydown chain after the typing/modifier guards and only when `!ended`, reset it on end and on projecting/preview transitions, and publish `blank: blank && !ended` in the `projected` memo.
4. In `src/present/ProjectorScreen.tsx`, treat `state.blank` as the dark case: `data-projector="dark"`, no slide rendered, with the placeholder caption suppressed so the room is actually blank.
5. Add B scenarios to `tools/studio-spike/browsertest-presenter.mjs`: blank while the presenter stays unchanged, step while blank, B restores the new stop, B after end does nothing, and a reloaded projector while blank is dark.
6. Run the build, unit tests, lint, and the presenter browser test.

Files: `src/present/projector.ts`, `src/present/projector.test.ts`, `src/present/PresenterScreen.tsx`, `src/present/ProjectorScreen.tsx`, `tools/studio-spike/browsertest-presenter.mjs`

Out of scope: no W key or white fill; no new projector message kind and no change to `isProjectorMessage`; no new visible control or design component, and no change to the presenter screen's own layout/content; only B toggles, so stepping/roaming must not unblank the room.

Verify: Start a lecture in one window and observe the projector window; press B and the projector turns dark while the presenter screen still shows the current stop; press → and the projector stays dark; press B again and the projector shows the new stop; reload the projector window while blanked and it comes up dark.
```
npm run build
npm test
node tools/studio-spike/browsertest-presenter.mjs
npm run lint
```

Assumptions: Ending the lecture, going back to preview, and starting/resuming clear `blank` (mirroring `mapUp`), so a resumed lecture shows its stop rather than staying blank; the blank dark view hides the “nothing is projected” caption, while `closed` still shows “the lecture has closed”; Shift+B is treated as a modifier-held press and ignored, but Caps Lock B works; no key-help list exists in the presenter today, so no hint is added.