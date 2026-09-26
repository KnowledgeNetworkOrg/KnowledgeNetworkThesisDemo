PASS

npm ci
npm run verify
npm run build
node tools/studio-spike/browsertest-walkdock.mjs  (once, then 10 more times in a row)
node tools/studio-spike/probe-walkdockbox.mjs
npm run test:browser

**The build and all the tests pass now, but only after I fixed one thing the change had missed.** The change added a new measuring script to the browser-test folder without adding it to that folder's list of scripts that deliberately don't run as tests. A unit test checks that every script there either runs as a test or appears on that list with a reason, and it failed on this one. I added the script to the list with a one-line reason, next to the two existing measuring scripts, and the test went green. That is the only file I changed.

**Results:**
- **Type check, lint and unit tests:** all passed, 610 of 610 unit tests, after the fix above.
- **Production build:** succeeded. It printed a warning that the app's code bundle is large; that warning predates this change.
- **The walk-dock test from the card:** passed 11 runs out of 11, all 106 checks each time. In every run the page stopped moving about 170 ms after the old fixed 800 ms wait, and the map's box was identical before, during and after the dock opened.
- **Whole browser suite:** 32 of 32 passed. No test needed its retry.

**The measuring script answered the card's open question, so its two new comments now have evidence behind them.** The card offered two explanations: the "before" measurement was taken too early, or the dock really nudges the map.
- **The dock doesn't nudge the map.** On a page that had finished settling, opening and closing the dock moved the map in 0 of 30 tries.
- **The late font is the cause.** With the fonts forced to arrive just after the 800 ms mark, the old test sequence failed and the new one passed. The failure was the card's exact one: the map's top edge 1 px higher, the box 1 px taller, the bottom edge unchanged. It happened in the same frame the fonts finished loading, while the dock was still closed.

One detail differs from what the change's comments imply. The element directly above the map didn't change height; the whole pane moved up 1 px. So what redrew was something above the pane, most likely the app's top bar.

**What's left:**
- **Keep the measurement output.** It's only in a temporary file on this machine, and the card asks for the cause to be shown, so the next step should paste the summary into issue #365.
- **Normal-font runs couldn't catch the failure.** The measuring script ran each font condition once. The original failure showed up about 1 run in 9, so a single run with fonts left alone was never likely to show it. The forced-late-fonts run is what proves the cause.
- **Two review points are still open.** The new check's name ("every webface in") also passes when the fonts failed to load. And a crash during the new wait could leave the test's dev server running. Both are real but optional, and fixing them would be new work, so I left them.