// browsertest-presenterclicker.mjs — #434: a presentation clicker steps the presenter screen.
//
// Clickers send Page Down / Page Up rather than the arrow keys. This driver starts a lecture, puts
// the keyboard on the deck (a pane that scrolls), and presses PageDown / PageUp: the record must
// advance and come back, and the pane must not take the key as a scroll instead. On the unfixed
// screen the stop stays put and the deck scrolls under it.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-presenterclicker.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
  return cond
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1750, height: 950 } })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  await page.evaluate(() => document.fonts.ready)

  const chip = () => page.locator('[data-presenter-chip]')
  const chipText = async () => (await chip().innerText()).replace(/\s+/g, ' ').trim()
  const stopNumber = async () => Number((await chipText()).match(/stop (\d+)/)[1])

  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(700)
  const [projector] = await Promise.all([
    context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
    page.locator('[data-toolbar-hook="present"]').click(),
  ])
  await page.bringToFront()
  await page.waitForTimeout(900)
  if (projector) projector.on('pageerror', (e) => errors.push('projector pageerror: ' + e.message))
  ok('the lecture is live', /^Presenting stop \d+$/.test(await chipText()), await chipText())

  const total = Number((await page.locator('[data-presenter-pill]').innerText()).match(/\/\s*(\d+)/)[1])
  let here = await stopNumber()
  if (here === total) {
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(400)
  } else if (here === 1) {
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
  }
  here = await stopNumber()
  ok('the record is away from both ends, so both clicker keys can move it', here > 1 && here < total, `stop ${here} of ${total}`)

  // A SHORT WINDOW MAKES THE DECK OVERFLOW, so a PageDown that is NOT claimed really does scroll
  // a pane rather than falling on a box with nowhere to go.
  await page.setViewportSize({ width: 1750, height: 560 })
  await page.waitForTimeout(600)
  const deck = () => page.locator('[data-quick-deck]')
  const focusDeck = () => page.evaluate(() => {
    const el = document.querySelector('[data-quick-deck]')
    if (!el) return null
    el.setAttribute('tabindex', '-1')
    el.focus()
    return { active: document.activeElement === el, max: el.scrollHeight - el.clientHeight }
  })
  const setDeckScroll = (where) => page.evaluate((where) => {
    const el = document.querySelector('[data-quick-deck]')
    if (!el) return null
    el.scrollTop = where === 'bottom' ? el.scrollHeight : 0
    return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight }
  }, where)
  const deckTop = () => deck().evaluate((el) => el.scrollTop)

  const focused = await focusDeck()
  ok('the deck is the keyboard\'s pane and has room to scroll', !!focused && focused.active && focused.max > 0, focused ? `max ${focused.max}` : 'no deck')

  // ── PageDown is NEXT ────────────────────────────────────────────────────────
  await setDeckScroll('top')
  const before = await stopNumber()
  await page.keyboard.press('PageDown')
  await page.waitForTimeout(600)
  const after = await stopNumber()
  ok('PageDown advances the record', after === before + 1, `stop ${before} → ${after}`)
  ok('and the deck does not scroll under it', (await deckTop()) === 0, `deck scrollTop ${await deckTop()}`)

  // ── PageUp is BACK ──────────────────────────────────────────────────────────
  await focusDeck()
  const bottom = await setDeckScroll('bottom')
  await page.keyboard.press('PageUp')
  await page.waitForTimeout(600)
  const returned = await stopNumber()
  const top = await deckTop()
  ok('PageUp returns the record to the stop it left', returned === before, `stop ${after} → ${returned}`)
  ok('and the deck stays at the bottom where PageUp found it', !!bottom && Math.abs(top - bottom.top) <= 1, `deck scrollTop ${top} of ${bottom && bottom.top}`)

  ok('no page errors', errors.filter((e) => e.includes('pageerror')).length === 0)
} catch (e) {
  errors.push('exception: ' + (e && e.stack || e))
}

await page.evaluate(() => localStorage.clear()).catch(() => {})
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log(`\n${checks.length} checks passed`)
