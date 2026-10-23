**Must fix:** none

**Optional:** none

**Nit:** none

I checked each settled finding against the code rather than the reply: `publishableRoad` exists with the active-walk opt-out and serialized comparison (`src/state/walk/presented.ts:40-47`), the module `lastPublished` (`presented.ts:50`) is recorded only on an editor publish (`presented.ts:91-95`), the editor opts into it (`WalkEditorView.tsx:85`) while the viewer stays on main's path (`WalkViewer.tsx:39`), the docblock states the editor-only quiet-after-clear rule and the viewer's republish (`presented.ts:59-71`), the first-publish test replaced the duplicate clear test (`presented.test.ts:39-43`), and the driver reads `data-step` + `data-step-end` with the trail block removed (`browsertest-walkvisibility.mjs:158-171`). `npm run verify` components, the new tests, and `browsertest-walkvisibility.mjs`, `browsertest-presenter.mjs` and `browsertest-walkdock.mjs` all pass.

**Noticed outside this card's scope:** `src/state/walk/authordraft.ts:208` still says the editor publishes on every change; #482 owns that file, so it was left untouched.

Assumptions: the pin-set check fails on `main` because the remounted editor publishes the draft's multi-stop road (step runs wider than the saved walk's `1-1`), and the saved-walk prefix is one stop at every camera level, which is why the level-independent `data-step`/`data-step-end` reading is stable after the presenter's re-peek.