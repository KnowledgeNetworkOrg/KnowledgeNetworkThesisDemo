// OB-129 — a two-digit stop NUMBER is a circle, not a pill.
//
// `StepDot`'s range test read `String(n).length > 1`, so every stop from 10 on
// took the auto-width PILL branch: a walk of ten or more drew circles up to 9
// and flattened lozenges after it. The DS found it on a 60-stop rig; the fault
// is in the authored file and this port carried it faithfully, so it has been on
// screen here since the `pin` variant landed. Both callers pass a number —
// `WalkStrip` as `n={i + 1}`, `MapView` as `n={s.label}`.
//
// WHY THIS IS A DRIVER AND NOT A UNIT TEST. The obligation's own acceptance test
// is a MEASUREMENT — "measured width equals height, equals `size`" — and the two
// branches differ by `width: auto` with padding against a fixed `width: size`.
// jsdom lays nothing out, so a unit test can only assert which branch rendered.
//
// AND THE MEASUREMENT ALONE IS NOT ENOUGH HERE, which is worth knowing before
// trusting it. The pill keeps `minWidth: size`, so it only grows past the circle
// once its content plus 2×`max(4, size*0.18)` of padding exceeds `size`. At this
// app's rail dot (28px) two mono digits still fit inside that minimum, so a
// broken build measures 28×28 exactly like a fixed one — verified by reverting
// the fix and re-running: every measurement check passed. The DS saw it flatten
// because their rig's dot is 18px. So the branch is asserted DIRECTLY as well:
// the circle branch draws its whole face in one `<svg>` and the pill branch has
// none, which is exact at every size and is what actually regressed.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-walkwheel.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-stepdot.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5212
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
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

/** every StepDot under `root`, as {label, w, h}. A StepDot is the only button in
 *  the system that renders a bare stop label in the mono face, so it is found by
 *  what it IS rather than by a class or a wrapper someone may re-nest. */
const dots = (root) =>
  page.evaluate((sel) => {
    const scope = document.querySelector(sel)
    if (!scope) return []
    return [...scope.querySelectorAll('button')]
      // a stop label: a number, a two-number ADDRESS ("2.1", OB-188), or a range of either — the
      // older hyphenated "1-3" and the en-dashed "1–2.2" a merged pin prints since OB-188
      .filter((b) => /^\d+(\.\d+)?([-\u2013]\d+(\.\d+)?)?$/.test(b.textContent.trim()))
      .map((b) => {
        const r = b.getBoundingClientRect()
        return {
          label: b.textContent.trim(),
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          // the circle branch draws fill + ring + dash in one <svg>; the pill
          // branch draws a CSS border and no SVG at all. This is the branch.
          svg: !!b.querySelector('svg'),
        }
      })
  }, root)

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

// ── the rail variant: the walk strip, on a walk of ten or more ─────────────
// The obligation names TrailStrip explicitly, and a walk of nine or fewer proves
// nothing at all — every stop is single-digit and both branches agree.
await page.getByLabel('studio-inst-trail').click()
await page.waitForTimeout(400)
const play = page.locator('[aria-label="trail-strip"]').getByRole('button').filter({ hasText: '▶' }).first()
if ((await play.count()) === 0) {
  console.error('no saved walk offered by the Trail — nothing to measure')
  await browser.close()
  vite.kill()
  process.exit(1)
}
await play.click()
await page.waitForTimeout(700)

