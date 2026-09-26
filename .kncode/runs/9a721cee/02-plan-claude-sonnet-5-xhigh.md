Eight of the nine bugs are in scope. I've left out OB-210 (the Firefox scrollbar item), as the owner's comment on the card says. The plan is below, and I haven't changed any files.

Most of these obligations are already fixed on the design side, so the app work is mainly copying those fixes across and connecting them. The exceptions are the palette double-press (OB-218) and the walk-pin paint order (OB-221), which are edits to our own code.

**Plan**
1. Fix the wrap-count bug (OB-217). Narrow the column by 1px inside the function that counts lines, keep one shared 1px constant that the chip code also reads, and add a unit test with a fake measurer that comes up 0.4px short, as Firefox does.
2. Fix the note timestamp and tag (OB-207). The timestamp moves to the caption size and wraps if long, the tag gets a 1px offset, and the During column takes the settled spacing (the first row `4px 4px 7px`, the scroller margins at 0, the composer gap at 6).
3. Add the film roll travel frame (OB-203). Group the three cards into one row and play a single slide animation on that row when the stop changes, driven by a new `stopIndex` value that the presenter screen passes in so the arrow keys, the strip and the finder all trigger it.
4. Make the open presenter strip span the row (OB-246). The 68px pitch becomes a minimum, the stops are spread across the width, the two ends are inset separately, and the window is clamped inside the walk. The fill-bounds helper and the "back to active node" pill test change to match, and I'll add a small test.
5. Fix the palette toggle (OB-218). Keep the 400ms timer in a ref and cancel it on open, close and unmount. Decide from what the palette is becoming rather than what is still mounted. A press mid-flight lands with no animation, and I'll add the three rapid-press checks to the palette driver. I'll also report on the cursor flicker.
6. Lengthen short relation arrows on the map (OB-197). Port the arrow helpers from the design side, and make the arrow component cap its own bow. In the map's relation layer the order becomes clip, lengthen, cap the bow, then derive the head angle and count label from the capped curve.
7. Fix the ghost heading and cell names (OB-223). Port the paper-case helper and the ghost colour (`topicPaint().ghost`). Cell names wear the case, the ghost becomes one opaque tone above every fill and wash, and I'll measure the selected name's contrast before touching its ink.
8. Do the map paint-order pass last (OB-221). Make the walk-pin group the final child of its parent, so the ghost move in step 7 can't undo it.
9. Record each port in `src/ds/PROVENANCE.json`, the file that logs what was copied from the design system.
10. Run the checks below, then drive the running app in Edge and screenshot each of the eight.
11. After the tool makes the commit, file the receipt in the design project with the real commit id. That is one entry per obligation, plus the Firefox numbers for OB-217 and the flicker finding for OB-218.

Files: `src/ds/graph/textMeasure.ts`, `src/ds/graph/NodeChip.tsx`, `src/ds/graph/textmeasure.test.ts`, `src/ds/presenter/LectureNotes.tsx`, `src/ds/presenter/FilmRoll.tsx`, `src/present/PresenterScreen.tsx`, `src/ds/presenter/PresenterStrip.tsx`, `src/ds/presenter/presenterstrip.test.ts` (new), `src/studio/StudioView.tsx`, `tools/studio-spike/drive-palette.mjs`, `src/ds/graph/NodeArrow.tsx`, `src/ds/graph/nodearrow.test.ts`, `src/ds/graph/textFit.ts`, `src/ds/graph/hueslots.ts`, `src/ds/graph/topicpaint.test.ts`, `src/ds/index.ts` (and `src/ds/values.ts` if the map reads the new colour through it), `src/instruments/MapView.tsx`, `src/model/color.ts` (only if the ink measurement fails), `src/ds/PROVENANCE.json`, and the browser drivers `browsertest-presenter.mjs`, `drive-maparrows.mjs`, `drive-mappins.mjs`.

Out of scope: OB-210, the Firefox scrollbar fix, is held until #342 (the Document pane's Relations rail) merges, and I won't touch the map, document or connections column scrollers. The obligations also rule out changes to any token or `tailwind/kn-theme.css`, a head cap on map arrows, the walk path and arrows moving, `AuthorRoad.tsx`, padding the predicted chip height, porting `ViewMorph`, disabling or debouncing the palette button, restructuring the palette measuring effect, and hard-coding a 200ms duration.

Verify: run the app with `npm run dev` and open it in Edge.
- **Presenter:** press the → key and the film roll visibly slides left, with a sample taken mid-move showing a value between the two endpoints. Then open the strip and its outermost stops sit as far out as the closed rail's ends.
- **Map:** a walk pin on a focused cell shows fully on top of the focus border, and the parent's ghost heading is the same colour over every child.
- **Palette:** three quick presses leave it open.

The extended browser drivers assert each of these.
```
npm ci --prefix desktop     (once, only if desktop/ has no packages yet)
npm run verify
npm run test:browser
```

Assumptions:
- **Paint order (OB-223 and OB-221):** the card doesn't say where the ghost sits relative to the walk lines and relation roads. I'll move the tinted fills of hover, spotlight and selection under the label group, leave the strokes, roads and walk lines where they are, and put the pins last. If that looks wrong on the page, I'll fall back to moving the whole label group above the selection overlay.
- **Ghost fade (OB-223):** I read "full opacity" as the resting state only, so the ghost still steps aside (0.03) when the pointer is inside it. Its existing white outline stays.
- **Selected name ink (OB-223):** the design measured a pre-wash ink, but our selected names already use a darker emphasis ink. I'll measure first and only change it if it's under 4.5:1.
- **Paper case (OB-223):** I'll pass the map's own scaling to the case call so the stroke tracks zoom the way the rest of the map does.
- **Arrow floor (OB-197):** our relation arrowheads are hand-drawn triangles, not the arrow component, so I'll take the minimum length from the shared arrow-head sizing for the whole set, converted to map units.
- **Firefox (OB-217):** nothing here drives Firefox, so the receipt will say the Firefox numbers weren't taken unless you run the design project's probe page. The unit test covers the arithmetic.
- **Receipt timing:** it can only be written after the commit exists. I'll put no OB-210 entry in it, since silence means untouched, unless you want a "blocked on #342" line.