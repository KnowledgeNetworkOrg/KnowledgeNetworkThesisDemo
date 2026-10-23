1. Read each presenter `.d.ts` docblock, then its `.jsx`. Take the ★ LOCAL deviations recorded in `src/ds/PROVENANCE.json` from the existing `.tsx` ports as the list to re-apply:
   - `wrapTip` at every `title=` site (adherence rule 5);
   - the `react-hooks` disables and ref-in-effect rewrites;
   - the `data-*` test hooks;
   - `borderRadius: '0 0 var(--radius-xs) 0'`;
   - `fillBounds` kept exported from `PresenterStrip.tsx`.
2. Dependencies first. A name and prop check shows `BinMark` lacks the `lift` prop that `LectureNotes` passes (`lift={false}`), so port `sidebar/BinMark.tsx` whole from its `.jsx` and `.d.ts`. Run the same check for `InlineText`, `MeasureBox`, `Pane`, `IconButton`, `PillButton` and `portal`. Port whole any that lacks a name or prop the presenter files pass. Keep their existing local extras (`tidyMultiline`, `isHairlineRule`). `PillButton` tones and `IconButton` and `LoadPicker` props already match.
3. Create `src/ds/presenter/FlagChip.tsx` (`FlagChip`, `FlagRing`, `FLAG_CHIP_METRICS`, `FlagType`, `FlagChipProps`). Create `PresentStartCard.tsx` (`PresentStartCard`, `START_CARD_METRICS`, `StartMath`, `StartSession`, `StartChoice`, `PresentStartCardProps`).
4. Re-port whole, replacing the files:
   - `LectureNotes.tsx` (v4 live and review, `GLYPH_DROP`, `TagGlyph`, `NoteFlagMath`, `LECTURE_NOTES_FIT.minHeight`, the `aside` props);
   - `LectureRecap.tsx` (`session`, `slide`, `shownStop`, `onFlag`, `StartMath` next-time line);
   - `FilmRoll.tsx` (`onFlag`, `FlagChip`, focus reveal, tab order);
   - `PresenterHeaderBar.tsx` (`onClose`);
   - `PresenterStrip.tsx` (the "roaming" label on `var(--surface-raised)`);
   - `ProjectedMap.tsx` and `QuickActionsDeck.tsx`.
   Reword the "unflag" prose from `FilmRoll.d.ts` when carrying it into the TSX docs, so `grep unflag src/ds` stays empty.
5. Update `src/ds/index.ts` with every new export: `FlagChip`, `FlagRing`, `FLAG_CHIP_METRICS`, `FlagType`, `GLYPH_DROP`, `TagGlyph`, `NoteFlagMath`, `PresentStartCard`, `START_CARD_METRICS`, `StartMath` and the new types. Drop `FlaggedSlide` if the new `LectureRecap` no longer exports it.
6. Fix the tests and records inside `src/ds`:
   - `panefit.test.ts` moves from `duringMin` to `chatMin` and adds `minHeight: 340`.
   - `lecturerecap.test.ts` gains the v4 `counts` case.
   - `barrel.test.ts` lists the new unconsumed ports (`FlagChip`, `PresentStartCard`, etc.).
   - `adherence.test.ts` gets a recounted `BUDGET`, with a dated comment line.
   - `PROVENANCE.json` gets dated entries per file: `from`, `contract`, deviations, and `BinMark`'s re-port.
7. Run `npm run build`. The new `.d.ts` files drop `flagged` and `onToggleFlag` on `LectureNotes`, and the `flagged` list on `LectureRecap`, so `PresenterScreen.tsx` will fail to typecheck. Delete only those call-site props, with no new wiring. OB-304 wires `onFlag`, `onClose`, `slide`, `shownStop` and the rest.
8. Run the two greps from the card, then `npm run verify`. Fix lint (`react-hooks`) and adherence failures in the ports. Do not change the host to satisfy them.
9. Write the PR description. It lists the dependency files ported whole (`BinMark`, and any others step 2 turns up), the one host touch, and any port divergence for drift log #74.

Files: `src/ds/presenter/{FilmRoll,FlagChip,LectureNotes,LectureRecap,PresentStartCard,PresenterHeaderBar,PresenterStrip,ProjectedMap,QuickActionsDeck}.tsx`, `src/ds/sidebar/BinMark.tsx`, possibly other `src/ds/chrome/*.tsx` that step 2 shows are behind, `src/ds/index.ts`, `src/ds/PROVENANCE.json`, `src/ds/barrel.test.ts`, `src/ds/adherence.test.ts`, `src/ds/presenter/{panefit,lecturerecap}.test.ts`, and a minimal prop deletion in `src/present/PresenterScreen.tsx` (see Assumptions).

Out of scope: any host wiring in `src/present/` or `src/studio/` (that is OB-304's). `StopFlag.jsx`, `FlagFilterBar`, `FilteredGap`, `FlagMath` and `DocHeader`'s `titleMark` (the paused flags mode). Editing anything under `design-system/`. Porting anything beyond what the card asks for.

Verify: start `npm run dev`, open the Studio's Present preview, and check that the notes pane is the v4 layout:
- the slide's title as its head;
- click-to-edit prepared notes;
- an `ns-resize` divider;
- "Flagged during lecture";
- the composer at the foot;
- the Class chat parked at 220px on the right;
- no console errors, and no blank screen on either corpus.
Also confirm the two `grep` checks come back empty. The host does not yet pass `onFlag`, `onClose` or the recap's `slide`, so the flag chip, the header's close pill and the recap preview cannot be seen in the app until OB-304.

```
npm ci
npm ci --prefix desktop
npm run verify
grep -rn "#fff\|rgba(255,255,255" src/ds/presenter/
grep -rn "unflag" src/ds
```

Run the two `npm ci` lines only where `node_modules` is missing.

Assumptions:
- **Host edit:** `npm run verify` has to pass, but the new `.d.ts` files reject the old `flagged` and `onToggleFlag` props on `LectureNotes`, and the `flagged` list on `LectureRecap`. I assume deleting those call-site props in `PresenterScreen.tsx` is acceptable, and I will say so in the PR. The alternative is keeping ignored legacy props in the ports, which leaves a divergence behind for OB-304 to clean up.
- **`.prompt.md` files:** these are reading material and are not ported. None of the existing ports has one.
- **Unlisted dependencies:** `PaneColumnHeader`, `PaneHeader`, `TreeRow`, `Grip`, `CloseMark`, `WalkerMark`, `EditMark`, `LocateMark`, `LoadMark`, `StepDot`, `WalkParts`, `WalkPreview`, `WalkDock` and `TextInput` have no copy in `design-system/`. I assume the existing ports are current if the names and props the presenter files use exist. If one is missing, I report the card `blocked` and name the file, as the card says.
- **Local deviations:** I re-apply them to the whole-file ports (lint and house-rule fixes, `data-*` hooks, `wrapTip`), and the provenance entries record them. The browser drivers under `tools/` depend on those hooks.
- **Old tests:** those pinned to the old arithmetic (`duringMin`, `LECTURE_NOTES_FIT` equality) are updated to the new `.d.ts` numbers, not worked around.
- **`StopFinder` and the other cards' files:** `StopFinder` and any file outside the card's list stay untouched. I assume `src/ds/presenter/StopFinder.tsx` from OB-301 is already current.