// browsertest-walkvisibility.mjs — OB-134 clause 4 (#252).
//
// A TEST. It opens the real app in a real browser and asserts what a person sees:
// the visibility eye hides the walk the map is drawing — pins and arrows together —
// and a CHANGE OF WALK shows the new walk without a click. Hidden is per-walk state
// (`src/model/walkvisibility.ts` says why, and its unit test proves the rule); this
// proves the rule is wired to the eye, the drawing and the bus. And the other half of
// the item's done-when (added 2026-09-14): the DOCK is never hidden by the eye — it stays
// mounted and usable while the walk is hidden, a seek moves its readout with nothing drawn
// on the map, the eye brings the drawing back at the CURRENT position, and the eye wears
// its slash and no moss wash (the slash is the whole state).
//
// WHAT COUNTS AS "the drawing". The whole walk layer is one `<g data-routepath>`
// gated by the flag (OB-122 put pins AND arrows inside it), so "hidden" is that
// element being absent, and "shown" is it being present. A walk activated from the
// Trail publishes only its played prefix — one stop — which is still one pin and
// therefore still a drawing; nothing here needs a seek.
//
// WHY THE TRAIL. It is the one instrument that lists every saved walk with a play
// button each and a "stop this walk" button once one is running, so it can switch
// walks without a palette or a seek. OB-106 closes the palette that instruments live
// in, so the Trail is added before any preset would close it again.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-walkvisibility.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5232

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
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

const drawn = () => page.evaluate(() => !!document.querySelector('svg[data-nested] [data-routepath]'))
const eyeSays = async () => {
  if (await page.getByLabel('hide the walk').count()) return 'hide the walk'
  if (await page.getByLabel('show the walk').count()) return 'show the walk'
  return null
}
const eye = () => page.getByLabel(/^(hide|show) the walk$/)
const trail = page.locator('[aria-label="trail-strip"]')
const playButtons = () => trail.getByRole('button').filter({ hasText: '▶' })
const stopWalk = async () => { await trail.getByLabel('stop this walk').click(); await page.waitForTimeout(400) }

// ── the desk: the map, plus the Trail to switch walks with ───────────────────
await page.getByLabel('studio-preset-explore').click()
await page.waitForTimeout(500)
const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
if ((await toggle.getAttribute('title')) !== 'hide the palette') { await toggle.click(); await page.waitForTimeout(400) }
await page.getByLabel('studio-inst-trail', { exact: true }).click()
await page.waitForTimeout(500)
ok('the map is on the desk', await page.evaluate(() => !!document.querySelector('svg[data-nested]')))
const walks = await playButtons().count()
ok('the Trail offers at least two saved walks to switch between', walks >= 2, `${walks} offered`)
ok('the eye names the DRAWING, not its nodes', (await eyeSays()) === 'hide the walk', `reads "${await eyeSays()}"`)

// ── walk A: activate, hide, and see that hidden survives a level change ─────
await playButtons().nth(0).click()
await page.waitForTimeout(700)
ok('walk A activated draws on the map', await drawn())
const face = (label) => page.getByLabel(label, { exact: true }).evaluate((el) => getComputedStyle(el).borderColor + ' | ' + getComputedStyle(el).backgroundColor)
const faceShown = await face('hide the walk')

await eye().click()
await page.waitForTimeout(300)
ok('the eye hides walk A — the whole drawing is gone', !(await drawn()))
ok('and the eye now offers to show it', (await eyeSays()) === 'show the walk', `reads "${await eyeSays()}"`)

// ── the dock is the CONTROL, the pins are the drawing: hiding one never hides the other ─
const dock = () => page.locator('[data-walk-dock]')
const readout = async () => {
  const t = await dock().locator('button').filter({ hasText: /\d+ \/ \d+/ }).first().textContent()
  const m = /(\d+) \/ (\d+)/.exec(t || '')
  return m ? { cur: Number(m[1]), n: Number(m[2]) } : null
}
ok('THE DOCK STAYS MOUNTED while the walk is hidden', (await dock().count()) === 1)
ok('the eye wears its slash and NO moss wash: hidden, its border and face are exactly what they were shown — the slash is the whole state', (await face('show the walk')) === faceShown, `${await face('show the walk')} vs ${faceShown}`)
const rHidden0 = await readout()
await dock().focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(400)
const rHidden1 = await readout()
ok('and it is USABLE: a seek moves the dock\'s readout', !!rHidden0 && !!rHidden1 && rHidden1.cur === rHidden0.cur + 1, `${JSON.stringify(rHidden0)} -> ${JSON.stringify(rHidden1)}`)
ok('while the map still draws nothing for the walk', !(await drawn()))
await eye().click()
await page.waitForTimeout(400)
ok('the eye brings the drawing back', await drawn())
const pinSteps = await page.$$eval('svg[data-nested] [data-routestop]', (els) => els.map((el) => el.getAttribute('data-step')))
const covers = (s, cur) => { const m = /^(\d+)(?:-(\d+))?$/.exec(s || ''); return !!m && cur >= Number(m[1]) && cur <= Number(m[2] ?? m[1]) }
ok('at the CURRENT position: the pin for the readout\'s stop is among those drawn', pinSteps.some((s) => covers(s, rHidden1.cur)), `readout ${JSON.stringify(rHidden1)}, pins ${pinSteps.join(',')}`)
await eye().click()
await page.waitForTimeout(300)
ok('hidden again for the level-change check', !(await drawn()))

const levelOf = () => page.evaluate(() => document.querySelector('svg[data-nested]')?.getAttribute('data-level'))
const levelBefore = await levelOf()
await page.getByLabel('zoom in').click()
await page.waitForTimeout(600)
ok('the level actually changed — without this the next check proves nothing', (await levelOf()) !== levelBefore, `L${levelBefore} -> L${await levelOf()}`)
ok('a level change does NOT restore it', !(await drawn()))

// ── THE CLAUSE: switch to walk B and it is drawn with no click on the eye ────
await stopWalk()
await playButtons().nth(1).click()
await page.waitForTimeout(700)
ok('switching to walk B shows walk B without a click', await drawn())
ok('and the eye offers to hide it again', (await eyeSays()) === 'hide the walk', `reads "${await eyeSays()}"`)

// ── per-walk state: back to A, and A is still hidden; the click brings it back ─
await stopWalk()
await playButtons().nth(0).click()
await page.waitForTimeout(700)
ok('coming back to walk A finds it still hidden (per-walk state)', !(await drawn()))
await eye().click()
await page.waitForTimeout(300)
ok('clicking the eye shows walk A again', await drawn())

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
