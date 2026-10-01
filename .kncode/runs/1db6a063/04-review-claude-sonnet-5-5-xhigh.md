PASS

**Must fix:**

none

In plain terms: every part of the card's "Done when" is implemented in the code. I read the helper, the runner, the guard test and the scripts, and found nothing that breaks the card or would make a run fail.

- **No fixed ports remain.** A search of the whole scripts folder finds no hard-coded port, no `--strictPort` or `--port` flag, no direct vite launch and no literal port in a page address. The only matches are inside the new helper (`tools/studio-spike/devserver.mjs`, which is allowed to do this) and in one explanatory comment in the runner.
- **All 46 scripts use the helper.** Each has exactly two references to `startVite`: the import and one call. The helper itself has one. None still uses the old `PORT` constant, the removed `spawn` import or the old vite output variable.
- **The two unusual scripts are right.**
  - The relations-rail script gets a fresh port for each of its two corpus runs and uses that port in its page address.
  - The course-corpus script passes its environment variable through.
- **Each script still serves its own checkout (#362).** The helper works out its root from its own file location and starts vite from there. The existing guard that forbids naming a checkout still passes, because the helper names none.
- **Nothing is collected twice.** The runner picks up only files starting `browsertest-` or `drive-`, so the helper is never run as a test. The runner's own bookkeeping was updated consistently to drop the port handling.
- **The guard test fits the file.**
  - The helper is registered as "not a test".
  - The new "no driver picks its own port" check uses names and helpers defined earlier in that file.
  - I read its patterns against the converted scripts, and none of them would flag the new `{ port: PORT }` or `localhost:${PORT}` forms.
- **Line endings are consistent.** The new helper and the edited files use the same Windows line endings as their neighbours.

**Optional:**

1. **The "Done when" line has not been shown to hold.** Two checkouts running `npm run test:browser` at the same moment, both green, was not run, because this checkout has no installed packages. The code supports it, but it is the one thing only a real run can confirm. It should still happen before anyone calls the card finished, and it should include the "hold the old ports busy" run from the plan.
2. **A pinned port is only partly checked.** The helper rejects a pinned port that is not a whole number, but still accepts `0`, a negative number or one above 65535. This only affects the probe scripts' optional `PROBE_PORT` and fails loudly, so it is low stakes.
3. **The guard test catches the common ways of bringing the problem back, not every way.** It would miss a lowercase `const port = 5300`, an address written as `127.0.0.1:5300`, or vite started through its programmatic interface. Starting vite through the command line, a `--port` flag or a literal port in a page address are all caught, so a future script would have to be unusual to slip through.
4. **A vite failure that has nothing to do with ports is retried too.** The helper treats any early vite exit as a possible port clash and retries up to five times, so a real configuration error costs five quick failures before it surfaces, and only the last attempt's output is shown. The previous step chose this on purpose, and it is harmless.

**Noticed outside this card's scope:**

- Several older screenshot scripts in other spike folders (`cockpit-spike`, `compare-spike`, `evoc-spike`, `unfold-spike` and `unfoldgraph-spike`) go to `http://localhost:3000` and expect someone to have a dev server running already. They are not in the browser suite and start no server of their own, so they do not cause the collision in the card. They are untouched, which is correct here.
- A historical results note in `tools/floating-panel-spike/RESULTS.md` still mentions port 5199. It is a record of a past spike and not a script, so there is nothing to fix.

Assumptions: I took the two-checkouts verification to be a later step in this pipeline, not something this edit step was expected to have done. I treated the spike folders that connect to port 3000 as outside the card, because the card is about drivers that start their own server on a fixed port and run in the suite.