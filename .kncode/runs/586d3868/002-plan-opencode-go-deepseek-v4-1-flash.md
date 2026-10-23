1. Read each presenter `.d.ts` docblock first, then its `.jsx`, and compare the app ports of every named dependency against `design-system/`; report blocked only if a required design-system file is missing.
2. Port `LectureNotes.jsx` whole to `src/ds/presenter/LectureNotes.tsx` first, because it owns `NOTE_CATEGORIES`, `NOTE_CATEGORY_POOL`, `GLYPH_DROP`, `TagGlyph`, `NoteFlagMath`, and the shared metrics.
3. Port `FlagChip.jsx` whole as `FlagChip.tsx` (tap, hold/right-click ring, usual-flag persistence, `FLAG_CHIP_METRICS`, `FlagRing`).
4. Port `FilmRoll.jsx` whole (focus-revealed corners, chip on the current frame, travel cue) and then `PresenterStrip.jsx` (roaming label on `var(--surface-raised)`).
5. Port `LectureRecap.jsx` whole, then `PresentStartCard.jsx` whole because the recap imports its `StartMath`, then `PresenterHeaderBar.jsx` with the new `onClose` pill.
6. Port `ProjectedMap.jsx` and `QuickActionsDeck.jsx` whole.
7. Port `src/ds/sidebar/BinMark.tsx` whole for the new `lift` prop the flag row passes; no other dependency body appears to be behind.
8. Update `src/ds/index.ts` for every new export (`FlagChip`, `FlagRing`, `FLAG_CHIP_METRICS`, `GLYPH_DROP`, `TagGlyph`, `NoteFlagMath`, `NOTE_CATEGORY_POOL`, `PresentStartCard`, `START_CARD_METRICS`, `StartMath`, `PresenterStripMath`, and their types), keeping `PresenterState` for the host.
9. Update `src/ds/presenter/panefit.test.ts` to the new `chatMin`/`minHeight` fit shape, and reword the unrelated “unflagged” comment in `src/ds/graph/NodeArrow.tsx` so the `unflag` grep is clean.
10. Run the three grep gates and `npm run verify`; fix only `src/ds/**` fallout.

Files: `src/ds/presenter/FilmRoll.tsx`, `src/ds/presenter/FlagChip.tsx`, `src/ds/presenter/LectureNotes.tsx`, `src/ds/presenter/LectureRecap.tsx`, `src/ds/presenter/PresentStartCard.tsx`, `src/ds/presenter/PresenterHeaderBar.tsx`, `src/ds/presenter/PresenterStrip.tsx`, `src/ds/presenter/ProjectedMap.tsx`, `src/ds/presenter/QuickActionsDeck.tsx`, `src/ds/presenter/panefit.test.ts`, `src/ds/sidebar/BinMark.tsx`, `src/ds/graph/NodeArrow.tsx` (comment only), `src/ds/index.ts`.

Out of scope: `src/present/**` and `src/studio/**` (OB-304); `StopFlag.jsx`, `FlagFilterBar`, `FilteredGap`, `FlagMath`, and `DocHeader`’s `titleMark`; `design-system/**` is read-only.

Verify: opening the Presenter, tapping the current slide’s chip adds a bare row and holding it opens the ring whose pick becomes the usual type; the notes pane shows the slide title, click-editable prepared notes, resize divider, “Flagged during lecture” tally, and composer; ending the lecture shows grouped flags beside the “Preview” column with ‹ › and a “close the presenter” pill in the header.
```
npm run build
npm run typecheck:desktop
npm run lint
npm run test
npm run verify
```

Assumptions: the only dependency needing a newer body is `BinMark` (the `lift` prop); other dependencies already expose every imported name and prop. To keep `src/present` compiling until OB-304, deprecated host props such as `flagged`/`onToggleFlag` on `LectureNotes` and `flagged` on `LectureRecap` remain accepted but ignored. The `unflag` grep also matches an unrelated `NodeArrow.tsx` comment, so that comment is reworded; `panefit.test.ts` is updated because it asserts the old metric names and fit object shape.