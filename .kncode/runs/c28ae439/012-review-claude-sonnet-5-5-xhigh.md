I found no Must fix or Optional problems, so the verdict is PASS. I ran the panes driver (70 checks) and the clicker driver (13); both pass. I did not run `npm run verify`, because its `vite build` would write files. I did not re-run `browsertest-presenter.mjs`, which nothing in this round touches.

**Must fix:**
none

**Optional:**
none

**Nit:**
1. `tools/studio-spike/browsertest-presenterclicker.mjs:70`: the `setViewportSize({ width: 1750, height: 560 })` line was deleted along with the stale comment. The person said "Change nothing else in the test", so this goes slightly past the comment rewrite and the deck cap. It is harmless: the recap section sets its own 1750×520 viewport at line 147, and the driver passes. The pull request should say it was removed on purpose.

**Earlier findings:**
- **R0-2, FIXED:** `browsertest-presenter-panes.mjs` now goes live, types six `live … flag` notes with `write()`, and then measures the During scroller (372 > 104). It no longer depends on the framed notes carrying over.
- **R0-3, FIXED:** the driver's header comment (lines 19–21) now lists the 340px floor, the scrolling presenter column and the unclipped quick actions shelf.
- **R0-4, FIXED:**
  - The `|| during` fallback is gone, so a missing `[data-pane-body="scroller"]` gives 0 > 0 and fails.
  - The card names `[data-notes-during]` for done-when 1, but the check measures its inner scroller, because the wrapper does not overflow itself. That point belongs in the pull request, not in code.

**Card requirements:**
- **Done-when 5:** `PresenterScreen.tsx:411` has `overflowY: 'auto'`, `overflowX: 'hidden'` and `scrollbarGutter: 'stable'`, with `flex: 1, minHeight: 0` kept. Line 454 has `flex: '1 1 0', minHeight: LECTURE_NOTES_FIT.minHeight`. The comment above the column is rewritten.
- **Done-when 1 to 4:** the new OB-305 block in the panes driver covers them, and it would fail without the fix. At 1280×720 the pane holds 340px and the column scrolls (745 > 561). The composer sits inside the pane, and the pane's bottom is inside the column once scrolled to the end. Six flags overflow the During scroller, in the framed preview and live. At 1280×1200 the column does not scroll (1041 vs 1041) and the pane fills the space. With the shelf open, all four corners hit the shelf.
- **Clicker driver:** the 80px cap on `[data-quick-deck]` gives the deck room to scroll (max 84), and the comment now says the pane floor is why the cap is needed.
- **Scope:** nothing under `design-system/` or `src/ds/` changed, and no probe file was left behind.

**Noticed outside this card's scope:**
- Step 0's eight numbers, the widest child, the Firefox result and the chosen viewport (done-when 6) are pull-request content, so I could not check them in this diff.
- The comment on drift log #74 about `src/ds/presenter/LectureNotes.tsx:530–534` also belongs in the pull request.

Assumptions: I read the removal of the clicker driver's viewport line as following from "stop relying on a short window". I took the column to be the parent of `[data-presenter-panes]`, as the plan says.

<!-- kncode-findings
{"reports":[{"id":"R2-5","raisedAgain":false,"bucket":"Nit","what":"The clicker driver\u0027s \u0060await page.setViewportSize({ width: 1750, height: 560 })\u0060 line was deleted along with the stale comment. The person\u0027s answer said \u0022Change nothing else in the test\u0022; this goes a little past the comment rewrite and the deck cap. It is harmless: the recap section sets its own 1750\u00D7520 viewport at line 147, and the driver passes (13 checks). The pull request should say it was removed on purpose.","file":"tools/studio-spike/browsertest-presenterclicker.mjs","line":70,"breaks":"Person\u0027s answer: \u0022Change nothing else in the test\u0022 (the removed viewport line was the short window the person said to stop relying on)","failure":null}],"answers":[{"id":"R0-2","answer":"Fixed","because":"browsertest-presenter-panes.mjs now clicks \u25B6, then types six \u0027live \u2026 flag\u0027 notes with write() and measures the During scroller afterwards (372 \u003E 104 in my run of the driver). The check no longer relies on the framed notes carrying over.","duplicateOf":null},{"id":"R0-3","answer":"Fixed","because":"The driver\u0027s header comment (lines 19-21) now lists the OB-305 block: the 340px notes floor, the scrolling presenter column, and the unclipped quick actions shelf.","duplicateOf":null},{"id":"R0-4","answer":"Fixed","because":"paneGeometry() now measures only \u0060[data-pane-body=\u0022scroller\u0022]\u0060 inside \u0060[data-notes-during]\u0060; the \u0060|| during\u0060 fallback is gone, so a missing scroller gives 0 \u003E 0 and fails. That the card\u0027s literal element is not the one measured is pull-request wording, not code.","duplicateOf":null}]}
-->
