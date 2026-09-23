// OB-128 (#249) — no two walk pins may be drawn inside each other, on the real
// screen, at every level.
//
// WHAT THIS DRIVER FOUND, WHICH IS WORTH KNOWING BEFORE TRUSTING IT: it does not
// reproduce the report. The DS filed OB-128 from an owner screenshot of steps 6
// and 11 overlapping near "Languages & Compilers", and neither authored walk in
// `corpus/walks.ts` collides anywhere — the closest two pins come at any level is
// about 100px of clear air, measured below. The screenshot is of a walk the owner
// authored on the desk, which is not in the repo. So this is a REGRESSION NET
// over the shipped corpus, not a reproduction, and it passed before the fix as
// well as after it. The arithmetic that can actually be made to fail is in
// `src/model/walkpins.test.ts`, which builds the crowds the corpus does not have.
//
// WHY IT IS STILL A DRIVER. The pin's world position is the output of five stages
// that each move it — the resolve up to a visible ancestor, the contiguous-run
// merge, the crowding arc, the label-clearance nudge, and the separation pass —
// and the label boxes those middle stages read are built from live layout. A unit
// test proves the stages; this proves the browser agrees, and it is the check
// that would catch a future walk, corpus or level ladder reintroducing the fault.
//
// The test is pure geometry: a StepDot pin is a circle, so two pins collide when
// the distance between their centres is less than the sum of their radii. No
// part of either circle may be inside the other — the obligation's own wording.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-mappins.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-pincrowd.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5213
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

/** every drawn pin as a circle: centre, radius, and the step label inside it. */
const discs = () =>
  page.$$eval('[data-routestop]', (els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return {
        label: (e.textContent || '').trim(),
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        d: Math.max(r.width, r.height),
      }
    }),
  )

/** every pair of pins with the clear air between their two circles, tightest
 *  first. A negative gap is an overlap — the fault. A small positive one is the
 *  margin, which is worth printing even on a pass. */
const closestFirst = (ds) => {
  const out = []
  for (let i = 0; i < ds.length; i++)
    for (let j = i + 1; j < ds.length; j++) {
      const a = ds[i]
      const b = ds[j]
      out.push({
        a: a.label,
        b: b.label,
        gap: Math.round(Math.hypot(a.x - b.x, a.y - b.y) - (a.d + b.d) / 2),
        sizes: `${Math.round(a.d)}px/${Math.round(b.d)}px`,
      })
    }
  return out.sort((p, q) => p.gap - q.gap)
}

const levelNow = () => page.$eval('[data-nested]', (el) => Number(el.getAttribute('data-level')))
// ON A PIN THAT IS IN THE PANE. Since OB-132 the first pin in the DOM is the oldest one
// still inside the band, five stops behind the position and wherever the camera left it —
// a double-click on a box outside the pane dives nowhere. Same rule as drive-mappins.
const diveOnAPin = async () => {
  const pane = await page.locator('[aria-label="map-view"]').boundingBox()
  const boxes = await page.locator('[data-routestop]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })))
  const b = boxes.find((r) => r.x >= pane.x && r.x + r.width <= pane.x + pane.width && r.y >= pane.y && r.y + r.height <= pane.y + pane.height)
  if (!b) return false
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForTimeout(800)
  return true
}

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

// ── THE SUBJECT: A WALK LONG ENOUGH TO HAVE A STEP 11 ──────────────────────
// The desk's own draft is four stops, and four stops cannot reproduce a report
// about steps 6 and 11. The saved 12-stop walk can — but `activateWalk`
// publishes only the PLAYED PREFIX, so activating it draws ONE pin. The walk has
// to be seeked to its last stop before the map holds the whole thing.
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
await page.waitForTimeout(600)

// SEEK TO THE END, THROUGH THE SEEK BAR. The step dots above it are display
// only — the bar is the strip's only control that moves the cursor (WalkStrip's
// own comment says so), and clicking a dot silently does nothing. The bar has no
// label of its own, so it is found by shape: the 4px rail is the only
// aria-hidden bar in the strip, and the element that takes the pointer is its
// parent.
const bar = await page.evaluate(() => {
  const scope = document.querySelector('[aria-label="walk-viewer"]')
  const rail = [...scope.querySelectorAll('[aria-hidden="true"]')].find((e) => Math.round(e.getBoundingClientRect().height) === 4)
  if (!rail) return null
  const r = rail.parentElement.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height }
})
if (!bar) {
  console.error('no seek bar in the walk viewer — cannot reach the end of the walk')
  await browser.close()
  vite.kill()
  process.exit(1)
}
await page.mouse.click(bar.x + bar.w - 1, bar.y + bar.h / 2)
await page.waitForTimeout(800)
const routeLen = await page.$eval('[data-routepath]', (e) => Number(e.getAttribute('data-step-count')))
ok('the whole saved walk is on the map, not just its played first stop', routeLen >= 11, `${routeLen} stops on the route`)

