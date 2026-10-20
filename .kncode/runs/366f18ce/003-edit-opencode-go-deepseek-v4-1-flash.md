Implemented the notes/deck divider for OB-254.

- Added `LECTURE_NOTES_FIT` derived from `LECTURE_NOTES_METRICS` (522, both numbers equal) and `QUICK_ACTIONS_FIT` (`300/300/360`), exported both through `src/ds/index.ts`, with a unit test pinning the values.
- `PresenterScreen.tsx` now measures the panes row, derives the drawn deck width every render, clamps drags with `clampDesk` over the two fits, stores the width only on `onDragEnd`, and resets to the seed on double-click/Enter.
- Removed the row's 12px gap, mounted the 14px transparent `PaneDivider`, and updated the browser panes test for the strip, drag floors, reset, and narrow-window visibility.
- Updated both `PROVENANCE.json` entries.

Checks run: `panefit.test.ts`, file-scoped ESLint, and `node --check` on the browser test.

Assumptions: `design-sync.md` and `PaneDivider.d.ts` are not in this checkout, so the card's constants and host rules were treated as the contract; below 836px, where both floors cannot fit, the deck holds its 300px floor and the notes pane gives way so the handle stays visible; the deck width lives only in component state (`null` = seed) because persistence is #368; a gesture that ends without changing the width stores nothing, following `RailFrame`'s precedent.