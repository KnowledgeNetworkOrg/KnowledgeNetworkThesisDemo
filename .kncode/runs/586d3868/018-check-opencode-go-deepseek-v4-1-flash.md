Failures:
- browsertest-presenterclicker.mjs: the recap list is focused and has room to scroll (`max 0`)
- browsertest-presenterclicker.mjs: PageDown scrolls the recap list once the lecture has ended (`scrollTop 0`)
- browsertest-presenter-panes.mjs: the category popover offers 'new category…' (30s `locator.click` timeout at line 247)
- browsertest-scrollbarclearance.mjs: firefox · lecture notes: the column under test is on screen (no scroller matches `/notes-during/`)

Commands run:
- `npm ci --no-audit --no-fund`
- `npm ci --prefix desktop --no-audit --no-fund`
- `npm run build` — passed
- `npm run typecheck:desktop` — passed
- `npm run lint` — passed
- `npm run test` — 67 files, 951/951 passed
- `npm run verify` — passed
- `npm run test:browser -- presenter` — 1/3 passed (2 failed twice)
- `npm run test:browser` — 35/38 passed (3 failed twice)
- grep `#fff|rgba(255,255,255` under `src/ds/presenter/` — no matches
- grep `unflag` under `src/ds` — no matches
- `src/ds/index.ts` export spot-check — `FlagChip`, `FlagRing`, `FLAG_CHIP_METRICS`, `GLYPH_DROP`, `TagGlyph`, `NOTE_CATEGORY_POOL`, `PresentStartCard`, `START_CARD_METRICS`, `StartMath` present

Left out: the manual presenter walkthrough (needs a person and the host wiring OB-304 owns); `probe-*`/`shot-*` scripts (instruments, not tests, per `run-browsertests.mjs`). No credentialed or opt-in-by-environment suite exists.

Verify: ran — failed: the five Verify commands (build, desktop typecheck, lint, unit tests, verify) all pass, but the command-run end-to-end presenter drivers fail the four checks above (stale v3 assertions against the v4 port and the not-yet-wired host).

<!-- kncode-findings
{"reports":[{"id":"C4-18","raisedAgain":false,"bucket":"MustFix","what":"After ending the lecture the check reports \u0060max 0\u0060: the recap\u0027s flagged list has no overflow. The v4 \u0060LectureRecap\u0060 renders rows from the \u0060notes\u0060 element / \u0060entries\u0060 passed to \u0060LectureNotes variant=\u0022review\u0022\u0060 and ignores the deprecated \u0060flagged\u0060 prop, while the host still flags only through \u0060flags\u0060 (\u0060src/present/PresenterScreen.tsx:212,422\u0060). Until OB-304 wires the host, the driver\u0027s \u0060f\u0060 presses produce no recap rows.","file":"tools/studio-spike/browsertest-presenterclicker.mjs","line":153,"breaks":"The plan\u0027s end-to-end check that ending the lecture shows grouped flags in the recap; the driver fails on both its first run and its retry.","failure":"browsertest-presenterclicker.mjs: the recap list is focused and has room to scroll"},{"id":"C4-19","raisedAgain":false,"bucket":"MustFix","what":"Follows from the empty recap scroller: \u0060scrollTop\u0060 stays 0 after PageDown, so the check cannot tell that the ended-recap scrollers still receive the clicker keys.","file":"tools/studio-spike/browsertest-presenterclicker.mjs","line":157,"breaks":"The same plan end-to-end check; deterministic on both runs.","failure":"browsertest-presenterclicker.mjs: PageDown scrolls the recap list once the lecture has ended"},{"id":"C4-20","raisedAgain":false,"bucket":"MustFix","what":"The driver times out for 30s per run waiting for \u0060[data-note-categories]\u0060 text \u0027new category\u2026\u0027; the v4 composer\u0027s mint row now reads \u0027new type.\u0027 (\u0060src/ds/presenter/LectureNotes.tsx:435\u0060), so the click never lands and the driver aborts with an exception. The driver was only partly updated for the v4 literals.","file":"tools/studio-spike/browsertest-presenter-panes.mjs","line":247,"breaks":"The plan\u0027s end-to-end check of the composer\u0027s type menu; the mint flow is unreachable, so every later check in this driver is skipped.","failure":"browsertest-presenter-panes.mjs: the category popover offers \u0027new category\u2026\u0027"},{"id":"C4-21","raisedAgain":false,"bucket":"MustFix","what":"In Firefox no scrolling box in the live lecture resolves to the \u0060[data-notes-during]\u0060 name the driver looks for; Chromium finds one. In v4 the hook sits on the flags-list wrapper (\u0060src/ds/presenter/LectureNotes.tsx:845\u0060), not on the element that scrolls, so the Firefox sweep has nothing to measure.","file":"tools/studio-spike/browsertest-scrollbarclearance.mjs","line":165,"breaks":"The OB-210 scrollbar-clearance check for the lecture notes in Firefox; deterministic on both runs (Chromium passes).","failure":"browsertest-scrollbarclearance.mjs: firefox \u00B7 lecture notes: the column under test is on screen"}],"answers":[]}
-->
