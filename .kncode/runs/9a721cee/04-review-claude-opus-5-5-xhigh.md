MINOR

**Summary:** all eight fixes are in the code, and each one closely matches the design project's own version. Nothing outside the card was touched, and the Firefox scrollbar item (OB-210) was correctly left alone. I found nothing that blocks the change. What's left falls into three groups:
- work that can only happen after the commit: the receipt, and the checks on the running page;
- a few gaps in the browser drivers;
- one contradiction inside the design's own text for the presenter strip, which should be reported back to them.

I read the binding obligation text directly from the design project and compared the ported files against the design's own source. I ran no tests or drivers, because this step is read-only.

**Must fix:**
none

**Optional:**

1. **The open presenter strip's stop spacing can dip just under 68px at certain widths (OB-246, done-when 4).** This happens when the row has a faded end stop on both sides. The spacing is then the row width minus 18, divided by (2·half + 2), and just past each step of the `half` formula it falls below the 68px floor:
   - a 549px row draws 66.4px;
   - a 413px row draws 65.8px;
   - about 13px of every 136px of width is affected.

   The code is at `src/ds/presenter/PresenterStrip.tsx:600` (the `half` count) and `:376` (the spacing). The design's `PresenterStrip.jsx` has identical arithmetic, and done-when 4's two halves can't both hold at those widths: "spacing never below pitch" and "the stop COUNT shown is unchanged from today at any given width". My advice is to keep the port as is and report the contradiction in the receipt. Two consequences here:
   - The unit test at `presenterstrip.test.ts:66` is named "never draws a pitch under the published floor", but it only samples 574px and 1200px, both outside the bad bands.
   - The browser check at `browsertest-presenter.mjs:388` (spacing ≥ 67.5px) will fail if the presenter row happens to land in one of those bands.

2. **Top-level domain names and the root name don't get the paper outline.** OB-223's done-when says "every cell name — selected or not — draws with the paper case". The two places are `src/instruments/MapView.tsx:1567` (level 0 draws with no outline) and `:1539` (the root name). No ghost heading crosses these names, and they're faint 0.55-opacity watermarks outside the contrast rule, so the design's reason for the outline doesn't apply. It is still a literal gap, so name it in the receipt and let the design agent rule on it.

3. **The ghost-colour check on the running page reads attributes, not pixels.** `drive-maparrows.mjs:544` asserts the fill string, full opacity and paint order. The obligation asks for "equal pixel values at two points of the same word over two differently-filled cells, including a selected one". The attributes imply that for pixels inside the letters. But the selection's blurred glow is drawn above the labels, so it can tint heading letters near the selected cell's border. Either sample two pixels during the check step, or say in the receipt that the attribute check stood in for the pixel measurement.

4. **The chip-size screenshot driver the wrap-count item names won't be run.** OB-217's done-when requires `shot-foldab.mjs` to report zero drift between the chip sizes that were told, predicted and actually drawn. But `npm run test:browser` only picks up `browsertest-*` and `drive-*` files (`run-browsertests.mjs:53`), so the plan's verification never runs it. The new 1px margin is exactly the kind of change that could make a clamped title predict two lines where Chromium draws one. Run `node tools/studio-spike/shot-foldab.mjs` separately.

5. **The film-roll driver misses two of OB-203's reduced-motion and resting-style clauses.** `browsertest-presenter.mjs:359` only checks that the duration collapses to 1ms under reduced motion. It doesn't assert:
   - "no lean" on the chevron. The code sets the lean and releases it when the 1ms animation finishes, so a 3px lean lasting a frame or two is possible.
   - that the row's resting style carries no transform or opacity. Reading `FilmRoll.tsx:405`, it is clean: only `willChange` is set.

6. **The pin driver doesn't check the cell's tooltip (OB-221, done-when c).** It confirms the pin still opens its preview card, but not that the cell under the pin still opens its tooltip (`drive-mappins.mjs:228`). The hover check is also skipped silently when no pin sits fully inside the pane.

7. **The selected name's darker ink ignores a spotlight on the selected cell.** `src/model/color.ts:403` picks the selected name's ink against the glow and body washes. When another pane hovers the same node, the map adds a 0.25 spotlight wash on top (`MapView.tsx:1507`). For that moment the name sits on a darker fill than the one it was checked against. It's brief and outside the obligation's measured case.

8. **Still owed before the card counts as done.** None of this is code, and none of it was possible in an edit-only step:
   - the receipt at `receipts/<sha>.md`, with one entry per obligation;
   - OB-217's Firefox line-count pair, or an explicit "not taken; nothing here drives Firefox" (the obligation says "report … either way");
   - OB-218's report on the cursor flicker;
   - the deviations marked for the drift log, posted as comments on #74:
     - NodeChip keeps its extra 1px width pad;
     - `shaftTailOffset` caps the bow;
     - the notes row only draws the tag wrapper when a note has a tag;
     - the During column keeps `paddingRight: 6`;
     - the film roll falls back to 0 instead of 200;
   - the verification on the running page the card requires. Nothing has been built, typechecked, linted, tested or driven yet.

**Noticed outside this card's scope:**
- `src/ds/graph/hueslots.ts` still defines `nestedFamilyPaint`, `nextTopicSlot` and `topicHue`, and `src/ds/values.ts:7` re-exports them. The design-copy log's 2026-08-28 entry says all three were deleted. This looks older than this change, but the log and the code disagree.

Assumptions:
- I judged the level-0 name outline and the 68px spacing dip as things to report rather than fix, because the port matches the design's own code in both places.
- I treated the receipt, the drift-log comments and the running-page checks as work for the later check and land steps, not gaps in this diff.
- I identified the changed files by modification time since the plan commit, because git was unavailable to me. All 27 are files the plan named.