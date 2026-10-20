1. Port the two-box `PanePlaceholder`: outer `data-pane-placeholder` takes `minHeight` + caller `style`, centres the dashed inner `data-pane-placeholder-box` sized to its two lines with `maxWidth: 100%`, `PANE_PLACEHOLDER_METRICS.stroke = 1.5`, `pad = '18px 22px'`, and update its docblock with caller rule 5.
2. Update `barrel.test.ts` for the new `PANE_PLACEHOLDER_METRICS` contract; leave `DocumentPanel`'s placeholder call (`flex: 1`, margin) untouched.
3. Rework `DocHeader` to own the header row: left text, optional `aside` at the outer end on the first line (14px top, 12px right), border under the whole row; without `aside` it draws as before.
4. In `DocumentPanel`, delete the header wrapper row, pass `RelationsRailCorner` as `aside` with no `style`, and replace the prose block's `border-slate-100` with `borderBottom: '1px solid var(--border-hair)'`.
5. Update `pane.test.ts` for `DocHeader`'s new padding/row structure while keeping the `FIRST_ROW_PAD` derivation check.
6. Add `REL_TIP_METRICS`, `relTipFit`, `REL_CARD_PARTS.tipFit`, and the opt-in `tip` prop on `RelSourceGroup`; `tip` off must leave current geometry byte-identical, `tip` on allows full-name sizing/wrapping.
7. Refactor `OrbitCard` to compute `relTipFit` per direct/via group against `window.innerWidth - PREVIEW_LAYER_METRICS.inset * 2`, take each field's maximum across groups, set the card to that width with `boxSizing: 'border-box'` and `padding: '4px ' + REL_TIP_METRICS.padX + 'px 6px'`, and pass `tip` + shared widths to every group.
8. Remove `orbitCardWidths`, `ORBIT_CARD_PAD_X`, their imports/uses, the old `cardW`/`previewGutter`/`orbitBox` host wiring, and their test block; keep `previewGutter` itself in the DS.
9. Add `bounds?: 'layer' | 'window'` to `NodePreviewLayer`: window mode portals the card to `document.body`, measures its real box in a layout effect, places it with `previewPlacement` against the viewport, and keeps it hidden until placed; add `boxH` to `previewPlacement` and test it.
10. Add `relTipFit` tests for the owner's case (200–360) and the exact-360 long pair; export `REL_TIP_METRICS`/`relTipFit` from `src/ds/index.ts`.
11. Rewrite `browsertest-relationsrail.mjs` checks that assert the card stays inside the document pane and that the placeholder's direct children are its two lines, so they assert window bounds/figure clearance and the inner placeholder box instead.
12. Update `src/ds/PROVENANCE.json` for the four ported files, then run verify and the browser drivers.

Files: `src/ds/chrome/PanePlaceholder.tsx`, `src/ds/doc/DocHeader.tsx`, `src/ds/connections/RelationCards.tsx`, `src/ds/connections/ConnectionsRails.tsx`, `src/ds/index.ts`, `src/instruments/DocumentPanel.tsx`, `src/instruments/relations.ts`, `src/instruments/relations.test.ts`, `src/ds/connections/relationcards.test.ts`, `src/ds/connections/connectionsrails.test.ts`, `src/ds/chrome/pane.test.ts`, `src/ds/barrel.test.ts`, `tools/studio-spike/browsertest-relationsrail.mjs`, `src/ds/PROVENANCE.json`.

Out of scope: OB-268 makes no DocumentPanel host change — it keeps passing `flex: 1` and the margin; `RelationStats` and `ConnectionsSplitPane` are not edited and pick the placeholder port up themselves; `RelSourceGroup` with `tip` off must draw exactly as before, so the rail's card list does not move.

Verify: In Explore with nothing chosen, the document pane shows one centred dashed box hugging its two text lines (1.5px computed top border) and no dashed pane frame; select a node and close Relations and the head rule runs full width beneath the Relations button; hover the screenshot's long mark and the card shows its names whole, crosses the seam onto the map without covering the figure, and never flashes at the window's top-left.
```
npm run verify
node tools/studio-spike/browsertest-relationsrail.mjs
node tools/studio-spike/browsertest-firstline.mjs
```

Assumptions: the DS `design-sync.md`/`.d.ts` sources are not in this checkout, so the internal choices in `REL_TIP_METRICS` and `relTipFit`'s text measurement are selected to satisfy the card (max 360, min 200, name/path/kind-label measurement); no `.d.ts` files are committed here, so contract prose goes in docblocks/PROVENANCE; `RelationsRailCorner` keeps its optional `style` prop but the host stops passing it; the browser driver is updated for the placeholder structure and the window-bound card even though the lane note names #417 next.