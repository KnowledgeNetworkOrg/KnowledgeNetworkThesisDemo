REVISE

**Must fix:**

1. **Upgrading an old payload saves the cleaned-up copy, so the one-time upgrade can permanently erase data** (`src/platform/persisted.ts:173`). When the app loads a draft or saved-walks list written before this change, it upgrades it to the new format and immediately saves it back. But what it saves is the result *after* the store's reader has thrown away anything it couldn't make sense of, not just the upgraded data. This breaks the card's line *"At least the draft and saved-walks stores can migrate forward across a shape change instead of discarding data."*
   - **How it goes wrong:** a developer has saved walks and a draft from before this change. They pull it and first open the app on the other course catalogue (`VITE_CORPUS=courses npm run dev`, the documented way to run it, which shares the same browser storage).
   - **Saved walks:** the reader drops every stop the loaded catalogue doesn't know, and then every walk left with no stops (`src/state/walkstore.ts:57-63`). The resulting empty list counts as "upgraded" and is written as `{v:1, data:[]}`. Every saved walk is gone, and the user never clicked anything.
   - **Draft:** every stop becomes a blank placeholder (`src/state/walk/draftpersist.ts:69-72`), and that is what gets saved.
   - **Before this change**, both kinds of data stayed on disk until the user's next save or edit.
   - **Fix:** save back the upgraded data as it was *before* the reader's repair, so the upgrade only changes the format. Add a test that loads an old unversioned draft and saved-walks list from storage and checks what gets written back.

**Optional:**

1. **The "never overwritten" promise only holds for the load itself.** The new storage file says a payload from a *newer* build is "reported, never overwritten" (`persisted.ts:25`). But the store then opens empty or on the seed, and the next action overwrites it. For saved walks, saving or deleting one walk replaces the newer build's whole list; for the draft it's the next edit; for presenter notes, the next note. Either stop writing to a key that loaded as "newer" for the rest of the session, or reword the comment so it doesn't promise more than the stores deliver.
2. **The presenter-notes upgrade can overwrite an unreadable payload** (`src/present/lecturenotes.ts:147-153`). If the new-name key is corrupt or from a newer build, and the old `.v1`-named key is still there, the old key's contents are written over it. This is the one place the change itself overwrites something it couldn't read. It needs both keys present, so it's rare. Falling back to the old key only when the new one is *absent* would close it.
3. **The report only reaches developers.** The card's problem is that a stale payload "presents to the user as 'my plan is wrong', never as an error." For a non-developer that is still true: the only report is a console warning, plus an issue log (`persistenceIssues()`) that nothing in the app reads. The card's "Done when" lines don't require visible UI, and the plan chose this on purpose. It's worth saying so in the PR so the owner can decide.
4. **Partial repairs are still silent.** Dropping a walk or stop, blanking a draft stop, and filtering out bad notes are all unreported. The card names "walkstore.ts silently drops members it cannot read" as part of the problem, though no "Done when" line requires reporting it.
5. **No direct test that an old saved-walks list upgrades.** No unit test loads an old unversioned saved-walks list through storage. The persistence browser driver only seeds an old draft, although the plan's Verify step said "an unversioned draft and saved walk." One other driver (`browsertest-walkdock.mjs:987`) seeds an old-format list, so the path is only exercised indirectly.
6. **The browser drivers have never run against this change.** The previous step only syntax-checked them, and I didn't run them either because they write screenshot files. `drive-persistence.mjs` (the plan's own Verify command), `browsertest-optionalgroup.mjs` and `browsertest-presenter-panes.mjs` should each run once before merge.
7. **Two comment lines lost their indentation** in `tools/studio-spike/browsertest-groupedit.mjs:77-78`.
8. **Leftover keys no longer get cleaned up.** The old panel-position keys (`pkt.floating-panel.*`) and Connections-pane keys (`kn-connections_*`) have had no writer for a while, and now nothing removes them either, because the Reset button was the only thing that did. They're harmless bytes; the plan chose to leave them.
9. **One comment is now false.** `src/model/nav.ts:17` still says "#170: persisted payloads have no version field."

**Noticed outside this card's scope**

- The design-system port log (`src/ds/PROVENANCE.json`) has two dated history entries that are now stale. Line 942 says "`storeddata.ts` keeps the prefix so Reset still sweeps them," and line 797 names `pkt.lecture.habits.v1`.
- The platform's "list stored keys by prefix" capability (`platform.storage.keys`) now has no caller in the app; the deleted diagnostic sweep was the only one. Whether to keep it belongs to the platform work tracked in #338.

**What I checked:** every "Done when" line is met except the data-loss case above:
- **Versions and naming:** every live stored payload now carries a version, under one naming rule.
- **Telling cases apart:** loads distinguish an old format from a corrupt one.
- **Upgrades:** the draft and saved walks upgrade instead of resetting.
- **Stopgap removed:** the Reset button, the diagnostic sweep, its test and `drive-reset.mjs` are deleted, `shot-toolbox.mjs` is back to five buttons, and nothing in the repo still points at them.
- **Design-system ports:** the Connections-pane components are no longer mounted by the app, so they write nothing.
- **Folder-import rule:** the new file respects it.
- **Commands I ran this session:** the type check and the linter were clean, and the full unit suite passed (61 files, 855 tests).
- **Not run:** the browser drivers, and the full `npm run verify` (it writes build output).

Assumptions: I judged the data-loss case a Must fix even though it needs a particular first load (the other catalogue, or a topic renamed since the walk was saved), because it contradicts a "Done when" line and this change introduced it. I treated "reported" as satisfied by a console warning, since the card asks only that a reader can *distinguish* the cases. I left the orphaned keys alone, as the plan decided.