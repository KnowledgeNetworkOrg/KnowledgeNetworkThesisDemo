I read everything this card touches and the design project's own text for the item (OB-249). I changed nothing. The change is small, but the design text differs from the card in three places, and one repo detail could stop the document pane reaching 25 at all.

**What I found, in plain terms**
- **The rail part is already done.** The earlier rail work (#340/#341) moved the left rail's top padding to 14. The closed button at the corner follows it, so the reviewer's "stuck at 6" comment is stale.
- **The pane source still lacks most of OB-249.** The pane's `FIRST_LINE` (25) and `FIRST_SCROLL_PAD` (2) don't exist yet, and the legend's `LEGEND_ROW` (11) is still a bare literal. The document header and the palette also still hard-code their own padding.
- **The design text amends the card in two places.** The breadcrumb bar's top padding must be exactly the shared constant (14), not 14 minus 1. Our code has 13. The owner also ruled that the palette's "presets" line stays about 1.3px low, from its 12px label style, and must not be nudged.
- **The document pane has an extra row.** It always draws a 16px preview-banner row above its header. The design shell may not have measured that row. My arithmetic puts the document's first line near 41 instead of 25, so the baseline run in step 1 decides this.

**Plan**
1. Write `tools/studio-spike/browsertest-firstline.mjs`, a new browser test. It opens palette, map and document side by side, then reads each frame's top edge and the top of each first line (the "presets" label, the Explorer head, the first crumb, the document eyebrow). It also reads the relations rail's head. Run it on the current code first to record the "before" numbers.
2. `Pane.tsx`: export `FIRST_LINE = 25` (chosen). Derive `FIRST_ROW_PAD = FIRST_LINE − LEGEND_ROW` and `FIRST_SCROLL_PAD = FIRST_ROW_PAD − SCROLLER_INSET`, as the design source does. Rewrite the "only this one is here so far" comment.
3. `PaneHeader.tsx`: export `LEGEND_ROW = 11` and use it as the legend row's height (no visual change).
4. `DocHeader.tsx`: top padding becomes `FIRST_ROW_PAD` (value stays 14).
5. `RailFrame.tsx`: keep the existing `FIRST_ROW_PAD` wiring and the right rail's 6. Only drop the "#358's" comments.
6. `index.ts`: export the new constants through the barrel (`FIRST_LINE`, `FIRST_SCROLL_PAD`, `LEGEND_ROW`).
7. `MapView.tsx`: the breadcrumb bar's top padding goes from `FIRST_ROW_PAD − 1` to `FIRST_ROW_PAD`, and the stale comment is fixed.
8. `StudioView.tsx`: the palette's presets block swaps `pt-2` (8px) for an inline top padding of `FIRST_SCROLL_PAD`.
9. `DocumentPanel.tsx`: the relations rail's closed button restates `14px` as its top margin. Make it read `FIRST_ROW_PAD`, with the same value.
10. Re-run the new test and read the "after" numbers. If the preview-banner row keeps the document's first line off 25, stop and put that to the design side as a `question` rather than moving the banner myself.
11. Add tests: pin 25/14/2/11 in `pane.test.ts`, and add source-text checks that no host restates the numbers. Update `barrel.test.ts` and the four `PROVENANCE.json` entries (including that the design header has since gained an unported `aside` slot).
12. Run the full verification below. Then, once there is a commit, file the receipt for OB-249 in the design project (`receipts/<sha>.md`), and open the PR with the author line first.

Files: `src/ds/chrome/Pane.tsx`, `src/ds/chrome/PaneHeader.tsx`, `src/ds/doc/DocHeader.tsx`, `src/ds/connections/RailFrame.tsx` (comments only), `src/ds/index.ts`, `src/ds/barrel.test.ts`, `src/ds/chrome/pane.test.ts`, `src/ds/PROVENANCE.json`, `src/studio/StudioView.tsx`, `src/instruments/MapView.tsx`, `src/instruments/DocumentPanel.tsx`, and the new `tools/studio-spike/browsertest-firstline.mjs`. The receipt goes to the design project, not this repo.

Out of scope: the panes' left edges (palette 13, rail 9, document 21) and the first label's style (lower-case "presets" against capitalised EXPLORER and TOPIC). The owner declined both on 2026-09-22, so do not align them. Also out of scope: the right rail's top (stays 6, so the relations head must not move) and anything else in the map or document panes.

Verify: With the Explore preset and the palette open, run the new browser test. It should print that the Explorer head, first crumb and document eyebrow each sit 25px (±1) below their pane's top edge. It should also print the palette's "presets" (about 26–27, which the owner accepted) and an unchanged relations-rail head. Open the Explore layout in Edge and the three panes' first lines should look level.
```
npm run build
npm run lint
npm run test
npm run verify
node tools/studio-spike/browsertest-firstline.mjs
npm run test:browser -- explorerrail
npm run test:browser -- relationsrail
npm run test:browser -- legendinset
```
`npm run verify` also typechecks `desktop/`, which needs `npm ci --prefix desktop` run once first.

Assumptions:
- **Palette tolerance:** the card says all four lines are 25 ±1. The design text, as amended on 2026-09-27, accepts "presets" at about 26.3 and says not to nudge it. I'll apply `FIRST_SCROLL_PAD` there, assert the other three at ±1, and report the palette's real number instead of failing it.
- **Breadcrumb padding:** 14 (not 13), per that same amendment.
- **Document pane (the real risk):** if the 16px banner row keeps the eyebrow well below 25, I will not move the banner without the design side's answer, because the banner is a binding earlier contract. That would leave done-when 1 open for the document, stated plainly in the receipt.
- **Document header port:** I port only the padding change, and note the newer `aside` slot as a separate, unported change.
- **Measuring:** I read the top of the first line's text from the frame's outer top edge. The frame has a 1px border, so I'll print both readings and report what I see.