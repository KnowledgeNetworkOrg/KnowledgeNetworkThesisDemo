// TEMPORARY (2026-08-22) — the driver for the temporary "Reset data" pill in
// src/instruments/walkdesk/WalkActionBar.tsx. Delete all three together.
//
// Two questions a unit test cannot answer, because both are about what the app
// does at BOOT with bytes that were already in the browser:
//
//   1. Does a stale payload actually present as a broken plan rather than as an
//      error? This driver writes the shape an OLDER build would have left —
//      a container with no `key` — and asserts the app comes up on the SEED with
//      no page error. That is the whole failure mode: the reader cannot tell
//      "older build" from "corrupt" (no stored payload carries a version field),
//      so it silently discards and reseeds, and the plan is simply gone.
//   2. Does the reset pill clear exactly what it owns — the draft, the saved
//      walks and panel layout, ORPHANS included — and does the app boot clean
//      afterwards? The orphan is the interesting half: #144 retired WalkToolbox,
//      so a `pkt.floating-panel.*` key it wrote is still in the browser with no
//      module left that names it.
//   3. Does it leave a presenter's lecture notes alone (#331)? It used to sweep
//      every `pkt.` key, and presenter mode (#267) saves its notes, categories
//      and deck layout under that same prefix, so one click erased them.
//
// Spawns vite itself — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/drive-reset.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5203
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let viteOut = ''
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not become ready:\n' + viteOut)), 30000)
  const watch = (d) => {
    viteOut += String(d)
    if (viteOut.includes('localhost:')) {
      clearTimeout(t)
      res()
    }
  }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

const errors = []
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}
const pass = (msg, detail = '') => console.log('PASS ', msg, detail)

const pktKeys = () =>
  page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('pkt.'))
      .sort(),
  )

// what a presenter left behind — a note typed at the lectern, a category they
// minted, where they put the deck. Reset must hand these back byte for byte.
const LECTURE = {
  'pkt.lecture.notes.v1:draft': JSON.stringify({
    notes: [{ id: 'n1', text: 'typed at the lectern — Reset must not take this', stop: 0, when: '12:04', at: 1 }],
    prepared: {},
  }),
  'pkt.lecture.categories.v1': JSON.stringify([{ key: 'mine', glyph: '!', label: 'my own', wash: 'red' }]),
  'pkt.lecture.habits.v1': JSON.stringify({ duringWidth: 320 }),
}
// a divider width no drag or default produces, so its survival is unambiguous.
// The pane writes its DEFAULT back as soon as it mounts, so after the reset the
// key may well exist again — the check is that THIS value is gone.
const CONNECTIONS_WIDTH_KEY = 'kn-connections_leftWidth'
const SEEDED_WIDTH = '237'

// ── seed a browser that already holds a stale payload ──────────────────────
// The draft is the shape an older build wrote: a container carrying `variants`
// but NO `key`. readStop() rejects that as structural damage — correctly, it
// cannot hang choice/collapse/rename off a container with no identity — and the
// rejection takes the whole plan with it. Plus an ORPHAN panel rect from the
// retired WalkToolbox, which no current module knows the name of, a saved
// Connections width, and a presenter's lecture data.
await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(({ lecture, widthKey, width }) => {
  localStorage.clear()
  localStorage.setItem(
    'pkt.walkdesk.draft',
    JSON.stringify({
      stops: [
        { node: 'web-http-rest', variants: [] },
        { title: 'Older build wrote me', variants: [{ id: 'v0', label: '', steps: [] }] },
      ],
      choices: {},
      withOptionals: true,
    }),
  )
  localStorage.setItem('pkt.walks.saved', JSON.stringify([]))
  localStorage.setItem('pkt.floating-panel.walk-toolbox', JSON.stringify({ x: 40, y: 40, w: 200, h: 300 }))
  localStorage.setItem(widthKey, width)
  for (const [k, v] of Object.entries(lecture)) localStorage.setItem(k, v)
}, { lecture: LECTURE, widthKey: CONNECTIONS_WIDTH_KEY, width: SEEDED_WIDTH })

const seeded = await pktKeys()
console.log('seeded keys =', JSON.stringify(seeded))
if (seeded.length !== 6) fail(`expected 6 seeded pkt. keys, got ${seeded.length}`)

// ── 1. a stale payload is silently discarded, not reported ─────────────────
await page.reload()
await page.waitForTimeout(600)
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(500)

const walkEditor = page.locator('[data-walk-editor]')
if (!(await walkEditor.isVisible())) fail('walk editor pane not visible under the Plan preset')
else pass('the app boots on a stale payload without erroring')

// the seed is 5 stops; the stale draft claimed 2. Whatever is on the road, the
// point is that it is NOT the stored plan — the container was dropped whole.
const roadLeaves = () => page.locator('[data-road-root] [data-node]').count()
const afterStale = await roadLeaves()
console.log('road [data-node] after booting on the stale draft =', afterStale)
if (afterStale <= 1) fail(`expected the seed plan after a rejected payload, got ${afterStale} node(s)`)
else pass('a structurally-stale draft silently reseeds — the plan is gone, with no error', `${afterStale} nodes`)

await page.screenshot({ path: `${OUT}/reset-01-stale.png` })

// ── 2. the reset pill clears what it owns, orphan included, and keeps the lecture
const actionBar = page.locator('[data-pane-actionbar]')
if (!(await actionBar.isVisible())) fail('action bar not visible on the walk editor pane')

const resetPill = actionBar.getByText('Reset data')
if (!(await resetPill.isVisible())) fail('no "Reset data" pill on the action bar')
else pass('the temporary Reset data pill is on the bar')

await resetPill.click()
await page.waitForTimeout(900) // it reloads the page itself

const afterReset = await pktKeys()
console.log('pkt keys after reset =', JSON.stringify(afterReset))
const lectureKeys = Object.keys(LECTURE).sort()
if (JSON.stringify(afterReset) !== JSON.stringify(lectureKeys))
  fail(`expected only the lecture keys left under pkt., have ${JSON.stringify(afterReset)}`)
else pass('the draft, the saved walks and the orphaned panel rect are gone — only the lecture keys are left')

const lectureAfter = await page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), lectureKeys)
const lost = lectureKeys.filter((k) => lectureAfter[k] !== LECTURE[k])
if (lost.length) fail(`the reset changed or removed a presenter's lecture data: ${JSON.stringify(lost)}`)
else pass("a presenter's notes, categories and deck layout survive the reset, byte for byte")

const widthAfter = await page.evaluate((k) => localStorage.getItem(k), CONNECTIONS_WIDTH_KEY)
if (widthAfter === SEEDED_WIDTH) fail(`the Connections pane's saved width survived the reset (${CONNECTIONS_WIDTH_KEY} = ${widthAfter})`)
else pass("the Connections pane's saved width is gone", `(now ${widthAfter ?? 'unset'})`)

// ── 3. and the app comes back up clean ─────────────────────────────────────
await page.waitForTimeout(400)
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(500)
if (!(await page.locator('[data-walk-editor]').isVisible())) fail('walk editor did not come back after the reset reload')
else pass('the walk editor boots clean after the reset')

await page.screenshot({ path: `${OUT}/reset-02-after.png` })

await browser.close()
vite.kill()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log(`\nall checks passed — shots at ${OUT}/reset-01-stale.png, reset-02-after.png`)
