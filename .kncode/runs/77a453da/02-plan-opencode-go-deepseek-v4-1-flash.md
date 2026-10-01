Investigated the current tree (the card was measured 2026-09-16; some facts changed since, notably `state/` is already in the guard, `src/ui/` is gone, and #342's relations test now uses `allContainerIds`). Plan below.

1. Shrink `src/model/derive.ts` to the `XY` interface only: delete the old layout engine (`layoutMap`, `deriveDrill`, `deriveEgo`), the test-only `liftEdges`/`deriveChoices`, and every helper they own (`hiddenIds`, `visibleAncestor`, `pack`, `nodesInRenderOrder`, `adjacency`, `mergeLink`, `Size`, `CARD_W`, `CARD_H`, six interfaces); delete `src/model/derive.test.ts`, which guarded only those.
2. In `src/model/flat.ts` delete `treePairs` (with `maxSpanningTree`), `modularityQ`, and `domainCapital`/`provinceCapital` (with their `capitalUnder`), and add an exported `centroidOf` for step 8.
3. Delete `depth2Expanded` from `src/model/nav.ts` (its test does not use it).
4. In `src/state/walkstore.ts` delete `savedWalks`; keep `deleteWalk` with a one-line reason (the store's delete API, no screen calls it yet).
5. In `src/corpus/graph.ts` delete the unused `isTopic` export and drop the matching `isTopic` from `src/corpus/corpusbuild.ts`; keep `allContainerIds` with a reason (referenced by `instruments/relations.test.ts` since #342).
6. In `src/model/color.ts` delete `hueOf` — re-checked, it is referenced nowhere, not even a test; keep `territorySlotOf`/`territoryNeighboursOf`/`familyOf`, whose "published for the audit" comments are their reason.
7. Keep `bowedPoint` in `src/model/walkarrow.ts` as a deliberate measurement seam, with a one-line reason.
8. Share `centroidOf`: export it from `model/flat.ts`, remove the private copies in `model/atlas.ts` and `model/star.ts`, and import the shared one in both.
9. Add `src/state/persistguard.ts` with `isObj` and `isTopic`, and use it in `state/walk/draftpersist.ts` and `state/walkstore.ts` instead of their local duplicates.
10. Widen the guard in `src/unreachedmodule.test.ts`: add `model` and `corpus` to `WATCHED`, and update the header/describe text to name the now-watched folders and say plainly it checks modules, not exports.
11. Run build and tests; for any module the widened guard newly reports, record it in `KEPT_UNREACHED` with a reason (or delete it if genuinely orphaned).

Files: src/model/derive.ts, src/model/derive.test.ts, src/model/flat.ts, src/model/atlas.ts, src/model/star.ts, src/model/nav.ts, src/model/color.ts, src/model/walkarrow.ts, src/corpus/graph.ts, src/corpus/corpusbuild.ts, src/state/walkstore.ts, src/state/walk/draftpersist.ts, src/state/persistguard.ts (new), src/unreachedmodule.test.ts

Out of scope: the copied helpers inside #69's parked instruments — `truncate`, `shortenToEdge`, and the `EDGE_TYPES` redefinitions in `UnfoldView.tsx`/`UnfoldGraphView.tsx`/`LensPane.tsx`/`NeighborhoodPanel.tsx`; the design-side `mmss` in `src/ds/presenter/LectureRecap.tsx`; `src/ui/` (deleted by #338); and any spike `RESULTS.md` prose.

Verify: run `npm run dev`, open the Map, Contours and a saved walk — the app must boot and render exactly as before (no blank screen, no missing-export error), and the test output shows the unreached-module guard covering `model/` and `corpus/` with no orphan.
```
npm run build
npm test
```

Assumptions: `allContainerIds` (card says unused) is now consumed by #342's `relations.test.ts`, so it is kept with a reason rather than deleted; `hueOf` is genuinely unreferenced, so it is deleted despite the card's "test-only" grouping; `hiddenIds`/`visibleAncestor` and `Size`/`CARD_W`/`CARD_H` become dead once the five named exports go, so the whole engine is removed; `deleteWalk`, `territorySlotOf`/`territoryNeighboursOf`/`familyOf`, and `bowedPoint` are kept as test/audit seams with reasons; `star.ts`'s deliberate recomputation of `centroidOf` is overridden to share the helper, per the card; shared predicates go in a new `src/state/persistguard.ts` (state→corpus is allowed by `layering.test.ts`).