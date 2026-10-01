// devserver.mjs — starts THIS checkout's vite dev server for a browser driver, on a port
// nothing else is holding. Imported by every driver in this folder; it is not a driver.
//
// WHY IT EXISTS (#364). Every driver used to start its own vite on a port written into the
// script, with --strictPort (fail rather than move to another port). One checkout running
// them one after another was fine; two checkouts running at the same time were not — the
// second reached a port the first already held, vite quit, and the driver failed for a
// reason that had nothing to do with the app. Here the operating system hands out the port
// instead: it is asked for one nobody holds, and vite is given exactly that one, so no two
// drivers — in one run, or in two checkouts' runs — start from the same number.
//
// WHICH CHECKOUT. The root is worked out from THIS FILE's location, never from a path
// written down (#362), so a driver run from a worktree serves that worktree's app.
//
// THE RACE, AND WHY IT IS HANDLED. A port is free when it is asked about and vite binds it a
// moment later; another process can take it in between. Vite then quits at once
// (--strictPort), so a vite that quits before it is serving is tried again on a fresh port,
// up to ATTEMPTS times. A vite that is merely slow (READY_MS) is not retried — that is not a
// port problem — and the last attempt's output is what the error shows.
//
// PINNING. `port` asks for one particular port instead (the probes' PROBE_PORT, for pointing
// a browser of your own at the server). A pinned port is tried once and never replaced.
//
// `env` is added to vite's environment (browsertest-coursecorpus sets VITE_CORPUS).
// Returns { vite, port }: the child process, to be killed when the driver is done, and the
// port it is serving on.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ATTEMPTS = 5
const READY_MS = 30000

/** ask the operating system for a port nobody holds, then let go of it */
const freePort = () =>
  new Promise((res, rej) => {
    const probe = createServer()
    probe.once('error', rej)
    probe.listen(0, () => {
      const { port } = probe.address()
      probe.close(() => res(port))
    })
  })

/** one try: vite on exactly `port`. Resolves with the child once it says it is serving;
 *  rejects with `.exitedEarly` set when it quit before that (the port was taken after all). */
const boot = (port, env) =>
  new Promise((res, rej) => {
    const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    })
    let out = ''
    const t = setTimeout(() => { vite.kill(); rej(new Error('vite did not become ready:\n' + out)) }, READY_MS)
    const watch = (d) => {
      out += String(d)
      if (out.includes('localhost:')) { clearTimeout(t); res(vite) }
    }
    vite.stdout.on('data', watch)
    vite.stderr.on('data', watch)
    vite.on('exit', (c) => {
      clearTimeout(t)
      rej(Object.assign(new Error('vite exited early ' + c + ':\n' + out), { exitedEarly: true }))
    })
  })

export async function startVite({ env = {}, port } = {}) {
  const pinned = port ? Number(port) : null
  if (pinned !== null && !Number.isInteger(pinned)) throw new Error(`a pinned port must be a whole number, not "${port}"`)
  for (let attempt = 1; ; attempt++) {
    const chosen = pinned ?? (await freePort())
    try {
      return { vite: await boot(chosen, env), port: chosen }
    } catch (e) {
      if (!e.exitedEarly || pinned !== null || attempt === ATTEMPTS) throw e
    }
  }
}
