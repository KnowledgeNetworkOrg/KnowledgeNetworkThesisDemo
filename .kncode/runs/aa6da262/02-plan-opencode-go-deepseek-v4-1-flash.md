## Plan

1. Add one versioned-storage seam, `src/platform/persisted.ts`, wrapping `platform.storage`: every app payload is stored as an envelope `{ v, data }`, with `readPersisted` / `writePersisted` / `removePersisted`. Reads classify as `absent | ok | migrated(from) | corrupt | future`, run an ordered migration chain, treat an envelope-less payload as version 0, and never throw or overwrite what they cannot read.
2. Convert the draft store (`draftpersist.ts`) to the v1 envelope, keeping its referential repair; make the v0→v1 migration the existing group-level-`optional` push-down, so old drafts load rather than reseed.
3. Convert the saved-walks store (`walkstore.ts`) to the v1 envelope, with the bare array as the v0 payload and the per-member dropping rule preserved.
4. Convert the presenter stores (`lecturenotes.ts`): drop `.v1` from the three key names (the one naming rule), add envelopes, read the old `.v1` key once as legacy v0 then rewrite under the new name, and shape-guard `loadHabits` (today unchecked).
5. Report classification: on `corrupt` / `future` `console.warn` and record in an exported, testable issue log; the app still boots on the seed/empty and never throws.
6. Delete the stopgap: `src/state/storeddata.ts`, `src/state/storeddata.test.ts`, the `resetStoredData` function + danger pill + import in `WalkActionBar.tsx`, and `tools/studio-spike/drive-reset.mjs`.
7. Update spike tooling: `shot-toolbox.mjs` (back to a bare 5 pills, no TEMP handling), the stale `Reset data` comment in `browsertest-groupedit.mjs`, and the envelope/key changes the drivers read in `browsertest-optionalgroup.mjs` and `browsertest-presenter-panes.mjs`; extend `drive-persistence.mjs` with a legacy→migrated round-trip and a corrupt-boot case.
8. Add `persisted.test.ts` (envelope, v0 detection, migrate/corrupt/future) and update `draftpersist.test.ts`, `walkstore.test.ts`, `lecturenotes.test.ts`; confirm `layering.test.ts` and `browsertestguard.test.ts` stay green.

Files: new `src/platform/persisted.ts`, `src/platform/persisted.test.ts`; changed `src/state/walk/draftpersist.ts`, `src/state/walkstore.ts`, `src/present/lecturenotes.ts`, `src/instruments/walkdesk/WalkActionBar.tsx`, `src/state/walk/draftpersist.test.ts`, `src/state/walkstore.test.ts`, `src/present/lecturenotes.test.ts`, `tools/studio-spike/shot-toolbox.mjs`, `tools/studio-spike/browsertest-groupedit.mjs`, `tools/studio-spike/browsertest-optionalgroup.mjs`, `tools/studio-spike/browsertest-presenter-panes.mjs`, `tools/studio-spike/drive-persistence.mjs`; deleted `src/state/storeddata.ts`, `src/state/storeddata.test.ts`, `tools/studio-spike/drive-reset.mjs`.

Out of scope: nothing stated as excluded — the card's scope note explicitly widens the fix to Studio-wide `pkt.*` persistence, not just the Walk Editor (its 2026-09-26 comment keeps the two design-system ports, `ConnectionsSplitPane.tsx` and `ContainTree.tsx`, on the design side).

Verify: seed an unversioned draft and saved walk into `localStorage`, reload, and check they come back unchanged (not reseeded) and are then re-written as `{v:1,data:…}`; then seed a malformed draft and check the app boots on the seed with a console warning naming that key.

```
npm run verify
node tools/studio-spike/drive-persistence.mjs
```

Assumptions:
- Envelope shape is `{ v, data }` applied app-side; stored key names stay as they are except the lecture `.v1` suffixes are dropped.
- Versioning lives in one app-side wrapper over `platform.storage`; the host `KeyValueStore` contract is left generic/capability-shaped rather than taught payload shapes.
- "Reported" means a console warning plus an exported issue log; no new visible UI, since the card deletes the only visible surface and names no replacement.
- The v0→v1 draft migration carries the existing group-`optional` push-down as its first real shape change, which is what demonstrates forward migration.
- Orphaned `kn-connections_*` / `pkt.floating-panel.*` keys are left in place (no writer, no reader).