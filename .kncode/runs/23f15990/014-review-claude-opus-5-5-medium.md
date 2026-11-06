The type error is fixed, and I found nothing new to raise.

I checked R2-9, the type error at `DocumentPanel.tsx:223`, against the code. `secondaryTagsAt` in `src/model/stopsecondary.ts:10` now accepts `null | undefined`. I ran `npx tsc -p tsconfig.app.json --noEmit --incremental false` and it reported no errors. The 466 unit tests under `src/model` and `src/state/walk` pass, and eslint reports nothing on the changed files. I did not run the full `npm run verify` or the browser drivers.

I tried to close R2-10, the duplicate of R2-9, but the tool refused because only the reviewer who raised it can answer it. That needs no change to the code.

The earlier findings, R0-1 to R1-8, also hold up in the code as their answers say. The card's requirements and its "done when" checks are all covered by the change or by the driver. Nothing outside the card's file scope changed, except new helper files under `src/model/`, which the card's "and what they need" allows.

**Must fix:** none

**Optional:** none

**Nit:** none

Assumptions: the PR description will say that "step titles" means the titles the app draws itself (the hover card and "walks through here"), not the titles in the DS `WalkStrip`, as the answer to R0-3 says it must. I could not see the PR text from here.