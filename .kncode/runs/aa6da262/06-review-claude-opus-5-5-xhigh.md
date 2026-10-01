REVISE

Must fix:

1. **Moving presenter note categories off their old key name saves them in a shape the app then rejects as corrupt** (`src/present/lecturenotes.ts:152`). On the first presenter load after this change, the store moves each old `.v1`-named key to its new name. It saves the value the reader *returned*, not the value that was *stored*. Notes and deck layout come back in the same shape they are stored in, so they survive. Note categories do not: they are stored as an object wrapping a list, but the reader returns the bare list. The app's own reader then classifies that copy as corrupt. This breaks the card's line *"A reader can distinguish 'older build, needs migration' from 'corrupt' instead of guessing"*: here the build misreads its own fresh write as corrupt.
   - **Reproduced this session.** I fed the real store an old categories key holding one category and loaded it twice, using a script piped through the bundler so no file was written. The first load returned the category. The stored copy then read `{"v":1,"data":[{…}]}`. The second load returned nothing and warned `[persisted] pkt.lecture.categories: corrupt — payload does not match v1`. The old key was already deleted, so nothing was left to recover from.
   - **Why it rarely shows today.** The presenter screen saves its categories again as soon as it opens (`src/present/PresenterScreen.tsx:263-264`), which rewrites the correct shape. In development, React's strict mode runs that first load twice, so the false "corrupt" warning does appear and lands in the issue log. Any path that loads without that immediate re-save loses the categories: a render error after the load, or a future caller.
   - **The same line drops data while moving it.** Habits lose any unknown field, and the whole deck layout if one id has the wrong type. That is the problem last round fixed for drafts and saved walks, left in place here.
   - **Fix:** save `legacy.writeBack` (the stored value before repair) instead of `legacy.data`, matching what the shared storage code now does. Add a second `loadMintedCategories()` call to the existing move test (`src/present/lecturenotes.test.ts:157`) and assert it still returns the category.

Optional:

1. **The "never overwritten" promise only holds for the load itself** (`src/platform/persisted.ts:29`). A payload from a newer build is left alone on load, but the store then opens empty or on the seed, and the next save, edit or note replaces it. Either stop writing to that key for the rest of the session, or reword the comment.
2. **The presenter key move can overwrite an unreadable payload** (`src/present/lecturenotes.ts:148-153`). If the new-name key is corrupt or from a newer build, and the old `.v1` key still exists, the old key's contents are written over it. Falling back to the old key only when the new one is *absent* closes this.
3. **The report only reaches developers.** A non-developer still sees a stale payload as "my plan is wrong": the only signals are a console warning and an issue log nothing in the app displays. The card's "Done when" lines don't require visible UI, so the PR should say this was a deliberate choice, and the owner can decide.
4. **Partial repairs are still silent.** Dropping a saved walk or one of its stops, blanking a draft stop, and filtering out bad notes all go unreported. The card names "walkstore.ts silently drops members it cannot read" as part of the problem, though no "Done when" line requires reporting it.
5. **The browser test scripts have never run against this change.** That covers the persistence driver (the plan's own Verify command), the optional-group test and the presenter-panes test. I didn't run them either, because they start a dev server and write screenshots.
6. **Two comment lines are still unindented** in `tools/studio-spike/browsertest-groupedit.mjs:77-78`.
7. **Leftover keys are no longer cleaned up.** The old panel-position and Connections-pane keys have had no writer for a while, and now nothing removes them, since the Reset button was the only thing that did. They're harmless bytes, and the plan chose to leave them.
8. **One comment is now false.** `src/model/nav.ts:17` still says "#170: persisted payloads have no version field."

Dropped from last round:
- **The upgrade data-loss Must fix is resolved.** The shared storage code now saves the upgraded payload before the reader's repair (`src/platform/persisted.ts:189`). I also checked that the walk-editor draft is only re-saved after an edit (`src/state/walk/authordraft.ts:168-172`), so the preserved copy isn't overwritten at startup.
- **The missing saved-walks upgrade test now exists** (`src/state/walkstore.test.ts:131`).

Noticed outside this card's scope
- The design-system port log has two dated entries that are now stale (`src/ds/PROVENANCE.json`): line 942 says the deleted sweep file keeps a prefix "so Reset still sweeps them," and line 797 names `pkt.lecture.habits.v1`.
- The platform's "list stored keys by prefix" capability (`platform.storage.keys`) has no caller left in the app. Whether to keep it belongs to the platform work in #338.

What I checked against the card's "Done when" lines:
- **Version on every payload:** every write in the app now goes through the one versioned path, under one naming rule. The only other writers are two design-system components that the app no longer mounts.
- **Telling cases apart:** loads distinguish an old format, a corrupt payload and a newer build's payload. The categories case above is the one exception.
- **Upgrades:** the draft and saved walks upgrade without discarding data.
- **Stopgap removed:** the Reset button, the diagnostic sweep and its test, and `drive-reset.mjs` are deleted, `shot-toolbox.mjs` expects five buttons again, and no file still references them.
- **Commands run this session:** the app type check was clean, the full unit suite passed (61 files, 858 tests), and lint was clean on the changed folders.
- **Not run:** the browser test scripts, and the full `npm run verify` (it writes build output).

Assumptions: I graded the categories problem a Must fix even though the presenter screen's save-on-open currently hides it from users, because this change introduced it and it makes the store write a payload its own reader reports as corrupt. I ran the type check with incremental builds off and the tests with caching off, so neither wrote anything to disk. I left the orphaned keys alone, as the plan decided.