// browsertest-cs2023builds-on.mjs — the published prerequisites as "builds on"
// links on a route, on the real app.
//
// A TEST. It opens the cs2023 build, activates CPS 209 from Trail, and reads its
// one wording: "CPS 109 or CPS 106". CPS 109 is a route and must be a button that
// opens it; CPS 106 is an outside course and must stay text with no link.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-cs2023builds-on.mjs
// Frames land in tools/studio-spike/out/ (gitignored).
// Exits nonzero on any failed assertion or any page error.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
mkdirSync(OUT, { recursive: true })

const data = JSON.parse(readFileSync(join(REPO, 'tools/cs2023import/cs2023_map.json'), 'utf8'))
const routeOf = (course) => {
  const route = data.routes.find((r) => r.course === course)
  if (!route) throw new Error(`no route for ${course}`)
  return route
}
const routeTitle = (r) => `${r.course} ${r.title}`
const WORDING = 'CPS 109 or CPS 106'

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const errors = []
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ''}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

const strip = page.locator('[aria-label="trail-strip"]')
const walkButtons = () => strip.locator('button', { hasText: '▶' })

/** Run `fn` with the palette open, and leave it as it was found. */
const withPalette = async (fn) => {
  const isOpen = async () => (await page.locator('[aria-label^="studio-inst-"]').count()) > 0
  const wasOpen = await isOpen()
  if (!wasOpen) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
  await fn()
  if ((await isOpen()) !== wasOpen) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(600)
  }
}

const stopServer = async (server) => {
  if (!server || server.vite.exitCode !== null) return
  await new Promise((res) => {
    server.vite.once('exit', res)
    server.vite.kill()
  })
}

const load = async (port) => {
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1400)
  await withPalette(async () => {
    if ((await page.locator('[aria-label="studio-pane-trail"]').count()) === 0) {
      await page.locator('[aria-label="studio-inst-trail"]').click()
    }
  })
  await page.waitForTimeout(500)
}

let server = null
try {
  server = await startVite({ env: { VITE_CORPUS: 'cs2023' } })
  await load(server.port)

  const routeCount = await walkButtons().count()
  if (routeCount !== data.routes.length) fail(`Walks list shows ${routeCount} routes, expected ${data.routes.length}`)

  const cps209 = routeOf('CPS 209')
  const cps109 = routeOf('CPS 109')
  await strip.locator('button', { hasText: `▶ ${routeTitle(cps209)}` }).click()
  await page.waitForTimeout(600)

  const builds = strip.locator('[data-builds-on]')
  const count = await builds.count()
  if (count !== 1) fail(`CPS 209 shows ${count} "Builds on" lines, expected 1`)
  else {
    const text = (await builds.innerText()).replace(/\s+/g, ' ').trim()
    console.log(`CPS 209 builds on: ${text}`)
    if (text !== `Builds on: ${WORDING}`) fail(`the line reads "${text}", expected "Builds on: ${WORDING}"`)

    const link = builds.getByRole('button', { name: 'CPS 109', exact: true })
    if ((await link.count()) !== 1) fail(`CPS 109 is ${await link.count()} buttons, expected 1`)

    const outside = builds.getByText('CPS 106', { exact: true })
    if ((await outside.count()) !== 1) fail(`CPS 106 appears ${await outside.count()} times as text, expected 1`)
    const outsideLinks = builds.locator('button').filter({ hasText: 'CPS 106' })
    if ((await outsideLinks.count()) !== 0) fail('CPS 106 is a link, expected plain text')

    if ((await link.count()) === 1) {
      await link.click()
      await page.waitForTimeout(700)
      const active = (await strip.innerText()).replace(/\s+/g, ' ')
      if (!active.includes(routeTitle(cps109))) fail(`after clicking CPS 109 the strip does not show "${routeTitle(cps109)}"`)
      if (!new RegExp(`stop 1 of ${cps109.stops.length}(\\D|$)`).test(active)) {
        fail(`CPS 109 did not open at stop 1 of ${cps109.stops.length}: "${active}"`)
      }
      if ((await strip.locator('[data-builds-on]').count()) !== 0) fail('CPS 109 shows a "Builds on" line but has no prerequisites')
    }
  }

  await page.screenshot({ path: OUT + '/cs2023builds-on.png' })
  console.log('shot in tools/studio-spike/out/cs2023builds-on.png')

  await stopServer(server)
  server = null
} finally {
  await stopServer(server)
  await browser.close()
}

if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('PASS — CPS 209 shows "Builds on: CPS 109 or CPS 106", links CPS 109 and leaves CPS 106 as text')
