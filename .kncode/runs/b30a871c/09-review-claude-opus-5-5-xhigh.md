REVISE

**Must fix:**

1. **One of the new unit tests will fail, and it will fail because of a comment.** That test reads the map file as raw text and checks that the old breadcrumb padding is gone. It does this by failing if the text "FIRST_ROW_PAD - 1" appears anywhere in the file (`src/firstline.test.ts:42`). The map file's new comment explaining the change contains that exact text: "It was `FIRST_ROW_PAD - 1` to absorb the crumb's own box" (`src/instruments/MapView.tsx:953`).

   A raw-text import includes comments, so the check named "the map's breadcrumb bar pads its top with FIRST_ROW_PAD itself, not a pixel off it" goes red. That fails `npm run test`, and with it `npm run verify`. The code itself is right; the guard for the card's clause "the four constants exported and no host restating them" fails anyway.

   There are two one-line fixes:
   - Reword the comment, for example to "one pixel less than the constant".
   - Narrow the pattern so it only matches the old code, `\(FIRST_ROW_PAD\s*-\s*1\)` (the old line had the subtraction in parentheses).

   I recommend narrowing the pattern. This repo's comments often record what a line used to be. The existing browser-test guard skips comment lines for the same reason (`src/studio/browsertestguard.test.ts`, `hooksOf`). A check that trips on prose will trip again.

   I confirmed the clash by searching both files. Nothing was run.

**Optional:**

1. **The new source-reading test still isn't listed in the repo's type-check settings** (`src/firstline.test.ts`; `tsconfig.app.json` excludes the other six file-reading tests, `tsconfig.node.json` lists them). It probably still type-checks, because the test library's own type files pull in the file-reading types. Moving it would mean replacing its three raw-text imports with plain file reads. Not verified. (again)

2. **A provenance note still overclaims what the new test catches** (`src/ds/PROVENANCE.json:754`). It says "src/firstline.test.ts fails if a host restates one." The test only catches a second declaration of a constant, or the three named spots going back to their old values. A fresh `paddingTop: 14` anywhere else would pass. (again)

3. **The barrel ledger still lists `FIRST_ROW_PAD`** (`src/ds/barrel.test.ts:273–275`). That ledger is meant for design-system exports no app file uses yet, and the map and the document now both import it. Nothing enforces the ledger, so this is bookkeeping only. (again)

4. **Still to do (these are steps, not gaps in the diff):**
   - Nothing has run yet. This checkout has no packages installed in either the app or `desktop/` (I checked), so `npm ci` and `npm ci --prefix desktop` come first. Then run the unit tests, the full verify, the new browser test, and the explorer-rail, relations-rail and legend-inset browser tests.
   - The receipt isn't filed. It should say six things:
     - The left rail's padding landed under the earlier rail work (#340/#341).
     - The pasted reviewer comment is resolved: the closed rail button follows the rail's top value (`RailFrame.tsx:309`).
     - The document decision in plain words, including its cost: with all panes docked, the document's first line sits about 16px below the other three.
     - Measurements are taken from inside the frame's 1px border.
     - The palette's actually measured number.
     - The palette is held to ±3, not the card's ±1, on the strength of the design side's amended text.

**Previous findings dropped:** last round's Must fix (the browser test measured from the frame's outer edge) is resolved. The Explorer head and the first crumb (`browsertest-firstline.mjs:188`), the document's eyebrow and the palette now all assert the inside-border reading. I re-derived the breadcrumb myself, using its 11px text, 1.3 line height and the last crumb's 1px padding. It lands about 25.65px inside the border, within 25 ±1.

I also checked the test's page hooks against the app. The document's hook sits inside the pane body, so the "first text" the test finds is the eyebrow, not the pane's title. The empty preview row holds no text, so it is skipped. The Relations rail's measured column is the one with the 6px padding. Every hook the test reaches for exists, so the browser-test guard passes. The port it uses (5266) clashes with no other test.

**Noticed outside this card's scope**

None. Every changed file is on the plan's list, and the declined items (left edges, the "presets" label style) are untouched.

Assumptions: I assumed the raw-text import gives the whole file, comments included, which is what that import does by design. For the Explorer, document and palette readings I relied on the previous review's arithmetic and the declared font metrics; I re-derived only the breadcrumb. I took the palette's ±3 bound as the plan's recorded decision, not a new gap.

---

**Recap.** I re-read the whole change and the code it depends on: the pane frame, the legend row, the scrolling body's inset, the rail's head and closed button, the breadcrumb, the document header and its preview row, the palette's label, the repo's guard tests (folder imports, type-check lists, browser-test hooks) and the lint rules. I changed no files and ran nothing. Nothing is installed here, and git was off-limits.

The fix from last round is in and correct: the browser test now counts from inside the frame's border, and on that reading all four first lines should land within tolerance. The new problem is small but would make the unit suite fail. One of the new "no host restates the number" checks searches the map file for the old expression, and the map file's own new comment quotes that expression. It is a one-line fix, either in the comment or, as I recommend, in the check's pattern. After that, what remains is running everything for the first time and filing the receipt to the design side.