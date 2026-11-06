1. Rework `tools/cs2023import/generate.mjs` so Science is the 18th area (ring hue in area order, exception document, no unit), while the CS2023 tree and edges stay otherwise unchanged.
2. Give a no-topic domain a drawable place: expose each domain's ring anchor from `flat.ts`, use it as the fallback domain centre in `atlas.ts`/`star.ts`, and synthesize a small selectable region in `nested.ts` so Science's label, territory and walk anchors are real. This is the proposal the owner decides on.
3. Extend `Walk` and its stop type with optional `category`, `group`, `label`, `source`, `confidence`, `secondary` and `item`; keep the topic guard for teaching/courses and use “node exists” for cs2023, mirrored in draft/saved-walk persistence so deep stops survive reload.
4. Generate the 61 routes: slug ids, verbatim title/description/marks, every stop including repeated visits, and CPS 40A/B with zero stops and its data `note`; assert distinct ids and existing nodes, then regenerate `cs2023data.ts`, `cs2023docs.ts` and `cs2023walks.ts`.
5. Make `PLAN` the empty plan for cs2023 and build `SEED` from the CPS 109 route, leaving teaching and the generic course seed untouched.
6. Extract “walks through here” into a pure `throughWalksAt(walks, id)` function and make `DocumentPanel` list every visit with a per-visit key.
7. Update the importer README and type comments with provenance, the Science proposal, the split/filled measurement rule, repeat visits and the empty route.
8. Rewrite `cs2023corpus.test.ts` for 18 domains and hue, 162 units, 305 deep places, 61 routes / 60 with stops / 637 stops / 61 ids, the level and mark counts, 45 repeat routes, per-visit walks-through, and CPS 40A/B.
9. Rewrite `browsertest-cs2023corpus.mjs` to check 61 routes, Science on screen, CPS 209 played in order to its last stop, CPS 40A/B doing nothing, the CPS 109 desk seed, and no page error.
10. Run the verify, browser and generator-determinism checks.

Files: `tools/cs2023import/generate.mjs`, `tools/cs2023import/README.md`, `src/corpus/cs2023data.ts`, `src/corpus/cs2023docs.ts`, `src/corpus/cs2023walks.ts`, `src/corpus/walks.ts`, `src/corpus/cs2023corpus.test.ts`, `src/model/flat.ts`, `src/model/nested.ts`, `src/model/atlas.ts`, `src/model/star.ts`, `src/model/throughwalks.ts` (new), `src/state/walk/mockwalk.ts`, `src/state/walk/authordraft.ts`, `src/state/persistguard.ts`, `src/state/walk/draftpersist.ts`, `src/state/walkstore.ts`, `src/instruments/DocumentPanel.tsx`, `tools/studio-spike/browsertest-cs2023corpus.mjs`

Out of scope: #504 (how marks and deep stops look), #505 (prerequisites), #506 (the sixty routes in the lists), the `teaching` and `courses` corpora and their seeds/guards/persistence, and Walk Desk authoring beyond units.

Verify: open the app with `VITE_CORPUS=cs2023` and observe Science as a drawn/selectable 18th area, 61 routes in the Trail list, CPS 209 playing stops 1–10 in route order to its last stop, CPS 40A/B doing nothing, and Plan opening on CPS 109's 12 stops.
```
npm run verify
node tools/studio-spike/browsertest-cs2023corpus.mjs
node tools/cs2023import/generate.mjs
git diff --exit-code src/corpus/cs2023*.ts
```

Assumptions: Science remains a childless area (not a topic) drawn as a synthetic region at its ring anchor with the 18th ring hue — a proposal for the owner; CPS 40A/B stays as the 61st, zero-stop route rather than being dropped; the owner's CPS 109 opening road wins over the stale done-when phrase “no non-unit stop”, so the driver expects its full 12-stop route including deep and area stops; the cs2023 place test is relaxed for stored drafts and saved walks so those stops survive reload; route title is `code + " " + title`, description is `calendar_description` plus the standing line, and `secondary` is emitted only when non-empty.