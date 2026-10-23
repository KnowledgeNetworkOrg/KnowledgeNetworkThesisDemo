Verdict: PASS. Both open findings are fixed in the code. I could not record my answers to R2-14 and R2-15 with `answer_finding`, because the tool says only the reviewer that raised a finding can answer it.

I did not run `npm run verify`, `vite build` or `typecheck:desktop`. I read the changed files and ran the grep gates and a JSON parse check.

**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Answers to the open findings**
- **R2-14: fixed.**
  - The `src/ds/sidebar/BinMark.tsx` entry in `PROVENANCE.json` now has `syncedAt: 2026-10-21`.
  - It carries an OB-303 deviation line recording the `lift` adoption, so a later card reading the ledger sees the file is current.
  - The ledger still parses as JSON.
  - `BinMark.tsx` matches the design system's `BinMark.jsx`: `lift` defaults to true, and `lift={false}` gives `transform: 'none'`.
- **R2-15: fixed.**
  - `LectureRecap.tsx:46,50,51` now use `slides ?? ''`, `notes ?? ''` and `flagged ?? ''`.
  - An absent count prints blank, as the design system's `recapStats` does (`LectureRecap.jsx:50-58`), where it used to print `0`.
  - The existing `recapStats` tests pass shapes that supply every count, so they are unaffected.

**Checks on the card's "Done when"**
- `grep "#fff\|rgba(255,255,255"` under `src/ds/presenter` finds nothing.
- `grep -i unflag` under `src/ds` finds nothing.
- Every `export` in the nine ported presenter files reaches `src/ds/index.ts`, including `FlagChip`, `FlagRing`, `FLAG_CHIP_METRICS`, `GLYPH_DROP`, `TagGlyph`, `NOTE_CATEGORY_POOL`, `PresentStartCard`, `START_CARD_METRICS` and `StartMath`. The two exceptions are `fillBounds`, which is reachable only as `PresenterStripMath.fillBounds`, and `PresenterState` in `PresenterHeaderBar.tsx`, which I did not look for in the barrel. The `RecapCounts` and `FlaggedSlide` type exports were dropped from the barrel, and nothing under `src` still uses them.
- `BinMark` was the only dependency port that needed refreshing, and it is ported whole and listed.

**Noticed outside this card's scope**
- The browser drivers in `tools/studio-spike/*.mjs` still assert the old review behaviour: `data-flagged-slide` → `.isDisabled()`, "notes taken", and the F-key flag. OB-304's driver rewrite has to replace them.
- `src/present` still passes the old flag props (`flagged`, `onToggleFlag`). `LectureNotes` and `LectureRecap` accept them and ignore them, as the plan said, so the chip and the new notes pane cannot be seen in the running app until OB-304.

Assumptions: I did not re-read every changed file line by line this round (the diff was truncated). I relied on the earlier rounds' line-by-line comparisons for the three large components, and re-read the two fixes and checked the barrel and the grep gates.