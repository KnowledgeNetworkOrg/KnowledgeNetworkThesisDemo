Failures: none

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run build`
- `npm run test`
- `npm run verify`
- `grep -rn "'inside itself'\|'already adjacent'" src/` (via Grep tool: only `src/ds/graph/DropVerdict.tsx:109`)

All passed: build succeeded, 64 test files / 931 tests passed, desktop typecheck and lint clean. No lockfile changed.

Left out: `npm run test:browser` — not part of `verify` or CI; it drives the machine's installed Edge and starts vite dev servers. The plan's interactive drag check (drag a group over its own gap, observe the struck line, pill, unchanged undo) needs a real browser and a person, so it was not run.

Verify: ran — passed (`npm run build`, `npm run test`, `npm run verify`; the stated grep also matches only `DropVerdict.tsx`).