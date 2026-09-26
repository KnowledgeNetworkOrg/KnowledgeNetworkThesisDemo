PASS

npm ci
npm run verify
npm run build
npm run test:browser
node tools/studio-spike/shot-foldab.mjs
node tools/studio-spike/shot-foldab.mjs  (unchanged card and test page temporarily swapped in, then restored)
node tools/studio-spike/shot-foldab.mjs  (the three `closable: true` flags temporarily removed from the test page, then restored)
node tools/studio-spike/shot-cardhead.mjs  (timed out on first load)
node /tmp/probe-cardhead.mjs  (throwaway diagnostic, since deleted)
node tools/studio-spike/shot-cardhead.mjs  (rerun, passed)

**Result: the build and every test pass.** The project's checks are type-checking, lint and 621 unit tests, run together by `npm run verify`. All passed, the production build succeeded, and all 32 browser tests passed. I changed no files: the two I edited temporarily for experiments are byte-identical to how I found them.

**The size-check driver still exits with a failure, but not because of this change.** This driver compares the size the app predicts for each card against the size the browser draws. It reports 8 mismatches. To find out who caused them, I temporarily ran it on the unchanged card, copied from another workspace on this machine. There it reports 15. All 8 that remain are in the unchanged code exactly as they are here:

- **Three step chips with multi-part numbers like "2.1."** are predicted 1–3 pixels off. The chip component is byte-identical to the unchanged copy, so this change can't have caused it.
- **Four folded cards** are predicted 1 pixel too tall. The line that shows the node count on narrow cards now draws 17.84 pixels, against the 18.84 measured in August. This change didn't touch that line. A pixel too tall only leaves a small gap, so it's harmless.

The 7 this change removed were open cards predicted a full title line (about 13 pixels) too short, plus one folded card 16.5 pixels short. That is the harmful direction, because the next card gets drawn on top. The driver's pictures were re-taken on every run, which covers the card's re-baselining requirement.

**The reviewer's "did the change take" check found nothing to see.** Removing the new "has an ungroup button" flag from the test page produced identical output, because none of the sample titles falls in the narrow band where reserving room for two buttons versus three changes where a title wraps. The receipt should say this check was inconclusive, and cite the 15-to-8 comparison as the evidence that the layout really moved.

**The card-head driver passed on its second run.** On its first run it waited 30 seconds for the "Plan" layout button and gave up. A diagnostic load showed the app starting cleanly with that button present, and the rerun passed every assertion: no card head overlaps its steps, and a folded card's reserved 81 pixels covers the 79.94 it draws. My guess is that another workspace's browser run was competing for the same fixed port at that moment (tracked as issue #364), but I didn't confirm it.

**Still open, for the receipt or later:**
- the two older mismatch patterns above deserve their own follow-up;
- the pencil button's border difference still needs its comment on the drift log (#74);
- the receipt itself needs a commit first.