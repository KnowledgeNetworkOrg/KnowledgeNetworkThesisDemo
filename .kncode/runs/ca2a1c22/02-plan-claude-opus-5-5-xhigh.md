I've read the design system's binding wording for all nine items and the app code each one touches. Eight are in scope. The ninth, the Firefox scrollbar fix, is held until #342 (the document pane's new Relations rail) merges, as the owner's comment says.

The card calls these small, and five of them are. Three are not:

- **Readable names on the selected map cell.** The app has to adopt a new "paper outline" around every cell name and a new solid colour for the faint parent headings behind them. It also has to change the order the map paints its layers in.
- **Short arrows between neighbouring territories.** Two new drawing helpers have to be copied in from the design system.
- **The presenter's stop row.** Its geometry changes: stops will spread across the whole row instead of sitting at a fixed spacing.

One more thing: the project's dependencies aren't installed in this working copy yet, so implementation starts with an install.

## Plan

1. Install the app's and the desktop package's dependencies so the build, tests and browser drivers can run.
2. **Presenter stop row (OB-246):** when the lecturer opens the row, the stops spread edge to edge like the closed bar does. 68px becomes a minimum gap between stops, not the spacing itself. The "back to the active node" pill now appears only when the active stop is off-screen. The row also stops reserving space for stops past the end of the walk when it starts narrow and then widens.
3. **Walk pins over a focused cell (OB-221):** move the walk-pin layer so the map draws it last, after the thick focus border. Nothing inside it changes; the walk's line and arrows stay where they are.
4. **Selected cell's name readable over its parent's heading (OB-223):**
   - every cell name gets a thin paper-coloured outline drawn under its letters;
   - the parent's faint heading becomes one solid colour per hue;
   - the tint that marks the selected cell moves under the text layer, so the heading sits above every fill and tint, and names sit above the heading;
   - the selected name's text colour is checked for contrast against the tinted colour it actually sits on.
   Done together with step 3, because both reorder the same layers.
5. **Short relation arrows (OB-197):** copy in two helpers from the design system. One gives every arrow a minimum shaft of three arrowhead-lengths, stretching both ends equally so the midpoint label doesn't move. The other caps how far a curved arrow bends. The map uses them in that order: clip, then lengthen, then cap the bend. It also computes the arrowhead's angle and the "×n" count label from the capped curve.
6. **Firefox cropping a road stop's second line (OB-217):** the line-count calculation keeps a 1-pixel safety margin, declared once and shared with the width calculation. This fixes Firefox reserving one line too few.
7. **Palette toggle double-press (OB-218):**
   - keep a handle on the 400ms close timer and cancel it on any press;
   - decide each press from where the palette is heading, not from whether it's still on screen;
   - a press that reverses a flight cuts straight to the new state instead of animating;
   - the button is never disabled or debounced.
   Three new checks go into the palette driver.
8. **Film roll travel frame (OB-203):** when the stop changes, the row of slide cards slides in from the side it came from, and the pressed chevron leans outward. The motion is one browser animation that reads the design system's own duration token, so reduced-motion settings turn it back into a cut. The presenter screen passes the stop's number, so keyboard arrows and jumps play the same slide.
9. **During-class note (OB-207):**
   - the timestamp goes from 11px to 12px so it stops blurring;
   - the category tag moves down 1px;
   - the live column's four settled spacing values are applied: no scroller insets, 6px above the text box, and the first note row's own padding.
10. Record each copied-in change in the file that tracks where every design-system copy came from, and update the unit tests that pin these values.
11. Check every item's own "done when" condition on the running page with the browser drivers, including a Firefox run for step 6. Also run the full verify command and the existing layout-drift check.
12. After the tool commits (ideally one commit per item, with steps 3–4 in one), write one receipt file into the design project giving each item's commit. The Firefox scrollbar item is marked "blocked on #342", and the receipt reports whether the palette's cursor flicker survived.

**Files:**
- `src/ds/presenter/PresenterStrip.tsx`
- `src/instruments/MapView.tsx`
- `src/ds/graph/textFit.ts`
- `src/ds/graph/hueslots.ts` (plus `topicvalues.ts` / `DomainDot.tsx` if the new colour has to flow through them)
- `src/model/color.ts`
- `src/ds/graph/NodeArrow.tsx`
- `src/ds/graph/textMeasure.ts`
- `src/ds/graph/NodeChip.tsx`
- `src/ds/index.ts`
- `src/studio/StudioView.tsx`
- `src/ds/presenter/FilmRoll.tsx`
- `src/present/PresenterScreen.tsx`
- `src/ds/presenter/LectureNotes.tsx`
- `src/ds/PROVENANCE.json`
- `src/ds/graph/nodearrow.test.ts`, `src/ds/graph/textmeasure.test.ts`, `src/ds/graph/topicpaint.test.ts`
- `tools/studio-spike/drive-palette.mjs`, `drive-maparrows.mjs`, `drive-mappins.mjs`, `browsertest-presenter.mjs`
- a new Firefox probe page and driver in `tools/studio-spike/` for OB-217

**Out of scope:** OB-210 (the Firefox scrollbar), left out entirely until #342 merges, per the owner's comment. That includes the map column, the document column and the connections columns. The obligations also rule out:
- any token or `tailwind/kn-theme.css` change;
- porting the design system's `ViewMorph` animation, or debouncing or disabling the palette button;
- any cap on arrowhead size on the map;
- moving the walk's line or arrows;
- changing how map labels are fitted.

**Verify:** In the running app, click the palette icon in the toolbar to close the palette, and click it again within a fraction of a second. The palette should end up open and stay open; today it closes itself about 400ms later. Each other item gets its own on-page check from its "done when" condition. For example: opening the presenter row puts its outer stops as close to the pane edges as the closed bar's ticks, and in Firefox the road stop "Transistors & Logic Gates" predicts 2 lines and draws 2.
```
npm ci
npm ci --prefix desktop
npm run verify
npm run test:browser
node tools/studio-spike/drive-palette.mjs
node tools/studio-spike/drive-maparrows.mjs
node tools/studio-spike/drive-mappins.mjs
node tools/studio-spike/shot-foldab.mjs
node tools/studio-spike/probe-roadstopclip.mjs
```

**Assumptions:**
1. **OB-223 — which layers move.** The design asks for the parent heading to sit "above the selection wash", but in the app that tint is part of the layer that also draws the focus border and the relation arrows. I'll move only the tint fills (the selected cell's and its neighbours') under the text, and leave the three focus-border strokes and the arrows where they are. The hover and spotlight tints are unchanged. The heading's existing "fade when the pointer is inside it" behaviour is kept; only its resting transparency goes to solid.
2. **OB-223 — which names get the outline.** "Every cell name" includes the top-level and second-level names when they are the level being viewed. The selected name keeps its current near-black emphasis colour, run through the contrast check against the tinted colour.
3. **OB-197 — arrowhead size for the minimum length.** The design says to take the head size from the shared helper for a set of arrows, but the map's relation arrows draw their own fixed-size head. I'll feed the minimum-length helper that actual drawn head, one value for all of them, so the arrowhead size doesn't change. Adding the bend cap inside the shared arrow component doesn't change the walk's arrows: their bend is already well under the new limit.
4. **OB-203 — fallback duration.** The design's reference code falls back to a literal 200ms if the duration token can't be read, but the obligation's own check forbids a literal 200. The fallback will be an instant cut instead.
5. **OB-217 — Firefox check.** The design's Firefox probe runs against the design project's own build. I'll build an equivalent probe page against the app, like the existing fold comparison page, and keep it so a reviewer can re-run it.