MINOR

The change does what the card asks. When two domain names (the top-level region names on the map) would overlap, the map now leaves out the later one in list order. That fixes the `sys`/`cs` overlap with the Explorer rail open. Nothing I read is wrong. The one real caveat is that none of it has been run yet, so the fix is unproven in a browser.

I checked five things:
- **Opening the rail re-runs the check.** The label layout recalculates when the canvas's measured size changes, and opening the rail changes that size.
- **A dropped name is really gone.** It isn't drawn, and it isn't reserved as space that walk pins steer around.
- **The measured width matches the drawn text.** Both use the page font at the same weight (800), and the map doesn't set a font of its own.
- **Only the requested part changed.** Wrapping, shrinking, module names and the faint parent names at deeper levels are untouched. Only the four files in the plan changed, and the rail still starts closed.
- **The browser test's new steps are safe.** It opens and closes the rail the same way the dedicated Explorer rail test does, it leaves the map as it found it, and visiting level 1 doesn't change which domain is selected.

Must fix:
none

Optional:
1. **Nothing has been run.** That covers the unit tests, `npm run verify` and both browser tests. The plan also said to reproduce the 3.3 × 7.2 px overlap before changing any code, and to set the box height from measured on-screen boxes. Instead, the height comes from the font's declared height figures (`src/model/labelfit.ts:211`). I think that is the right number, because Chrome sizes a text box from exactly those figures, but no browser has confirmed it. The browser test's two assertions are the proof. With the rail closed, all domain names must still be drawn (`tools/studio-spike/browsertest-mapconnections.mjs:498`). With the rail open, no two drawn names may overlap. Both must pass before this goes up as a pull request.
2. **One test name says the opposite of what it checks.** `src/model/labelfit.test.ts:152` is titled "boxes must clear on BOTH axes to stay". The test itself shows that clearing on one axis is enough, since the two boxes share a column and both are kept. It should read "clear on EITHER axis".
3. **A dropped name loses its fade.** The existing comment (`src/instruments/MapView.tsx:730`) says names are laid out one level beyond where they show so they can fade in and out over 350 ms. A dropped domain name is removed outright at the top level. So flying back up from level 1, where it shows as a faint parent name, it vanishes instantly instead of fading. This is cosmetic, and it's what the card's "drop" wording implies. Keeping the name in place but invisible would keep the fade.
4. **The rail's default is still open for decision.** The card says to revisit the closed-by-default rail once this is fixed. The change updates the comment at `src/instruments/MapView.tsx:240` but leaves the setting closed, as the plan chose. Opening it by default is one setting, but the Explorer rail browser test checks that the rail starts closed. I agree with the plan's recommendation: a small follow-up after the owner has seen the rail-open screenshot the browser test now saves (`5b2-domain-names-rail-open.png`).

Assumptions: The card has no "Done when" section, so I treated its "What it wants" paragraph and the plan's verification line as the acceptance bar. I didn't run the unit tests or the browser tests myself, because this step may not create files and both write caches or screenshots. Everything above comes from reading the code.