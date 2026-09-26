The desktop app is now covered by the automatic checks. If its code stops matching the app's platform contract, which is the list of things the app expects any host to be able to do, both GitHub's checks and the local `npm run verify` command now fail. I proved it by recreating the original bug: the check caught it with the exact error the card asked for.

## 1. What I changed and why

- **GitHub's checks** now install the desktop package's dependencies and run its existing typecheck (a compile-only pass that catches type mismatches without running anything). The desktop's dependency list is also included in GitHub's download cache. A comment on the new step records the #330 story.
- **`npm run verify`** now builds the app first. That covers the app typecheck plus the production build GitHub already ran and `verify` used to skip. It then typechecks the desktop package, then lints and tests. A new root script, `typecheck:desktop`, runs the desktop step on its own.
- **Node version:** GitHub's checks move from Node 20 to 22. Both packages now declare a minimum of Node 22.13. That's the real floor, because one linter dependency needs 22.13 and Electron 44 itself needs 22.12. The desktop build script's compile target moves from Node 20 to 22 to match, and its comment is updated.
- **Browser-automation library:** the root package moves from 1.61.1 to 1.62.1, exactly the desktop's version. Both lockfiles now point at the identical download.
- **Docs:** the project map's description of `verify` now lists everything it runs. The README says to install the desktop packages once with `npm ci --prefix desktop`, and names the error you'll see if you haven't.

**Two things differed from the plan:**
- **No "skip download" setting was needed.** Electron 44 never downloads its ~100 MB program during install; it fetches it the first time something launches Electron, and a typecheck never does. The setting I planned does nothing in this version (Electron's code never reads it), so I left it out and wrote the real reason in the workflow comment.
- **I caught and undid an npm quirk.** Updating the desktop's lockfile from the root folder made npm silently add the whole app as a dependency of the desktop package. I restored the files and redid the update from inside the desktop folder. The final lockfile changes contain only the intended lines.

**What I verified this session:**
- **Deliberate break:** with `openWindow` deleted from the desktop's implementation of the contract, `verify` built the app, then stopped at the desktop step: `error TS2741: Property 'openWindow' is missing … but required in type 'Platform'`. Lint and tests never ran.
- **Restored:** with the line back, `verify` passed: build, desktop typecheck, lint, and 610 of 610 unit tests.
- **Library bump:** the browser tests passed, 32 of 32.
- **Build-target change:** the desktop smoke test passed all 14 checks under real Electron, including "pressing ▶ opens the projector window".

**Not verified:** GitHub's checks themselves haven't run yet. They will on the pull request, where the new "Typecheck desktop" step should appear and pass.

**Waiting on you:** the card's stronger option is to launch the real app in GitHub's checks on a Windows machine. It was waiting on the ▶ bug being fixed and the smoke test covering presenting, and both are now true. I recommend giving it its own card. Windows machines cost more CI time, and one smoke check expects at least one display, which a headless GitHub machine may not have. That needs trying separately.

## 2. Assumptions

Assumptions: `verify` only runs the desktop typecheck and doesn't install the desktop packages itself. Installing would contact the npm registry, breaking the documented promise that `verify` reaches outside the repository for nothing, so the README asks for a one-time install instead. When the desktop packages are missing, the failure is TypeScript's own "Cannot find module 'electron'" rather than a custom message, since adding a guard script felt beyond the card. I set one Node minimum (22.13) for both packages rather than a slightly different one for each, since they're always used together. I matched the library to exactly 1.62.1, not the newer 1.63.0 npm first picked, so the two packages agree. I saved the files npm and my editor had rewritten with the checkout's Windows-style line endings again, so the commit shows only the real changes.