// #76 FloatingPanel interaction proof. Same idiom as tools/studio-spike/browsertest-studiodesk.mjs
// (createRequire -> playwright-core, msedge, headless, script OWNS the vite
// lifecycle because backgrounded dev servers die on this machine). What the unit
// tests in src/ui/floatingPanel.test.ts CANNOT reach — real pointer input flowing
// through onPointerDown -> window pointermove/up -> setRect -> repaint, plus
// localStorage surviving a reload and the auto-hide fade — is what this asserts.
//
// Run: node tools/floating-panel-spike/drive.mjs   (exits nonzero on any failure)
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const OUT = join(HERE, 'out')
const PORT = 5199
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
const fail = (msg) => {
  errors.push(msg)
  console.log('FAIL:', msg)
}
const near = (a, b, tol = 3) => Math.abs(a - b) <= tol
const STORE_KEY = 'pkt.floating-panel.harness'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
page.on('pageerror', (e) => fail(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') fail(`console: ${m.text()}`)
})

// a real pointer drag: down at `from`, glide to `to` in steps, release. Steps
// matter — a single jump can skip the grab element's hit test.
const dragPointer = async (from, to, steps = 14) => {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps })
  await page.mouse.up()
  await page.waitForTimeout(120)
}
const centerOf = async (loc) => {
  const b = await loc.boundingBox()
  if (!b) throw new Error('no bounding box for locator')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b }
}

const url = `http://localhost:${PORT}/tools/floating-panel-spike/harness.html`
await page.goto(url)
// start from the default anchor, not a rect left by a previous run
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(400)

const panel = page.locator('[aria-label="Toolbox"]')
// The drag handle is the DS PaneHeader's legend title (OB-013): the panel's
// hand-written copy of that hat is gone, and with it the aria-label this used
// to address. OB-023 gave PaneHeader a stable hook of its own — data-grab on
// the grabbable title's own span — so this locates the handle by that
// attribute rather than by the title's text, which breaks the moment the
// panel's name changes.
const handle = page.locator('[aria-label="Toolbox"] [data-grab]')
const seCorner = page.locator('[aria-label="Toolbox"] [aria-label="floating-panel-resize-se"]')
const wEdge = page.locator('[aria-label="Toolbox"] [aria-label="floating-panel-resize-w"]')
const hostMove = page.locator('[aria-label="host-move"]')

// ── 1. DRAG — the handle moves the panel by the pointer delta ───────────────
{
  const before = (await panel.boundingBox())
  const h = await centerOf(handle)
  await dragPointer(h, { x: h.x + 90, y: h.y + 60 })
  const after = await panel.boundingBox()
  console.log(`drag: (${before.x.toFixed(0)},${before.y.toFixed(0)}) -> (${after.x.toFixed(0)},${after.y.toFixed(0)}) expect +90,+60`)
  if (!near(after.x - before.x, 90)) fail(`drag dx: expected ~90, got ${(after.x - before.x).toFixed(1)}`)
  if (!near(after.y - before.y, 60)) fail(`drag dy: expected ~60, got ${(after.y - before.y).toFixed(1)}`)
}
await page.screenshot({ path: `${OUT}/1-dragged.png` })

// ── 2. RESIZE — the SE corner grows width+height by the delta ───────────────
{
  const before = await panel.boundingBox()
  const c = await centerOf(seCorner)
  await dragPointer(c, { x: c.x + 70, y: c.y + 45 })
  const after = await panel.boundingBox()
  console.log(`resize SE: ${before.width.toFixed(0)}x${before.height.toFixed(0)} -> ${after.width.toFixed(0)}x${after.height.toFixed(0)} expect +70,+45`)
  if (!near(after.width - before.width, 70)) fail(`resize dw: expected ~70, got ${(after.width - before.width).toFixed(1)}`)
  if (!near(after.height - before.height, 45)) fail(`resize dh: expected ~45, got ${(after.height - before.height).toFixed(1)}`)
}
await page.screenshot({ path: `${OUT}/2-resized.png` })

// ── 3. RESIZE W — the left edge moves the origin, right edge anchored ────────
{
  const before = await panel.boundingBox()
  const right0 = before.x + before.width
  const c = await centerOf(wEdge)
  await dragPointer(c, { x: c.x - 40, y: c.y }) // pull the left edge outward
  const after = await panel.boundingBox()
  const right1 = after.x + after.width
  console.log(`resize W: x ${before.x.toFixed(0)}->${after.x.toFixed(0)}, right ${right0.toFixed(0)}->${right1.toFixed(0)} (right must stay put)`)
  if (!near(after.x - before.x, -40)) fail(`resize W dx: expected ~-40, got ${(after.x - before.x).toFixed(1)}`)
  if (!near(right1, right0)) fail(`resize W anchored right edge moved: ${right0.toFixed(1)} -> ${right1.toFixed(1)}`)
}

