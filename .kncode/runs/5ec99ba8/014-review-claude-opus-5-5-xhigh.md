**Must fix:**
none

Both earlier Must fix findings now hold against the code:

- **Must fix 2** is fixed. At `src/present/PresenterScreen.tsx:206-207` both step branches start with `!ended &&`. Once the lecture has ended, PageDown, PageUp and the four arrows skip past every other branch to `else return`, before `e.preventDefault()` at line 214. So the recap's scrollers get the keys again. The driver's recap check covers this, and it would fail if the `!ended` guard were removed.
- **Must fix 1** is resolved as you directed. Both driver outputs are in the run log, in the fixing step's reply:
  - The red run, with the handler back to arrows only, failed 4 checks: PageDown advances, the deck does not scroll, PageUp returns, ArrowDown advances.
  - The green run, with the fix restored, passed all 13.
  - The file's hash was the same before the revert and after the restore.
  - `npm run verify` was left to the check step, as you asked.

The card's three items are met:
1. PageDown steps forward and PageUp steps back.
2. ArrowDown and ArrowUp step too. Space and Enter stay unbound, and the comment says why. Backspace still ends a roam. A key is claimed only when one of the handler's branches acts on it. Text fields and Ctrl/Meta/Alt keys are still ignored.
3. The driver presses PageDown and PageUp and was shown failing on the stop checks before the fix.

The two takes you asked for are in: one press each of ArrowDown and ArrowUp (driver lines 112-123), and `returned === after - 1` (line 109). Only the card's two files changed. `session.ts` is untouched, and nothing touches #205.

**Optional:**
1. `tools/studio-spike/browsertest-presenterclicker.mjs:110`: the check "and the deck stays at the bottom where PageUp found it" passed on the red run. It is not among the 4 failures, so it has not been shown to catch a PageUp that scrolls the deck. The reason is its `<= 1` tolerance. On this machine, a PageDown the presenter does not claim moved the pane only 1px within the wait: the red deck read `scrollTop 1`, and the green recap read `scrollTop 1`. A PageUp from the bottom therefore lands inside the tolerance. Both readings are taken from the same `scrollTop` with nothing in between, so if nothing scrolled they are identical. `top === bottom.top` would be a check that can fail.

**Nit:**
1. `tools/studio-spike/browsertest-presenterclicker.mjs:123`: `afterUp === beforeArrow` also passes when neither ArrowDown nor ArrowUp did anything, and it passed on the red run. This is the same pattern as the PageUp check you had fixed. `afterUp === afterDown - 1` says what it means, as line 109 now does.
2. `src/present/PresenterScreen.tsx:179-180`: "the arrows and a clicker's Page Down/Page Up advance" reads as if all of them step forward, but ←, ↑ and PageUp step back. Also, "claimed while live" is narrower than the code: the keys are claimed whenever the lecture has not ended, which includes the preview.

Assumptions:
- I did not run the driver or the build. This step may not create files, and starting vite can write to its cache, so I relied on the red and green outputs in the run log.
- I took the keys being claimed in preview, including when focus is on the shell's palette beside the deck, as intended. ← and → already behaved that way before this change, and the card asks the presenter to take these keys.
- I found no on-screen key legend and no design-handoff text naming the presenter's keys that this change would leave out of date.