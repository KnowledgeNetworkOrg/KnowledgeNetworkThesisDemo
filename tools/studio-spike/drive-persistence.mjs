// #16 — does the desk survive a reload, and does a saved walk become a real walk?
//
// Neither question can be answered by a unit test. draftpersist.test.ts proves
// the PARSER is safe against a bad payload; only a real browser proves that the
// app writes a payload at all, that it reads it back at the right moment in
// module init, and that a walk saved on the desk turns up in an instrument that
// has never heard of the desk. So this driver does the whole loop against the
// running app: edit → reload → still there → save → reload → the Trail offers it.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as browsertest-mapconnections.mjs beside it.
//
// Run from anywhere:  node tools/studio-spike/drive-persistence.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5201
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

/** the Plan preset is where the walk editor lives; the preset is NOT persisted, so
 *  every reload has to pick it again */
const openPlan = async () => {
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(500)
}

const roadText = () => page.$eval('[data-road-root]', (el) => el.innerText)
const stageCount = () => page.$$eval('[data-rstage]', (els) => els.length)

await page.goto(`http://localhost:${PORT}/`)
// start from a known state — a leftover draft from a previous run would make
// every count below meaningless
await page.evaluate(() => localStorage.clear())
await page.reload()
await openPlan()

// ── 1. the seed is what an empty store opens on ─────────────────────────────
const stages0 = await stageCount()
const text0 = await roadText()
ok('opens on the seed', stages0 === 2 && text0.includes('Secure the channel'), `stages=${stages0}`)

// ── 2. load a walk in as a stage (#16, the inbound half) ─────────────────────
// #154's follow-up moved these off hand-rolled buttons onto the DS Toolbar,
// which has no data-* passthrough — its own label text is the stable hook now.
await page.locator('[aria-label="studio-pane-walkeditor"]').getByRole('button', { name: 'add a walk' }).click()
await page.waitForTimeout(200)
await page.locator('[aria-label="studio-pane-walkeditor"]').screenshot({ path: OUT + '/persistence-picker.png' })
const offered = await page.$$eval('[data-walk-picker] button', (els) => els.map((e) => e.textContent))
ok('the picker offers the built-in walks', offered.length >= 2, JSON.stringify(offered))
await page.click('[data-walk-picker] button')
await page.waitForTimeout(400)

const stages1 = await stageCount()
const text1 = await roadText()
ok('the walk lands as one new stage', stages1 === stages0 + 1, `${stages0} → ${stages1}`)
// the real Nunito face (loaded since the OB-200 font fix, tokens/fonts.css) is wider than
// the Segoe UI fallback this app silently drew in before, so a title that fit whole now
// clips with an ellipsis inside its fixed-width card — checking a short, unclipped prefix
ok('the stage is titled after the walk', text1.includes('From transistor to running'))

// ── 3. THE question: does it survive a reload? ──────────────────────────────
await page.reload()
await openPlan()
const stages2 = await stageCount()
const text2 = await roadText()
ok('the draft survives a reload', stages2 === stages1, `${stages1} → ${stages2}`)
ok('and it is the same plan, not a fresh seed', text2.includes('From transistor to running'))

// ── 4. save the road as a walk (#16, the outbound half) ──────────────────────
const NAME = 'Driver walk ' + stages2 + ' stages'
await page.locator('[aria-label="studio-pane-walkeditor"]').getByRole('button', { name: 'save as walk' }).click()
await page.fill('[data-name-walk] input', NAME)
await page.click('[data-name-walk-save]')
await page.waitForTimeout(300)
await page.locator('[aria-label="studio-pane-walkeditor"]').screenshot({ path: OUT + '/persistence-receipt.png' })
const receipt = await page.$eval('[data-walk-receipt]', (el) => el.innerText)
ok('saving reports what it stored', receipt.startsWith('saved'), receipt)

// ── 5. a saved walk is a REAL walk — in an instrument that never saw the desk ─
await page.reload()
await page.getByLabel('studio-inst-trail').click()
await page.waitForTimeout(500)
const trail = await page.$eval('[aria-label="trail-strip"]', (el) => el.innerText)
ok('the Trail offers the walk the desk saved', trail.includes(NAME), JSON.stringify(trail.slice(0, 220)))

await page.screenshot({ path: OUT + '/persistence.png' })

// ── leave no draft behind: the shot drivers next to this one photograph the
// seed, and a walk this script authored would sit in their frames forever ─────
await page.evaluate(() => localStorage.clear())

await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/shots/persistence.png')
