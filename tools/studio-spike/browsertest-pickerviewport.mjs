// browsertest-pickerviewport.mjs — a node picker's menu opens where you can reach it.
//
// A TEST. It was not one until 2026-09-03: this began as `drive-pickerviewport.mjs`,
// an investigation into whether `NodePicker` can open its menu off the bottom of the
// window. It measured and PRINTED, printing "!! THE MENU RUNS Npx OFF THE BOTTOM —
// that is the bug" on the bad path and exiting 0 either way. So it could not fail,
// and `run-browsertests.mjs` counted it as a passing test.
//
// WHAT IT SUSPECTED, AND WHAT IS ACTUALLY TRUE NOW. It was written believing
// `NodePicker` anchors its menu at `rect.bottom + 4` unconditionally, with no
// viewport-edge flip, in our port AND in the Design System source — so a picker low
// in the pane could open a menu running off the bottom of the screen. That was real:
// measured at the time as 280px of menu with 46px off-screen and 7 of 53 rows
// reachable.
//
// IT HAS SINCE BEEN FIXED, and the investigation was never updated to say so. Our
// `NodePicker.tsx` now carries a `★ LOCAL` divergence — `placeMenu()` — which flips
// the menu above the anchor when there is no room below AND caps its height to the
// room it has on that side. Both terms are needed: flipping alone still overran by
// 46px in the measured case. The DS source still has neither; the divergence is
// marked to be dropped if they adopt it.
//
// SO WHY KEEP THIS FILE. `NodePicker.test.ts` already asserts `placeMenu()`'s
// arithmetic with no browser. That proves the RULE. It cannot prove the rule is
// wired to the real anchor, with the real road geometry, in the real window — which
// is the half that broke in the first place. Same split as `browsertest-maphover.mjs`.
//
// It therefore drives the WORST case rather than a comfortable one: the LAST group
// card on the road, a fresh empty version on it (adding a version GROWS the card and
// pushes the new empty slot further down, so the picker most likely to be opened is
// the one most likely to be near an edge), the picker scrolled to the BOTTOM of its
// scroller, at three window heights. It also asserts that the trigger really did end
// up low, because a height where it did not would prove nothing while still going
// green.
//
// WHAT IT MEASURES TODAY: the trigger lands at y=569 at every height, and the menu
// opens BELOW it at 950px (75px to spare) and flips ABOVE it at 800 and 700. The
// flip is doing exactly what it was added to do.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/browsertest-pickerviewport.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5225
// a roomy window, a laptop, and a short one. All three are sizes a person has.
const HEIGHTS = [950, 800, 700]
const WIDTH = 1750

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
    if (viteOut.includes('localhost:')) { clearTimeout(t); res() }
  }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
  return cond
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })

/** open a picker on the LOWEST group card and measure its menu against the window */
async function measureAt(height) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height } })
  page.on('pageerror', (e) => errors.push(`pageerror @${height}: ` + e.message))
  try {
    await page.goto(`http://localhost:${PORT}/`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(700)
    await page.locator('[aria-label="studio-preset-plan"]').click()
    await page.waitForTimeout(600)

    const cards = page.locator('[data-road-root] [data-rstage]')
    const n = await cards.count()
    if (!n) return { fail: 'no group cards on the road' }
    const card = cards.nth(n - 1)
    await card.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    // the row is role="button"; its version NAME is an editable span whose own
    // handler starts a rename, so the click lands on the row's left edge
    const row = card.locator('[role="button"]').filter({ hasText: /v\d/ }).first()
    if (!(await row.count())) return { fail: 'no version row on the last card' }
    const rb = await row.boundingBox()
    await page.mouse.click(rb.x + 6, rb.y + rb.height / 2)
    await page.waitForTimeout(400)

    const addRow = page.getByText(/add new version/i).first()
    if (!(await addRow.count())) return { fail: 'no add-version row' }
    await addRow.click()
    await page.waitForTimeout(700)

    const pk = page.locator('[data-rpicknode]').first()
    if (!(await pk.count())) return { fail: 'the new version rendered no picker' }

    // PUT THE TRIGGER AS LOW AS THIS APP WILL PUT IT, which is the entire point.
    // `scrollIntoViewIfNeeded()` re-CENTRES the element, so the first cut of this
    // test measured the menu at 281-561px at every window height -- the same box
    // three times, an assertion that could not have failed. `block: 'end'` scrolls
    // the road so the picker sits at the BOTTOM of its scroller instead, which is
    // the position a person reaches by scrolling down to the last card.
    await pk.evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'instant' }))
    await page.waitForTimeout(350)
    const tb = await pk.locator('button').first().boundingBox()
    if (!tb) return { fail: 'the picker trigger has no box' }
    await pk.locator('button').first().click()
    await page.waitForTimeout(500)

    // the menu is the fixed-position box holding the search field
    const box = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="search nodes"]')
      if (!input) return null
      let el = input
      while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
    })
    if (!box) return { fail: 'the menu did not open' }
    return { box, overflow: box.bottom - height, triggerY: Math.round(tb.y), roomBelow: Math.round(height - (tb.y + tb.height)) }
  } finally {
    await page.close()
  }
}

for (const height of HEIGHTS) {
  const r = await measureAt(height)
  if (r.fail) {
    ok(`the gesture completes at ${height}px tall`, false, r.fail)
    continue
  }
  // if the trigger is not actually near the bottom, this height proves nothing, and
  // saying so is better than a green line that was never at risk
  ok(`at ${height}px tall the trigger really is low in the window`, r.roomBelow < height / 2,
    `trigger at y=${r.triggerY}, ${r.roomBelow}px of window below it`)
  ok(`at ${height}px tall the menu opens INSIDE the window`, r.overflow <= 0,
    `menu ${r.box.top}\u2013${r.box.bottom} of ${height} \u2014 ${r.overflow > 0 ? `${r.overflow}px off the bottom` : `${-r.overflow}px to spare`}`)
  ok(`at ${height}px tall the menu's top is on screen too`, r.box.top >= 0,
    `top ${r.box.top}`)
}

ok('no page errors at any height', errors.filter((e) => e.startsWith('pageerror')).length === 0,
  errors.filter((e) => e.startsWith('pageerror')).join(' | '))

await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
