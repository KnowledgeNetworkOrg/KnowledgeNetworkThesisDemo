## What changed

**`src/present/PresenterScreen.tsx`**
- The presenter column now scrolls: `overflowY: 'auto'`, `overflowX: 'hidden'`, `scrollbarGutter: 'stable'`, with `flex: 1, minHeight: 0` kept. The reserved gutter stops the roll resizing when a scrollbar appears or disappears.
- The `data-presenter-panes` row now keeps the notes pane’s floor: `flex: '1 1 0'` and `minHeight: LECTURE_NOTES_FIT.minHeight`, never a literal 340.
- The comment above the column now says the pane keeps `LECTURE_NOTES_FIT.minHeight` and the column scrolls below it.

**`tools/studio-spike/browsertest-presenter-panes.mjs`**
- Added a self-contained block covering done-whens 1–4: framed and live at 1280×720 (pane ≥ 340px, column scroll, pane bottom inside after scrolling, composer inside the pane’s foot, six typed flags overflowing the During column), a 1280×1200 tall window (no column scroll, pane fills below the strip), and the open quick-actions shelf checked at its four corners with `elementFromPoint`.

## Step 0 measurements (pre-change, Edge/Chromium headless, 1280×720)

| | `studio-presenter` scrollWidth / clientWidth | column scrollWidth / clientWidth | screen right | column right | widest descendant |
|---|---|---|---|---|---|
| framed | 1254 / 1254 | 1254 / 1254 | 1268 | 1267 | unlabelled `div`, width 1230, right 1255 |
| live | 1280 / 1280 | 1280 / 1280 | 1280 | 1280 | unlabelled `div`, width 1256, right 1268 |

Window width was 1280. The notes pane was 153px framed and 262px live before the change, both below 340, so **1280×720 is the squeezing size**; 1280×600 was not needed.

The right-edge spill did **not** reproduce in the Chromium/Edge driver at 1280×720: no `scrollWidth` excess and no right edge past `window.innerWidth`. I am not reporting it absent in Firefox, which was not available to this run.

## Other notes
- The quick-actions shelf is **not** clipped by the column at 1280×720: all four corners hit the shelf or its child.
- `src/ds/presenter/LectureNotes.tsx:530–534` is unchanged; its pre-26-Oct “`min-height: 0` / never wrap it in a scrolling ancestor” text still needs noting on drift log #74.
- `node tools/studio-spike/browsertest-presenter-panes.mjs` passes: **70 checks**. `node --check` on the driver also passes. Full `npm run verify` was left to the check step.

Assumptions: the During column’s actual scroll container is the `PaneScroller` inside `[data-notes-during]`, so the six-flag check reads that element’s `scrollHeight`/`clientHeight`; the presenter column is identified as the parent of `[data-presenter-panes]` because it carries no data attribute; step 0 was measured by temporarily restoring the pre-change inline styles and then re-applying the change, with the throwaway probe deleted; only Chromium/Edge was used, not Firefox; `npm ci` was run so the browser driver could execute, which only populates the untracked `node_modules`.