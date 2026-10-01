MINOR

Must fix:
none

I read the code and all three edited files. Nothing has been run in this checkout, so every check below comes from reading, not from a test.

The document pane now keeps the last node that was selected, and every "Done when" line that can be checked in code is covered:
- **Clearing keeps the page.** The pane shows the current selection, else a map hover preview, else the remembered node (`DocumentPanel.tsx:299-306`). Clicking the selected Explorer row, clicking empty map water, and Esc all set the selection to nothing (`MapView.tsx:329-332`, `606-609`). The page therefore stays.
- **Re-selecting works.** Selecting any node, including the one just cleared, shows it straight away. The selection always wins over the memory.
- **First load is unchanged.** Nothing has ever been selected, so the pane still shows "Nothing chosen". The existing first-load checks still run before any selection (`browsertest-relationsrail.mjs:245-249`, `289-290`).
- **The browser check would fail on today's code.** Before the fix the pane's node would be empty after each clear, so the "leaves the Document on the node it was reading" check at line 361 fails. Each gesture also confirms the node was selected beforehand, so the test cannot pass on nothing.
- **Other tests are not broken.** The two source-grep checks at lines 624-626 ignore comments and still pass. No other test script asserts the old empty pane.
- **Scope is respected.** Nothing under `src/ds/**` was edited.

Optional:
1. **The card's last "Done when" line is not done.** The receipt in the design project that marks OB-240 done has not been written, so the card is not fully closed. It needs the merged commit's sha and your go-ahead, so waiting until after merge is reasonable. It must say it restores clause 2 and supersedes OB-260 for this case.
2. **One test label is now misleading.** `browsertest-relationsrail.mjs:624` says "no resting-node fallback remains in the Document pane". The check itself still passes, because it only bans the old root fallback and the old history stack. But the pane now does keep a resting node of its own, so the wording should say "no root fallback".
3. **Nothing was type-checked or linted.** The pane sets state while rendering, behind a guard. That is React's standard pattern and should satisfy the repo's linter. But no other code in the repo does this, so `npm run verify` is the only real confirmation. I could not run it, because it needs package installs that would create files.
4. **Small cosmetic edge case.** With nothing selected, hovering the map cell of the node the pane is already resting on shows the "previewing" banner above that same page (`DocumentPanel.tsx:305`). It is harmless, and the card does not cover it.
5. **The memory outlives a bus reset.** If anything calls `bus.reset()`, the selection clears but the pane keeps its remembered node, because `reset` cannot reach the pane's own state. The plan already recorded this, and nothing calls it today.

Noticed outside this card's scope:
- The design-system copies in `src/ds/chrome/PreviewBanner.tsx:37` and `src/ds/chrome/PanePlaceholder.tsx:40` still say the pane "does NOT keep the last node". They now contradict the app. The card puts them out of scope, so the design agent should amend them, and the receipt is where to say so.
- The Neighborhood pane still falls back to the root page when nothing is selected. The card does not mention it.

Assumptions: I took "Do NOT create files" to rule out installing packages, so I could not run anything. I judged the conditional render-time state update to be lint-safe from React's documented pattern, not from a lint run. I did not re-check design-project records; I relied on the plan's account of OB-209 and OB-260.

FLAG: conflict: The card was written by an agent and moved to Ready, and this change reverses a recorded owner ruling (OB-209 clause 4, cleared as OB-260 on 2026-09-27). Does the owner confirm that OB-240 clause 2 overrides it, so the receipt can say "supersedes OB-260"?