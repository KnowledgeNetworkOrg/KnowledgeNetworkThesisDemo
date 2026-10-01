REVISE

**Must fix:**

1. **The new browser test will very likely fail on the map's breadcrumb, so the card's first "done when" line still isn't met.** The card says: *"the four first lines measured at 25px ±1 off the DOM with the three panes docked."*

   The failing check is `tools/studio-spike/browsertest-firstline.mjs:188`. It measures from the frame's *outer* edge, which sits above a 1px border. Here is where the breadcrumb's text lands, step by step:
   - the border, 1px;
   - the legend row, 11px;
   - the bar's top padding, now 14px (`src/instruments/MapView.tsx:956`);
   - 1px more, because the last crumb carries 1px of padding top and bottom, which makes the row 16.3px tall, and the row centres the first crumb in it;
   - minus 0.34px, which is where the app's Nunito font puts its text inside a 14.3px line.

   That totals about **26.66px, outside 25 ±1**. The old `FIRST_ROW_PAD - 1` had absorbed exactly that centring pixel. The new map comment at `MapView.tsx:954` says "the pixel is inside the clause's ±1", but that holds only when measuring from inside the border, which is not what the test asserts.

   The same outer-edge reading leaves the Explorer label and the document's label (once the preview row is subtracted) at about 25.93. That passes by 0.07px. If the web font fails to load and the browser falls back to Segoe UI, the Explorer label reads about 26.1 and fails too.

   The design side's own figures only add up when measured from inside the border: 11 + 14 = 25 for the document, and 11 + 6 = 17 for the old Explorer. From inside the border, the four lines come out at about 24.9, 25.7, 24.9 and 25.6, all inside ±1 with room to spare.

   The clean fix is to assert the inside-border reading at lines 188, 195 and 203, which the test already computes. Say so in the receipt. Reverting the breadcrumb pad to 13 would also pass, but it contradicts the design side's amended text.

   All of this is arithmetic from the code and the declared font metrics. Nothing was measured. (again — this upgrades the earlier review's Optional #2, which estimated the breadcrumb at about 25.9 and missed the centring pixel.)

**Optional:**

1. **The new source-reading test still skips the repo's type-check listing** (`src/firstline.test.ts`). It is now the only test that reads files off disk but still compiles under the app's type settings; the other six are excluded from `tsconfig.app.json` and listed in `tsconfig.node.json`. It probably compiles anyway, because the test library's type files pull the file-reading types in. Moving it would also need its three `?raw` imports replaced with plain file reads. Unverified, since nothing is installed. (again)

2. **A provenance note still overclaims what the new test catches** (`src/ds/PROVENANCE.json:754`): "src/firstline.test.ts fails if a host restates one." The test catches only a host declaring its own copy of a constant, and the three named sites going back to their old values. A fresh `paddingTop: 14` anywhere else would pass. (again)

3. **The export bookkeeping list still holds a constant the app now uses** (`src/ds/barrel.test.ts:275`). That list is meant for design-system exports no app file imports yet, but the map and the document now both import `FIRST_ROW_PAD`. The comment was reworded to justify keeping it. Nothing enforces the list, so this is bookkeeping only. (again)

4. **Still to do, not gaps in the diff:**
   - Nothing has run: no unit tests, build or browser tests. `npm ci` and `npm ci --prefix desktop` come first.
   - The receipt isn't filed yet. It should say four things:
     - The left rail's padding change landed under the earlier rail work (#340/#341).
     - The pasted reviewer comment is resolved: the closed rail button now follows the rail's top value (`RailFrame.tsx:309`).
     - It should give the document decision in plain words, including what it costs: with all panes docked, the document's first line sits about 16px below the other three, which is the kind of mismatch the owner originally reported.
     - It should name which edge the measurements are taken from.

**Previous findings dropped:** the earlier Must fix (the document's first line near 41) is resolved by the call you asked for. The preview row stays, the document is measured from that row's bottom edge, and the decision is written at the row in `DocumentPanel.tsx`, in the provenance file and in the test. I checked its main reason against the code, and it holds: the existing relations-rail browser test requires the first element under the preview row to sit at the same height whether a node is chosen or the "Nothing chosen" placeholder is showing (`browsertest-relationsrail.mjs:286`). So pulling the header up under the row would break that test.

**Noticed outside this card's scope**

None. Every changed file is on the plan's list. The left edges and the "presets" label style, which the owner declined, are untouched.

Assumptions: I assumed the browser's text measurement covers the font's declared height (ascent plus descent), not the line's height. If it used the line's height instead, the breadcrumb would read 27.0 from the outer edge and still fail. I assumed the web fonts load during the test. I took the earlier Optional #2 as upgraded by this round's evidence rather than as a new finding.

---

**Recap.** I re-read the whole change and the code it depends on: the pane frame, the legend row, the rail's head, the breadcrumb component, the document header, the preview row, the palette's label, the app's font metrics, and the guard tests that police browser tests and folder imports. I changed no files and ran nothing; the checkout has no packages installed.

Most of the change matches the card:
- The three new constants and the legend-row constant exist, are tied together by arithmetic, and are exported.
- The document header, the breadcrumb, the palette and the document's closed Relations button all read the shared values, and none restates them.
- The right-hand Relations rail keeps its 6px top padding.
- There's no import loop, and every page hook the new test uses exists in the app.
- The decision you made about the document's preview row is recorded and holds up.

The one real problem is in how the new browser test measures. It counts from the outside of the frame's 1px border. On that reading the breadcrumb lands about 1.7px off target, which fails its ±1 check, and the other lines pass by hairs. Counting from inside the border, which is how the design side's own numbers add up, all four pass comfortably. The fix is a three-line change in the test, plus saying which edge is used in the receipt.