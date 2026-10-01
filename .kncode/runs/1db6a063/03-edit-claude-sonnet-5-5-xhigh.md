Every browser script now asks the operating system for a free port each time it starts. Two checkouts running `npm run test:browser` at once shouldn't collide any more. I could not run the browser suite, either alone or in two checkouts at once.

**Why it was failing.** Each script started its own vite server on a port number written into the script. Two checkouts running together reached the same number, and the second one failed.

**What changed**
- **New shared helper** (`tools/studio-spike/devserver.mjs`):
  - It starts vite for the checkout it lives in, so every script still serves its own checkout (#362).
  - It takes the port from the operating system, waits until vite says it is serving, and returns the server and the port.
  - If another program grabs the port in the instant before vite does, vite quits at once, so the helper picks a new port and retries, up to five times.
- **All 46 scripts converted.** That is the 33 the suite runs and the 13 manual ones (`probe-*` and `shot-*`). Each now makes one call to the helper and uses the port it returns.
  - The corpus-switching script passes its environment variable through.
  - The relations-rail script gets a fresh port for each of its two runs.
  - The two `probe-*` scripts that had a `PROBE_PORT` override keep it as an optional pinned port.
- **Runner simplified.** `run-browsertests.mjs` no longer reads each script's port or keeps same-port scripts apart. Its header and two stale comments now say why.
- **Guard test extended.** The unit test for the scripts folder now registers the helper as "not a test", so it doesn't fail as unexplained. It also has a new check that fails if any script hard-codes a port, passes vite a port flag, or starts vite itself. A future script can't bring the problem back unnoticed.

**What I verified and what I didn't.** This checkout has no installed packages, so the unit test, the real browser scripts and the two-checkouts-at-once run all could not run, and the rules limited me to one narrow check. In its place I ran one throwaway script, since deleted. It showed that:
- All 48 files in the folder pass the new scan, and the helper is the only file the patterns match.
- The patterns do catch the old style, so the new guard test can't pass by checking nothing.
- In this checkout, where vite isn't installed, the helper fails with a clear message instead of hanging. It also refuses a pinned port that isn't a whole number.
- All 48 scripts pass a syntax check, and every file keeps the folder's Windows line endings.

**Still to do:** run `npm run verify`, then start `npm run test:browser` in two separate copies of the repo at the same moment, as in the plan.

Assumptions: I converted all 46 scripts rather than the card's 40, because the change is identical and it leaves no fixed port in the folder. I made the helper retry on any early vite exit, not only a "port in use" message, so a changed vite error wording can't switch the retry off. I did not touch `tools/walk-tiers-spike/`, which has a separate screenshot script on a fixed port; it is not in this folder or in the suite. I assumed each checkout has its own installed packages, and I noted in the runner comment that a shared one would also share vite's cache.