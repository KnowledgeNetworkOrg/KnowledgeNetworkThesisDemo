The two Firefox drivers fail for an environmental reason, so record them as skipped with that reason. Either run npx playwright install firefox in the workspace, or skip them and record why. They don't block this card. What does block it: run browsertest-presenter-panes.mjs and record its PASS output (reviewer optional 3). The done-when 2–4 DOM readings have never been observed. Also take these from the MINOR review:
▎ - Optional 1: measure the row with usePaneWidth() instead of useRef + useEffect.
▎ - Optional 2: remove PaneDivider, PANE_DIVIDER_METRICS, clampDesk and deskBounds from the "not adopted" ledger in barrel.test.ts.
▎ - Optional 5: after a mouse drag, check that → still advances the stop.
▎
▎ The "522 doesn't fit the notes' own padding" finding is the design system's number. Leave it as-is and record it for the OB-254 receipt.