// OB-132 — the band draws five stops behind the position and two ahead, nothing further.
// At the last stop that is stops 7–12; one stop back it is 6–12, which puts the reported
// pair (6 and 11) both on the map, where this driver can measure them.
await page.locator('[aria-label="map-view"] [data-walk-dock]').focus()
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)

// the whole desk for the map, exactly as drive-mappins.mjs does it: the opening
// preset leaves the map a quarter of the window, so most pins sit outside the
// viewport and any measurement is about the camera instead of about the pins.
// The walk survives this — it lives on the bus, not in the strip.
for (const inst of ['unfoldgraph', 'document', 'walkviewer', 'trail']) {
  await page.getByLabel(`studio-inst-${inst}`).click()
  await page.waitForTimeout(150)
}
await page.waitForTimeout(600)

const start = await discs()
ok('the whole walk is drawn on the map', start.length > 1, `${start.length} pins at L${await levelNow()}, labels ${start.map((d) => d.label).join(',')}`)

// ── the sweep: no two pins may intersect, at any level ─────────────────────
const report = []
for (let i = 0; i < 8; i++) {
  const level = await levelNow()
  const ds = await discs()
  const hits = closestFirst(ds).filter((p) => p.gap < 0)
  report.push({ level, pins: ds.length, hits, tightest: closestFirst(ds)[0] })
  ok(
    `L${level}: no two walk pins overlap`,
    hits.length === 0,
    hits.length === 0 ? `${ds.length} pins, all clear` : hits.map((h) => `${h.a}×${h.b} by ${-h.gap}px at ${h.sizes}`).join('; '),
  )
  if (level >= 5) break
  if (!(await diveOnAPin())) break
}

// THE SWEEP HAS TO HAVE SWEPT. Every check above is inside the loop, so a dive
// that failed on the first turn would leave ONE level measured and the run would
// still be green while claiming "at any level". `drive-mappins.mjs` guards its own
// level sweep the same way, and this file did not.
ok('the sweep dived through the levels, not just the one it started on',
  report.some((r) => r.level >= 3), report.map((r) => `L${r.level}`).join(' '))

// ── HOW MUCH ROOM IS ACTUALLY LEFT ─────────────────────────────────────────
// Reported rather than asserted, and printed even when everything passes. The
// pass/fail above only says "not touching", which stays true right up to the
// moment it stops being true; the margin says how close this corpus ever gets,
// and it is the number that tells the next reader whether a green run here means
// the layout is safe or merely lucky. It is also the evidence for the claim in
// this file's header that the reported case is not reachable from `walks.ts`.
const tightest = report.map((r) => r.tightest).filter(Boolean).sort((a, b) => a.gap - b.gap)[0]
console.log(`\nclosest any two pins come, across every level: ${tightest ? `${tightest.a}×${tightest.b}, ${tightest.gap}px apart at ${tightest.sizes}` : 'n/a — fewer than two pins'}`)

await page.screenshot({ path: OUT + '/pin-crowd.png' })
console.log('\nper level: ' + report.map((r) => `L${r.level}:${r.pins}pins/${r.hits.length}clash`).join(' '))

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/shots/pin-crowd.png')
