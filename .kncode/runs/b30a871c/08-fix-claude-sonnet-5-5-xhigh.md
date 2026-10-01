1. Must fix #1: fixed. The browser test now checks the three first-line readings from inside the frame's 1px border instead of from its outer edge. That's the document's eyebrow (after taking out the preview row), the map's first crumb and the Explorer head, plus the palette's looser bound. Inside the border, the design side's own numbers add up (11 + 14 = 25), and the breadcrumb's extra pixel stays within 25 ±1.

The breadcrumb padding stays at 14, which is what the design side's amended text asks for. I did not revert it to 13.

Both readings still print on each line, labelled, so the receipt can state either edge. The test's header comment and the breadcrumb comment in `MapView.tsx` now say which edge is asserted and why.

Checks:
- I ran a syntax check on the edited test file, and it passed.
- I did not run the browser test or the unit tests. The checkout has no packages installed, so those can't run here.

Assumptions: I assumed the preview row sits inside the border, so the document's reading is "inside-border minus the row's measured height". I left the palette's ±3 bound at 3. Its "presets" line should read about 25.3 from inside, well within that bound, and the old 8px padding would still read about 30–31 and fail. I left every Optional finding alone, as allowed.