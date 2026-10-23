Changes made:
- Ported `FlagChip` and `PresentStartCard` whole, rewrote `LectureNotes` for flags v4, and ported `FilmRoll`, `LectureRecap`, `PresenterHeaderBar`, `ProjectedMap`, and `BinMark` (`lift`) to the current design-system sources.
- Updated `PresenterStrip`’s roaming label to `var(--surface-raised)` and added every new export to `src/ds/index.ts`.
- Updated `panefit.test.ts` and `lecturerecap.test.ts` for the new fit shape and clock wording, and reworded the remaining “unflag” comments in `NodeArrow.tsx` and `PROVENANCE.json`.
- Ran `npm run typecheck`, `npm run lint`, `npm run build`, and the presenter/barrel tests; all pass. The three grep gates are clean.

Assumptions: Deprecated host props (`flagged`, `onToggleFlag`, `onDeleteEntry`, `duringWidth`) remain accepted and ignored where needed so `src/present` still compiles until OB-304; `QuickActionsDeck` and the rest of `PresenterStrip` were already current, so only the requested roaming-label change was needed there; the historical `unflag` wording in `PROVENANCE.json` was reworded because the card’s grep checks all of `src/ds`.