Accept the maphover setup-only edit. "Unchanged" means the assertions, and the preset moved because this lane carries #416 on purpose. Keep #416's preset in this PR.

Then fix all four must-fixes:
1. Repair the raw newline in PROVENANCE.json:796, and add a vitest that JSON.parses the file so this can't happen again.
2. A floor limits how far a drag can go (through clampDesk). It is not a CSS minWidth. When the row is narrower than the sum of the floors, panes shrink as they did before (minWidth: 0), and the page never scrolls sideways. Lay the 14px strip over the existing 12px gutter, as RailFrame does, so a seam costs nothing extra. The new driver must assert there is no page-level horizontal overflow at 1100px and at 1280 with the sidebar open, and that every pane and handle can be reached.
3. Run the full npm run test:browser. Run browsertest-studiodesk on base 72206e8 in the same environment to prove whether its failure is environmental. Skip the two Firefox drivers for the same reason as #415.
4. Receipt: you can't write to the design project. Put the receipt's text in the run log, with the open assumptions (no done when: text in the checkout, and the floors were chosen). The owner files it with the final sha after merge.

Also take optional 1: don't store fractions when a gesture didn't move. It is the same bug as #372.