I read the full diff against the card and found nothing that must be fixed. I did not run the browser drivers, because that would start vite and write files. I checked their selectors, roles, titles and flows against the `src/ds` ports and `StudioView` by reading.

**Must fix:** none.

**Optional:** none.

**Nit:** none.

**R0-1 (the open finding): FIXED.** Check 7 in `tools/studio-spike/browsertest-presenter-start.mjs` no longer compares against the DS defaults 150 and 220.
- **What it measures:** the drawn `[data-notes-prepared]` height and the chat column's width, before and after the two drags. It asserts both changed.
- **After the reload:** it starts a live lecture and measures both again, then compares them with the post-drag sizes.
- **Selectors:** they match the DS port. The prepared separator's title starts "drag to resize the prepared…", so `[title^="drag to resize ·"]` reaches only the chat divider.

**What I confirmed against the card:**
- **`lectureFlags`:** it keeps resolved entries and returns the same book object when nothing is dropped. Its unit test covers both.
- **Flags and the preview:** `recordFlag` returns early while not projecting, and the roll's marks come from the lecture's own entries (open ones only). The preview pane still shows the whole notebook.
- **Old flag model:** the `flags` state, `toggleFlag`, the `f` key, the deck's `flag` tile and its `deckOn` entry, `FilmRoll`'s `onToggleFlag`, and the pane's and recap's `flagged` are gone.
- **Live pane:** `usualFlag`, `flagTypes`, `preparedHeight` and the rest are wired as specified. `onResolveEntry` replaces the deprecated `onDeleteEntry` on both panes. Neither `onUndoEntry` nor `onRestoreEntry` is passed.
- **End screen:** `onClose={onLeave}` on the header bar. The recap gets `session` from the stored `sessions` state, `walks` from `StudioView`, the new `counts`, a held `shownStop` reset on end, `slide`, `onFlag` and the review notes as an element. `aside` and `actions` are not passed.
- **Drivers and scope:** the panes, presenter and start drivers match the card's list, and no stale F, `flag` tile, "notes taken" or recap-scoped close lookup remains. The clicker driver changed only a comment. Nothing outside the card's files changed, and `StudioView` changed only to pass `walks={walkList}`.

**Assumptions:** `counts.slides` is distinct stops with an open flag. The palette preview's marks use the presenter's own lecture entries even though its pane shows the whole notebook. After the recap's Present preset the screen is a true preview, because `projecting` going false resets `ended`, so check 8 does exercise the early return in `recordFlag`.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R0-1","answer":"Fixed","because":"Check 7 in browsertest-presenter-start.mjs (lines ~373-399 and ~436-441) no longer hard-codes 150/220. It measures the drawn \u0060[data-notes-prepared]\u0060 height and the chat column\u0027s width (via the \u0022Messages from students appear here\u0022 element\u0027s parent) before and after the two drags, asserts both changed, then after a reload starts a live lecture and re-measures both, comparing the drawn sizes to the post-drag sizes. The selectors exist in src/ds/presenter/LectureNotes.tsx (\u0060data-notes-prepared\u0060, the separator labelled \u0022resize the prepared notes and the flags\u0022, the chat divider titled \u0022drag to resize \u00B7 \u2026\u0022); the prepared separator\u0027s title starts \u0022drag to resize the prepared\u2026\u0022, so the \u0060[title^=\u0022drag to resize \u00B7\u0022]\u0060 locator hits only the chat divider.","duplicateOf":null}]}
-->
