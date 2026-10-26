1. Extend `lecturenotes.ts`: add `LectureFlag`, the v2 `LectureNotebook` (`notes`/`legacy`/`prepared`), `NOTEBOOK_VERSION = 2`, the `migrations[1]` v1-to-v2 move, and a `parseNotebook` that keeps `legacy` verbatim while parsing current flags defensively.
2. Replace `addNote`/`editNote`/`deleteNote` with `addFlag`, `setFlagText`, `setFlagCategory`, `resolveFlag` and `flaggedStops`, including bare-flag (`text: ''`) and resolve-never-erase behaviour.
3. Add the per-stop prepared store: `loadPrepared` (once-only copy from scanned notebooks when the key is absent), `savePrepared`, and the pure map-based `setPrepared` with `{ text, at }`, blank-clears, newest-`at`/last-key tie rule, and stub-safe key scanning.
4. Add the per-course session store: `sessionsKey`, `loadSessions`, `saveSessions`, and pure create/rename/meets/delete/write-`last` ops using the v1 envelope and storing `last.at` as ms.
5. Extend habits with `usualFlag`, `chatWidth`, `preparedHeight`, guarded by non-empty-string/finite-number checks, and stop reading/writing `duringWidth`.
6. Rewire `PresenterScreen.tsx` only as required: mint a mount `lectureId`, save flags with `stopId`, commit text via `setFlagText`, make the bin resolve, read/write per-stop prepared notes, pass `chatWidth`, and count only unresolved notes in the recap.
7. Rewrite `lecturenotes.test.ts`: update the existing v2 shapes, moved-`.v1`/future payload expectations and habits fixtures; add v1-to-v2 legacy, prepared-copy/tie/idempotence, bare-flag/resolve, sessions-separate/`last`, and habits round-trip/type tests on fresh, future-safe keys.
8. Update `browsertest-presenter-panes.mjs`: assert stored flags carry `lectureId` and `stopId`, and move the two prepared checks to `pkt.lecture.prepared` (`data[stopId].text`), leaving the other notebook read intact.
9. Run the full verification and the browser check; fix only regressions inside these files.

Files: `src/present/lecturenotes.ts`, `src/present/lecturenotes.test.ts`, `src/present/PresenterScreen.tsx`, `tools/studio-spike/browsertest-presenter-panes.mjs`

Out of scope: adding a parallel store or a new sessions module; filtering notebook flags by `lectureId`/`sessionId` (that is #486); replacing `flags`, `toggleFlag`, the `f` key, the deck flag tile or `FilmRoll onToggleFlag` with `flaggedStops`/the chip (that is #486); wiring `usualFlag` or `preparedHeight` into the pane (that is #486); changing the categories/habits payload versions; changing the two `<div>` styles owned by #494; any design-system file; any locked file.

Verify: Open the presenter, type a flag, edit a prepared note and reload — the flag still shows with a non-empty `lectureId` and `stopId`, the prepared text survives under `pkt.lecture.prepared`, and a previously stored v1 notebook now has empty `notes`, its old notes only in `legacy`, and is stored as v2; two session stores under different course keys remain separate after reload.
```
npm run verify
node tools/studio-spike/browsertest-presenter-panes.mjs
```

Assumptions: `flaggedStops` returns a `Set<string>`; `addFlag` takes `Omit<LectureFlag, 'id'>`; the session ops are pure list transforms named `createSession` (append, returning `{ sessions, id }`), `renameSession`, `setSessionMeets`, `deleteSession`, `writeSessionLast`; `setPrepared` trims text and returns the same map when the text is unchanged (no restamp); `parseNotebook` keeps the existing object/`text` guard on current `notes` while `legacy` is unfiltered; `lectureId` is minted with the existing `mintNoteId` at mount and `sessionId` is omitted; the prepared copy skips blank/non-string values and ignores non-finite note `at`s.