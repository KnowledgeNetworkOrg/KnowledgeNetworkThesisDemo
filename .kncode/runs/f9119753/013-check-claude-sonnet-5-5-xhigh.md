Failures: none

Commands run:
```
npm run verify
node tools/studio-spike/browsertest-datasetswitch.mjs
node tools/studio-spike/browsertest-cs2023lists.mjs
node tools/studio-spike/browsertest-cs2023corpus.mjs
npm run test:browser
```
`npm run verify` covers the build (`tsc -b` and `vite build`), the `desktop/` typecheck, eslint and vitest. Vitest ran 77 files and 1053 tests, all passing. `npm run test:browser` ran 43 of 43 drivers, all passing, and none were marked FLAKY. I did not run `npm ci`. Both `node_modules` folders were already present, and the lockfiles were not touched (their modification times are from before this run).

The new driver and the full browser run each started their own vite and Edge and shut them down at the end. No node or Edge process from the run was still alive afterwards.

Left out: the bundle-growth comparison against base `4c06ce8`, because building that commit means checking it out with git, which this step forbids. Nothing else was left out, and no suite needed an opt-in flag or a credential.

Verify: ran — passed. The new driver passed all six groups:
- The header switch marks `teaching` when no `corpus` is given.
- A saved walk is hidden under `cs2023`, and returns with all its stops after switching back.
- Pressing the current dataset does not reload the page.
- `?corpus=nonsense` opens `teaching`.
- Other query values are kept when switching.
- The projector window opens at `?projector&corpus=cs2023`.

The two updated drivers (`cs2023lists`, `cs2023corpus`) also passed.

For the PR text, the main bundle after this change is `index-BlS0Pz0O.js` at 1,604.26 kB (396.51 kB gzip), with the CSS at 47.39 kB. The `dist/` already in the working copy before this run had the same file name and size, so it came from this same code. I have no base-commit figure to compare it with.