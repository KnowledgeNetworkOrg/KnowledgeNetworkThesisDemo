REVISE

**Must fix:**

1. **The new "no host restates the number" test breaks the build.** The tests themselves would pass; the build fails one step earlier, at the type-check, so `npm run build` and `npm run verify` both fail. That takes down the guard for the card's clause "the four constants exported and no host restating them."
   - **Why it fails.** The new test file reads files using Node's built-in modules (`src/firstline.test.ts:17–19`: `node:fs`, `node:url`, `node:path`). But it sits under the app's type-check settings (`tsconfig.app.json`), which load only browser-side types (`"types": ["vite/client"]`). I traced everything the test library's type files pull in, and none of it loads Node's types either. So the type-checker stops with:
     ```
     src/firstline.test.ts:17  Cannot find module 'node:fs' or its corresponding type declarations.
     src/firstline.test.ts:18  Cannot find module 'node:url' or its corresponding type declarations.
     src/firstline.test.ts:19  Cannot find module 'node:path' or its corresponding type declarations.
     ```
   - **How I know.** I ran the real type-checker, TypeScript 5.9.3 (the version this repo pins), over this checkout's own settings. It borrowed the packages installed in another run's checkout, which has an identical package lock, by redirecting package lookups in memory. No files were written. The other 250 app files checked clean, so these three errors are the only ones.
   - **The fix** follows the repo's own convention. `browsertestguard.test.ts` explains that the app settings keep Node out on purpose, and six existing tests already live outside them.
     - Add `src/firstline.test.ts` to the `exclude` list in `tsconfig.app.json` and the `include` list in `tsconfig.node.json`.
     - Replace its three raw-text imports (lines 21–23) with plain reads, for example `readFileSync(join(SRC, 'instruments', 'MapView.tsx'), 'utf8')`. The Node-side settings don't understand the `?raw` imports, so this swap is required.
     - I type-checked exactly this variant in memory, and both settings files then report zero errors.

   (again — the previous review's Optional item 1 said "it probably still type-checks… Not verified". It is now verified that it does not, so it moves up to Must fix.)

**Optional:**

1. **A provenance note still overclaims what the new test catches** (`src/ds/PROVENANCE.json:754`, "src/firstline.test.ts fails if a host restates one"). The test catches a second declaration of a constant, or the three named spots going back to their old values. A fresh `paddingTop: 14` somewhere else would pass. (again)

2. **The barrel test's ledger still lists `FIRST_ROW_PAD`** (`src/ds/barrel.test.ts:273–275`). That ledger is for design-system exports no app file uses yet. Its own header says "To adopt one: import it from '@/ds' in app code and remove it from these imports." The map (`MapView.tsx:58`) and the document (`DocumentPanel.tsx:38`) both import it from there. The rewritten comment explains the listing instead of following that rule. Nothing enforces the ledger, so this is bookkeeping only. (again)

3. **Still to do. These are steps, not gaps in the diff:**
   - **Install, then run everything.** This checkout still has no packages, in the app or in `desktop/`. Install both (`npm ci`, then `npm ci --prefix desktop`). Then run the unit tests, the full verify, the new browser test, and the explorer-rail, relations-rail and legend-inset browser tests. None of these has run yet.
   - **File the receipt.** The person's gate answer asks for the document decision to go back to the design side as a receipt. It should cover:
     - **The document decision, with its cost:** the preview row stays, so with the panes docked the document's first line sits about 16px below the other three. The 25 is counted from that row's bottom edge.
     - The left rail's padding landed under the earlier rail work (#340/#341).
     - The pasted reviewer comment is resolved: the closed rail button follows the rail's top value (`RailFrame.tsx:309`).
     - Measurements are taken from inside the frame's 1px border.
     - The palette's actually measured number, held to ±3 rather than the card's ±1, on the strength of the design side's amended text.

**Previous findings dropped:** last round's Must fix is resolved. The breadcrumb check no longer trips on the map file's own comment. I replayed every text check in both new unit-test files against the real files with plain Node, and all pass. That includes the narrowed pattern and the four "each constant is declared exactly once" checks.

**What I checked against the card.** Each requirement is in the diff:
- `Pane` exports `FIRST_LINE` 25, with `FIRST_ROW_PAD` 14 and `FIRST_SCROLL_PAD` 2 derived from it.
- `PaneHeader` publishes `LEGEND_ROW` 11, and the legend row is now drawn at it.
- `DocHeader` reads the pad, still 14.
- The rail keeps 14 on the left and 6 on the right, so the Relations head is unmoved.
- The palette and the breadcrumb are both repointed at the shared constants.
- The document decision is written down in three places: the document file, the provenance record and the browser test.
- The declined items (left edges, the "presets" label style) are untouched.

I also confirmed:
- Every page hook the new browser test uses exists in the app.
- Its port is unique.
- Nothing in the new imports forms a loop.
- The folder-import rule and the palette file's raw-pixel lint ban are satisfied.
- The palette's scrolling body really does hold its content 12px down, so the 2px pad adds up.

One knock-on effect I traced is benign. The breadcrumb row also holds the button that reopens a closed Explorer rail, so that button now sits at 14, the same as the open rail's head. The older Explorer rail test compares those two heights within ±1px, and they should now agree more closely than before.

**Noticed outside this card's scope**

None.

Assumptions: I took my in-memory type-check as equivalent to the build's own type-check. It used the same compiler version, the same settings files and the same package lock, and the rest of the app came out clean, which supports that. I treated the receipt as a later step rather than a gap in this diff, as the previous review did. I accepted the document decision as the person's call from the gate, and the palette's ±3 as the plan's recorded decision.

---

**Recap.** I re-read the whole change against the card. I replayed the new unit tests' checks against the real files, and checked the browser test's page hooks, the import rules and the lint rules. I also settled a question the last two reviews left open: does the new test file compile? It does not. I ran the real type-checker in memory, using another checkout's identical packages, and wrote no files. The new test uses Node's file-reading tools while sitting under the app's settings, which deliberately exclude them. So the build, and with it the full verify, would fail on three lines.

The fix is mechanical, and I confirmed it compiles cleanly. Move that one test file to the Node-side settings, as six similar tests already are, and swap its three raw-text imports for plain file reads.

Everything else the card asks for is in place, and last round's problem is fixed. What remains after this fix:
- installing packages and running the test suites and browser tests for the first time;
- filing the receipt that tells the design side about the document decision and its 16px cost.