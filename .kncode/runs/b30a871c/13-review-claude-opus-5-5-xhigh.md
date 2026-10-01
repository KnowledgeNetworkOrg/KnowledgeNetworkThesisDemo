MINOR

**Must fix:**

none

**Optional:**

1. **A note in the provenance record still claims more than the new test catches.** The provenance record is the file that logs how each ported component differs from its design source. Its new entry says "src/firstline.test.ts fails if a host restates one" (`src/ds/PROVENANCE.json:754`). The test does catch two things: a second declaration of one of the four constants, and any of the three named host spots going back to its old value. A new hand-typed `paddingTop: 14` anywhere else would still pass. The sentence should name what the test actually guards. (again)

2. **The barrel test's ledger still lists `FIRST_ROW_PAD`.** The barrel is the design system's single export file, and the ledger is the list in its test of things it exports that no app file uses yet. The ledger's own header says that to adopt one, you import it in app code and remove it from the list. The map (`src/instruments/MapView.tsx:58`) and the document (`src/instruments/DocumentPanel.tsx:38`) both import it from there, so it belongs off the list (`src/ds/barrel.test.ts:3`, comment at `:273–275`). Listing the two numbers no app file uses, `FIRST_LINE` and `LEGEND_ROW`, is correct. Nothing enforces the ledger, so this is bookkeeping only. (again)

3. **Still to do. These are steps, not gaps in the diff:**
   - **Install packages, then run everything.** This checkout still has no packages, for the app or for `desktop/`, so none of these has run yet: the unit tests, the full verify, the new browser test, or the explorer-rail, relations-rail and legend-inset browser tests.
   - **Watch the new browser test for one specific risk.** It fails outright if the Relations rail is not open in the docked document pane at its 1750px-wide window, because it needs that rail's head on screen. Whether the rail is open by default, and whether it fits at that width, only a run will show.
   - **Treat the crumb's reading as a claim until the browser test confirms it.** The breadcrumb's "25 ±1" holds only if you count from inside the frame's 1px border.
   - **File the receipt.** It should cover:
     - the document decision and its cost: the document's first line sits about 16px below the other three when the panes are docked;
     - that the left rail's padding landed in the earlier rail work;
     - that the pasted reviewer comment about the closed rail button is resolved, because the button now follows the rail's top value (`src/ds/connections/RailFrame.tsx:309`);
     - that measurements are taken from inside the border;
     - the palette's actual measured number, held to ±3 rather than ±1.

**Previous finding resolved:** last round's Must fix, the new test breaking the type-check, is fixed. The test now sits with the Node-side tests, whose settings do load Node's types (`tsconfig.node.json` has `"types": ["node"]`), and it is excluded from the browser-side settings. Its three source files are read as plain files instead of through the raw-text imports the Node settings can't understand. The file now matches the existing `src/unreachedmodule.test.ts` almost line for line.

**Noticed outside this card's scope**

None.

Assumptions:
- I treated the browser measurements and the receipt as later steps, not gaps in this diff, as the previous review did.
- I accepted the document decision as the call the person delegated at the gate, and the palette's ±3 as the plan's recorded decision.
- I took my plain-Node replays of the new tests' text checks as equivalent to the real test runner. They read the same files with the same patterns.

---

**Recap.**

**What I did.** I re-read the whole change against the card, focusing on last round's build-breaking problem. I changed no files.

**What I checked:**
- **The fix itself:** the new "no host restates the numbers" test now sits with the Node-side tests, as the reviewer asked. The settings it moved into load Node's types, so the three type errors should be gone.
- **Every text check in the new tests:** I replayed them against the real files with plain Node, and all pass. The four constants are each declared exactly once, in the file that owns them. My first replay of that last check came back empty; that was the shell eating my backslashes, not a fault in the test, and the test file's own pattern is written correctly.
- **The new browser test against the existing guard test** (the unit test that inspects every browser-test script):
  - its filename puts it in the collected run;
  - it doesn't hard-code a checkout path;
  - every page hook it selects on exists in the app;
  - it measures the Relations rail's top padding off the right element.
- **The document decision:** the preview row is genuinely always drawn and 16px tall, by the design system's own rule, so the note's reasoning and stated cost are accurate.
- **The rest:** the lint rules, the folder-import rule and the provenance file's validity are all fine.

**What's different from last round.** Nothing is blocking anymore. The two leftover items are small bookkeeping corrections.

**What remains:**
- installing packages and actually running the builds and tests, including the new browser test, which nobody has run yet;
- filing the receipt to the design side, which tells them the document pane's first line was deliberately left about 16px lower.