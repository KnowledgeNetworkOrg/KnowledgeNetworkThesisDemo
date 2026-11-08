Failures: none

Commands run:
- `npm run verify` (`tsc -b` and `vite build`, then the `desktop/` typecheck, `eslint .`, `vitest run`), all passed. Vitest: 77 files, 1051 tests passed.
- `node tools/studio-spike/browsertest-datasetswitch.mjs`
- `node tools/studio-spike/browsertest-cs2023lists.mjs`
- `node tools/studio-spike/browsertest-cs2023corpus.mjs`
- `npm run test:browser` (43/43 passed, no FAIL or FLAKY rows)

Left out: nothing. The browser drivers start their own vite on a free port and kill it in a `finally` block. I checked afterwards that no vite process was left running. The drivers wrote screenshots into `tools/studio-spike/out/`, which is gitignored. I ran no install, and I have no sign that either lockfile changed. I could not run git to confirm.

Verify: ran — passed. The new driver confirmed these points:
- `teaching` is the default and its header pill is marked.
- The cs2023 pill puts `corpus=cs2023` in the address and shows 61 cs2023 routes.
- The saved walk is hidden under cs2023 and comes back with all its stops on return to teaching.
- `?corpus=nonsense` opens teaching.
- Starting a lecture from cs2023 opens a projector window at `?projector&corpus=cs2023`.

The `npm run build` inside `verify` showed a main bundle of 1,604.26 kB (396.51 kB gzip). I did not build the base commit, so I have no before-and-after bundle growth figure for the PR.