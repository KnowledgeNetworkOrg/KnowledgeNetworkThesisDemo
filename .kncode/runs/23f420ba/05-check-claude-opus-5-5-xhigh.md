FAIL
The new browser test for this change (browsertest-dropverdict.mjs) fails 1 of its 66 checks, "no page or console errors". The cause is an older bug outside this change: the walk dock gives two stops the same React identity key whenever a road visits the same node twice.

Commands run:
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser -- dropverdict
node tools/studio-spike/browsertest-dropverdict.mjs
npm run lint
npm run test:browser
```
I also ran a few throwaway diagnostic copies of the browser test. They lived in a temp folder outside the repository and are deleted.

**Results.** The project's standard check (`npm run verify`) passed in full: the typecheck and production build, the desktop typecheck, the linter, and all 687 unit tests in 55 files.

The new browser script starts a private copy of the app and drives it in Edge. The refusal itself now works live: the two gaps beside the twin DNS refuse the drop. They draw the dashed red line, show "already adjacent" under the held node, and leave the road, the saved draft, undo and the notices untouched. The picker greys exactly the right neighbours with their reason, and pressing a greyed row does nothing. That meets the card's requirement that the refusal be reproduced in a real browser driver, not only in a unit test.

**What I fixed.** On the first run, all nine "an allowed gap draws a solid green line" checks failed. When I measured the page, the line was being drawn correctly: 2 pixels tall, in the moss green. The test's detector was the mistake. It required the line's border style to read "none", but the app's stylesheet reset gives every element a zero-width border whose style reads "solid". I changed the check to ask whether the border width is zero, and added a comment explaining why. All nine now pass. This is the only file I changed.

**What still fails, and why it isn't this change's fault.** The test's starting road deliberately visits DNS twice, which the app allows. The walk dock is the strip of stops shown along the bottom of the map. It uses each stop's node id as its React identity key, so a repeated node gives two stops the same key, and React logs an error. The warning fired 26 times just from loading the page, before any drag, when none of this change's new behaviour is active. Every error the test collected was this same warning. No other test starts from a road with a repeated node, which is why nobody has seen it before. This is a real bug that users could hit: React warns that stops with duplicate keys may be duplicated or dropped.

**Full browser suite.** 32 of 33 tests passed; the one failure is the drop-refusal test above. 17 tests failed instantly on the first pass and then all passed when retried alone. That was a collision, not a regression. Another agent's checkout (task #344) was running its own browser tests at the same time on the same fixed port numbers, which is the known fixed-port problem tracked as #364.

**Your decision.** This test can't join the suite as it stands, or it will turn the suite red for everyone. I'd let this test ignore that one specific warning, with a comment pointing to a new issue, and fix the dock separately. The dock is a copy of a design-system component, so changing its key means logging a divergence on the drift log (#74) or asking the design agent. That work is outside this card, so I didn't do it. The other option is to fix the dock's key first and land that before this.

Still open from the review: nothing is committed, and no receipt has been filed.