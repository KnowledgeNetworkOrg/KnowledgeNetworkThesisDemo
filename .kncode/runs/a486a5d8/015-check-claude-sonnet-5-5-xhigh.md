Failures: none

Commands run:
- `npm ls --depth=0` and `npm --prefix desktop ls --depth=0` (dependencies were already installed; I ran no install, so no lockfile changed)
- `npm run verify` (`tsc -b && vite build`, desktop typecheck, `eslint .`, `vitest run`): all passed, 75 test files and 1035 tests
- `node tools/studio-spike/browsertest-relationsrail.mjs`: "all checks passed". The cs2023 section confirmed one `see_also` kind and `AI-Planning` with no relationships. It also confirmed 31 marks on `SEC-Foundations` and the half-circle checks.
- `node tools/studio-spike/browsertest-cs2023marks.mjs`: "PASS — cs2023 shows stop marks, secondary places and the standing notice; teaching does not"
- `node tools/studio-spike/run-browsertests.mjs` (what `npm run test:browser` runs): 42/42 passed, none flaky
- The card's done-when `grep -rnE "coursedata|coursedocs|…|'courses'" src tools .github desktop package.json README.md CLAUDE.md …`: printed nothing (exit 1). `ls tools/courseimport` reports no such directory.
- A check for leftover vite processes: none from this run. The one vite still running belongs to a different checkout.

Left out: nothing. No suite needed an opt-in flag or credential.

Verify: ran — passed. The browser drivers start and stop their own vite inside the command, and Edge is installed. A leftover-process check afterwards found none from this run.