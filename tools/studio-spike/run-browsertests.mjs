// run-browsertests.mjs — runs every browser test in this folder, four at a time,
// and fails if any of them really fails.
//
// WHY THIS EXISTS. These tests were written one at a time, each for the change it
// was checking, and then only ever run by the person making that change. A test
// nobody runs is not a regression guard; it is a note. One of them (#234) had
// rotted silently and was only discovered when someone ran it by hand months later.
//
// WHY IT RUNS FOUR AT A TIME. Each test spawns its own vite on its own fixed port
// with --strictPort, so two tests whose ports collide are a failed run, not speed —
// which used to mean strictly one at a time. But almost every driver owns a unique
// port (two pairs share one on main; #364 tracks what fixed ports cost across
// checkouts), and almost all of a driver's wall time is deliberate waiting:
// measured 2026-09-24 across the drivers as of #341, 473 `waitForTimeout` calls
// total 228 seconds of sleep, against about 4 s each of starting vite, launching
// Edge and loading the page. Waiting is the part that parallelizes, so the pool
// below hands work out in order, never starting two drivers that share a port, and
// starts four workers (#370). --workers=N or KN_BROWSER_WORKERS changes the count.
//
// THE FOUR VITES SHARE ONE PRE-BUNDLE CACHE (node_modules/.vite), which with a warm
// cache they only read. A cold cache was the one thing four at a time could plausibly
// break, so it was run once cold (#371 review, 2026-09-24, cache deleted): 31/31 in
// 146s, no 504 Outdated-Optimize-Dep reload, no flake.
//
// A driver that fails is retried once, alone, after the pool has drained. If the
// retry passes, the row says FLAKY and the suite stays green — an intermittent should
// not turn a pull request red for no change. A failure that survives its retry is a
// failure. The intermittent this was written for (#365) was the walkdock driver
// measuring the map before the webfaces had landed; it now waits for them, so a FLAKY
// row is news, not a known quantity.
//
// It does NOT run the measurements (`probe-*`) or the screenshot scripts (`shot-*`).
// Those are instruments, not tests: the measurements print numbers for a person to
// read and one of them asserts a speed ratio, which is exactly the assertion that
// fails randomly on a loaded machine.
//
// Run:  npm run test:browser                 — every test
//       npm run test:browser -- walk         — only tests whose name contains "walk"
//       npm run test:browser -- --workers=1  — one at a time
// The `=` matters: `-- --workers 2` would make "2" the name filter and find no test.
import { readdirSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')

// `browsertest-` is the name a test in this folder should carry. `drive-` is the
// invented prefix the older ones still use; both are collected while that rename
// is outstanding, so a test cannot fall out of the run by being renamed.
const tests = readdirSync(HERE)
  .filter((f) => (f.startsWith('browsertest-') || f.startsWith('drive-')) && f.endsWith('.mjs'))
  .sort()

const args = process.argv.slice(2)
const only = args.find((a) => !a.startsWith('-'))
/* An EXPLICIT worker count that cannot be used is worth stopping for, the same rule the port
   read below follows: silently running four when someone asked for "abc" or "0" hides the
   mistake behind a run that looks fine (reviewer nit on #371). Absent, four is the default. */
const workersArg = args.find((a) => a.startsWith('--workers='))?.slice('--workers='.length) ?? process.env.KN_BROWSER_WORKERS
let workers = 4
if (workersArg !== undefined) {
  const n = Number(workersArg)
  if (!Number.isFinite(n) || n < 1) {
    console.error(`the worker count must be a number >= 1, not "${workersArg}" (--workers=N or KN_BROWSER_WORKERS)`)
    process.exit(1)
  }
  workers = Math.floor(n)
}

const chosen = only ? tests.filter((f) => f.includes(only)) : tests
if (!chosen.length) {
  console.error(only ? `no browser test matches "${only}"` : 'no browser tests found')
  process.exit(1)
}

// The pool must never run two tests that share a port, so each driver's port is
// read from its source: every driver declares `const PORT = <number>`. A driver
// that does not is one the scheduler cannot place, which is worth stopping for
// rather than guessing about.
const portOf = (f) => {
  const m = /^const PORT = (\d+)/m.exec(readFileSync(join(HERE, f), 'utf8'))
  if (!m) {
    console.error(`${f} does not declare "const PORT = <number>"; the runner cannot place it`)
    process.exit(1)
  }
  return Number(m[1])
}

const queue = chosen.map((f) => ({ f, port: portOf(f) }))
const atATime = Math.min(workers, chosen.length)
console.log(`running ${chosen.length} browser test${chosen.length === 1 ? '' : 's'}${atATime > 1 ? `, ${atATime} at a time` : ''}\n`)

const runOne = (t) =>
  new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(process.execPath, [join(HERE, t.f)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('close', (status) =>
      resolve({ ...t, secs: ((Date.now() - started) / 1000).toFixed(0), pass: status === 0, stdout, stderr }))
  })

const row = (name, verdict, secs, note = '') =>
  console.log(`${verdict.padEnd(5)} ${name.padEnd(34)} ${secs.padStart(3)}s${note ? ` — ${note}` : ''}`)

const failed = []
const inUse = new Set()
const wake = []
const release = () => { while (wake.length) wake.pop()() }

const worker = async () => {
  for (;;) {
    let i = queue.findIndex((t) => !inUse.has(t.port))
    while (i === -1 && queue.length) {
      await new Promise((res) => wake.push(res))
      i = queue.findIndex((t) => !inUse.has(t.port))
    }
    if (i === -1) return
    const [t] = queue.splice(i, 1)
    inUse.add(t.port)
    const r = await runOne(t)
    inUse.delete(t.port)
    release()
    row(r.f, r.pass ? 'PASS' : 'FAIL', r.secs)
    if (!r.pass) failed.push(r)
  }
}

const startedAt = Date.now()
await Promise.all(Array.from({ length: atATime }, worker))

if (failed.length) {
  const n = failed.length
  console.log(`\nretrying ${n === 1 ? 'the failed driver' : `all ${n} failed drivers`} once, alone, with the machine quiet\n`)
}
const flaky = []
const hardFail = []
for (const r of failed) {
  const again = await runOne(r)
  if (again.pass) {
    flaky.push(r)
    row(r.f, 'FLAKY', again.secs, 'passed on retry')
  } else {
    /* Keep the RETRY's output too (reviewer finding on #371): it ran alone, on a quiet machine,
       so it is the run that says what really broke. The first run's tail is kept beside it,
       labelled — when the two differ, the difference IS the diagnosis (load-only timing, or a
       port/process the first run left behind). */
    hardFail.push({ ...r, retry: again })
    row(r.f, 'FAIL', again.secs, 'failed twice')
  }
}

const wall = ((Date.now() - startedAt) / 1000).toFixed(0)
const passed = chosen.length - failed.length + flaky.length
console.log(`\n${passed}/${chosen.length} passed${flaky.length ? ` (${flaky.length} flaky)` : ''} in ${wall}s`)

if (hardFail.length) {
  // the last few lines are where every one of these prints its own summary
  const tail = (out) => (out || '').trimEnd().split('\n').slice(-6).join('\n')
  for (const r of hardFail) {
    const runs = [
      ['first run', [tail(r.stdout), tail(r.stderr)].filter(Boolean).join('\n')],
      ['retry', [tail(r.retry.stdout), tail(r.retry.stderr)].filter(Boolean).join('\n')],
    ]
    console.error(`\nFAILED: ${r.f}\n` + runs.map(([label, out]) => `--- ${label} ---\n${out}`).join('\n'))
  }
  process.exit(1)
}
