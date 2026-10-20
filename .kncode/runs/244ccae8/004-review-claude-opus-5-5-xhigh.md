**Must fix:**

1. `src/ds/PROVENANCE.json:796` is now **invalid JSON**. The new PaneDivider entry was meant to say "the separator's `now`/min/max", but the `\n` of `now` was written as a raw line break, so the file reads "separator's ⏎ow/min/max". Running `JSON.parse` on the file fails with "Bad control character in string literal … line 796 column 169". `npm run verify` doesn't catch it because nothing in the suite parses the file. It is still the record that every lane appends to and rebases (lane comment), and any tool that reads it will break.

2. **The desk now runs off the window in compositions that used to fit.** This breaks something that worked. Two changes combine:
   - each pane's floor is a hard `minWidth` (`src/ds/chrome/Pane.tsx:542`, `src/studio/StudioView.tsx:493`);
   - each divider sits inside the row's flow with a `gap-3` on both sides, so every seam costs 38px (`StudioView.tsx:577`, `desk.ts:19`).
   
   When the floors add up to more than the row, the row overflows and the page itself scrolls sideways. Before, every pane had `minWidth: 0` and shrank to fit. Worked through for Plan (floors 300 + 330 + 396, two seams = 1102px):
   - **1280×800 with the sidebar open:** the row is 1036px, so the document ends about 54px past the window edge, Relations rail included.
   - **1280 with the walk palette added**, which #416 calls "one sidebar click away": about 1380px of panes in a 1256px row, so the palette is about 112px off-screen even with the sidebar closed.
   - **The opening composition at 1280 with the sidebar open:** already 6px over the row.
   - **The new driver's 1100px check** (`browsertest-deskdividers.mjs:166`) passes while the document is about 14px off-screen. It asserts the floors hold, never that the panes stay reachable.
   
   The desk needs a deliberate answer for "floors exceed the row", and the driver should assert it, e.g. no page-level horizontal overflow and every pane and handle reachable.

3. **Done when: "every browser driver passes unchanged" is not shown.**
   - Only 4 of the roughly 30 collected drivers were reported run, and Plan's composition and every multi-pane desk's geometry changed under all of them.
   - `browsertest-studiodesk` is reported failing (its opening/closing samplers saw 3–8 frames, under the floor of 10). The claim that this is environmental has no evidence. Run it on base `72206e8` in the same environment, or fix it.
   - `browsertest-maphover.mjs` was edited (see the FLAG).
   - Run the full `npm run test:browser` and report the result.

4. **Done when: "a receipt is filed"** is not met. No OB-170 receipt exists yet. It should cite the final commit sha and record the open assumptions: the `done when:` text was not available in this checkout, and the floors were chosen.

**Optional:**

1. `StudioView.tsx:522`: `onDividerEnd` stores fractions even when the gesture didn't move (a plain click or `pointercancel`). The base comes from the DOM, which is already squeezed by floors and window width. Example: in Plan at 1100px the base is the floors themselves; one click on a seam pins those proportions, and widening to 1750 never returns to the preset split. This is the same bug `RailFrame` was fixed for on #372, and PaneDivider's docs say to treat 0 as "nothing was chosen". It matters more once #368 saves widths.
2. `StudioView.tsx:577` puts the 14px strip in the flow, so the gap between column panes is now 38px instead of 12px:
   - The comment at `:736` ("the 12px gutter matches the p-3 window inset") is now false.
   - It costs 26px per seam and feeds Must fix 2.
   - `RailFrame` set the precedent of laying the strip over the seam ("a strip in the flow would move both by 14px"). Overlaying the desk's existing gutter would keep the desk's spacing unchanged.
3. `instruments.tsx:152–310`: the floors of every pane that doesn't carry a rail are unexplained choices (240/280/300/320/360). The `PaneFit` contract says they are measurements. Two specific problems:
   - `narrowBelow > floor` claims these panes draw a lesser reading, which none of them do; the contract says "a pane with nothing to degrade to sets them equal".
   - #416's done-when 3 wants the walk editor's fit "from its own content". At minimum, measure the walk editor and record how.
4. `StudioView.tsx:520`: every pointer move re-renders the whole Studio, so every pane's `render(bus)` runs, map and document included. The same change avoids exactly that for the palette flight. Consider writing live widths to the DOM, or memoizing the pane content.
5. `Pane.tsx` `fit` is a LOCAL divergence from the DS `Pane.jsx`. Per CLAUDE.md that needs a comment on drift-log #74, not only a PROVENANCE line.
6. `StudioView.tsx:528`: a reset on either seam restores the whole composition. In Plan, double-clicking editor|map also undoes a map|document drag. Either reset only that boundary, or say so.

**Nit:**

1. `PROVENANCE.json:777`: "? LOCAL:" is a mangled character (other entries use ★). The new text also uses " - " where the file uses " — "; the same goes for the `OB-170 -` describe names in `desk.test.ts` and `pane.test.ts`.
2. `src/ds/barrel.test.ts:311`: the comment line is overlong and has no closing period.
3. `instruments.tsx:335`: the `Slot` doc still justifies stacks by "the palette above the document", which no preset uses any more.
4. `desk.ts:19`: `DESK_GUTTER` restates the row's `gap-3` (`StudioView.tsx:762`). Derive one from the other.
5. `StudioView.tsx:350`: `ensureActive` doesn't clear `deskLive`/`dragBase`, while `toggle` and `applyPreset` do. A reveal during a drag keeps a stale base.

**Noticed outside this card's scope**

- Declaring the map and document floors as `railFloor('left'|'right')` also lands #425 item 1 (OB-238 clause 3, "a pane hosting a rail declares that minimum"). #425 and its receipt should be updated so the work isn't redone.

Checks I ran: `tsc -b` is clean, eslint on the changed files is clean, and vitest passes 908/908. I did not run the browser drivers, because they write screenshots.

Assumptions: OB-170's own `done when:` isn't in this checkout and I didn't read the design project. I judged against the `PaneDivider`/`PaneFit` contracts, #416's done-when and #425 (fetched from GitHub). The overflow figures are worked out from the CSS and the declared numbers (`--sidebar-w` 208, `p-3`/`gap-3` 12, strip 14), not measured in a browser.

FLAG: conflict: The card requires every browser driver to pass unchanged, but #416's Plan change (put in this lane by the 2026-10-02 comment) forces `browsertest-maphover.mjs`'s setup to change. Should the owner accept the setup-only edit, or should #416's preset change come out of this PR?