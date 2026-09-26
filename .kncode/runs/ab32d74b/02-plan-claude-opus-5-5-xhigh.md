The desktop app's code can currently stop fitting the app's "what the host can do" contract without any check noticing. The fix is to make both the automatic checks on GitHub and the local `npm run verify` command run the desktop package's existing typecheck. Four things I found while reading shape the plan:

- **Nothing installs the desktop's dependencies today.** The desktop typecheck needs the Electron package's type definitions. Installing Electron normally also downloads a ~100 MB program, which a type check never uses. GitHub's checks can skip that download with a setting Electron supports.
- **Installing packages inside `verify` would break a documented promise.** The project map says `verify` "reaches outside this repository for nothing", and a fresh install contacts the npm registry. It would also rebuild the desktop's installed packages from scratch on every run. So `verify` will only run the typecheck, and it will fail loudly if the desktop packages were never installed.
- **The precondition for the card's stronger option is now met.** The card waited on the ▶ (present) button bug being fixed and on the smoke test covering presenting. A recent merge fixed that bug (#378), and the smoke test now checks it. I'm leaving that option alone, but it's ready for your decision.
- **One code comment depends on the Node version.** A comment in the desktop build script explains its compile target by pointing at GitHub's Node 20. If the Node version moves to 22, that comment needs updating too.

**1. Plan**
1. Add a root script that runs the desktop package's own typecheck.
2. Change `verify` to build (which includes the app typecheck and the `vite build` step GitHub already runs), then typecheck the desktop, then lint and test. That removes the "verify skips vite build" drift.
3. In the GitHub workflow, add a step that installs the desktop's dependencies with the Electron download skipped, and a step that runs the desktop typecheck. Include the desktop's package list in the dependency cache. Add a comment citing #330.
4. Align Node: GitHub moves from Node 20 to 22 (Node 20 reached end of life in April 2026, and development here uses 22). Add a minimum Node version (`engines` ≥22) to both packages, and update the desktop build script's target and its comment to match.
5. Align the browser-automation library (`playwright-core`): bump the root package from 1.61.1 to the desktop's 1.62.1 and update the root lockfile.
6. Update the one-line description of `verify` in the project map, and note the one-time desktop install in the README's scripts section.
7. Prove it: delete the `openWindow` line from the desktop preload (recreating #330), confirm `verify` fails with "property missing", restore the line, confirm it passes.

**Files:** `.github/workflows/code-verify.yml`, `package.json`, `package-lock.json`, `desktop/package.json`, `desktop/package-lock.json`, `desktop/build.mjs`, `CLAUDE.md`, `README.md`

**Out of scope:** Option 2, running `desktop/smoke.mjs` on a Windows runner so Electron actually boots in CI. The card says to do option 1 first and decide on option 2 separately.

**Verify:** Delete `openWindow` from `desktop/preload.ts` and run `npm run verify`. It should stop at the desktop typecheck with TypeScript error TS2741 ("Property 'openWindow' is missing… required in type 'Platform'"). Restore the line and it passes. On the pull request, GitHub's checks should show the new "Typecheck desktop" step running and green. The commands:
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser
npm --prefix desktop run smoke
```
The browser tests exercise the library bump. The smoke test exercises the build-target change.

**Assumptions:**
- The card suggests running the desktop install inside `verify`. I'm putting it only in GitHub's checks, for the reasons above; locally, the desktop packages are installed once, and the README will say so.
- GitHub's checks skip the Electron program download, because type definitions are all the typecheck needs.
- I'm fixing the three smaller drift items here because the card says "fix when touching this". The library version is aligned upward (root to 1.62.1), not downward.
- I'll show the failure locally with a deliberate break, not by pushing a broken commit to GitHub.
- The desktop typecheck probably passes on current main now that #378 is merged. I couldn't confirm that, because nothing is installed in this copy yet.