Failures: none

Commands run:
- `npm ci`
- `npm ci --prefix desktop`
- `npm run verify` (build, desktop typecheck, lint, all tests: 67 files / 950 tests)
- `npx vitest run src/state/walk/authordraft.unsaved.test.ts src/state/walk/draftpersist.test.ts` (32 tests)

Left out: `npm run test:browser` and the plan's manual browser check — they start a Vite server and drive the system's installed Edge, which this step forbids keeping running and which CI excludes for that reason.

Verify: ran — passed (the plan's `npm run verify`; its separate `build`/`test` commands are included in that script). The plan's end-to-end "edit, reload the app, and see the Load warning" was not run: it needs a browser and a running dev server, and the module-reload tests covering it pass.