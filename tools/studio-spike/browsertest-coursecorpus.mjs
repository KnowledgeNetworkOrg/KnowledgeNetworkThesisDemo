// browsertest-coursecorpus.mjs — the app, loaded against the OTHER corpus.
//
// A TEST. It opens the real app in a real browser with `VITE_CORPUS=courses` and
// asserts that the Studio comes up on Toronto Metropolitan University's real
// course data: no page error, the map draws, and the names on screen are course
// codes rather than the hand-authored teaching topics.
//
// WHY THIS EXISTS. Everything else that checks the second corpus is a unit test,
// and a unit test cannot catch the failure this guards against: a module-level
// guard somewhere in the app that names an id of the teaching corpus and throws
// on import. Two of those existed (`model/lens.ts`'s hub, the Walk Desk's seed
// plan) and neither showed up as anything but a blank screen.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-coursecorpus.mjs
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

const { vite, port: PORT } = await startVite({ env: { VITE_CORPUS: 'courses' } })

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

  // 2. the text on screen is the COURSE corpus, not the teaching one
  const text = await page.locator('body').innerText()
  const codes = (text.match(/\bCPS ?\d{3}\b/g) ?? []).length
  if (codes < 3) fail(`expected several course codes on screen, saw ${codes}`)
  for (const teachingOnly of ['Virtual Memory', 'Propositional Logic', 'Hash Tables']) {
    if (text.includes(teachingOnly)) fail(`"${teachingOnly}" is a teaching-corpus topic and should not be on screen`)
  }

  // 3. the subject areas the generator built are the map's top level
  for (const area of ['Computer Systems', 'Software Engineering']) {
    if (!text.includes(area)) fail(`subject area "${area}" is not on screen`)
  }

  await page.screenshot({ path: OUT + '/coursecorpus-studio.png' })
  console.log(`saw ${codes} course-code mentions; shot in tools/studio-spike/out/coursecorpus-studio.png`)
} finally {
  await browser.close()
  vite.kill()
}

if (errors.length) {
  console.log('\n' + errors.join('\n'))
  process.exit(1)
}
console.log('PASS — the app runs on the course corpus')
