Failures:
- `npm run build` (`tsc -b`) fails with `src/corpus/graph.ts(56,67): error TS7017: Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature.`
  - `tsconfig.node.json` has no DOM lib. It compiles `graph.ts` through its test includes, such as `src/corpus/edgecolor.test.ts`.
  - There, `globalThis.location` has no type, so the new address read in `CORPUS_NAME` fails.
  - Because the build fails, `npm run verify` stops there.

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` (stopped at the `tsc -b` step with the error above)
- `npm run typecheck:desktop` (passed)
- `npm run lint` (passed)
- `npm run test` (passed: 77 files, 1051 tests)
- `npx tsc -b` (same TS7017 error)
- `npx vite build` (passed; main JS bundle 1,604.25 kB, gzip 396.50 kB)

Neither lockfile changed. `npx vite build` wrote `dist/`, which is gitignored.

Left out: the browser drivers named on the plan's Verify line — `node tools/studio-spike/browsertest-datasetswitch.mjs`, `browsertest-cs2023lists.mjs`, `browsertest-cs2023corpus.mjs` and `npm run test:browser`. Each starts a vite dev server (`startVite()` in `devserver.mjs`) and drives Edge. I was told not to start a web server, so I did not work around it. That also means I have no before/after bundle-growth figure for the PR text. I only measured the current build.

Verify: not run — the browser drivers need a vite dev server and Edge, which I'm not allowed to start. `npm run verify` itself ran and failed at the build step, as above.

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"\u0060npm run build\u0060 (\u0060tsc -b\u0060) fails, so \u0060npm run verify\u0060 fails before it reaches the desktop typecheck, lint or tests. \u0060globalThis.location?.search\u0060 at \u0060graph.ts\u0060 line 56 has no type in the node-side project (\u0060tsconfig.node.json\u0060, lib ES2023 only, no DOM). That project pulls \u0060src/corpus/graph.ts\u0060 in through its test includes, for example \u0060src/corpus/edgecolor.test.ts\u0060. \u0060typeof globalThis\u0060 there has no \u0060location\u0060, so under strict settings the access is an implicit any. \u0060src/platform/index.ts\u0060 reads \u0060globalThis.window?.knPlatform\u0060 through a cast, which is the pattern to follow.","file":"src/corpus/graph.ts","line":56,"breaks":"The card\u0027s done-when: \u0060npm run verify\u0060 passes. \u0060npm run build\u0060 (tsc -b) must succeed.","failure":"\u0060npm run build\u0060 / \u0060npx tsc -b\u0060 \u2192 src/corpus/graph.ts(56,67): error TS7017: Element implicitly has an \u0027any\u0027 type because type \u0027typeof globalThis\u0027 has no index signature."}],"answers":[]}
-->
