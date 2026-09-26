**The fix:** make Reset data wipe only the things it says it wipes. Today it erases everything the app has saved whose storage name starts with `pkt.`. After the fix it will erase only a short, named list: the walk draft, the saved walks, and panel layout. The lecture notes a presenter typed, the categories they created and their deck layout will all survive the reset.

**Why it happens.** The browser gives each website a small key-value store (localStorage). Every saved thing in this app sits there under a name, and most names start with `pkt.`. When the Reset button was built, "everything starting with `pkt.`" meant exactly the draft, the walks and panel positions. Presenter mode later saved its notes under the same prefix. The broad sweep took them in without anyone deciding it should. I recommend flipping the default, which is the card's first suggested fix: Reset clears only the storage areas named on its list, so anything a future feature saves is safe unless someone deliberately adds it. The list uses name *prefixes*, not exact names. That way leftover keys from the retired floating panel still get cleared, which was the original reason for sweeping broadly.

**Correction to the card.** The note at the top of the helper file already names the lecture-notes module as one of three places that save things. What it gets wrong is that it describes lecture notes as fair game for the sweep, and it never mentions the Connections pane's saved layout. The rewrite will list every stored name and say which ones Reset clears.

1. In the stored-data helper, replace "every `pkt.` key" with an explicit list of what Reset owns: `pkt.walkdesk.` (draft), `pkt.walks.` (saved walks), `pkt.floating-panel.` (leftover positions from the retired floating panel), and `kn-connections` (the Connections pane's column width and collapsed state).
2. Keep the diagnostic listing that prints before a reset showing everything the app stores, including the `kn-connections` keys, so the console shows what was cleared and what was kept.
3. Rewrite that file's header note to list every stored name and its owner, say which ones Reset clears and why lecture data is excluded, and update the stale reasoning about why the sweep uses a prefix.
4. Change the button's tooltip to "TEMPORARY: forget the saved draft, saved walks and panel layout, then reload — lecture notes are kept", and fix the matching code comments.
5. Add a unit test with a fake browser storage. It seeds draft, walks, floating-panel, Connections-pane, lecture notes, categories, habits and an unrelated key, then checks that exactly the first four groups are removed.
6. Extend the existing browser script that presses Reset for real: seed a lecture notebook and a Connections-pane width, press Reset, and check that the notebook survives and the width is gone. Update its header comment to match.
7. Run the full check suite and that browser script.

Files: `src/model/storeddata.ts`, `src/instruments/walkdesk/WalkActionBar.tsx`, `src/model/storeddata.test.ts` (new), `tools/studio-spike/drive-reset.mjs`

Out of scope: #170's real fix, i.e. adding versions to stored data and deleting the Reset button. The card says the button stays until #170 replaces it. Nothing that writes lecture notes changes, and neither does the design-system Connections code that writes its own keys.

Verify: Open the app and teach a walk in presenter mode, typing a note. Drag the Connections pane's divider. Press Reset data. After the reload, the note is still in the presenter's notebook and the Connections divider is back at its default width. The browser script in step 6 automates exactly this and fails if the note is gone or the width is still saved.
```
npm run verify
npm run test:browser -- reset
```

Assumptions:
- "Lecture notes are kept" covers all three presenter keys: notes, categories and deck layout. The card lists all three as wrongly erased, and categories are work a person created.
- The card left the `kn-connections` keys open. I'm clearing them because they are panel layout, which is what the tooltip promises, and they are the only panel layout still being saved.
- I chose the named list over a confirmation dialog, because it is the smaller change and protects future features by default.