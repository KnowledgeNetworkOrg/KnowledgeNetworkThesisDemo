1. Add optional `unsaved` to `DraftSnapshot`, parse it as `true` only (absent/false → `undefined`), and keep the envelope at version 1.
2. Have `saveDraft` write `unsaved` only when true, so old payloads and saved drafts stay byte-compatible.
3. In `authordraft.ts`, introduce a `restoredUnsaved` latch seeded from `restored?.unsaved === true`, and compute unsaved as `(latch || differs from baseline) && leafStops(...).length > 0`.
4. Make `persist` compute that bit directly from the current stores and latch (never read `dirtyStore`), keeping its subscriptions before `refreshDirty`.
5. In `markSaved`, clear the latch, reset baselines, refresh the dirty store, and explicitly call `persist()` so save/`forgetDraftUnsaved` write the cleared bit even though no store changed.
6. Add tests for reload persistence, reload + edit + undo, save/forget then reload, deleting all stops from a restored unsaved draft, and legacy payloads without the field; extend `draftpersist` tests for parse/save round-trips.

Files: `src/state/walk/authordraft.ts`, `src/state/walk/draftpersist.ts`, `src/state/walk/authordraft.unsaved.test.ts`, `src/state/walk/draftpersist.test.ts`

Out of scope: Do not bump the draft's version; version 1 must remain enough (the first version-2 payload belongs to #483), and stop/report if version 1 proves insufficient.

Verify: Edit the walk draft, reload the app, and the Load dialog still warns about the walk draft; after Save/Load without saving, reload again and it no longer warns.
```
npm run build
npm test
npm run verify
```

Assumptions: `unsaved?: boolean` on `DraftSnapshot` is acceptable, with only a stored literal `true` counting as unsaved and `markSaved` being the single latch-clearing path used by both `saveDraftAsWalk` and `forgetDraftUnsaved`.