**Must fix:**

1. **On a three-pane desk, pushing a seam against a floor walks the boundary backwards and grows the pane on the far side.** This is the same symptom as round 1's Must fix 1, but it has a new cause.
   - **What I measured** (headless Edge, 1280×800, sidebar open, the launch desk; widths map / unfold graph / document):
     - At launch: 459.3 / 322.1 / 230.6.
     - I focused the map|unfoldgraph seam and pressed ArrowRight. After 5 presses the unfold graph reaches its floor: 534.3 / 244.0 / 233.8.
     - After 60 presses: 508.7 / 240.6 / 262.7.
     - So once the handle should have stopped, each further press **shrank the map**, the pane the key is growing, and **grew the document**, which is not beside that seam. `aria-valuenow` fell from 536 to 510 while `aria-valuemax` stayed equal to it.
     - 41 presses of End went on to 492.6 / 240.6 / 278.8.
     - Pointer drags do the same, more slowly. Eight ±10px drags on seam 0, net travel zero, moved the document from 230.64 to 235.59.
   - **Contracts this breaks:**
     - The person's answer: "assert that only the two panes beside it move".
     - `clampDesk`: "the handle STOPS … a handle that redistributes the whole desk is a mystery".
     - The plan's Verify: "stop at each pane's declared floor".
   - **First cause: the drawing and the stored fractions are different numbers.**
     - `src/studio/StudioView.tsx:511` draws a flexible column as `flex: f 1 0%`. A `Pane` frame is border-box with a 1px border on each side, so its flex base is 2px, not 0.
     - The drawn width is therefore `2 + f·(A − 2n)`. But `readFlexSizes` and `fractionsOf` (`StudioView.tsx:521`, `src/studio/desk.ts:78`) store `w/A`.
     - So every write moves every pane toward A/n by `2(1 − n·w/A)`, about 0.6px per write for the document at launch. The same gap makes `aria-valuenow` read 460 for a map drawn at 459.27 (`StudioView.tsx:503`), and the document stops at 396.7 instead of 396.
   - **Second cause: the store fires on the requested travel.**
     - `StudioView.tsx:540` stores on `delta !== 0`, the requested travel, not on whether the clamp moved anything.
     - So a press or drag against a floor still re-stores, and every re-store applies the drift.
   - **Why only on three panes:** with two panes the clamp absorbs the drift. With three or more (the launch desk, Plan) the third pane is never clamped, so it creeps.
   - **The fix:**
     - Make the drawn width and the stored fraction one number. Either give flexible columns a basis that is exactly `f × (row − gutters − fixed)` (e.g. `flex: 0 1 calc(...)`), or convert through the frame's border both ways.
     - Store only when the clamped sizes differ from the base.
     - Add a driver check: at launch, press ArrowRight about 20 times on a seam whose neighbour is at its floor, then assert that the third pane and the stopped boundary have not moved.

**Optional:**

1. `tools/studio-spike/browsertest-deskdividers.mjs:119` and `:135`: the launch check drags 2px and allows ±2px. `near(459, 461, 2)` passes for a map that did not move, so the check cannot tell "moved by the pointer's travel" from "did not move". A larger drag (e.g. 20px) with the same tolerance would.
2. Round 1's Optionals 1–4 are still open. Per the person's answer they stay as they are and go in the closing comment:
   - `narrowBelow` is declared but nothing reads it (`src/studio/instruments.tsx:60`).
   - Every pointer move re-renders the whole Studio (`StudioView.tsx:534`). The `deskWidth` ResizeObserver now does the same on every frame of a window resize.
   - `Pane`'s `fit` needs a drift comment on #74; the person is posting it.
   - A reset on either seam restores the whole composition (`StudioView.tsx:543`).

**Nit:**

1. `src/ds/barrel.test.ts:366` says "RailFrame and StudioView both import this handle from the barrel". `RailFrame` imports `../chrome/PaneDivider` directly (`src/ds/connections/RailFrame.tsx:7`). StudioView is the only importer outside `src/ds`.
2. `src/studio/desk.ts:18`: `DESK_GUTTER` still restates the row's `gap-3`. This is round 1's Nit 4; the person did not take it.

**Noticed outside this card's scope**

- Declaring the map and document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3). #425 and its receipt should record that, so the work isn't redone.

Assumptions:
- Round 1's Must fix 2 (the full `npm run test:browser` run, studiodesk on base `72206e8`, skipping the two Firefox drivers) is the check step's, per the person's answer, so I did not list it as a finding here. I confirmed which drivers those two are: emptyeditshift and scrollbarclearance, and both click Plan.
- I ran `browsertest-deskdividers` (36/36 pass), vitest on the desk, pane, barrel and layering tests (66/66), and eslint on the changed files (clean). I measured the creep with two inline Playwright scripts that write no files.
- I treated the vite and vitest caches in `node_modules` as tool caches, not repository files.
- I explained the 2px flex base from the frame's `1px` border under Tailwind's border-box preflight. The measured widths match that formula exactly (2 + 0.4545·1006 = 459.27).
- I did not read OB-170's own `done when:`, which lives in the design project.