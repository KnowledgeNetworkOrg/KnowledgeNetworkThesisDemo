PASS

Build and tests both succeeded for the part this change touched. Root verify steps pass (build, desktop typecheck, lint, 845 unit tests), and the desktop packaging path actually ran: `pack` produced `desktop/release/GraphDisclosureLab-0.0.0-portable.exe` (99.9 MB) with `resources/dist/index.html` copied, and the Electron smoke test passed all 14 checks against the real `app://` host. Lint still passes after a pack.

Commands run:
npm ci
npm run build
npm --prefix desktop run typecheck
npm --prefix desktop run build
npm run lint
npm run test
npm --prefix desktop run pack
npm --prefix desktop run smoke
npm run lint