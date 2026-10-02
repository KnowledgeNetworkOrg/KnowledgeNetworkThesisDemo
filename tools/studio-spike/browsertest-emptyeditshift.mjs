// browsertest-emptyeditshift.mjs — DS OB-273: the group card's PENCIL MOVES NOTHING, in FIREFOX
// as well as Edge, on a card with EMPTY fields and on one with FILLED ones.
//
// THE FAULT, and why this is its own test in two engines. On a card with an empty title,
// description and version name, pressing the pencil pushed the head row — the index, the controls,
// the version row — and the card's foot down by ~5px in Firefox (measured by the design side at
// dpr 1.5: card +4.57, index +5.12, version row +4.57). Edge measured 0.00, so every Chromium test
// we have could never see it. The cause is a missing baseline: an open `InlineText` with no value
// renders no children, Chromium synthesises a text baseline for an empty editable box anyway,
// Firefox does not, and the head row aligns on baselines. The fix is one rule in `tokens/base.css`
// (`.kn-inline-edit-selection:empty::before { content: '\200b' }`), which this app re-vendors — so
// a re-vendor that drops the rule fails here, in Firefox, and nowhere else.
//
// WHAT IS MEASURED, off the DOM and never a screenshot, all RELATIVE TO THE CARD'S OWN TOP so a
// card that merely scrolled does not read as moved: the card's height, the head index's top, the
// version row's top, and the minimise control's top — at rest, with the pencil on, and with it off
// again. The toggle must move every one of them by under half a pixel. Device scale 1.5, as the
// design side measured it; a fractional scale is where a baseline error shows up as sub-pixel drift.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-emptyeditshift.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const require = createRequire(REPO + '/package.json')
const { chromium, firefox } = require('playwright-core')

const { vite, port: PORT } = await startVite()

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
  return cond
}

/** the half-pixel tolerance: the fault is ~5px, a baseline-aligned row that is right reads 0.00 */
const TOLERANCE = 0.5

const runEngine = async (engine) => {
  const browser = engine === 'firefox'
    ? await firefox.launch({ headless: true })
    : await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1750, height: 950 }, deviceScaleFactor: 1.5 })
  page.on('pageerror', (e) => errors.push(`${engine} pageerror: ` + e.message))

  const road = () => page.locator('[data-road-root]')
  const chip = (node) => road().locator(`[data-rnode][data-node="${node}"]`)
  const card = () => road().locator('[data-rstage^="draft-"]').first()
  const open = () => card().locator('[contenteditable="true"]')
  const outsideMousedown = () => page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
  // the card's centre is under a step chip, so presence (which fades the controls in) is woken on the head row
  const wakeHead = async () => {
    const b = await card().boundingBox()
    await page.mouse.move(b.x + 30, b.y + 10)
    await page.waitForTimeout(250)
  }
  const pressPencil = async (label) => {
    await wakeHead()
    await card().getByLabel(label, { exact: true }).click()
    await page.waitForTimeout(350)
  }
  /** everything the toggle must not move, relative to the card's own top */
  const measure = () => card().evaluate((el) => {
    const top = el.getBoundingClientRect().top
    const rel = (n) => (n ? n.getBoundingClientRect().top - top : null)
    const index = el.querySelector('[data-grab] > span')
    const version = [...el.querySelectorAll('span, button, div')].find((n) => n.children.length === 0 && /^v\d+$/.test((n.textContent || '').trim()))
    const fold = el.querySelector('button[aria-label="minimize"], button[aria-label="maximize"]')
    return { height: el.getBoundingClientRect().height, index: rel(index), version: rel(version), controls: rel(fold) }
  })
  const delta = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] === null || b[k] === null ? null : b[k] - a[k]]))
  const still = (d) => Object.values(d).every((v) => v !== null && Math.abs(v) < TOLERANCE)
  const show = (d) => Object.entries(d).map(([k, v]) => `${k} ${v === null ? 'MISSING' : (v >= 0 ? '+' : '') + v.toFixed(2)}`).join(', ')

  /** rest -> pencil on -> pencil off, for the card as it stands */
  const toggleOnAndOff = async (label) => {
    const atRest = await measure()
    await pressPencil('edit')
    const whileOpen = await measure()
    ok(`${engine}, ${label}: the pencil opened the three lines`, (await open().count()) === 3, `${await open().count()} open`)
    await pressPencil('done editing')
    const backAtRest = await measure()
    ok(`${engine}, ${label}: every measured part exists (a missing one is a broken selector, not a pass)`,
      Object.values(atRest).every((v) => v !== null), JSON.stringify(atRest))
    const on = delta(atRest, whileOpen)
    const off = delta(atRest, backAtRest)
    ok(`${engine}, ${label}: pressing the pencil moves nothing`, still(on), show(on))
    ok(`${engine}, ${label}: pressing it again puts everything back`, still(off), show(off))
    return atRest
  }

  try {
    await page.goto(`http://localhost:${PORT}/`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(900)
    await page.getByLabel('studio-preset-plan').click()
    await page.waitForTimeout(600)

    // make one group: two steps, then Group — it opens straight into edit mode with all three lines empty
    await chip('web-sockets-apis').click({ modifiers: ['Control'] })
    await chip('app-authentication-authorization').click({ modifiers: ['Control'] })
    await page.waitForTimeout(200)
    await page.getByTitle('group the selected steps').click()
    await page.waitForTimeout(700)
    ok(`${engine}: Group made one new card`, (await road().locator('[data-rstage^="draft-"]').count()) === 1)

    // ── 1. THE EMPTY CARD — the case that moves in Firefox ───────────────────────────────
    await outsideMousedown() // commits the three empties and closes edit mode
    await page.waitForTimeout(400)
    ok(`${engine}: the card is at rest with nothing in its fields`, (await open().count()) === 0 && !(await card().innerText()).includes('Alpha'))
    const emptyRest = await toggleOnAndOff('EMPTY card')
    console.log(`${engine} empty card at rest: ${JSON.stringify(emptyRest)}`)

    // ── 2. THE FILLED CARD — the fix must not trade one case for the other ───────────────
    await pressPencil('edit')
    await open().nth(0).click()
    await page.keyboard.type('Alpha stage')
    await open().nth(1).click()
    await page.keyboard.type('What the first stage covers')
    await open().nth(2).click()
    await page.keyboard.type('Draft')
    await outsideMousedown()
    await page.waitForTimeout(400)
    ok(`${engine}: the card now holds its title`, (await card().innerText()).includes('Alpha stage'))
    const filledRest = await toggleOnAndOff('FILLED card')
    console.log(`${engine} filled card at rest: ${JSON.stringify(filledRest)}`)
  } catch (e) {
    errors.push(`${engine} threw: ` + (e && e.stack || e))
  } finally {
    await browser.close()
  }
}

try {
  for (const engine of ['firefox', 'chromium']) await runEngine(engine)
} finally {
  vite.kill()
}

console.log(checks.join('\n'))
if (errors.length) {
  console.log('\nFAILED:\n' + errors.map((e) => ' - ' + e).join('\n'))
  process.exit(1)
}
console.log('\nDONE — all checks passed')
