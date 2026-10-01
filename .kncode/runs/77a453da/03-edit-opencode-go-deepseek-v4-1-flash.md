1. **What I changed.** I removed the dead code the card listed and shared the copied helpers.

- `src/model/derive.ts` now holds only the `XY` point type; the old layout engine (`layoutMap`, `deriveDrill`, `deriveEgo`, `liftEdges`, `deriveChoices`, and their private helpers) is gone, and its test-only guard `src/model/derive.test.ts` is deleted. Every app module that imports `XY` from here still works.
- `src/model/flat.ts` lost `treePairs`/`maxSpanningTree` (which was computed unused at every startup), `modularityQ`, and `domainCapital`/`provinceCapital` with their `capitalUnder`. It gained one exported `centroidOf`.
- `src/model/atlas.ts` and `src/model/star.ts` now import that shared `centroidOf` instead of each keeping an identical private copy — the two views still place a region at the same point.
- `src/model/nav.ts` lost `depth2Expanded`.
- `src/state/walkstore.ts` lost `savedWalks`; `deleteWalk` stays with a comment saying it is the store's delete API and only its test calls it yet.
- New `src/state/persistguard.ts` holds the shared `isObj` and `isTopic`; both `walkstore.ts` and `walk/draftpersist.ts` import them instead of their duplicate copies.
- `src/corpus/graph.ts` and `corpusbuild.ts` lost the unused `isTopic`; `allContainerIds` stays with a note that the relations audit test uses it.
- `src/model/color.ts` lost the unreferenced `hueOf`; `src/model/walkarrow.ts`'s `bowedPoint` stays with a note that it is a test measurement seam.
- `src/unreachedmodule.test.ts` now watches `model/` and `corpus/` too, and its header says plainly it checks modules, not exports.

**Verified:** `npx vitest run src/unreachedmodule.test.ts` passes with no orphans (no new `KEPT_UNREACHED` entries needed), and `npx tsc -b` is clean. I installed the repo's locked dependencies first (`npm ci`), since `node_modules` was absent.

2. **Assumptions:** I kept `allContainerIds`, `deleteWalk`, `territorySlotOf`/`territoryNeighboursOf`/`familyOf` and `bowedPoint` as documented test/audit seams rather than deleting them; I deleted `hueOf` outright because it is referenced nowhere, not even by a test. I put the shared predicates in `state/persistguard.ts` because both callers live in `state/` and the layering test permits `state -> corpus`.