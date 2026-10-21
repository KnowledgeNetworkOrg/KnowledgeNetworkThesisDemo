1. Re-vendor `design-system/tokens/elevation.css` verbatim over `src/tokens/elevation.css`, adding `--lift-group` (and the DS's `--scrim`); existing lift values stay identical.
2. Re-vendor `design-system/tailwind/kn-theme.css` verbatim over `src/tokens/kn-theme.css`, adding `--shadow-lift-group` (and `--color-scrim`).
3. Change the one resting-shadow literal at `src/ds/group/VersionedGroup.tsx:1841` to `boxShadow: carrying ? 'var(--lift-drag)' : 'var(--lift-group)'`.
4. Update `src/ds/PROVENANCE.json`: refresh the two token hashes and `syncedAt` per the recorded recipe, note the re-vendor, and reword the OB-073 historical quote so its copied literal no longer trips the done-when grep.
5. Confirm the literal now appears only in the two token files and run the full verification.

Files: `src/tokens/elevation.css`, `src/tokens/kn-theme.css`, `src/ds/group/VersionedGroup.tsx`, `src/ds/PROVENANCE.json`

Out of scope: the CHOSEN `--lift-group` value (do not re-tune it), the files under `design-system/` (read-only), and the rest of the `boxShadow` line/other component shadows (do not overwrite the line from an older copy or widen this beyond the group card).

Verify: Open a group card in the running app and inspect its resting `box-shadow`; it still paints the same two bark shadows, and changing `--lift-group` in DevTools immediately changes that card (dragging still switches it to `--lift-drag`), proving the card now reads the token rather than a literal.
```
npm run build
npm run test
npm run verify
```

Assumptions: I assume `PROVENANCE.json` must be updated (its own note and `src/tokens/README.md` require hashes/`syncedAt` on a re-vendor, and its OB-073 history currently contains the searched literal). I also assume "re-vendor" means copying the DS files wholesale, including their comment/`--scrim`/`--color-scrim` additions, since no existing token consumes them and the README requires byte-identical copies.