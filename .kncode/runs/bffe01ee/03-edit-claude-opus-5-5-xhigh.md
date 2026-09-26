I've made both changes (OB-196 and OB-199). The project's own checks all pass, and so does the full browser suite.

**1. What changed and why**

- **The hover card now shows the stop's document, not just its name.** When you hover a stop anywhere in the walk (the map's dock and pins, the walk viewer's strip, the presenter's strip and stop finder), the card shows:
  - its number and name
  - a one-line "where it sits" path, e.g. "Networking › Protocol Stack"
  - the walk's own note, if there is one
  - the first lines of that stop's document page

  Before, a stop the walk hadn't annotated got a one-line card with just its name, which is what was reported. The card itself is the design system's `StopCard`, copied into our code. Our shared card code now only hands it the text. The text is at body size, not the old 11px, and the card is 264px wide.
- **The presenter's card now shows the stop number.** Its two call sites weren't passing the number, so its card had no "2.1 · …". They do now.
- **The dock's play button becomes a circular replay arrow on the last stop.** Pressing it (or the space bar) jumps to stop 1 at once, and the walk starts playing 0.6 s later. Moving to another stop during that pause cancels the start. One stop before the end, it's still a normal play triangle.
- **Hovering the current stop's name beside the button opens the same card.** It centres on the words themselves, not the empty space after a short name.

I also added unit tests and browser checks for each piece. I noted every place we differ from the design system in its provenance file.

Three things I did that the design system doesn't:
- **The delayed start uses the map's play button as it is when the pause ends.** The design system's version uses the one from the moment of the click. That one still thinks the walk is on the last stop, so it would jump back to stop 1 a second time and add a duplicate entry to the navigation history.
- **Moving to another stop from a different screen during the pause also cancels the start.** For example, a stop picked in the presenter. The design system only cancels on moves made in the dock itself. I didn't find a way to trigger such a move in a browser check, so this part is covered by the code only.
- **Two test-only markers**, one on the card's heading and one on the dock's stop name, so the browser checks can find them.

**What I verified:**
- Type check, lint and all 627 unit tests pass.
- The dock's browser check passes 127 of 127. That covers the replay timing (the walk started 618 ms after the click), cancelling during the pause, the name hover, and an identical card on the dock, the walk viewer and the presenter for "2.1 · IP & Routing".
- The full browser suite passes 32 of 32.
- Dependencies aren't installed in this working copy, so I ran all of this on a throwaway copy in the temp folder. It borrowed another run's installed dependencies (same lock file), and the checks used spare ports because another session was using the usual ones. I deleted the throwaway copy afterwards; the other run's dependencies are untouched, apart from a small test-results cache my first test run may have added there.

**What's left:**
- The card also asks for a receipt in the design project. It has to cite the commit, and I don't commit in this step, so filing it comes after the commit exists.

**2. Assumptions:**
- I followed the card file to its current home in the shared walk folder, since #338 had already moved it out of the walk desk.
- I left out the separate italic styling for optional stops (OB-216), even though the design system's current code includes it, because the card says "these two and nothing else".
- The map relies on the dock's own two-step restart and passes no one-step `onReplay`, because that route would skip the required pause.
- The "where it sits" path is built inside the shared card code: the layering rules don't allow importing the walk desk's identical helper.
- I read "identical on all three screens" as the same card text and address for the same stop on the dock, the walk viewer and the presenter.