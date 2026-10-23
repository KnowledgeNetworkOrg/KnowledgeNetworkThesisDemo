Failures:
- #481: the walk editor, remounted by Plan, leaves the loaded walk's pins alone — `dm -> dm-propositional-logic` (`tools/studio-spike/browsertest-walkvisibility.mjs:168`)
- browsertest-walkdock.mjs — CRASHED: `locator.textContent` timeout waiting for the dock readout (`tools/studio-spike/browsertest-walkdock.mjs:753`); the shared `lastPublished` also stops the WalkViewer republishing the draft after "stop this walk" (route stays 1 stop, dock unmounts)

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify`
- `node tools/studio-spike/browsertest-walkvisibility.mjs`
- `node tools/studio-spike/browsertest-walkvisibility.mjs` (repeat)
- `node tools/studio-spike/browsertest-presenter.mjs`
- `npm run test:browser`

Left out: `probe-*` and `shot-*` scripts, which `run-browsertests.mjs` excludes by design as instruments rather than tests; nothing needed a credential or opt-in.

Verify: ran — failed: `browsertest-walkvisibility.mjs` fails the #481 pin-set check; `browsertest-presenter.mjs` passed 91/91. `npm run verify` itself passed (build, desktop typecheck, lint, 948 tests). One extra note: in the solo walkdock run, "the map keeps at least 30 frames a second" also failed at 18 fps, likely machine load.

<!-- kncode-findings
{"reports":[{"id":"C0-1","raisedAgain":false,"bucket":"MustFix","what":"The new #481 check fails: \u0060dm -\u003E dm-propositional-logic\u0060. It reads \u0060data-routestop\u0060 before the presenter at L1 (the earlier zoom-in left the map there) and after Plan on a freshly mounted map, where the leaving-presenter \u0060peekAt(focus)\u0060 moves the camera to the focused stop\u0027s level, so the same single saved-walk stop now resolves to a different visId. The route is still the saved walk\u0027s one stop (one pin, not the draft\u0027s road), so the check is comparing across a camera-level change rather than the route. Compare at a fixed level or use a level-independent reading.","file":"tools/studio-spike/browsertest-walkvisibility.mjs","line":168,"breaks":"Card done-when: \u0022browsertest-walkvisibility.mjs gains a check that fails on main and passes after \u2026 Activate a saved walk and read the set of [data-routestop] values \u2026 The set is unchanged.\u0022","failure":"#481: the walk editor, remounted by Plan, leaves the loaded walk\u0027s pins alone"},{"id":"C0-2","raisedAgain":false,"bucket":"MustFix","what":"browsertest-walkdock crashes at section F, waiting 30s for the dock\u0027s \u0060N / N\u0060 readout after the saved-walk pin hover. A separate, confirmed regression from the shared module-level \u0060lastPublished\u0060: with a saved walk active the route is the walk\u0027s prefix, and after \u0060deactivateWalk()\u0060 the WalkViewer\u0027s effect now sees \u0060lastPublished\u0060 equal to the draft it published before activation, returns null, and never republishes the draft. The route stays the saved prefix (measured route count 1 instead of the draft\u0027s 7), \u0060routeIsWalk\u0060 goes false, and the dock unmounts. Section F expects \u0022stopping the saved walk hands the dock the draft back\u0022.","file":"tools/studio-spike/browsertest-walkdock.mjs","line":753,"breaks":"Existing \u0060browsertest-walkdock.mjs\u0060 expectation that stopping a saved walk restores the desk draft, and the plan\u0027s requirement that \u0060WalkViewer.tsx\u0060 needs no edit / the drivers stay green.","failure":"browsertest-walkdock.mjs \u2014 CRASHED: locator.textContent timeout (line 753)"}],"answers":[]}
-->
