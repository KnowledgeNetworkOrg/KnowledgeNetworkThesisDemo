I've changed the test so it waits for the page to finish settling before it measures the map. I also added a measuring script that can show whether that was really the cause. Nothing has been run yet, so the diagnosis is still unproven. I only edited files and parsed them for syntax errors. The dependencies aren't installed in this checkout, so the browser tests couldn't run here anyway.

**1. What changed and why**

- **The walk-dock test waits before measuring.** It used to record the map's box a fixed 0.8 seconds after reloading. The app's three fonts download from Google and start out drawn in a stand-in font, and text above the map can redraw a pixel shorter when the real font arrives. Now, after that same 0.8 seconds, the test waits until every font has finished loading and the map's box hasn't changed for 10 frames in a row. That second condition also covers any other late layout change, not just fonts. The wait gives up after 10 seconds, so a page that never settles fails a new, clearly named check instead of hanging the test.
- **The failure messages print the value that was compared.** Before, the "map did not move" message took a second, separate reading of the box, so it could show numbers the check never saw. Now one reading is used for both. The "still without moving the map" check, which runs after the dock closes, printed nothing when it failed; it now prints its before and after boxes too.
- **The test runner's comment is updated.** The runner reruns a failed test once before calling it a real failure. Its comment named this issue as a known intermittent failure; it now says the cause has been addressed, so a test that only passes on the retry is worth looking into. The retry itself is unchanged.
- **New measuring script.** This is an evidence tool, not part of the test suite; the runner skips it. It loads the page three ways:
  - **Held:** the fonts are fetched but held back until the exact moment the old test measured.
  - **Blocked:** the fonts never arrive, so nothing can redraw and any movement must come from the dock.
  - **Plain:** nothing is changed.

  Under each, it runs the old measuring sequence and the new one on separate fresh page loads. It then opens and closes the dock five times on a settled page, which tests the "the dock really moves the map" explanation directly. It logs every change to the map's box next to every font event, with the distance to the nearest font arrival and the nearest dock change.

**What you'd observe:** the walk-dock test has one extra check at the start. If a failure recurs, its message now shows the numbers that were actually compared.

**What's left:** the verification step needs to run the measuring script. With fonts held back, the old sequence should fail and the new one should pass. The open-and-close cycles should never move the map. If any of them do, the dock really is nudging the map: the fix belongs in the app, and this change is not the answer. After that, the fixed test should pass ten plain runs in a row, and the full browser suite should pass.

Assumptions: I placed the wait right after the reload, so the checks before the dock-open one measure a settled page too. I used 10 still frames and a 10-second limit. I gave the measuring script its own port (5253, overridable like the existing measuring scripts). When fonts are held back, the script waits for the map to appear instead of for the page's full-load signal, because a font still downloading might hold up that signal. I didn't touch the app's fonts or layout.