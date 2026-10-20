Must fix:
1. `tools/studio-spike/browsertest-presenterclicker.mjs` (whole file): this breaks card item 3, "A browser driver presses `PageDown` / `PageUp` … and was shown to fail before the fix." The driver has never run. There was no red run against the old handler and no green run against the new one. `npm run build`, `npm run lint` and `npm run test` from the plan's Verify list didn't run either, because `node_modules` is missing from the workspace (I checked). The header at lines 5–6 also says "On the unfixed screen the stop stays put and the deck scrolls under it," but nobody has seen that happen. What's needed:
   - install the dependencies (`npm ci`, plus `npm ci --prefix desktop` for `verify`);
   - run the driver with lines 205–206 of `PresenterScreen.tsx` reverted, and keep the FAIL lines;
   - run it again with the fix, and keep the PASS output;
   - run `npm run verify`.

   Whether the driver even works is unproven. Its `focused.max > 0` check needs the deck to overflow at a 950×560 window. The layout suggests it will (a fixed 286px roll, the strip and the header leave roughly 130px for the panes row), but that has to be shown by running it.
2. `src/present/PresenterScreen.tsx:205-206` and `:213`: once the lecture has ended, `PageDown`, `PageUp`, `ArrowDown` and `ArrowUp` still match. `step()` then does nothing because of its `if (ended) return`, but the handler still reaches `e.preventDefault()`. So on the recap screen these keys are taken and nothing happens. That screen has its own scrollers (`LectureRecap.tsx:231` and the review list in `LectureNotes`), and the header and palette come back beside it. Before this change, `PageDown`, `ArrowDown` and the rest scrolled whichever of those panes had focus. Now nothing scrolls. This goes against the card's "`preventDefault` when acting" and breaks something that worked. The fix is to skip the step keys when `ended`, so they reach the `else return` and are left to the browser.

Optional:
1. `tools/studio-spike/browsertest-presenterclicker.mjs`: add a check that ends the lecture and confirms `PageDown` scrolls a recap scroller. This guards Must fix 2.
2. `tools/studio-spike/browsertest-presenterclicker.mjs:91-109`: `ArrowDown` and `ArrowUp` are newly bound but no check presses them. One press of each would cover the decision this change made.

Nit:
1. `tools/studio-spike/browsertest-presenterclicker.mjs:107`: `returned === before` also passes when neither key did anything. It only works as a check because the `PageDown` check fails first. `returned === after - 1` says what it means and fails on its own.
2. `src/present/PresenterScreen.tsx:179-182`: in this file "the deck" means the quick-actions deck (see line 194, "THE DECK BINDS THE KEYS IT DRAWS"). So "the pane under the deck does not scroll" reads as a pane beneath that deck, when it means any focused pane. Also, every key the handler acts on is claimed, not just "those two". And "arrows" was already the word when only ←/→ worked, so the comment doesn't record that ↓/↑ now step too. Card item 2 asks for that decision.

Assumptions: I couldn't run anything: there are no dependencies, and this step may not create files, `node_modules` included. My judgement that the deck overflows at 560px comes from reading the layout, not from a run. I took binding `ArrowDown`/`ArrowUp` as a decision card item 2 allows. There is no `.kncode/locked-files` in this repository. Only the two files the card's lane covers were touched.