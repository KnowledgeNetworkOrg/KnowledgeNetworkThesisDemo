PASS

The change does what the card asks. If the desktop app's code stops matching the app's platform contract (the list of things the app expects any host to be able to do), both GitHub's automatic checks and the local `npm run verify` command now fail. I confirmed that myself instead of taking the previous step's word for it:

- **The new check passes on the current code.** I ran the new desktop typecheck (a compile-only pass that catches type mismatches without running anything) and it finished with no errors.
- **It catches the original bug.** I re-created the #330 bug in memory only, with no file edited: I removed the `openWindow` line from the desktop's implementation of the contract and typechecked again. It failed with exactly the error the card is about: `TS2741 Property 'openWindow' is missing in type '{ name: "electron"; … }'`. So the "Done when" line holds, as long as GitHub runs that same command. The workflow now does, right after installing the desktop's packages.
- **The claim about the large Electron download is true.** The previous step said installing the desktop packages on GitHub won't pull Electron's ~100 MB program. Electron 44's package has no install script at all, so `npm ci --prefix desktop` fetches only the npm package, which includes the type definitions the typecheck needs.
- **The three smaller drift items from the card are all fixed:**
  - GitHub's checks now use Node 22, and both packages declare a minimum Node version (≥22.13). Electron 44 itself requires ≥22.12.
  - `verify` now includes the `vite build` step GitHub already ran.
  - The browser-automation library is at 1.62.1 in both packages, and both lockfiles point at the same download.
- **Nothing outside the card changed.** Every file touched serves either option 1 or one of the drift items the card lists. The stronger option, launching the app under Electron on GitHub, was correctly left alone.

What I did not verify: I didn't see GitHub's checks actually run, because that only happens on the pull request. I also didn't run the full `verify` myself, because it writes build output and I'm not allowed to create files in this step.

Must fix:
none

Optional:
1. `desktop/build.mjs:23-26`: the new comment says the compile target is Node 22 "so CI and this machine agree on one runtime." That target only affects code that runs inside Electron, which bundles its own, newer Node. CI's Node never runs that output. So node22 is a safe value, but the comment implies it must track GitHub's Node version, and a future editor could believe that. The wording carries over from the old comment, so this is low stakes.

Noticed outside this card's scope
- The card's stronger option, booting the real app under Electron on a Windows machine in GitHub's checks, is now unblocked: the ▶ (present) button bug is fixed and the smoke test covers presenting. It was left out correctly here. I agree with the previous step that it should get its own card, because a headless GitHub machine may not satisfy the smoke test's "at least one display" check.

Assumptions: I treated the Node, `engines`, and library-version changes as in scope because the card says "fix when touching this." I counted the local deliberate-break test, plus the fact that GitHub runs the identical command, as enough evidence for the "Done when" line before GitHub's checks have run. I judged that keeping the package install out of `verify` (a one-time manual install instead) meets the card's option 1, because it keeps the documented promise that `verify` reaches outside the repository for nothing.