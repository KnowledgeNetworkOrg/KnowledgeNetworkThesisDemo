I've edited the code for all eight items and left OB-210 alone, as the owner's comment says. I did not run the type check, lint, unit tests or browser drivers, because this step is edit-only. The tests and driver checks I wrote have not been run.

**What changed, in plain terms**
- **Wrap count (OB-217):** the line counter now keeps a 1px margin against its own measurement. Without it, Firefox counts one line too few and the road crops the words. Unit tests pin this. I did not take the Firefox numbers, since nothing here drives Firefox.
- **Note timestamp and tag (OB-207):** the timestamp is the larger caption size and wraps if long. The tag sits 1px lower. The During column uses the settled spacing.
- **Film roll (OB-203):** the three cards now slide as one row when the stop changes, and the matching chevron leans while it runs. The presenter passes the stop on the wall, so arrow keys, the strip and the finder all trigger it, including roams.
- **Presenter strip (OB-246):** the 68px spacing is now a minimum. The open row spreads its stops across the full width, and the window is kept inside the walk.
- **Palette (OB-218):** the 400ms unmount timer is now cancelled on open, close and unmount. The toggle and the button's pressed state read what the palette is becoming, not what is still mounted. A press mid-flight cuts to the new state with no animation.
- **Short relation arrows (OB-197):** the map clips each road, lengthens short ones to three head-lengths from the shared head sizing, then caps the bow against the new length. The head angle and count label come from the capped curve.
- **Ghost heading and names (OB-223):** the ghost is one opaque colour per hue at full opacity, painted above the fills and washes and below the names. Cell names wear the paper case.
- **Pins (OB-221):** the walk pins are now the last thing the map draws, so the focus border can't cover them.

**Surprises**
- The selected name's ink fell to 4.30:1 in the worst case against its washed cell, under the 4.5 floor. I added a rule that darkens it only where it must.
- After the palette opened, its animation state was never cleared, so "is a flight running?" couldn't be answered. I added a settle timer.

Every deliberate difference from the design's version is recorded in the provenance log. The new pins group also meant updating the walk-visibility driver.

Assumptions: to make the ghost sit above the washes without covering roads, I moved the tints of hover, spotlight and selection below the labels and left their outlines and roads in place; the ghost still steps aside to 0.03 under the pointer and keeps its white outline, and the map reads it through the JS-resolved twin because a `var()` in an SVG attribute isn't trusted for unknown hues; the paper case applies to nested names and level-1 names but not level-0 domain names or the root; the arrow floor is measured on the clipped chord, so the visible shaft is about the floor minus the head; I kept our existing 1px width pad in the chip sizing and the During scroller's `paddingRight: 6` (the design dropped it under OB-210); a ✕ or preset press during a close is ignored, not re-run; the receipt, drift-log comments on #74 and the OB-210 follow-up were not done.