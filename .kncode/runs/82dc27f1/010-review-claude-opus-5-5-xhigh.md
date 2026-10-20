Must fix:
none

Optional:
1. `src/ds/connections/RelationCards.tsx:157-179`: `relTipFitAcross` starts from each group's already-scaled answer and then scales again, which causes two small problems.
   - **The long source gets squeezed twice.** Take the round-1 case: two groups with the same target ("Set Theory & Functions"), where one group is over the cap. The long source's pill is shrunk once for its own group, then shrunk again across the card. The target pill keeps more than it needs, and the long source wraps onto more lines than it has to.
   - **A card can scale when it had room.** The card's width is the widest single group, not the sum of the widest fields. So when the widest left pill and the widest connector come from different groups, the pills shrink a little even though the card is still under 360.
   - **Fix:** have `relTipFit` also return its unscaled widths. Take the largest of each across the groups, then clamp and scale once.
   - **Test:** pin a two-group case where both groups have the same target and one is over the cap.
2. `src/ds/connections/relationcards.test.ts:54-58` (still open from rounds 0 and 1): the owner's-pair test cannot fail. The clamp alone keeps any answer between 200 and 360. Pin something that depends on the names, such as a stubbed `measure`, or a short pair answering narrower than a long one.
3. `tools/studio-spike/browsertest-relationsrail.mjs:372-376` (still open from rounds 0 and 1): the driver still doesn't test OB-272's "Done when" (1) or (3).
   - **(1):** nothing checks the card's text for "…".
   - **(3):** at 1750×950 nothing crosses the seam. The round-1 reviewer measured that the cards cross at about 1366 wide.
   - **Top-left check:** line 376 reads the card after it has been placed, so it cannot see a one-frame flash at the top-left (OB-272 "Done when" (4)).
   - **Fix:** add a narrower-window pass, and an ellipsis check, including on an `implemented_with` card.

Nit:
1. `src/instruments/DocumentPanel.tsx:9`: the file header still says the card "opens it over the PROSE". It may now cross onto the map.
2. `tools/studio-spike/browsertest-relationsrail.mjs:5-6,15,432,453`: these lines still say "over the prose", or that the card is "sized against" the figure or seam. It is now sized to its names.
3. `src/ds/barrel.test.ts:273-274` still says the document's closed Relations button reads `FIRST_ROW_PAD`; `DocHeader` reads it now. `:345-346` still lists `orbitBox` as adopted ("DocumentPanel.tsx imports them"), and it no longer does. `previewGutter` has lost its only app importer and isn't listed.
4. `src/ds/connections/ConnectionsRails.tsx:7-9` ("has to know WITHOUT measuring … a measure-then-move would place it wrong for one frame") and `:83-86` ("THE CALLER MUST ALSO SIZE THE CARD TO THAT GUTTER") are no longer true in `bounds="window"` mode.
5. `src/ds/connections/ConnectionsRails.tsx:232`: the window mode calls `createPortal` itself rather than the shared `portalInto` (`src/ds/chrome/portal.ts`). OB-110 made `portalInto` the one place portals go through ("Same call, one home").

Assumptions:
- **Dropped:**
  - **Round-1 Must fix 1 is fixed.** `relTipFitAcross` caps the row total, so no row is wider than the card; I checked the logic by reading it.
  - **Round-1 Must fix 2 is fixed.** `tipArrowWidth` searches with the same call `FillArrow` draws with (`fitLines` at 9px, pad 0).
  - **Round-1 Nit 1:** the bare `50` literals are gone.
- **Ran:** Vitest on `relationcards`, `connectionsrails`, `pane`, `barrel`, `firstline`, `relations` and `layering`: 7 files and 104 tests, all passing. I did not run `npm run verify` or the browser drivers.
- **Not issues:**
  - The design tokens are defined on `:root`, so the card still gets them after it moves to the page body.
  - The hub card keeps its own 260px cap in window mode.
  - With the rail open, the empty corner keeps the head's right inset at 12 + 8 = 20, the same as before.
  - The search for `orbitCardWidths`/`ORBIT_CARD_PAD_X` over `src` finds nothing.
  - No `.kncode/locked-files` exists.