// browsertest-groupgapped.mjs — OB-115 (#257): "Group" on a NON-CONTIGUOUS selection.
//
// A TEST. It opens the real walk editor in a real browser and does what the owner asked
// for on 2026-08-28: picks two steps that are NOT next to each other, presses Group, and
// looks at what the road draws. The rule itself is `gatherIntoGroup` in authordraft.ts
// and has a unit test with the issue's 2-and-5 chain; this proves the rule reaches the
// button — that the button is no longer disabled for a gapped pick, and that the road
// then shows ONE card at the first pick's slot holding both, with what sat between
// moved after it.
//
// THE SEED DRAFT is the fixture: six top-level stops — a leaf, a stage, a fork, then
// three leaves. Picking the first leaf and the fourth stop puts the stage AND the fork
// in the gap, which is the hardest case the road has: two containers move after a card
// that did not exist a moment ago. The adjacent case is the control and runs on a fresh
// seed, so neither run sees the other's draft.
//
// "Where a thing is" is read as GEOMETRY, not DOM nesting: an open card's steps float
// over it as board-level siblings placed by layoutRoad, so "inside the card" means
// inside the card's box, and "after the card" means below it.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-groupgapped.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5233

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

// the seed draft, every time: clear what the desk persisted and reload
const freshSeed = async () => {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(600)
}

const road = () => page.locator('[data-road-root]')
const chip = (node) => road().locator(`[data-rnode][data-node="${node}"]`)
const card = (key) => road().locator(`[data-rstage="${key}"]`)
const newCards = () => road().locator('[data-rstage^="draft-"]')
const groupButton = () => page.getByTitle('group the selected steps')
const box = async (loc) => loc.boundingBox()
const inside = (inner, outer) => inner.y >= outer.y - 1 && inner.y + inner.height <= outer.y + outer.height + 1
const below = (a, b) => a.y >= b.y + b.height - 1 // a starts where b ends, or later

// ── the gapped case: the first leaf and the fourth stop, two containers between ─
await freshSeed()
ok('the walk editor is on the desk', (await road().count()) === 1)
ok('the seed draws its two containers', (await road().locator('[data-rstage]').count()) === 2)
ok('with nothing selected, Group is disabled', await groupButton().isDisabled())

await chip('stk-dns-naming').click({ modifiers: ['Control'] })
await chip('web-http-rest').click({ modifiers: ['Control'] })
await page.waitForTimeout(200)
ok('THE CLAUSE: a gapped selection no longer disables Group', !(await groupButton().isDisabled()))

await groupButton().click()
await page.waitForTimeout(600)
ok('one new card', (await newCards().count()) === 1, `${await newCards().count()} new`)
const g = await box(newCards().first())
const net = await box(card('seed-net'))
const sec = await box(card('seed-sec'))
const dns = await box(chip('stk-dns-naming'))
const http = await box(chip('web-http-rest'))
const sockets = await box(chip('web-sockets-apis'))
ok('the new card stands at the FIRST pick\'s slot — above both containers', g && net && sec && g.y < net.y && g.y < sec.y)
ok('it holds the first pick', g && dns && inside(dns, g))
ok('and it holds the second pick, pulled up past the gap', g && http && inside(http, g))
ok('what sat between — the stage — now sits after the card', g && net && below(net, g))
ok('and the fork after the stage, in their old order', net && sec && below(sec, net))
ok('the untouched tail follows the fork', sec && sockets && below(sockets, sec))

// ── the control: an adjacent selection groups exactly as it always did ───────
await freshSeed()
await chip('web-sockets-apis').click({ modifiers: ['Control'] })
await chip('app-authentication-authorization').click({ modifiers: ['Control'] })
await page.waitForTimeout(200)
ok('an adjacent selection still enables Group', !(await groupButton().isDisabled()))
await groupButton().click()
await page.waitForTimeout(600)
ok('one new card (adjacent)', (await newCards().count()) === 1)
const g2 = await box(newCards().first())
const sec2 = await box(card('seed-sec'))
const s2 = await box(chip('web-sockets-apis'))
const a2 = await box(chip('app-authentication-authorization'))
ok('the adjacent group stays where the run was — after the fork', g2 && sec2 && below(g2, sec2))
ok('holding both, in order', g2 && s2 && a2 && inside(s2, g2) && inside(a2, g2) && a2.y > s2.y)

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
