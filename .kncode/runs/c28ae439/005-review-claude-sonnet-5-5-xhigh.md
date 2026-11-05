I found no Must fix problems. The three optional and nit points are below. I ran the panes, clicker and presenter browser drivers, and all three pass: 70, 13 and 91 checks. ESLint is clean on the three changed files, and `tsc --noEmit` on `tsconfig.app.json` reports no errors. I did not run the full `npm run verify`, since its `vite build` would write files.

**What the diff does**
- **Column:** `src/present/PresenterScreen.tsx:411` adds `overflowY: 'auto'`, `overflowX: 'hidden'` and `scrollbarGutter: 'stable'`, and keeps `flex: 1, minHeight: 0`.
- **Panes row:** line 454 is now `flex: '1 1 0', minHeight: LECTURE_NOTES_FIT.minHeight`. Both done-when 5 greps find their lines.
- **Comment:** the comment above the column no longer says `min-height: 0`. It now says the pane keeps `LECTURE_NOTES_FIT.minHeight` and the column scrolls below it.
- **Panes driver:** `browsertest-presenter-panes.mjs` has a block of its own covering done-when 1 to 4. It would fail without the fix: at 1280×720 the column content is 745px in a 561px column, so the pane would have been squeezed to about 156px.
- **Clicker driver:** `browsertest-presenterclicker.mjs` now caps `[data-quick-deck]` at 80px and rewrites the stale comment, as the person asked. The deck reports `max 84`, so it has room to scroll.
- **Scope:** nothing outside the three files changed, and `design-system/` and `src/ds/` are untouched.

Must fix:
none

Optional:
1. `tools/studio-spike/browsertest-presenter-panes.mjs:~523`: the live half never types six flags. It reuses the six typed in the framed preview and checks they "still scroll" (216 > 104 both times). Done-when 2 says live is "the same as 1", which includes typing them. If notes stop carrying between framed and live (for example when #483 mints a `lectureId` on mount), this check would fail for a reason unrelated to this card. Typing six flags with `write()` after going live would remove that dependency.

Nit:
1. `tools/studio-spike/browsertest-presenter-panes.mjs:22`: the header comment of the driver lists what it covers and does not mention the new OB-305 block.
2. `tools/studio-spike/browsertest-presenter-panes.mjs:~433`: done-when 1 names `[data-notes-during]` as the element with `scrollHeight > clientHeight`. The test measures the inner `[data-pane-body="scroller"]` instead, which is the right element because the wrapper does not overflow itself. The pull request should say so, and the `|| during` fallback would hide a missing scroller.

Noticed outside this card's scope:
- Step 0's eight numbers, the widest child, the Firefox result and the chosen viewport (done-when 6) are pull-request content, so they are not in this diff and I could not check them.
- No probe file is left in `tools/studio-spike/`.
- The drift-log #74 comment about `LectureNotes.tsx:530` to `:534` also belongs in the pull request, not the code.

Assumptions: I took the removal of the `1750×560` `setViewportSize` line from the clicker driver as part of "stop relying on a short window". It is a mild reading of "change nothing else in the test", but the line existed only for the overflow premise. I did not re-take step 0's measurements.

<!-- kncode-findings
{"reports":[{"id":"R0-2","raisedAgain":false,"bucket":"Optional","what":"The live half of the new block does not type six flags; it reuses the six typed in the framed preview and checks they \u0022still scroll\u0022. Done-when 2 says live \u0022the same as 1\u0022, which includes typing six flags in the composer. The check passes today only because the framed notes carry into the live lecture (both runs read 216 \u003E 104). If notes stop carrying (for example #483 minting a lectureId on mount), the check fails for a reason unrelated to this card. Typing six flags with write() after going live would match the card and drop the dependency.","file":"tools/studio-spike/browsertest-presenter-panes.mjs","line":523,"breaks":"Done-when 2: \u0022Live (the toolbar\u0027s \u25B6), at 1280\u00D7720, the same as 1\u0022 (six typed flags scroll inside the During column)","failure":null},{"id":"R0-3","raisedAgain":false,"bucket":"Nit","what":"The driver\u0027s header comment (lines 1\u201324) lists what the test covers and does not mention the new OB-305 block (the 340px notes floor, the scrolling column, the quick actions shelf not clipped). It is now out of date.","file":"tools/studio-spike/browsertest-presenter-panes.mjs","line":22,"breaks":"Card step 3, \u0022Keep the code\u0027s words true\u0022: the file\u0027s own summary of what it checks no longer matches what it checks.","failure":null},{"id":"R0-4","raisedAgain":false,"bucket":"Nit","what":"Done-when 1 names \u0060[data-notes-during]\u0060 itself as the element with scrollHeight \u003E clientHeight. The test measures the inner \u0060[data-pane-body=\u0022scroller\u0022]\u0060 and falls back to the wrapper only if no scroller exists. The wrapper is a flex column around a PaneScroller and does not overflow itself, so the inner scroller is the right element to measure. The pull request should say that the card\u0027s literal element was not the one measured. The \u0060|| during\u0060 fallback would hide a missing scroller.","file":"tools/studio-spike/browsertest-presenter-panes.mjs","line":433,"breaks":"Done-when 1: \u0022\u0060[data-notes-during]\u0060 has \u0060scrollHeight \u003E clientHeight\u0060\u0022 is checked on a different element than the one the card names.","failure":null}],"answers":[]}
-->
