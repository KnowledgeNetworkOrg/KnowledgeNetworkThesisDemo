I read both obligations in full from the design system's project and traced every place the card and the dock appear. I changed nothing in the repository. The only files I made were two scratch copies of design-system files, outside the repo, so I could search them.

**What the work is.** The hover card will stop showing just a stop's name. It will show a small preview of the stop's document: its number and name, where it sits in the course, the walk's own note if there is one, and the first lines of the node's page. The walk dock's play button will turn into a circular "replay" arrow once the walk reaches its last stop. Pressing it jumps back to stop 1 straight away and starts playing about 0.6 s later. Finally, hovering the current stop's name next to the button will open that same card.

**Three things I found that shape the plan:**
- **The shared card file has already moved.** The layering clean-up the card mentions (#338) has moved the card's code out of the walk desk's folder into the shared walk folder. So this work follows it there, as the card asks.
- **The design system has added a third, separate obligation to the same components.** Italic names for optional stops (OB-216) is now built into the design system's current versions of the card, the dock and their shared parts. The card says "these two and nothing else", so I will leave that styling out rather than copy it in by accident.
- **The map's play button already restarts from stop 1 when pressed at the end, but with no pause.** OB-196 explicitly requires the jump back first and the start after a beat. So the map will use the dock's built-in two-step restart, and the map's own code does not need to change.

## Plan

1. Add to the shared walk parts: the replay arrow glyph, a check for "the walk has reached its last stop", and a third state for the play button (replay), where "playing" still wins.
2. Add the 600 ms pause before a replay starts to the published playback defaults.
3. Update the dock:
   - Draw the replay arrow only when the walk is on its last stop and not playing.
   - Restart in two steps: go to stop 1 at once, then start playing after the pause. Any seek, a second press, or the space bar cancels the pending start.
   - Add the optional `onReplay` and `restartPause` settings.
   - Hovering the current stop's name opens the card, centred on the words themselves, and does not report the hover to other panes.
4. Add the design system's `StopCard` component and its size limits to our copy of the card-placement code. It will keep the "(optional)" suffix but not OB-216's italics. Also add one test-only marker on the card's heading.
5. Export the new pieces through the design system's single entry point.
6. Shrink the shared card code to a thin wrapper that passes `StopCard` its fields:
   - the address the screen already computes
   - the title
   - the placement line (the containment path with the root and the node itself removed)
   - the walk's note
   - the document's opening, from the per-node document text (`DOC_BODY`)
   - the merged-pin marker, only when there is one
7. In the presenter screen, pass the stop number at both places it asks for the card (its strip and its stop finder), so its card shows "1.2 · …" like the dock's.
8. Add unit tests:
   - the "last stop" check: never true for a walk under two stops, not true one stop early, and correct at in-between positions
   - the play button draws the replay arrow, and a pause while playing
   - a stop with no note gets a card longer than its heading
   - the placement line leaves out the root and the node
   - a merged pin's "+N more" line comes from the card itself
   - no 11px text and no 220px width limit
9. Update the two browser checks that look for the old card markers. Add browser checks for:
   - the replay arrow at the last stop
   - the jump to stop 1 at once, with play starting about 600 ms later
   - a seek during that pause cancels the start
   - the arrow turns back into a play triangle when the cursor leaves the last stop
   - hovering the dock's name, the reported stop "1.2 · Transistors & Logic Gates", the walk viewer and the presenter all show the same full card
10. Record the ported changes in the design-system provenance file.
11. After the commit exists, file one receipt in the design project marking both obligations done, with that commit's sha.

Files: src/ds/nav/WalkParts.tsx, src/ds/nav/WalkPreview.tsx, src/ds/map/WalkDock.tsx, src/ds/map/walkrecipes.ts, src/ds/index.ts, src/state/walk/stoppreview.tsx, src/present/PresenterScreen.tsx, src/ds/PROVENANCE.json, src/ds/nav/walkparts.test.ts, src/state/walk/stoppreview.test.ts (new), tools/studio-spike/browsertest-walkdock.mjs, tools/studio-spike/browsertest-grouppins.mjs

Out of scope: moving the shared card file (the card says "This issue does not move it"; #338 has already moved it, so this work only follows it), and anything beyond OB-196 and OB-199 ("these two and nothing else"). That excludes OB-216's italic styling for optional stops, and the walk viewer's strip adopting the replay arrow.

Verify: run the app and open the Studio's map. Put the walk dock on the last stop: the button shows a circular replay arrow. Click it: the readout goes to "1 / N" at once, and the walk starts moving about 0.6 s later. Hover the current stop's name: a card appears above the name with the address and name, a "Domain › Module" line and the opening lines of that node's document. Hovering stop "1.2 · Transistors & Logic Gates" in the dock, the same stop in the walk viewer's strip, and the same stop in the presenter's strip all show that same card.
```
npm run verify
node tools/studio-spike/browsertest-walkdock.mjs
node tools/studio-spike/browsertest-grouppins.mjs
npm run test:browser
```

Assumptions:
- **The card file's location:** OB-199 names the old folder, which is out of date. I'll use the card file's current home in the shared walk folder.
- **OB-216 styling:** the design system's current components include OB-216's italic and slanted styling. I'll port them without it. OB-216 would also need a font-slant setting from the design system that isn't in our code yet.
- **How the map restarts:** it won't pass its own one-step restart (`onReplay`). That route would skip the required pause, so the map relies on the dock's two-step fallback.
- **The placement line:** it is built inside the shared card file from the corpus. The walk desk has the identical helper, but the layering rules don't let the shared folder import from the walk desk, so I won't reach into it.
- **Browser-check markers:** the browser checks will switch to the design system's own card markers, plus one test-only heading marker that I'll record as a local difference.
- **"Identical on all three screens":** I'm reading this as the same card component with the same address style on the map (dock and pins), the walk viewer's strip, and the presenter (strip and stop finder).
- **The receipt:** it is written only after the commit exists, since it has to cite that commit's sha.