1. Add `lectureFlags(book, lectureId)` to `src/present/lecturenotes.ts`: keep only the lecture's entries (resolved included), return the same `book` object when nothing is filtered out, and add unit tests beside the existing flag tests.
2. In `PresenterScreen.tsx`, derive the lecture notebook and `flags: number[]` from `flaggedStops`; add a shared `recordFlag(stop, category)` that returns early while previewing and writes `{ lectureId, sessionId, stop, stopId, category, text: '', at: Date.now(), when: mmss(elapsedS) }`.
3. Wire the composer to add `sessionId`; add `onEntryCategoryChange` via `setFlagCategory`, rename `onDeleteEntry` to `onResolveEntry`, and pass `usualFlag`, `flagTypes={categories}` and `preparedHeight`/`onPreparedHeightChange` to the panes; add `onUsualFlagChange` to `FilmRoll` and `LectureRecap`.
4. Remove the old per-slide model: `flags` state, `toggleFlag`, the `f` key, the deck's `flag` tile and its `deckOn` entry, `FilmRoll onToggleFlag`, the live pane's `flagged`/`onToggleFlag`, and the recap's `flagged` list.
5. Rewire the end screen: give `PresenterHeaderBar onClose={onLeave}`; add `walks?: PresentStartCardProps['walks']` to `PresenterScreenProps` and pass `walks={walkList}` from `StudioView`; pass the recap `session` from the stored `sessions` state, the new `counts`, held `shownStop`/`stops`/`onShowStop`, `slide`, `onFlag`, and the review `LectureNotes` as an element; remove the recap's `actions` and never pass `aside`.
6. Update `browsertest-presenter-panes.mjs`: five shelf actions, use the `strip` tile for drag/reload/key checks, drop the F-key check, read the new recap stat words, and refresh the comments about the host's F.
7. Update `browsertest-presenter.mjs`: both "close the presenter" lookups move from `[data-lecture-recap]` to `[data-presenter-header]`, keeping the OB-164 pill check on the header pill.
8. Extend `browsertest-presenter-start.mjs` with the nine card checks, and change its `leavePresenter` helper to use the header pill.
9. Re-run `browsertest-presenterclicker.mjs`; adjust its recap-list locator only if the list is no longer scrollable.
10. Run `npm run verify` and all four presenter drivers, then fix any failures.

Files: `src/present/lecturenotes.ts`, `src/present/lecturenotes.test.ts`, `src/present/PresenterScreen.tsx`, `src/studio/StudioView.tsx`, `tools/studio-spike/browsertest-presenter-start.mjs`, `tools/studio-spike/browsertest-presenter-panes.mjs`, `tools/studio-spike/browsertest-presenter.mjs`, `tools/studio-spike/browsertest-presenterclicker.mjs` (only if its recap-list check needs adjusting).

Out of scope: the flags mode; the "review of flags" (open flags from earlier lectures); dropping the flags of a stop deleted from a walk; undo and "+ why"; the recap's `aside` and `actions` props; any `StudioView` change beyond `walks={walkList}`.

Verify: Start a lecture, tap the roll's chip twice on one slide, step forward and type a note on the next slide, then end — the recap's Flags list shows two slide groups and three rows, clicking a group moves the Preview column's "stop N of M" and washes that group, and the ended header bar (not the recap) carries "close the presenter".
```
npm run verify
node tools/studio-spike/browsertest-presenter-start.mjs
node tools/studio-spike/browsertest-presenter-panes.mjs
node tools/studio-spike/browsertest-presenter.mjs
node tools/studio-spike/browsertest-presenterclicker.mjs
```

Assumptions: `counts.slides` counts distinct stops with an OPEN flag, since resolved flags are counted nowhere and the derived `flags` list is open-only; the palette preview's derived marks use the presenter's own lecture entries as the card says, even though its pane still shows the whole notebook; `shownStop` resets on the end action, not on resume or preview; a null `sessionId` becomes `undefined` on entries; the header bar gets `onClose` and itself draws the pill only when ended.