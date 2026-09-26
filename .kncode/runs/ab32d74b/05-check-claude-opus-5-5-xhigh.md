PASS

The build and every test pass. The change works as intended: the desktop app is now typechecked against the web app's platform contract (the list of things the app expects any host to provide) inside the one "check everything" command, and that check passes on the current code.

**What I ran and what each showed:**

- **Clean installs of both packages.** I reinstalled the web app's packages and the desktop package's packages from scratch, using their lockfiles (the files that pin exact versions). Both succeeded. That matters because the change edited both lockfiles, and a clean install refuses to run if a lockfile disagrees with its package list. Along the way I confirmed the change's claim that GitHub won't download Electron's ~100 MB program: Electron's package has no install step.
- **The full check, `npm run verify`.** It builds the web app, typechecks the desktop code against the contract (the new step), lints, and runs the unit tests. Everything passed: 610 of 610 tests in 51 files.
- **The desktop bundle build.** The change set its compile target to Node 22, and `verify` doesn't cover this build, so I ran it separately. It built cleanly.
- **The browser tests**, which drive the Edge browser installed on this machine. They are the only thing that uses the browser-automation library the change upgraded. 31 of 32 passed. The one failure was not caused by the change. That test always starts a local web server on network port 5234, and another run of that same test, almost certainly from another working copy of this repository, already held that port. The server couldn't start, so the test failed within a second, before it opened a browser. It's a known problem, tracked as issue #364. I left the other process alone, ran the same test from a temporary copy outside the repository on a free port, and all 105 of its checks passed. Then I deleted the temporary copy.

I made no edits to the project. The only files written were build output and test screenshots, and those go to folders the repository ignores.

**Not verified:** I haven't seen GitHub's checks run. They only run once the pull request exists. They use the same commands I ran here, but on Linux with Node 22 instead of this Windows machine.

Commands run:
```
npm ci
npm ci --prefix desktop
npm run verify
npm --prefix desktop run build
npm run test:browser
node <temp copy of tools/studio-spike/browsertest-walkdock.mjs with PORT 5299>
```