// SEEK TO THE END BEFORE LOOKING AT THE MAP. `activateWalk` publishes only the
// PLAYED PREFIX, so hitting play puts ONE stop on `bus.route` and the map draws a
// single pin — which is why the range-label half of this file used to report
// "SKIP  no crowded cell in this corpus is drawing a range label" and pass anyway.
// The strip shows the whole walk either way, so the omission was invisible from
// the rail measurements above it. Lifted from `drive-pincrowd.mjs`, which needs
// the same thing for the same reason: the seek BAR is the strip's only control
// that moves the cursor (the dots above it are display only), it has no label, so
// it is found by shape — the 4px rail is the only aria-hidden bar in the strip,
// and the element that takes the pointer is its parent.
const seekBar = await page.evaluate(() => {
  const scope = document.querySelector('[aria-label="walk-viewer"]')
  const bar = [...scope.querySelectorAll('[aria-hidden="true"]')].find((e) => Math.round(e.getBoundingClientRect().height) === 4)
  if (!bar) return null
  const r = bar.parentElement.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
if (!seekBar) {
  console.error('no seek bar in the walk viewer — cannot reach the end of the walk')
  await browser.close()
  vite.kill()
  process.exit(1)
}
await page.mouse.click(seekBar.x + seekBar.w - 1, seekBar.y + seekBar.h / 2)
await page.waitForTimeout(800)

const rail = await dots('[aria-label="walk-viewer"]')
const twoDigit = rail.filter((d) => d.label.length > 1)
ok('the walk is long enough to have two-digit stops at all', twoDigit.length > 0, `${rail.length} stops, ${twoDigit.length} of them 10+`)

// THE CHECK ITSELF: square, and the same square as its single-digit siblings.
// "equals size" is read off stop 9 rather than hardcoded — WalkStrip picks the
// dot size from its own metrics, so pinning a number here would fail the day the
// strip is re-measured, for a reason that has nothing to do with this item.
const single = rail.find((d) => d.label === '9') || rail.find((d) => d.label.length === 1)
ok(
  'every numeric stop takes the CIRCLE branch — one SVG face, not a CSS pill',
  rail.every((d) => d.svg),
  `${rail.filter((d) => !d.svg).map((d) => d.label).join(', ') || 'none on the pill branch'}`,
)
ok('every stop is a CIRCLE — width equals height', rail.every((d) => Math.abs(d.w - d.h) < 0.5), JSON.stringify(rail.filter((d) => Math.abs(d.w - d.h) >= 0.5)))
ok(
  'and a two-digit stop is the same size as a single-digit one',
  single && twoDigit.every((d) => Math.abs(d.w - single.w) < 0.5),
  `stop ${single?.label} ${single?.w}px vs ${twoDigit.map((d) => d.label + ' ' + d.w + 'px').join(', ')}`,
)

// ── the pin variant: the same dots over the map ───────────────────────────
// `variant="pin"` takes the same `isRange` branch, and MapView passes `s.label`,
// which is a number for a lone stop and a "1-3" STRING for a crowded cell — the
// one case that must still draw a pill. Both are on the map at once.
await page.getByLabel('studio-preset-explore').click()
await page.waitForTimeout(900)
const pins = await dots('[aria-label="map-view"]')
if (pins.length === 0) {
  checks.push('SKIP  the map is showing no walk pins in this composition — rail measured only')
} else {
  // OB-188 (2026-09-15): a pin prints its two-number ADDRESS. A plain top-level number ("4") is a
  // NUMBER-shaped label and a circle; an address with a dot ("2.1") and a merged pin's en-dashed
  // range ("1–2.2", the older hyphenated "1-3") are strings over one character and take the PILL.
  const pinNums = pins.filter((d) => /^\d+$/.test(d.label))
  const pinRanges = pins.filter((d) => /[-\u2013]/.test(d.label))
  ok('every plain-number map pin takes the circle branch too', pinNums.every((d) => d.svg), `${pinNums.length} pins: ${pinNums.map((d) => d.label).join(', ')}`)
  ok('and measures square', pinNums.every((d) => Math.abs(d.w - d.h) < 0.5), pinNums.map((d) => `${d.label} ${d.w}x${d.h}`).join(', '))
  // pins are sized per crowding, so they are NOT all the same size as each other
  // — squareness is the whole claim here, not a shared width.

  // THE PILL BRANCH IS THE POINT OF THE FILE, so its absence is a failure and not
  // a SKIP. It used to be a SKIP, and the SKIP was firing: the branch OB-129
  // rewrote was going unmeasured in the browser on every run while the file
  // reported all-green. A range label needs two stops to land on ONE cell, which
  // is what the coarse levels do — so it is asserted where merging actually
  // happens rather than wherever the preset left the camera.
  ok('some cell is crowded enough to draw a range label at this level', pinRanges.length > 0,
    `${pins.length} pins: ${pins.map((d) => d.label).join(', ')}`)
  ok(
    'and a RANGE label ("1–2.2") still takes the pill branch — no SVG face',
    pinRanges.length > 0 && pinRanges.every((d) => !d.svg),
    pinRanges.map((d) => `${d.label} ${d.w}x${d.h}`).join(', '),
  )
}

await page.screenshot({ path: OUT + '/stepdot.png' })
await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/shots/stepdot.png')
