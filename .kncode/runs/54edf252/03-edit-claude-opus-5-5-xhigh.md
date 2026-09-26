The "Reset data" button no longer erases a presenter's lecture notes. It now clears only a short, named list: the walk draft, the saved walks, and panel layout. I made the edits but did not run the test suites, because this step's rules limit me to editing files. The only check I ran was a syntax check on the browser script, which passed.

**What was wrong.** The browser keeps each website's saved data under names, and most of this app's names start with `pkt.`. Reset used to delete everything starting with `pkt.`. When it was written, that meant exactly the draft, the saved walks and panel positions. Presenter mode later started saving under the same prefix, so a click on Reset also wiped a presenter's notes, the categories they created and their deck layout, with no warning.

**What changed:**

- **What Reset deletes.** Instead of "everything starting with `pkt.`", it now deletes only names on an explicit list:
  - the walk draft;
  - the saved walks;
  - leftover positions from the floating panel that was removed earlier;
  - the Connections pane's divider width and collapsed state.

  Because the list is opt-in, anything a future feature saves is safe from Reset unless someone deliberately adds it. The list matches the start of each name rather than exact names, so the leftover floating-panel entries, which nothing in the code refers to any more, still get cleared.
- **The console listing.** Before a reset, the button still prints every saved entry to the browser's developer console. That listing now includes the Connections pane's entries, and a new last line lists what Reset kept.
- **The tooltip** now reads: "TEMPORARY: forget the saved draft, saved walks and panel layout, then reload — lecture notes are kept".
- **The explanation at the top of the stored-data helper** is rewritten. It lists every saved name, which part of the app writes it, which ones Reset clears, and why lecture data is left alone. This is what the card's "done when" asked for.
- **A new unit test** fills a fake browser store with one of everything the app saves, plus an unrelated entry and an invented future-feature entry under `pkt.`. It checks that Reset removes exactly the draft, walks, floating-panel and Connections entries. The lecture entries must come back unchanged, down to the byte.
- **The existing browser script that presses Reset for real** now also plants a lecture notebook, categories, deck layout and an unusual Connections width (237). After the reset it checks that the lecture data survived unchanged and the 237 width is gone. The Connections pane writes its default width back as soon as it appears, so the script checks for "not 237" rather than "no entry at all".

**What you could observe:** type a note while presenting, press Reset data, and after the reload the note is still in the presenter's notebook. The Connections divider goes back to its default width.

**Not yet verified:** the full check suite (`npm run verify`) and the browser script (`npm run test:browser -- reset`) still need to run.

Assumptions: "lecture notes are kept" covers all three presenter entries: notes, categories and deck layout. The Connections pane's saved layout is cleared, because it is panel layout, which is what the tooltip promises. For its names I used the prefix `kn-connections_`, with the underscore, since every name the pane writes has one.