I made the change, but I couldn't run any test here. This working copy has no installed packages, so the one narrow run I attempted stopped at startup with "Cannot find package 'vitest'". Nothing was verified by running. I checked the new test numbers by tracing them by hand against the new code, which is not the same as a run.

**What I changed**

The map's pins now count stops from 0, the same as the design system's walk code and the player's position. Before, the pins counted from 1 and every place the two met subtracted or added 1 by hand. Those places are now gone.

- **The pin model** (`src/model/walkpins.ts`) numbers each stop from 0 when it first creates it. `pinPosition` no longer adds 1 to the player's position. I rewrote the comments that said "1-based".
- **The playback camera** (`src/instruments/map/arrivallook.ts`) now matches the arriving stop against the pin directly, with no `- 1`.
- **The map pins component** (`src/instruments/map/WalkPins.tsx`) builds the design-system mark straight from the pin's numbers. The only `+ 1` left is on the two on-screen attributes, `data-step` and `data-step-end`, which stay counted from 1. That is why the browser test scripts, which read those attributes, need no edits, and why the three past receipts that describe pins by what's on screen stay true.
- **The wall view** (`src/model/walkwall.ts`) had its own hand conversion in two places, which the card didn't mention. It now compares the wall's 0-based stops against the pins directly.
- **The unit tests** (`walkpins.test.ts`, `walkwall.test.ts`, `walkdraw.test.ts`) now have their tables written from 0. The scenarios are the same, only shifted by one. In `walkpins.test.ts`, the failure message for overlapping pins now says "stop index" instead of "stop", because the number is no longer what a person would call the stop.

**What I found**

- The card names `pinMarks` in `MapView.tsx`, but that code has since moved into `WalkPins.tsx` under the name `marks`.
- The pin's `key`, an internal label React uses, is built from the first stop number, so it is now 0-based too. Nothing outside that component reads it, and it never reaches the page.
- I searched every file outside the design-system copy that reads a pin's `step` or `stepEnd`, and I covered the browser scripts too. The three scripts that mention `.step` read the on-screen attributes, not the model. The draw rules in `walkdraw.ts` never read `step`, so their fixture edits are only cosmetic.

**What is left**

The full checks still need to run where packages are installed: build, unit tests, lint, and the browser scripts that play a walk. The ones to watch are the walk dock, group pins, optional group, walk visibility and pin crowd scripts. Pins should still print the same numbers as before.

Assumptions: I kept `data-step` and `data-step-end` counted from 1, taking the card's own suggested option, and I left the past receipts and the design-system copy untouched. I left the hand-built pins in the "SEPARATE" tests numbered from 1, because their `step` is only a label there and no assertion depends on it.