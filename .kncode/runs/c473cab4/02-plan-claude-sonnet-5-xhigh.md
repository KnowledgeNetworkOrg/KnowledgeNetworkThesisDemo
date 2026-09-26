The map fits each region name inside its own region one at a time. It never checks whether two neighbouring names run into each other. The fix is a second pass that keeps the earlier of two colliding domain names and leaves out the later one. The dropped name still shows in the hover tooltip.

**Plan**

1. Extend the map-connections browser driver first. It will measure the domain-name boxes with the rail closed (asserting every domain is still named), then open the rail with the corner button and measure again. Run it once before touching the app, to reproduce the `sys`/`cs` overlap of 3.3 × 7.2 px.
2. In the label-fit module, add a pure "region name box" that matches what the browser draws. Width is measured at the name's real weight, and height is calibrated against the on-screen boxes from step 1.
3. In the same module, add a pure gate that walks the names in order and keeps a name only if its box misses every name already kept. A dropped name never blocks a later one.
4. In the map view's label-fit calculation, fit all domain names at level 0 first and run the gate. Only the survivors are stored and registered as boxes, so walk pins don't steer around a name that isn't drawn. Module names, ghost names and the wrapping logic stay untouched.
5. Add unit tests for the gate: overlap drops the later name, disjoint names all stay, a dropped name doesn't block a third, and list order decides which one goes.
6. Correct the now-stale "closed at first" comment on `railOpen` and the header comment in the label-fit module.
7. Have the driver also log level-1 module-name overlaps, rail closed and open, without changing that grain. If they collide, that becomes a follow-up issue rather than a wider change here.

Files: `src/model/labelfit.ts`, `src/model/labelfit.test.ts`, `src/instruments/MapView.tsx`, `tools/studio-spike/browsertest-mapconnections.mjs`

Out of scope: the rail itself ("not the rail's bug"), the wrapping and shrinking in `fitRegionLabel` ("wrapping is already right"), and the default-closed state of the rail. The card says only to revisit that default, not to change it.

Verify: at the explore preset (1750×950), open the Explorer rail from the corner in the map's top row and read every visible domain name's on-screen box. No two boxes overlap, whereas before the fix `sys` and `cs` overlap by 3.3 × 7.2 px. With the rail closed, every domain name is still drawn exactly as before.
```
npm ci --prefix desktop        (once, only if desktop/ packages aren't installed; verify needs them)
npx vitest run src/model/labelfit.test.ts
npm run verify
node tools/studio-spike/browsertest-mapconnections.mjs
node tools/studio-spike/browsertest-explorerrail.mjs
```

Assumptions:
- "L0" in the card means the domain names (internal tier 0). The level picker labels that level "L1" since #336.
- "Later" means later in the domain list order, which is also the order they're drawn.
- I drop the later name outright, as the card says. I don't shrink it first or ghost it.
- The box has to match the browser's real box closely. If it's too generous, it would drop a name on the closed-rail default screen that fits today. That is why step 1 asserts that all names survive with the rail closed, and why the box is calibrated to measured boxes rather than the character-count estimate the walk pins use.
- The decision is made at each level's resting zoom, like the existing fit, so a user zooming freely inside a level isn't re-checked frame by frame.
- The rail stays closed by default in this card. Flipping it is one boolean, but it also means rewriting the "starts closed" checks in the Explorer rail driver and shifts the layout under other browser tests. My recommendation is to flip it in a small follow-up once this has landed and the owner has seen the open-rail screenshot.