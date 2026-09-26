I made no edits this round: neither finding needed one.

1. **Not fixed, because the problem is no longer in the file.** The reviewer quoted a comment that named the design system's global timer (`window.PKT_SB.LEAVE`), which would break the menu-wash item's rule that searching the card's folder for that name finds nothing. The comment there now says "the shared recede clock's (`recedeMs()`)". `recedeMs()` is the repo's own helper for that half-second delay, and it exists in the shared button file. I searched the card's whole folder, including the new unit test, and the size-check test page: the global's name appears nowhere. So the ledger's claim that the search "finds nothing" is true as written. The ledger now says the behaviour is "Pinned … by" the tests, not "Proven … by" as the reviewer quoted. The reviewer most likely read an earlier version of the change.

2. **Not fixed, deliberately: the running is deferred to the final check step.** At the last gate you said to leave running for the check step, and this step only allows editing files. Nothing has been run yet, so nothing is confirmed to pass. That covers the full verify, the build, the browser tests, and both screenshot drivers. The "did the change take" test is ready to run in that step. The size-check page sets the new "has an ungroup button" flag in three places (`tools/studio-spike/foldab/main.tsx`, lines 235, 301 and 302). The check step should:
   - run the driver once with those three flags removed, where it should report drift;
   - run it again with them restored, where it should agree.

   If the first run shows no drift, the receipt should say so rather than claim the check passed.

Nothing in the project behaves differently after this step.

Assumptions: For finding 1, I treated the file as it is now as the thing to judge, not the text the reviewer quoted. For finding 2, I read your "leave for the last step" as covering all the running the reviewer asked for, including the drift test on the size-check driver, so I didn't change the ledger's wording to hedge about results that don't exist yet.