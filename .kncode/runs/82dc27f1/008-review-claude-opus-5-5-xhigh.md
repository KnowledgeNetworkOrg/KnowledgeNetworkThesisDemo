Must fix:
1. `src/instruments/DocumentPanel.tsx:96-106`, with `src/ds/connections/RelationCards.tsx:116-121`: in one real card, a row is wider than the card and the target pill runs past its right edge. Measured in Edge at 1750×950:
   - **Where:** select Languages & Compilers and hover the "Set Theory & Functions" mark or its dot. The card holds two "via children" groups.
   - **Why:** "Regular Expressions & Automata" is over the 360 cap, so `relTipFit` scales its pills down. "Type Systems" fits, so it keeps the full 151px target pill. The card takes the scaled left width and the unscaled 151 right width at 360 wide.
   - **Result:** the "Set Theory & Functions" pill crosses the card's border, and its text alone ends 8px outside.
   - **Regression:** the old card's rows were pinned never to overhang; that test block was deleted.
   - **Second source:** the same overhang (6px) happens when a flat group sets the left width and a stacked group draws it, because the frame (`chrome`) differs by 6px between the two shapes.
   - **Fix:** taking the larger value per field is what the card asks for. After taking them, check `chrome + left + right + arrow` against the card's width (the cap and the room) and rescale the pills when over. Pin it with a two-group unit test.
2. `src/ds/connections/RelationCards.tsx:108`: the connector is fixed at `REL_TIP_METRICS.arrow` (38), and at 38 the label "implemented with" gets "…". Measured with `fitLines('implemented with', w, { fontPx: 9 })` in Edge:

   | Width | Drawn |
   | --- | --- |
   | 41 | "implemen / ted with" |
   | 39–40 | "impleme / nted with" |
   | 38 | "impleme / nted wi…" |

   The old card's connector was 41, or 39 at its narrowest gutter, so this label drew whole. Now every `implemented_with` hover card shows "…": my sweep found about 25, for example Trees & Heaps → File Systems and Compilers & Interpreters → Hash Tables. This breaks something that worked, in the card whose fault was "…". Fix: have `relTipFit` measure the kind labels, giving the connector the width at which `fitLines` draws each label whole in two lines, or set `arrow` to at least 41. Record the choice in `PROVENANCE.json`.

Optional:
1. `src/ds/connections/relationcards.test.ts:52-56`: the owner's-pair test still can't fail; the clamp alone keeps the answer between 200 and 360. Under node's 0.55em fallback this pair is 368 wide before the cap, so it answers 360 with its pills scaled. In Edge it answers 339. Pin something that depends on the names, such as a stubbed measurement, or a short pair answering less than a long one.
2. `tools/studio-spike/browsertest-relationsrail.mjs:372-377`: nothing checks for "…" in the card, and nothing checks that the card crosses the seam.
   - At the driver's 1750×950 the document pane is 671px wide and every card stays inside it: on Discrete Mathematics the card's left edge is at x 1122 and the pane's at x 1066. So "Done when" (3) is never exercised.
   - At 1366×800 every card does cross: card at x 738, pane at x 833.
   - Add a narrower-window pass and an ellipsis check; the ellipsis check would have caught Must fix 2.

Nit:
1. `src/instruments/DocumentPanel.tsx:98`: `leftWidth = 50, rightWidth = 50` repeats `REL_CARD_METRICS.pillMin` as a bare number.
2. `src/instruments/DocumentPanel.tsx:9`: the header still says the card "opens it over the PROSE". It now may cross onto the map.
3. `tools/studio-spike/browsertest-relationsrail.mjs:5,15,432,453`: these lines still say "over the prose" or "sized against" the figure or seam.
4. `src/ds/barrel.test.ts:274` still says the document's closed Relations button reads `FIRST_ROW_PAD`; `DocHeader` reads it now. `:346` still lists `orbitBox` as adopted ("DocumentPanel.tsx imports them"), and it no longer does. `previewGutter` has lost its only app importer and is not listed.
5. `src/ds/connections/ConnectionsRails.tsx:8` ("has to know WITHOUT measuring") and `:83` ("THE CALLER MUST ALSO SIZE THE CARD TO THAT GUTTER") are no longer true in `bounds="window"` mode.

Assumptions:
- **Dropped from the previous round:**
  - The Must fix on `PROVENANCE.json` is fixed: the grep over `src` finds nothing.
  - The Optional about verification not being run: I ran the full Vitest suite (62 files, 896 tests), full ESLint, `tsc -p tsconfig.app.json`, `browsertest-relationsrail.mjs` and `browsertest-firstline.mjs`. All are green. I did not run `vite build` or the desktop typecheck, because they write files.
- **What I checked in the browser:** I used inline probes that write no files, apart from vite's and Vitest's caches under `node_modules`. The probes checked:
  - OB-268: one dashed box, centred in a transparent room.
  - OB-270: the head's rule spans the pane with the rail open and closed, the button sits 14 from the top and 12 from the right, and the prose rule has the same colour as the head's.
  - OB-272: the owner's card shows its names whole, and `relTipFit` gives 339 and 360. The cards cross the seam at 1366px, and no card was drawn at the top-left in about 580 frames watched.
- **Judged non-issues:**
  - At device scale 1 the dashed edge reads 1px. I took that as the browser rounding 1.5 down, which the card allows.
  - The placeholder box hugs the second line's 34ch box, not its wrapped lines. That is CSS shrink-to-fit and follows the design system's structure, so I did not raise it.
- **Severity:** both Must fix items were Optional last round. I made them Must fix because I reproduced them as regressions against `main`.