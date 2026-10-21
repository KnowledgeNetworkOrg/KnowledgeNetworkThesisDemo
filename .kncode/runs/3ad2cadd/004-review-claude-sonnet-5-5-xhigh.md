**Must fix:**
none

**Optional:**
none

**Nit:**
none

**Noticed outside this card's scope:**
- The top-level `syncedAt` in `src/ds/PROVENANCE.json` (line 11) still reads `2026-08-12`, while the per-file entries carry later dates. This was already stale before this change, and the card does not ask for it.

**What I checked against the card's "Done when" lines:**
- **Token defined:** `src/tokens/elevation.css:19` has `--lift-group: 0 1px 2px rgba(53, 49, 42, 0.06), 0 3px 6px -4px rgba(53, 49, 42, 0.20)`, the exact value from the card. `src/tokens/kn-theme.css:341` has `--shadow-lift-group` with the same value.
- **Copies match the design system:** `elevation.css` is byte-identical to `design-system/tokens/elevation.css` after CRLF normalisation. `kn-theme.css` differs from the design-system copy only on line 113, the documented `DomainDot.tsx` path repoint, which keeps `src/ds/graph/DomainDot.tsx` in place of the design system's `components/graph/DomainDot.jsx`.
- **Card shadow:** `src/ds/group/VersionedGroup.tsx:1841` reads `boxShadow: carrying ? 'var(--lift-drag)' : 'var(--lift-group)'`, as the card requires. It matches the design-system reference at `design-system/components/group/VersionedGroup.jsx:990`.
- **Grep:** `grep -rn "3px 6px -4px" src/` finds only `src/tokens/elevation.css:19` and `src/tokens/kn-theme.css:341`. The OB-073 history line in `PROVENANCE.json` was reworded so it no longer carries the old literal.
- **Provenance hashes:** the recorded `elevation.css` hash `ebddc0c4…` and `kn-theme.css` hash `b9075bcb…` both reproduce with the recorded recipe (sha256 after CRLF normalisation). The note's design-system `kn-theme.css` hash `43f82415…` also reproduces. `PROVENANCE.json` still parses as JSON.
- **Scope:** the changes are in the two token files, one line in `VersionedGroup.tsx`, and `PROVENANCE.json`. `--scrim` and `--color-scrim` came along with the verbatim re-vendor; nothing reads them, and the `PROVENANCE.json` notes record this.

Assumptions: I could not run `npm run verify`, because `node_modules` is absent and I was told not to create files. The "`npm run verify` passes" line is therefore untested here. I judged from the code that nothing else should break. The tests that read the tokens (`src/ds/adherence.test.ts`, `src/corpus/edgecolor.test.ts`) only look at the colour definitions, and `src/ds/barrel.test.ts` only checks that `PROVENANCE.json` parses. I treated rewording the OB-073 history line as required by the card's grep, not as scope creep.