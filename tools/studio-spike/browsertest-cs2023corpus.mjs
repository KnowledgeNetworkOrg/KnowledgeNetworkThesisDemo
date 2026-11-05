// browsertest-cs2023corpus.mjs — the app, loaded against the CS2023 corpus.
//
// A TEST. It opens the real app in a real browser with `VITE_CORPUS=cs2023` and
// asserts that the Studio comes up on the CS2023 map: no page error, the map
// draws, and the names on screen are CS2023 knowledge areas rather than the
// hand-authored teaching topics or the TMU courses.
//
// WHY THIS EXISTS. The same reason as browsertest-coursecorpus.mjs: a module-level
// guard that names another corpus's id shows up only as a blank screen, and only
// in the browser. This corpus also has 17 domains, more than the ring's 16 hues,
// and no walks yet, two shapes the other corpora never load.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-cs2023corpus.mjs
// Frames land in tools/studio-spike/out/ (gitignored).
// Exits nonzero on any failed assertion or any page error.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite({ env: { VITE_CORPUS: 'cs2023' } })

const errors = []
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}
${e.stack ?? ''}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)

  // 1. the app mounted at all — the single thing a module-load throw would deny
  const svgs = await page.locator('svg').count()
  if (svgs === 0) fail('no svg on the page — the app did not render')

  // 2. the text on screen is the CS2023 corpus, not the teaching or the course one
  const text = await page.locator('body').innerText()
  for (const other of ['Virtual Memory', 'Propositional Logic', 'Hash Tables', 'CPS 109 Computer Science I']) {
    if (text.includes(other)) fail(`"${other}" belongs to another corpus and should not be on screen`)
  }

  // 3. the CS2023 knowledge areas are the map's top level
  const areas = ['Artificial Intelligence (AI)', 'Software Engineering (SE)']
  for (const area of areas) {
    if (!text.includes(area)) fail(`area "${area}" is not on screen`)
  }

  await page.screenshot({ path: OUT + '/cs2023corpus-studio.png' })
  console.log('shot in tools/studio-spike/out/cs2023corpus-studio.png')
} finally {
  await browser.close()
  vite.kill()
}

if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('PASS — the app runs on the CS2023 corpus')
