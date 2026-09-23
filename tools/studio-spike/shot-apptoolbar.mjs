// Verification for the app-level toolbar (#55, OB-064): src/studio/AppToolbar.tsx,
// mounted once at StudioView.tsx:190, outside every pane, pinned under the app
// header. Was text-label pills ("undo", "print", …); OB-064 shipped the missing
// marks and asked for glyph-only pills instead, in four groups: new map | undo/redo
// | print/save/load | copy/paste/cut.
//
// Same idiom as shot-toolbox.mjs beside this file — own the vite lifecycle
// (backgrounded dev servers die on this machine), msedge headless, collect
// pageerror/console errors, exit nonzero on any. What this driver checks:
//   1. GLYPH-ONLY — every item's button carries no visible text (no `label`);
//      the DS forbade this before the marks existed, and a stray leftover label
//      string is the easy way to silently keep the old bar.
//   2. ALL NINE TOOLTIPS — the real name survives even with no visible word.
//   3. DISABLED SET — only undo/redo have a command model; the other seven
//      (new map, print, save, load, copy, paste, cut) render disabled, honestly,
//      not silently un-disabled by an over-eager port.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5206
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
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})
const fail = (msg) => {
  errors.push(`ASSERT FAIL: ${msg}`)
  console.log('FAIL:', msg)
}

await page.goto(`http://localhost:${PORT}/`)
await page.waitForTimeout(700)

const TITLES = {
  'New map': true,
  'Undo (Ctrl+Z)': false,
  'Redo (Ctrl+Y)': false,
  'Print (Ctrl+P)': true,
  'Save (Ctrl+S)': true,
  Load: true,
  'Copy (Ctrl+C)': true,
  'Paste (Ctrl+V)': true,
  'Cut (Ctrl+X)': true,
}

const found = []
for (const [title, expectDisabled] of Object.entries(TITLES)) {
  const btn = page.getByTitle(title, { exact: true })
  const n = await btn.count()
  if (n !== 1) {
    fail(`expected exactly one button titled "${title}", found ${n}`)
    continue
  }
  // textContent() would also pick up each mark's own invisible baseline-keeper
  // span ("+"), which is aria-hidden and correctly present — that is not a
  // visible label. What ToolbarItem actually renders when `label` is omitted is
  // {glyph}{label} as two DIRECT children of the button, so only a direct TEXT
  // NODE child of the button itself (not inside the glyph's own wrapper span)
  // would be a leftover `label` string.
  const directText = await btn.evaluate((el) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent?.trim() || '')
      .join(''),
  )
  if (directText !== '') fail(`button "${title}" has a visible label ${JSON.stringify(directText)} — expected glyph-only`)
  const disabled = await btn.isDisabled()
  if (disabled !== expectDisabled) fail(`button "${title}" disabled=${disabled}, expected ${expectDisabled}`)
  found.push(title)
}
console.log('toolbar buttons matched by tooltip =', found.length, '/', Object.keys(TITLES).length)

await page.screenshot({ path: `${OUT}/apptoolbar.png`, clip: { x: 0, y: 0, width: 1750, height: 120 } })
console.log('apptoolbar.png taken')

// undo/redo still wired — click undo once, just confirm it does not throw (no
// draft history to unwind on a fresh load, so this is a safe-no-op check, not a
// behavior assertion; authordraft.ts's own tests cover the history itself)
await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click()
await page.waitForTimeout(150)

await browser.close()
vite.kill()
if (errors.length) {
  console.log('ERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('DONE — all assertions passed')
