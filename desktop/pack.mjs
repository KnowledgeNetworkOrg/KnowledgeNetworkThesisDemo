// `npm run pack` — build the web app, build the desktop shell, then package one
// portable Windows .exe.
//
// The same three steps `start.mjs` runs, with electron-builder as the third
// instead of electron. Order matters: electron-builder reads `desktop/out/` and
// copies the ROOT `dist/` through `extraResources` (see electron-builder.yml),
// so both builds have to exist before it starts.
//
// NO CI JOB RUNS THIS. Packaging downloads Electron and is Windows-only, and
// `desktop/` exists precisely so `.github/workflows/code-verify.yml` never
// touches Electron (#201). This is a hand-run command, on purpose.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

function run(cmd, args, cwd, env) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ...env } })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run('npm', ['run', 'build'], ROOT)
run('node', ['build.mjs'], HERE)
// `--win portable` on x64: a single self-contained .exe, no installer — the
// owner's decision on #203. Windows-only on purpose; there is no macOS or Linux
// target (macOS signing would need a Mac anyway).
run('npx', ['electron-builder', '--win', 'portable', '--x64'], HERE)
