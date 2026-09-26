PASS

Commands I ran:
npm run verify
npm run test:browser
node tools/studio-spike/browsertest-presenter.mjs

**What each result was**
- `npm run verify` is the project's own full check. It builds the app, typechecks the desktop wrapper, lints, and runs the unit tests, and every step succeeded. The unit tests came to 57 files and 724 tests, all passing.
- `npm run test:browser` runs 33 scripted checks that drive the real app in a headless browser. In the first pass 32 passed. That includes the new test for this change's Relations rail, which passed in 43 seconds.
- Of the two that failed on the first pass, `browsertest-presenter-panes.mjs` passed when the runner retried it.
- `browsertest-presenter.mjs` failed twice in the runner, both times within a second.

**Why the presenter test failed**
Its own log said "Port 5240 is already in use". It starts its own copy of the app on a fixed port, and something else on this machine was holding that port. A node process started at 4:43 PM with that exact command line was listening on it, and it was gone a minute later. Other run workspaces (342-efe2cc48, 343 and 344) are active on this machine and were running lint at that moment. Another session's copy of the presenter test was very likely the port holder. That is a clash between sessions, not a fault in this change. This is inferred from timing, not confirmed. I did not kill that process.

With the port free, I ran the presenter test on its own. It passed: 71 checks passed and it exited with code 0.

**What I didn't do**
I changed no code. I did not re-run the full browser suite after the presenter test passed, so the "32 of 33" runner tally stays as printed. The 33rd driver passed separately, on its own.