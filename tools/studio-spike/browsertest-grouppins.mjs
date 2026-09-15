// browsertest-grouppins.mjs — #228 (DS OB-114): a group on the walk is ONE step on the map.
//
// A TEST. It opens the Plan preset (walk editor + map) on the seed draft, whose second and
// third top-level steps are GROUPS — "Reach the machine" holds two nodes, "Secure the
// channel" one — and reads what the map's pins PRINT. The owner's ruling (2026-09-03): one
// pin per node, each numbered with the group's top-level step, never "3.1" on a pin; the
// full path lives in the pin's hover card. So the seed's seven stops number 1 2 2 3 4 5 6,
// the dock still counts seven, and hovering a grouped pin names "2.1 · …".
//
// The pins are read at level 2 (two dives on the first pin, as browsertest-walkdock does)
// and with the walk seeked into the middle, so the recency band (OB-132) draws the pins
// around the position; every DRAWN pin is checked, and the grouped ones must be among them.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-grouppins.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5239

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
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

// the seed's seven stops, and the top-level step each one belongs to
const EXPECTED = { 1: '1', 2: '2', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6' }

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(800)

  const map = page.locator('[aria-label="map-view"]')
  const pins = () => map.locator('[data-routestop][data-step]')
  const readPins = () => pins().evaluateAll((gs) => gs.map((g) => ({ step: Number(g.getAttribute('data-step')), label: (g.textContent || '').trim() })))
  const dock = () => map.locator('[data-walk-dock]')

  ok('the map is on the desk with the walk docked', (await dock().count()) === 1)
  ok('the dock counts every stop — a group\'s nodes are still stops', (await dock().innerText()).includes('/ 7'), (await dock().innerText()).replace(/\n/g, ' | '))

  // two dives on the first pin → level 2, where the stops spread onto their own cells
  for (let d = 0; d < 2; d++) {
    const b = await pins().first().boundingBox()
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(800)
  }
  await page.keyboard.press('Escape')
  await dock().focus()
  await page.keyboard.press('End')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
  await page.mouse.move(4, 4)
  await page.waitForTimeout(500)

  const drawn = await readPins()
  ok('pins are drawn around the position', drawn.length >= 4, `${drawn.length} drawn: ${JSON.stringify(drawn)}`)
  ok('no pin prints a dotted path', drawn.every((p) => !p.label.includes('.')))
  const wrong = drawn.filter((p) => !(p.label === EXPECTED[p.step] || p.label.includes('-')))
  ok('THE CLAUSE: every drawn pin prints its TOP-LEVEL step — a group\'s nodes share the group\'s number', wrong.length === 0, JSON.stringify(wrong))
  const grouped = drawn.filter((p) => p.step === 2 || p.step === 3)
  ok('the grouped stops are among the drawn pins', grouped.length >= 1, JSON.stringify(grouped))
  ok('and both nodes of the group read "2"', grouped.every((p) => p.label === '2' || p.label.startsWith('2-')), JSON.stringify(grouped))
  const after = drawn.find((p) => p.step === 5)
  ok('the step after the groups picks up where the groups\' slots left off — "4", not "5"', !after || after.label === '4', JSON.stringify(after))

  // the hover card names the full path — the only place on the map it is readable
  const groupedPin = map.locator('[data-routestop][data-step="3"]').first()
  if ((await groupedPin.count()) === 1) {
    await groupedPin.hover()
    await page.waitForTimeout(300)
    const path = page.locator('[data-stoppath]')
    ok('hovering a grouped pin shows its path in the card', (await path.count()) === 1)
    ok('and the path is the group\'s local numbering, "2.2 · <name>"', (await path.count()) === 1 && (await path.innerText()).startsWith('2.2 ·'), (await path.count()) ? await path.innerText() : 'no card')
    await page.mouse.move(4, 4)
    await page.waitForTimeout(300)
  } else {
    ok('a grouped pin is drawn to hover (step 3)', false, `${await groupedPin.count()} found`)
  }
  const topPin = map.locator('[data-routestop][data-step="5"]').first()
  if ((await topPin.count()) === 1) {
    await topPin.hover()
    await page.waitForTimeout(300)
    // OB-184 (2026-09-14): the card NAMES the stop now, by the number THE PIN PRINTS (the walk
    // slot, "4" on this fifth stop), never a group path. Until then a top-level stop with no note
    // drew no card at all.
    const top = page.locator('[data-stoppath]')
    const pinLabel = ((await topPin.textContent()) || '').trim()
    ok(`a top-level stop's card names it by the number its pin prints, "${pinLabel} · <name>", not a group path`, (await top.count()) === 1 && (await top.innerText()).startsWith(pinLabel + ' ·'), (await top.count()) ? await top.innerText() : 'no card')
    await page.mouse.move(4, 4)
  }
  ok('no page errors', errors.filter((e) => e.startsWith('pageerror')).length === 0)
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