// ── 4. CLAMP — dragging past the top-left wall pins inside the host ──────────
{
  const hostBox = await hostMove.boundingBox()
  const h = await centerOf(handle)
  await dragPointer(h, { x: h.x - 600, y: h.y - 600 }) // way past the corner
  const after = await panel.boundingBox()
  const localX = after.x - hostBox.x
  const localY = after.y - hostBox.y
  console.log(`clamp: panel host-local pos = (${localX.toFixed(1)}, ${localY.toFixed(1)}) expect ~0,0`)
  if (!near(localX, 0)) fail(`clamp x: expected ~0, got ${localX.toFixed(1)}`)
  if (!near(localY, 0)) fail(`clamp y: expected ~0, got ${localY.toFixed(1)}`)
}

// ── 5. PERSIST — the stored rect matches the live panel, and survives reload ─
{
  const hostBox = await hostMove.boundingBox()
  const live = await panel.boundingBox()
  const stored = await page.evaluate((k) => localStorage.getItem(k), STORE_KEY)
  if (!stored) {
    fail('persist: nothing stored under ' + STORE_KEY)
  } else {
    const r = JSON.parse(stored)
    console.log(`persist: stored=${JSON.stringify(r)} live host-local=(${(live.x - hostBox.x).toFixed(0)},${(live.y - hostBox.y).toFixed(0)} ${live.width.toFixed(0)}x${live.height.toFixed(0)})`)
    if (!near(r.x, live.x - hostBox.x)) fail(`persist x mismatch: stored ${r.x} vs live ${(live.x - hostBox.x).toFixed(1)}`)
    if (!near(r.y, live.y - hostBox.y)) fail(`persist y mismatch: stored ${r.y} vs live ${(live.y - hostBox.y).toFixed(1)}`)
    if (!near(r.w, live.width)) fail(`persist w mismatch: stored ${r.w} vs live ${live.width.toFixed(1)}`)
    if (!near(r.h, live.height)) fail(`persist h mismatch: stored ${r.h} vs live ${live.height.toFixed(1)}`)

    // reload: the panel must come back at the stored rect, not the defaultRect
    await page.reload()
    await page.waitForTimeout(400)
    const host2 = await hostMove.boundingBox()
    const restored = await panel.boundingBox()
    console.log(`persist reload: restored host-local=(${(restored.x - host2.x).toFixed(0)},${(restored.y - host2.y).toFixed(0)} ${restored.width.toFixed(0)}x${restored.height.toFixed(0)}) expect ${JSON.stringify(r)}`)
    if (!near(restored.x - host2.x, r.x)) fail(`reload x: expected ${r.x}, got ${(restored.x - host2.x).toFixed(1)}`)
    if (!near(restored.width, r.w)) fail(`reload w: expected ${r.w}, got ${restored.width.toFixed(1)}`)
    // proves it's NOT the default anchor (default was x:60,w:220)
    if (near(restored.x - host2.x, 60) && near(restored.width, 220)) fail('reload showed the default rect — persistence not applied')
  }
}

// ── 6. AUTO-HIDE — fades after idle, wakes on host pointer activity ──────────
{
  const hidePanel = page.locator('[aria-label="Auto-hide"]')
  await page.mouse.move(10, 10) // pointer well away from the auto-hide host
  await page.waitForTimeout(700) // idleMs is 400 — this is safely past the fade
  const hiddenAfterIdle = await hidePanel.getAttribute('aria-hidden')
  console.log(`auto-hide after idle: aria-hidden=${hiddenAfterIdle} (expect "true")`)
  if (hiddenAfterIdle !== 'true') fail(`auto-hide did not fade after idle: aria-hidden=${hiddenAfterIdle}`)

  const hideHost = page.locator('[aria-label="host-hide"]')
  const hc = await centerOf(hideHost)
  await page.mouse.move(hc.x, hc.y) // activity over the host wakes it
  await page.waitForTimeout(120)
  const shownAfterWake = await hidePanel.getAttribute('aria-hidden')
  console.log(`auto-hide after wake: aria-hidden=${shownAfterWake} (expect "false")`)
  if (shownAfterWake !== 'false') fail(`auto-hide did not wake on activity: aria-hidden=${shownAfterWake}`)
}
await page.screenshot({ path: `${OUT}/6-autohide.png` })

await browser.close()
vite.kill()
if (errors.length) {
  console.log('\nERRORS:\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nDONE — FloatingPanel interaction verified (drag, resize, clamp, persist, auto-hide)')
