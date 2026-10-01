PASS

Build and tests for the touched area all succeeded. The new `browsertest-explorerroute.mjs` passes, all 845 unit tests pass, and the walk/explorer browser tests pass.

Commands run:
- `npm run build`
- `npm test`
- `npm run test:browser -- explorerroute`
- `npm run test:browser -- walk`

One transient note: the first `walk` run failed on `browsertest-walkdock.mjs` because a concurrent agent run in a different workspace (`326-4afb55c9`) was holding its fixed port 5234. After that other run ended, the retry passed clean — an environment collision, not a defect in this change.