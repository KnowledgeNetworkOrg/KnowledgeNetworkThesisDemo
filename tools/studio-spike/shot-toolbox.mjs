// Verification for the Walk Editor's pane-local actions (#144, replacing #54's
// floating Toolbox): a PaneActionBar — a docked, labelled row of pills under the
// pane's header (src/instruments/walkdesk/WalkActionBar.tsx, mounted via the
// Instrument registry's `actionBar` slot, not inside WalkEditorView's own render).
//
// Same idiom as browsertest-studiodesk.mjs beside this file — own the vite lifecycle (backgrounded
// dev servers die on this machine), msedge headless, collect pageerror/console
// errors, exit nonzero on any. What this driver provokes:
//   1. MOUNT — switch to the Plan preset; the walk editor pane appears with its
//      action bar docked under the header ([data-pane-actionbar]), all five
//      buttons present with their real WORDS (icon+label pills, not icon-only —
//      the whole point of the #144 redesign), extract included: it is the one
//      pill most at risk of being silently dropped in a port (see #144, #70).
//   2. ADD A NODE — clicking "Add node" inserts one fresh slot on the road
//      (a [data-node] under [data-road-root]); the leaf count goes up by one.
//   3. NEW WALK — clicking "New walk" resets the draft to a single empty slot;
//      the road drops to exactly one [data-node]. Undoable (not asserted here).
// The bar has no drag/resize/auto-hide/persist of its own (unlike the FloatingPanel
// it replaced) — it only dims on idle (PaneActionBar's own presence clock), which
// does not block clicks, so this driver does not need to "wake" it first.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5199
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

await page.goto(`http://localhost:${PORT}/`)
await page.waitForTimeout(600)

// ── 1. Plan preset → walk editor + action bar mount ────────────────────────
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(500)

const walkEditor = page.locator('[data-walk-editor]')
if (!(await walkEditor.isVisible())) fail('walk editor pane not visible under the Plan preset')

const actionBar = page.locator('[data-pane-actionbar]')
if (!(await actionBar.isVisible())) fail('action bar not visible on the walk editor pane')

// TEMPORARY (2026-08-22): "Reset data" is a debugging pill, not one of the bar's
// real actions — src/instruments/walkdesk/WalkActionBar.tsx carries the marker.
// Counted separately so this driver stays green while it exists AND goes back to
// a bare 5 the moment it is deleted, without anyone having to remember to edit
// a hardcoded 6 back down.
const TEMP_LABELS = ['Reset data']
const PERMANENT_LABELS = ['New walk', 'Add node', 'Group', 'Optional', 'Extract']

const buttons = actionBar.locator('button')
// the whole point of #144: the WORD is what names the action now, not the title
// tooltip. Assert on visible text, and check "Extract" explicitly — it is the one
// pill with no drawn mark of its own and the easiest to drop silently in a port.
const labels = await buttons.evaluateAll((els) => els.map((e) => e.textContent?.trim() || ''))
const tempSeen = TEMP_LABELS.filter((t) => labels.some((l) => l.includes(t)))
console.log('action bar labels =', JSON.stringify(labels))
console.log(
  'action bar buttons =',
  labels.length,
  `(expect ${PERMANENT_LABELS.length} real + ${tempSeen.length} temporary${tempSeen.length ? ' — ' + tempSeen.join(', ') : ''})`,
)
if (labels.length !== PERMANENT_LABELS.length + tempSeen.length) {
  fail(`unaccounted action-bar buttons: got ${labels.length}, expected ${PERMANENT_LABELS.length} real + ${tempSeen.length} temporary`)
}
for (const need of PERMANENT_LABELS) {
  if (!labels.some((t) => t.includes(need))) fail(`no action-bar button labelled "${need}"`)
}
await page.screenshot({ path: `${OUT}/toolbox-plan.png` })
console.log('toolbox-plan.png taken')

// ── 2. add a node → one more slot on the road ──────────────────────────────
const roadLeaves = () => page.locator('[data-road-root] [data-node]').count()
const before = await roadLeaves()
// not exact: the glyph span shares the button's text node with the label
// ("⊙Add node"), so an exact match against "Add node" alone never hits
await actionBar.getByText('Add node').click()
await page.waitForTimeout(250)
const afterAdd = await roadLeaves()
console.log('road [data-node]: before =', before, '· after add-node =', afterAdd, '(expect +1)')
if (afterAdd !== before + 1) fail(`expected leaf count ${before + 1} after add-node, got ${afterAdd}`)

// ── 3. new walk → draft resets to a single empty slot ──────────────────────
await actionBar.getByText('New walk').click()
await page.waitForTimeout(250)
const afterNew = await roadLeaves()
console.log('road [data-node] after new-walk =', afterNew, '(expect 1 — one empty slot)')
if (afterNew !== 1) fail(`expected exactly 1 leaf after new-walk, got ${afterNew}`)

await browser.close()
vite.kill()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE — all assertions passed')
