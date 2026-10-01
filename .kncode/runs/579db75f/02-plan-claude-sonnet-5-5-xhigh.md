I've read everything I need and changed nothing. The change is small and safe: make the pin model count stops from 0, like the design system, and keep the on-screen `data-step` number counted from 1. That means none of the browser test scripts need editing.

A few things in the card are out of date or incomplete:
- **Moved code:** `pinMarks` is now `marks` inside `src/instruments/map/WalkPins.tsx`. The playback camera's conversion moved to `src/instruments/map/arrivallook.ts`, line 76.
- **Missed conversion:** the wall view (`wallPinState` in `src/model/walkwall.ts`) also converts by hand in two places, and the card doesn't mention it.
- **Why the drivers can stay as they are:** every driver only reads the `data-step` and `data-step-end` attributes, never the model. The pin's `step` field changes to 0-based, but the attribute stays 1-based by adding 1 in one commented place.

1. In `walkpins.ts`, number stops from 0 where the model first creates them (`step: i + 1` becomes `step: i`), and rewrite the comments that say "1-based".
2. In `pinPosition` (same file), delete the `position + 1` conversion and fix its docblock.
3. In `walkwall.ts`, make `wallPinState` compare the wall's 0-based `lit` and `covered` directly against the pin, with no `+ 1` or `- 1`.
4. In `arrivallook.ts`, make the camera test `p.step <= arrival && arrival <= p.stepEnd`, with no arithmetic.
5. In `WalkPins.tsx`, build the design-system mark as `{ from: s.step, to: s.stepEnd }` with no subtraction. The only `+ 1` left is on the two `data-step` attributes, commented as "what a person reads".
6. Update the unit tests whose tables are written from 1: `walkpins.test.ts` (pin shapes and `pinPosition` runs), `walkwall.test.ts`, and the fixtures in `walkdraw.test.ts`.
7. Run the full verification, then the browser drivers that read these pins.
8. In the PR text, state that the attribute stays 1-based, so the three past receipts that describe pins by what's on screen remain true.

Files: `src/model/walkpins.ts`, `src/model/walkwall.ts`, `src/instruments/map/arrivallook.ts`, `src/instruments/map/WalkPins.tsx`, `src/model/walkpins.test.ts`, `src/model/walkwall.test.ts`, `src/model/walkdraw.test.ts` (fixtures only)

Out of scope: nothing stated

Verify: Play a walk on the map, at a fine zoom and at a coarse zoom where several stops merge into one pin. The pins should print the same numbers as before (for example, one pin labelled "1–3" with `data-step` 1 and `data-step-end` 3). The pin matching the dock's current stop should light up and wash in the same order, and the camera should still fly only when the next stop is off-screen. The browser drivers check exactly this. They should pass without being edited.

```
npm run build
npm run test
npm run lint
npm run typecheck:desktop
npm run test:browser -- walkdock
npm run test:browser -- grouppins
npm run test:browser -- optionalgroup
npm run test:browser -- walkvisibility
npm run test:browser -- pincrowd
node tools/studio-spike/shot-walkpath.mjs
```

`npm run verify` runs the first four together, and `npm ci --prefix desktop` is needed once beforehand if `desktop/` has no packages. The browser drivers launch Edge. If Edge isn't available here, I'll say so rather than report them as passed.

Assumptions:
- **Keep `data-step` from 1:** I'm taking the card's own suggested option, so the drivers and past receipts stay valid.
- **`data-step-end` too:** it also stays 1-based, matching `data-step`.
- **Field names unchanged:** `step` and `stepEnd` keep their names and only their values shift. Because that rename wouldn't alert the compiler to a missed reader, I searched for every reader of them. They are the files listed above, and `walkdraw.ts` doesn't read them.
- **Receipts untouched:** I won't edit past receipts. They live in the design project, outside this repo, and are one file per run.
- **Design-system code untouched:** `src/ds/**` is a vendored copy of the design system's code and already counts from 0, so nothing there changes.