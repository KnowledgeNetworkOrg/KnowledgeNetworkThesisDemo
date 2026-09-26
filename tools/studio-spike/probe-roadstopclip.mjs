// DS OB-217 — runs the road stop clip probe (roadstopclip/) in FIREFOX and in Chromium, against
// this app's build, and reports the line columns the receipt has to carry.
//
// The fault is engine-specific: Firefox's canvas `measureText` undershoots its own DOM layout by
// ~0.24-0.48px, so a title measured a fraction UNDER its column lays out a fraction over it, wraps
// anyway, and a box sized from the one-line prediction crops the second line. The fix is a 1px
// margin on the wrap decision (`WRAP_SAFETY_PX`, textMeasure.ts). So the check that matters is
// Firefox: `titleLines` equal to lines DRAWN on both stops, both reading "fits". Chromium is run
// beside it as the control — it agreed before the fix and must still agree after.
//
// Uses Playwright's own Firefox build (`npx playwright install firefox` if it is missing). It is
// Firefox's engine with Playwright's automation patches, not a branded release — say so when
// reporting a number from it.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/probe-roadstopclip.mjs
// Exits nonzero if any engine predicts fewer lines than it draws, or any stop reads SHORT.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5271
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium, firefox } = require('playwright-core')

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

const engines = [
  { name: 'firefox', launch: () => firefox.launch({ headless: true }) },
  { name: 'chromium (msedge)', launch: () => chromium.launch({ channel: 'msedge', headless: true }) },
]
try {
  for (const e of engines) {
    const browser = await e.launch()
    try {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
      page.on('pageerror', (err) => errors.push(`${e.name} pageerror: ${err.message}`))
      await page.goto(`http://localhost:${PORT}/tools/studio-spike/roadstopclip/index.html`)
      await page.waitForSelector('[data-probe-result]', { state: 'attached', timeout: 20000 })
      const res = JSON.parse(await page.$eval('[data-probe-result]', (el) => el.textContent))
      const version = browser.version()
      console.log(`\n${e.name} ${version} — WRAP_SAFETY_PX ${res.wrapSafetyPx}`)
      for (const r of res.rows) {
        console.log(`  ${r.label.padEnd(30)} box ${r.width} x ${r.predH}  column ${r.column}  titleLines ${r.predLines}  DRAWN ${r.drawnLines}  line ${r.lineH}  needs ${r.needed}  ${r.verdict === 'SHORT' ? '+' + r.short + ' SHORT' : 'fits'}`)
        ok(`${e.name}: ${r.label} — predicts the lines it draws`, r.predLines === r.drawnLines, `titleLines ${r.predLines}, drawn ${r.drawnLines}, column ${r.column}px`)
        ok(`${e.name}: ${r.label} — the box fits its own text`, r.verdict === 'fits', `needs ${r.needed}, told ${r.predH}`)
      }
      await page.screenshot({ path: `${OUT}/ob217-roadstopclip-${e.name.split(' ')[0]}.png`, fullPage: true })
    } finally {
      await browser.close()
    }
  }
} finally {
  vite.kill()
}

console.log('\n' + checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shots at tools/studio-spike/shots/ob217-roadstopclip-{firefox,chromium}.png')
