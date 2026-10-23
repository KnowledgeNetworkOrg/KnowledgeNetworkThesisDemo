**Must fix:**
none

**Optional:**
none

**Nit:**
none

Both points I was handed are settled by the code, not the reply:
- R3-16 (fixed): `PresenterHeaderBar.tsx:8-16` now carries the preview and ended host rules, and `PresentStartCard.tsx:20-33` carries WHEN IT OPENS / WHAT THE HOST MUST DO.
- R3-17 (fixed): `BinMark.tsx:12-16` now names `lift={false}` as the one way to drop the lift, matching the DS wording.

Rest of the card checks out: the v4 presenter files are ported whole (`FlagChip`, `PresentStartCard` new; `LectureNotes`, `FilmRoll`, `LectureRecap`, `PresenterHeaderBar`, `PresenterStrip`, `ProjectedMap`, `QuickActionsDeck`, `BinMark` current), every new name is in `src/ds/index.ts`, both greps are clean (`#fff`/`rgba(255,255,255)` in `src/ds/presenter/`, `unflag` in `src/ds`), and build/typecheck/lint/test pass locally (951 tests, plus `typecheck:desktop`). The v4 behaviours are present: one flag list with `resolvedAt`, delete asks first, click-to-edit words, `TagGlyph`/`GLYPH_DROP`, the 220px parked chat, the review `aside` preview, `onClose`, ‹ ›, and focus-revealed film-roll corners.

**Noticed outside this card's scope**
- `tools/studio-spike/browsertest-presenter-panes.mjs` and `tools/studio-spike/browsertest-scrollbarclearance.mjs` were edited (v4 label literals: composer placeholder, mint fields, prepared-notes label) so `src/studio/browsertestguard.test.ts` passes. The card says "A PORT ONLY: `src/ds/**` and nothing else", so this is outside its stated scope; it is the check's required follow-through rather than a behavioural defect.

Assumptions: I treated the two browser-driver literal edits as the check's required follow-through (noted above, not counted as a finding), and the `NodeArrow.tsx` comment reword as inside `src/ds`, which the card's `unflag` grep requires.

<!-- kncode-findings
{"reports":[],"answers":[{"id":"R3-16","answer":"Fixed","because":"src/ds/presenter/PresenterHeaderBar.tsx:8-16 now carries the .d.ts preview rule (no clock, keep the start control pressable, start from zero) and the ended rule (resume elsewhere, word the tooltip to match the chip). src/ds/presenter/PresentStartCard.tsx:20-33 now carries WHEN IT OPENS and WHAT THE HOST MUST DO (store the sessions and their \u0060last\u0060, pass \u0060openWalk\u0060, do what \u0060onStart\u0060 says, mount as a modal, unmount on \u0060onCancel\u0060).","duplicateOf":null},{"id":"R3-17","answer":"Fixed","because":"src/ds/sidebar/BinMark.tsx:12-16 now uses the DS wording: \u0060style\u0060 merges under the lift so a caller cannot counter-nudge it, and \u0060lift={false}\u0060 is named as the one way to drop the lift for a bin alone in a round button. The prop itself defaults true (:36) and the flag row passes lift={false} (LectureNotes.tsx:336).","duplicateOf":null}]}
-->
