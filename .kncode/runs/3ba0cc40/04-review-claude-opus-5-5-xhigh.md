MINOR

**In short:** the change does what the card asks, as far as code can. The test now waits for the page to stop moving before it takes its "before" measurement of the map, and the failure messages now print the numbers the check actually compared. The catch is that none of it has ever run. This checkout has no installed dependencies, so neither the test nor the new measuring script has executed. The card's finish line ("passes reliably", or "shown to catch a real 1 px move") is still waiting on the verification step.

**What I checked.** I read the three changed files against the card and the plan, and compared the new wait with how two other browser tests already wait for fonts. I also confirmed three things:
- The app's three fonts do come from Google's servers and first draw in a stand-in font. That makes a late font swap plausible as the cause.
- The measuring script's port is used by no other script.
- The script's "height of whatever sits above the map" reading will pick up the breadcrumb row directly above the map, so it will show which element grew or shrank.

Nothing outside the card's scope changed.

Must fix:
none

Optional:
1. **The diagnosis is written down as fact but has not been measured yet.** Two new comments say the cause was a font arriving late: one in the walk-dock test (`tools/studio-spike/browsertest-walkdock.mjs:73-80`) and one in the test runner (`tools/studio-spike/run-browsertests.mjs:28-30`). The plan was to run the measuring script before writing any fix, and that order was skipped. The card leaves both readings open, including "Opening the dock really does nudge the map by 1 px on some runs". If the script shows the dock moving the map on a settled page, this change fixes nothing and both comments are wrong. The verification step has to deliver four things:
   - With fonts held back, the old sequence fails and the new one passes.
   - Zero of the open-and-close cycles move the map.
   - The walk-dock test passes about ten plain runs in a row.
   - The whole browser suite passes.

   The script's output should also be kept somewhere, such as the issue thread. The card's "shown to" wording asks for evidence someone can point to.
2. **The new check's name claims more than it tests.** It is called "every webface in" (`browsertest-walkdock.mjs:101`), but its condition only means "no font is still downloading". That is also true when the fonts failed to load, for example offline. The behaviour is right: with no font arriving, nothing can redraw. But the name and the printed detail read the same whether the fonts loaded or failed, so a reader can't tell which one happened.
3. **A small new way to crash.** The test registers a crash handler that shuts down its dev server; the handler lives at `browsertest-walkdock.mjs:116`. The new wait (up to 10 seconds) runs before that handler exists. If the page reloads during the wait, the test dies without printing its checks and leaves its dev server running on port 5234. The runner's one retry would then fail to start on that busy port. This is unlikely: the page has already loaded once by then, so a reload triggered by the dev server itself is rare. Registering the handler earlier would close it.

Assumptions: I treated "nothing has been run" as the next step's job, not a gap in the code. That step needs installed dependencies, the Edge browser, and network access to Google's font servers. Without all three it cannot produce the evidence the card's "Done when" line asks for. I judged the measuring script's lack of crash cleanup by the house pattern: the two existing measuring scripts don't have any either, so I didn't list it.