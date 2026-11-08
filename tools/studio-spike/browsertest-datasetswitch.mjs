// browsertest-datasetswitch.mjs — #520: the header's dataset switch, one running app, two corpora.
//
// A TEST. The dataset is read from the address (`?corpus=cs2023`), and the switch in the
// header bar loads the page again with the address changed. This opens the app with NO
// VITE_CORPUS and no `corpus` value, so the build default (teaching) is what it finds, then:
//   1. teaching is showing, and the switch marks it;
//   2. a walk saved under today's key belongs to teaching: cs2023 does not list it, and
//      switching back finds it again with all its stops;
//   3. pressing the dataset that is already showing does nothing;
//   4. an unknown `corpus` value opens teaching, and the switch keeps other query values;
//   5. a lecture started from cs2023 opens a projector window on the same dataset.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-datasetswitch.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// how many routes cs2023 lists comes from the data, not from a number typed here
const CS2023_ROUTES = JSON.parse(readFileSync(join(REPO, 'tools/cs2023import/cs2023_map.json'), 'utf8')).routes.length
/** teaching's shipped walks; a saved walk comes after them */
const TEACHING_WALKS = 2
const SAVED_TITLE = 'Driver saved walk'
/** three places teaching has and cs2023 does not */
const SAVED_STOPS = ['stk-dns-naming', 'stk-ip-routing', 'stk-tcp-udp']

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()
const BASE = `http://localhost:${PORT}/`

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
  return cond
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1750, height: 950 } })
context.on('page', (p) => p.on('pageerror', (e) => errors.push('pageerror: ' + e.message)))
const page = await context.newPage()

const pill = (name) => page.locator('[aria-label="studio-dataset"]').getByRole('button', { name, exact: true })
const pressed = (name) => pill(name).getAttribute('aria-pressed')
const search = () => new URL(page.url()).searchParams
const settle = async () => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1400)
}
const walkButtons = () => page.locator('[aria-label="trail-strip"] button', { hasText: '▶' })

/** the Trail pane open, which is where every walk the app knows is listed */
const openTrail = async () => {
  if ((await page.locator('[aria-label="studio-pane-trail"]').count()) > 0) return
  if ((await page.locator('[aria-label^="studio-inst-"]').count()) === 0) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
  await page.locator('[aria-label="studio-inst-trail"]').click()
  await page.waitForTimeout(500)
}

/** press the other dataset's button and wait for the page to load again on its address */
const switchTo = async (name) => {
  await Promise.all([page.waitForURL((u) => u.searchParams.get('corpus') === name), pill(name).click()])
  await settle()
}

try {
  // ── 1. no `corpus` value: teaching, marked in the header ──────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  ok('1: the header carries the dataset switch', (await page.locator('[aria-label="studio-dataset"] button').count()) === 2)
  ok('1: teaching is marked', (await pressed('teaching')) === 'true')
  ok('1: cs2023 is not', (await pressed('cs2023')) === 'false')
  await openTrail()
  ok('1: the Walks list is teaching\'s', (await walkButtons().count()) === TEACHING_WALKS, String(await walkButtons().count()))

  // ── 2. a walk saved under today's key is teaching's ───────────────────────────────────
  await page.evaluate(
    ([title, stops]) => {
      localStorage.setItem(
        'pkt.walks.saved',
        JSON.stringify({
          v: 1,
          data: [{ id: 'authored-driver-saved-walk', title, description: '', stops: stops.map((id) => ({ id, note: '' })) }],
        }),
      )
    },
    [SAVED_TITLE, SAVED_STOPS],
  )
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  await openTrail()
  ok('2: teaching lists the saved walk after its own', (await walkButtons().count()) === TEACHING_WALKS + 1 && (await page.locator('[aria-label="trail-strip"]').innerText()).includes(SAVED_TITLE))

  await switchTo('cs2023')
  ok('2: the address names cs2023', search().get('corpus') === 'cs2023', page.url())
  ok('2: cs2023 is marked', (await pressed('cs2023')) === 'true' && (await pressed('teaching')) === 'false')
  await openTrail()
  const routes = await walkButtons().count()
  ok('2: cs2023 lists its own routes', routes === CS2023_ROUTES, `${routes} routes, expected ${CS2023_ROUTES}`)
  ok('2: and not teaching\'s saved walk', !(await page.locator('[aria-label="trail-strip"]').innerText()).includes(SAVED_TITLE))
  ok('2: the saved walk is still in storage, under teaching\'s key', await page.evaluate(() => localStorage.getItem('pkt.walks.saved') !== null))

  // ── 3. the dataset that is showing: pressing it does nothing ─────────────────────────
  await page.evaluate(() => { window.__stillHere = true })
  await pill('cs2023').click()
  await page.waitForTimeout(800)
  ok('3: pressing the current dataset does not load the page again', await page.evaluate(() => window.__stillHere === true))

  await switchTo('teaching')
  ok('2: the address names teaching', search().get('corpus') === 'teaching', page.url())
  ok('2: teaching is marked again', (await pressed('teaching')) === 'true' && (await pressed('cs2023')) === 'false')
  await openTrail()
  ok('2: the saved walk is back', (await walkButtons().count()) === TEACHING_WALKS + 1 && (await page.locator('[aria-label="trail-strip"]').innerText()).includes(SAVED_TITLE))
  await page.locator('[aria-label="trail-strip"] button', { hasText: SAVED_TITLE }).click()
  await page.waitForTimeout(500)
  const dock = (await page.locator('[data-walk-dock]').innerText().catch(() => '')).replace(/\s+/g, ' ')
  ok('2: with all its stops', dock.includes(`1 / ${SAVED_STOPS.length}`), dock)

  // ── 4. an unknown value is teaching, and the switch keeps what else the address holds ──
  await page.goto(BASE + '?corpus=nonsense&keep=1', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  ok('4: ?corpus=nonsense opens teaching', (await pressed('teaching')) === 'true' && (await pressed('cs2023')) === 'false')
  await Promise.all([page.waitForURL((u) => u.searchParams.get('corpus') === 'cs2023'), pill('cs2023').click()])
  await settle()
  ok('4: the switch keeps the other query values', search().get('keep') === '1', page.url())
  ok('4: and lands on cs2023', (await pressed('cs2023')) === 'true')

  // ── 5. a lecture started from cs2023 opens its projector on cs2023 ────────────────────
  await page.goto(BASE + '?corpus=cs2023', { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  const [projector] = await Promise.all([
    context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
    (async () => {
      await page.locator('[data-toolbar-hook="present"]').click()
      await page.locator('[role="dialog"][aria-label="Start presenting"]').waitFor()
      await page.keyboard.press('Enter')
    })(),
  ])
  if (ok('5: starting a lecture opens the projector window', projector !== null)) {
    await projector.waitForLoadState('domcontentloaded')
    const at = new URL(projector.url())
    ok('5: it is the projector', at.searchParams.has('projector'), projector.url())
    ok('5: and it names cs2023', at.searchParams.get('corpus') === 'cs2023', projector.url())
  }
} finally {
  await browser.close()
  vite.kill()
}

console.log(checks.join('\n'))
if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nPASS — the header switch changes the dataset, saved work stays with its dataset, and the projector follows')
