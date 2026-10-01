REVISE

**Must fix:**

1. **The document pane's first line will sit about 41px down, not 25, so the card's first "done when" line is not met.** The card says: *"the four first lines measured at 25px ±1 off the DOM with the three panes docked."*

   The cause is a 16px preview row that the document pane always draws first, above its header (`src/instruments/DocumentPanel.tsx:228`). The header itself starts at line 234. The document's body doesn't scroll, so the arithmetic is the legend row (11) + the preview row (16) + the header's top padding (14) = 41 from inside the border, or about 42 from the outer edge.

   I read the design side's binding text for this item directly. Their shell measured the document heading at 25.00 with the header directly under the legend, so the shell evidently has no preview row there. The two requirements genuinely collide. Nothing in this change addresses it, and the earlier step knew that.

   Two consequences:
   - The new browser test will fail on the document check every time (`tools/studio-spike/browsertest-firstline.mjs:178`).
   - The test runner picks up every browser test automatically, so the full browser suite goes red until this is resolved.

   This can't be fixed here without moving the preview row, which an earlier binding item placed. It needs a ruling from the design side; see the FLAG line at the end.

**Optional:**

1. **The new "no host restates the numbers" test breaks the repo's documented type-check rule, and might break the build.** The test is `src/firstline.test.ts`, lines 17–23.

   It reads files from disk. The app's type-check settings say every test that does that must be listed in two places: excluded from the app's own settings (`tsconfig.app.json`) and included in the separate settings for disk-reading tests (`tsconfig.node.json`). All six other such tests are listed in both. This one is in neither.

   It also uses the bundler's "import this file as text" form (`?raw`) three times. Under the disk-reading settings that form has no type declarations, so simply listing the file would fail too.

   It may compile today, because the test library's own type files probably drag the disk-reading types in. I couldn't check: no packages are installed in this checkout. The clean fix is to read the three host files with the plain file read the test already uses for its folder walk, then list the file in both settings. Run `npm run build` in the check step either way.

2. **The browser test's pass margin for the Explorer head and first crumb is under a tenth of a pixel.** It measures from the frame's outer edge. The frame has a 1px border and the legend row sits inside it. So by arithmetic both lines land near 25.9: the border, 11 and 14, less a hair for how the font sits in its line.

   That passes ±1 by a sliver, and any font fallback or sub-pixel rounding would flip it. The design side reported exactly 25.00 with the same 11 + 14, which suggests they read from inside the border. The test already prints both readings. Pick which one it asserts and say so in the receipt.

3. **A design-sync provenance note overclaims what the new test catches** (`src/ds/PROVENANCE.json:754`). It says the test "fails if a host restates one." The test actually catches only two things: a host declaring its own copy of a constant, and the three named host sites going back to their old values. A new `paddingTop: 14` anywhere else would pass. Soften the sentence.

4. **The entry-point test still lists a constant the app now uses** (`src/ds/barrel.test.ts:273`). That file keeps a list of design-system exports the app doesn't use yet, and its own instructions say to remove an export once app code imports it. `FIRST_ROW_PAD` stays on the list even though the map and document panes both import it, and the rewritten comment admits as much. This is a small bookkeeping inconsistency; no test enforces it.

5. **Still to do, not gaps in this diff:**
   - Nothing has run: no unit tests, build or browser test. The checkout has no packages installed at all, so the check step needs `npm ci` and `npm ci --prefix desktop` first.
   - The receipt hasn't been filed. The card asks it to say that the left rail's top-padding change already landed under the earlier rail work (#340/#341).
   - The reviewer comment pasted into the card is now resolved: the closed rail button sits at the rail's top value (`src/ds/connections/RailFrame.tsx:309`), so it no longer jumps 8px between closed and open. The receipt can say so.

**Noticed outside this card's scope:**

None. Every changed file is one the plan named. The two things the owner declined (left edges and label style) are untouched: the palette keeps its 12px left padding and its lower-case "presets" label.

**Recap:**

I read every changed file, the pane and header code they rely on, the document, map and palette setup, the automated guards, and the design side's own text for this item. I changed nothing.

The design system's constants, the header, the rail, the palette and the breadcrumb all match the binding text. That includes the two amendments the earlier step relied on, which I confirmed in the design text: the breadcrumb at exactly 14, and the palette's "presets" accepted at 26.33. The Relations rail keeps its 6px top, so its head doesn't move. There's no import loop between the pane and header files, the browser test's port is unique, and all the page hooks and labels it relies on exist.

What's left is the document pane, which can't reach 25 while the preview row sits above its header. Everything here comes from reading the code and doing the arithmetic; nothing was measured.

Assumptions: I took the design side's 2026-09-27 amendments as overriding the card's breadcrumb value (13) and its ±1 for the palette, since the card names that text as binding. I classed the type-check issue as Optional because I couldn't run the build to show it fails. I took the document's first line to be its kind label ("topic"), since the preview row is empty at rest.

FLAG: conflict: The document pane's always-drawn 16px preview row sits above its header, which puts the document's first line near 41px. Should the design side move or overlay that row so the line sits at 25, or amend done-when 1 to accept the document at about 41, as they did for the palette?