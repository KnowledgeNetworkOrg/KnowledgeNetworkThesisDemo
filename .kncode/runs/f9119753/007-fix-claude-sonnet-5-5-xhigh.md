I fixed the build failure. The address read in `src/corpus/graph.ts` no longer breaks the DOM-less node-side project.

The old line `globalThis.location?.search` had no type there, so `tsc -b` failed with TS7017. I now read it through a cast to `{ location?: { search?: string } }` and pass `pageAddress?.search ?? ''` to `parseCorpusName`. This is the same cast `buildEnv` already uses. The comment above it says why the cast is needed.

`npx tsc -b` now finishes with no errors, and I recorded C0-1 as FIXED. I didn't run `npm run verify`, the unit tests or the browser drivers; the check will run them again.

Assumptions: I used a cast on `globalThis` instead of adding a DOM lib to `tsconfig.node.json` or a `declare global` block. It's the smaller change, and it keeps the node-side project free of DOM types.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"C0-1","answer":"Fixed","because":"src/corpus/graph.ts:55-57: the address is now read through a cast, \u0060(globalThis as unknown as { location?: { search?: string } }).location\u0060, as \u0060buildEnv\u0060 is, so the DOM-less node-side project no longer hits TS7017. \u0060npx tsc -b\u0060 now exits clean.","duplicateOf":null}]}
-->
