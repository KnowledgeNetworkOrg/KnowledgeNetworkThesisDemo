The document pane now stays on the page you were reading when you clear a selection, but I couldn't run any test, so none of this has been run. The checkout has no installed packages, so the browser test stopped at "Cannot find module 'playwright-core'". I could only check that both edited test files parse, and they do. The type-check and lint didn't run either.

**What changed.** The pane now remembers the last node that was selected. When the selection is cleared by clicking the selected Explorer row, clicking empty water on the map, or pressing Esc, the Explorer pill and the map ring go off and the page stays. Selecting any node, including the one just cleared, moves the document to it as before. On first load, before anything has ever been selected, the pane still shows "Nothing chosen" rather than the curriculum root.

**Where.** The fix is in the document pane's file, with its header comment rewritten to match.

**Tests.** I rewrote the part of the Relations-rail browser test that asserted the old empty pane. It now runs the three gestures one after another and checks four things after each:
- the map ring is off;
- the Explorer pill is off;
- the page is still drawn;
- no preview stands in for it.

It also checks that re-selecting the node moves the document to it. Before the first gesture it checks the map ring and the document are both on the node, so the test can't pass on nothing. Further checks cover three cases:
- a hover over a map cell previews that node over the resting page, and the pane returns to the resting page when the pointer leaves;
- selecting a second node and clearing it rests the pane on the second node, not the first;
- the first-load placeholder is still asserted.

In the map-connections test I added the same "document stays" check after both of its Esc steps. I also rewrote its note that called the empty pane a bug, since the code now matches the design.

**Surprise.** The pane already showed "Nothing chosen" after a clear, not the root as the card says, and the design project's records (OB-209, OB-260) ruled that deliberate. My plan said to ask the owner before reversing it. You told me to make the changes now, so I took the card as the owner's decision and implemented it. If that ruling should stand, the three edited files are what to revert.

**Not done.** The receipt marking OB-240 done in the design project is not written. It writes to an outside project and should wait for your go-ahead after the merge. It should say it restores clause 2 and supersedes OB-260 for this case.

Assumptions: the memory lives in the pane's own state, so a Document pane opened after a clear starts on the placeholder. It remembers the last selection, not the last hover. I left the Neighborhood pane's root fallback alone because the card doesn't mention it. In the map-connections test I park the pointer inside the document pane before Esc, so a map cell under the pointer can't cause a false failure. I left the design-system copy of the preview-banner comment, which still says the pane shows "not the last node", untouched, since the card puts files under `src/ds/**` out of scope.