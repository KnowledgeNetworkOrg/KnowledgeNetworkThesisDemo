The fix is to stop giving each test script its own hard-coded port. Each script will ask the operating system for a free port at the moment it starts, so two checkouts can't land on the same one. I found one extra constraint along the way: a unit test guards the scripts folder, and it would reject a new helper file unless the helper is registered with it.

1. Install packages in this checkout first, since there is no `node_modules` here yet, so vite and the browser scripts can run.
2. Add one shared helper, `tools/studio-spike/devserver.mjs`. It starts vite for the checkout it lives in on a free port the operating system picks, waits until vite is ready, and returns the server and its port. If another process grabs that port just before vite does, it picks again, up to 5 tries.
3. Switch the 33 scripts the suite runs (22 `browsertest-*` and 11 `drive-*`) from "fixed number plus hand-written vite startup" to one call to the helper, and use the returned port in the page address. The corpus-switching script passes its environment variable through. The relations-rail script, which starts vite once per corpus, gets a fresh port each time.
4. Make the same swap in the 13 manual scripts (4 `probe-*`, 9 `shot-*`), so no script in the folder keeps a fixed port. The probes keep their `PROBE_PORT` override as an optional pinned port.
5. Simplify the runner `run-browsertests.mjs`. Remove the code that reads each script's port and avoids running two scripts on the same port. Update its header comments, plus the stale "one port per test" remarks in the explorer-rail and relations-rail scripts.
6. Update the unit-test guard `browsertestguard.test.ts`. Register the helper as "not a driver", because otherwise the guard fails it as neither run nor explained. Add a check that no script in the folder hard-codes a port or starts vite itself, so a future script can't bring the problem back.
7. Verify as described below, including the two-checkouts-at-once run.

Files: `tools/studio-spike/devserver.mjs` (new); `tools/studio-spike/run-browsertests.mjs`; all 46 scripts in `tools/studio-spike/` (22 `browsertest-*`, 11 `drive-*`, 4 `probe-*`, 9 `shot-*`); `src/studio/browsertestguard.test.ts`.

Out of scope: nothing stated. The one constraint the card does give is that every script must keep serving the checkout it lives in (#362). I'll preserve that: the helper works out its root from its own file location, and the existing guard already forbids naming a checkout.

Verify: with packages installed in two separate copies of the repo, start `npm run test:browser` in both at the same moment. Both should finish with all 33 scripts passing, and neither should show a "port already in use" error. As a second check, hold some of the old port numbers (5198–5265) busy with a dummy listener and run the suite once. It should still pass, which shows no script depends on a fixed port any more.

```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser
```

Run the last command in both copies at the same time.

Assumptions:
- **Script count:** the card says 40 scripts, but I count 46 (33 the suite runs and 13 manual ones). I'll convert all 46, because the swap is identical and it leaves no fixed port anywhere in the folder.
- **How the port is chosen:** I'll have the helper pick a free port and retry on a clash. I won't rely on telling vite to pick its own port, because this checkout has no installed vite to confirm that works on the pinned version (7.3.1).
- **Separate packages:** I assume each checkout has its own installed packages. A shared or linked `node_modules` would also share vite's cache between the two runs, and I'm not addressing that.
- **Machine load:** two suites at once means up to 8 browsers and 8 vite servers together. I'm relying on the runner's existing "retry once, alone" for load-only flakiness. If the double run still fails, I'll report that as a finding rather than quietly lowering the worker count.
- **Verification environment:** it needs Microsoft Edge, which the scripts launch. The second checkout will be a plain folder copy of the finished tree, because git is run by the tool and not by me.
- **CI:** the CI workflow doesn't run browser tests, so it needs no change.