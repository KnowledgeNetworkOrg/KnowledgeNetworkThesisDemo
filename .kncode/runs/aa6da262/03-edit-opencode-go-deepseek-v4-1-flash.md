The whole unit suite passes (61 files, 855 tests). Here is my summary.

## Summary

I gave every payload this app stores a real version marker and one naming rule, and deleted the temporary "Reset data" stopgap.

**One versioned-storage seam (`src/platform/persisted.ts`).** Everything app-side now stores an envelope `{ v, data }` through `readPersisted`/`writePersisted`/`removePersisted`. A read classifies what it finds as *absent*, *ok*, *migrated*, *corrupt* or *future*; it runs an ordered migration chain, treats a payload with no envelope as version 0, and never throws or overwrites bytes it cannot read. Bad reads are reported with a `console.warn` and recorded in an exported `persistenceIssues()` log — the card deleted the only visible surface, so this is the report.

**The stores.** The draft (`draftpersist.ts`) and saved-walks (`walkstore.ts`) stores now write v1 envelopes and can migrate forward rather than reseed. The draft's v0→v1 migration is the existing group-`optional` push-down, so an older draft loads with the author's meaning preserved. The presenter stores (`lecturenotes.ts`) dropped the `.v1` from their key names (one naming rule), gained envelopes, read the old `.v1` key once and move its data over, and `loadHabits` is now shape-guarded instead of handed through unchecked.

**Stopgap removed.** Deleted `src/state/storeddata.ts`, its test, the `resetStoredData` function and danger pill in `WalkActionBar.tsx`, and `tools/studio-spike/drive-reset.mjs`. Updated the spike drivers that read the old bare payloads/keys, and extended `drive-persistence.mjs` with a v0→v1 migration case and a corrupt-boot case.

**Verified:** `tsc -b` and `eslint` clean on the changed files; the full unit suite passes (61 files, 855 tests), including new `persisted.test.ts`. `node --check` passes on each changed driver.

Assumptions:
- The envelope lives in one app-side wrapper over `platform.storage`; the design-system ports (`ConnectionsSplitPane.tsx`, `ContainTree.tsx`) and the orphaned `kn-connections_*` / `pkt.floating-panel.*` keys are left as-is (no writer/reader), matching the card's scope note and the 2026-09-26 comment.
- Stored key names stay except the lecture `.v1` suffixes are dropped; existing data's meaning is unchanged, only wrapped.
- "Reported" means the console warning plus the exported issue log, not new UI.
- Because the draft store now leaves a container's group flag to the migration rather than pushing it down on every read (including current v1 payloads), I added a guard so the migration never strips a leaf's own `optional` — including a leaf left carrying a legacy flag after ungrouping.
- Corrupt payloads are classified as corrupt (via the envelope seam) even when a store's own reader could previously salvage a partial value; the readers still salvage what they can once versioning is valid, and the visible parse behavior for valid payloads is unchanged.