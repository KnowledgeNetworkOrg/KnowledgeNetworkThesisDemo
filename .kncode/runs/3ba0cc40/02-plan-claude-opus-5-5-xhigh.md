I have enough to plan. Summary of the diagnosis first, then the plan.

**What's most likely happening:** the first reading is right — the test measures the map before the page has finished settling, and opening the dock doesn't move anything. I still have to prove that by experiment; the plan's first step does it.

**Why I think so.** The app's three fonts download from Google's font servers and are set to "swap": text first appears in a stand-in system font and is redrawn when the real font arrives. The stand-in's line heights differ slightly, so a header above the map can change height by a pixel when the swap happens. The numbers fit this exactly: the map's top edge moved up 1 px and its height grew 1 px, while its bottom edge stayed at 685. The test takes its "before" reading at a fixed 800 ms after reload, and nothing makes it wait for the fonts. Two more things point the same way:

- **The map stayed moved after the dock closed.** In the failing run, the second check ("still without moving the map", after closing) also failed. If opening the dock pushed the map, closing it should have put it back. A one-time shift partway through the check is what fits.
- **The rest of the project already guards against this.** Three other browser tests wait for the fonts before measuring, and one says a font landing mid-test "redraws whatever text it touches". The app itself re-measures in several places once the fonts arrive. This test never got that wait.

**Plan**

1. Write a small measuring script (a "probe", like the one kept for #374) that reloads the page and records the map's box and the font-loading state on every frame. It runs three ways: fonts deliberately held back ~1.5 s, fonts blocked entirely, and normal.
2. Use the probe to tell the two readings apart. With fonts held back, the box should shift when they land even with the dock untouched. With fonts blocked, opening and closing the dock should never move the map. If it does move, the dock is at fault, and I switch to finding and fixing that layout effect in the app instead.
3. Assuming the first reading holds: right after the reload, make the test wait for the fonts to finish loading, then until the map's box stops changing for several frames in a row. That second wait also covers any other late layout, not just fonts.
4. Fix the failure message so it prints the same "after" value the check compared, not a second, separate reading.
5. Update the note in the test runner that names #365 as a known intermittent, so it no longer describes a live problem. The runner keeps its "retry a failed test once" safety net.
6. Run the fixed test with fonts held back (the old version should fail this every time, the new one should pass), then plain, many times over.

Files: `tools/studio-spike/browsertest-walkdock.mjs`, `tools/studio-spike/run-browsertests.mjs` (comment only), new `tools/studio-spike/probe-walkdockbox.mjs` (evidence tool, not a test)

Out of scope: nothing stated. I also don't plan to change the app's fonts or layout, for example by hosting the fonts locally, unless step 2 shows the dock really moves the map.

Verify: with the fonts held back by the probe, the old test fails its "map did not move" check every time and the fixed one passes every time. The probe's timeline shows the map's top edge moving from 103.19 to 102.19 at the moment the fonts land, with the dock never touched. Then the fixed test passes 10 plain runs in a row, and the whole browser suite passes.
```
npm run verify
node tools/studio-spike/probe-walkdockbox.mjs
node tools/studio-spike/browsertest-walkdock.mjs
npm run test:browser -- walkdock
npm run test:browser
```

Assumptions: that the late font swap causes the settling. That's inferred from the evidence above; step 2 confirms or rules it out before any fix goes in. I'm also assuming the fix belongs in the test, not the app, unless step 2 proves otherwise, and that the runner's retry-once rule stays as it is.