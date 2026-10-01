// browsertest-explorerroute.mjs — #325.
//
// A TEST. It opens the real app in a real browser and asserts the rule written
// into `src/state/bus.ts`'s header: the route belongs to the desk, and the
// edge-following explorer is not one of its writers. With the Plan preset open
// the desk has published its seeded road; turning the Walk pane on and clicking a
// start node must grow the explorer's OWN trail (`data-explore-path`) while the
// map's numbered route (`data-routepath`'s step count and its pins) stays exactly
// what the desk published. Before #325 the explorer called `bus.setRoute`, so the
// click collapsed the map's seven-stop road to the one clicked node.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-explorerroute.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5266

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

// the desk's published road, as the map draws it
const routeLen = () => page.$eval('svg[data-nested] [data-routepath][data-step-count]', (el) => Number(el.getAttribute('data-step-count')))
const pins = () => page.$$eval('svg[data-nested] [data-routestop]', (els) => els.length)
// the explorer's own trail, as WalkView publishes it
const exploreLen = async () => {
  const els = await page.$$('[aria-label="studio-pane-walk"] [data-explore-path]')
  return els.length ? Number(await els[0].getAttribute('data-explore-path')) : null
}

// ── the desk: Plan publishes the seeded road, and the map draws it ───────────
await page.getByLabel('studio-preset-plan').click()
await page.waitForTimeout(900)
const deskRoute = await routeLen()
const deskPins = await pins()
ok('the desk published a seeded road', deskRoute > 0 && deskPins > 0, `route ${deskRoute}, pins ${deskPins}`)

// ── turn the Walk pane on (the palette closed when the preset was picked) ────
const toggle = page.locator('[data-toolbar-hook="palette-toggle"]')
if ((await toggle.getAttribute('title')) !== 'hide the palette') { await toggle.click(); await page.waitForTimeout(400) }
await page.getByLabel('studio-inst-walk', { exact: true }).click()
await page.waitForTimeout(600)
const walkPane = page.locator('[aria-label="studio-pane-walk"]')
ok('the Walk pane mounted', (await walkPane.count()) === 1)
ok('and it starts empty, independent of the desk road', (await exploreLen()) === 0, `explore ${await exploreLen()}`)

// ── click a start node: the explorer grows, the map does not change ──────────
await walkPane.getByRole('button', { name: /links/ }).first().click()
await page.waitForTimeout(500)
const afterStart = await exploreLen()
ok('a start click grows the explorer trail to one step', afterStart === 1, `explore ${afterStart}`)
ok('while the map still draws the desk\'s route, unchanged', (await routeLen()) === deskRoute, `route ${await routeLen()} vs ${deskRoute}`)
ok('and the map\'s pins are untouched', (await pins()) === deskPins, `pins ${await pins()} vs ${deskPins}`)

// ── follow a link: the explorer extends, the map still does not change ───────
// choices are the pane's untitled buttons (the step card carries a title, the
// clear button its own text); the first one is the first outgoing link.
const choice = walkPane.locator('button:not([title])').filter({ hasNotText: 'clear walk' }).first()
await choice.click()
await page.waitForTimeout(500)
const afterLink = await exploreLen()
ok('following a link extends the explorer trail', afterLink === 2, `explore ${afterLink}`)
ok('while the map still draws the desk\'s route', (await routeLen()) === deskRoute, `route ${await routeLen()} vs ${deskRoute}`)
ok('and the map\'s pins are still untouched', (await pins()) === deskPins, `pins ${await pins()} vs ${deskPins}`)

// ── clear the explorer: only the explorer empties ────────────────────────────
await walkPane.getByRole('button', { name: '✕ clear walk' }).click()
await page.waitForTimeout(400)
ok('clearing the explorer empties only the explorer', (await exploreLen()) === 0, `explore ${await exploreLen()}`)
ok('and the desk\'s route is still on the map', (await routeLen()) === deskRoute, `route ${await routeLen()} vs ${deskRoute}`)
ok('with its pins still there', (await pins()) === deskPins, `pins ${await pins()} vs ${deskPins}`)

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
