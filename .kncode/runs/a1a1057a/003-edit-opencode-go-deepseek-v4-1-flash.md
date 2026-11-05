Implemented the card's changes:

- Added `lectureFlags(book, lectureId)` to `src/present/lecturenotes.ts`, plus a unit test that keeps only the lecture's entries (resolved included) and returns the same book when nothing is filtered.
- Rewired `PresenterScreen.tsx`:
  - derived the lecture notebook and the open-flag `flags` indexes from `flaggedStops`;
  - added a shared `recordFlag` that writes bare flags with `lectureId`, `sessionId`, `stop`, `stopId`, `category`, `at` and `when`, and records nothing in the preview;
  - passed `usualFlag`, `flagTypes`, `preparedHeight` and the category/resolve handlers to both panes;
  - removed the old `flags` state, `toggleFlag`, the `F` key, the deck's flag tile, `FilmRoll`'s `onToggleFlag`, the live pane's old flag props, and the recap's `flagged` list;
  - gave the header bar `onClose`, added `walks`, held `shownStop`, passed the stored `session`, the new `counts` wording, the preview slide, the recap chip, and the review `LectureNotes` as an element without `aside`/`actions`.
- Passed `walks={walkList}` from `StudioView.tsx`.
- Updated the four drivers: five shelf actions and strip-based deck checks in the panes driver, header-bar close lookups in the presenter driver, the clicker comment, and the nine new flags-v4 checks in the start driver.

Assumptions:
- `counts.slides` counts distinct stops with an **open** flag; resolved flags are counted nowhere.
- The preview's derived roll marks use the preview lecture's own entries, while its notes pane still shows the whole notebook.
- `shownStop` resets to 0 on the end action; a null `sessionId` becomes `undefined` on stored entries.
- I could not run `vitest` because `node_modules` is absent in this checkout; I did run `node --check` on all four drivers successfully.