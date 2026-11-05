Failures: none

Commands I ran:
- `npm run verify`
- `node tools/studio-spike/browsertest-presenter.mjs`
- `node tools/studio-spike/browsertest-presenter-panes.mjs`
- `node tools/studio-spike/browsertest-walkvisibility.mjs`
- `node tools/studio-spike/browsertest-walkdock.mjs`
- `npm run test:browser`

Left out: nothing

Verify: ran — passed. `npm run verify` built the app, typechecked `desktop/`, linted, and ran all 980 vitest tests (69 files), all green. The four named browser checks passed (103, 57, 22 and 132 checks respectively), and the whole browser suite passed 38/38. Dependencies were already installed, so no install ran and no lockfile changed.