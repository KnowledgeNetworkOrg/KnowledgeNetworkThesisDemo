// DS OB-091 + OB-092 — the walk editor's unresolved "pick a node" slot.
//
// Two facts a unit test cannot reach, because both are about where a
// content-sized pill lands inside a box the road's layout arithmetic reserved:
//
//   OB-091  the pill's horizontal midpoint must sit on the SAME centre line as
//           the resolved NodeChip columns above and below it. The pill is
//           `inline-flex` by design (sized to its own content, never stretched
//           to the column), so only the host can centre it — and `items-center`
//           on a row flex centres the CROSS axis, which is why it was sitting
//           left for so long while looking deliberately aligned.
//
//   OB-092  hovering the pill reveals a ✕, and clicking it removes that slot
//           from the chain — the same act a resolved step's own NodeChip
//           already offers, so the road never swaps which control it renders
//           as a step resolves.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-newversion.mjs, whose
// route to an unset slot (plan preset → open a group card → add a version) this
// reuses rather than re-deriving.
//
// Run from anywhere:  node tools/studio-spike/drive-pickerslot.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5211
mkdirSync(OUT, { recursive: true })

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  cwd: REPO,
  stdio: ['ignore', 'pipe', 'pipe'],
})
await new Promise((res, rej) => {
  let out = ''
  const t = setTimeout(() => rej(new Error('vite never came up:\n' + out)), 30000)
  const watch = (d) => {
    out += String(d)
    if (out.includes('localhost:')) { clearTimeout(t); res() }
  }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + out)))
})

const errors = []
const checks = []
const ok = (name, pass, detail = '') => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await page.locator('[aria-label="studio-preset-plan"]').click()
  await page.waitForTimeout(600)

  // ── reach an unset slot: open a group card, add an empty version ──────────
  // The version menu opens from a group card's version ROW. Its onClick is guarded
  // by `if (!editing)` and the version NAME inside it is an InlineText that starts
  // a rename instead, so the click lands on the row's LEFT EDGE (the check glyph)
  // — drive-newversion.mjs found that the hard way; do not "simplify" it.
  const firstCard = page.locator('[data-road-root] [data-rstage]').first()
  await firstCard.scrollIntoViewIfNeeded()
  const versionRow = firstCard.locator('[role="button"]').filter({ hasText: /v\d/ }).first()
  ok('a group card with a version row is on the road', (await versionRow.count()) > 0)
  const rowBox = await versionRow.boundingBox()
  await page.mouse.click(rowBox.x + 6, rowBox.y + rowBox.height / 2)
  await page.waitForTimeout(400)
  const addRow = page.getByText(/new version|add version|\+ *version/i).first()
  ok('the version menu offers a new, empty version', (await addRow.count()) > 0)
  await addRow.click()
  await page.waitForTimeout(700)

  const slot = page.locator('[data-rpicknode]').first()
  ok('an unresolved slot is on the road', (await slot.count()) > 0)
  if ((await slot.count()) === 0) throw new Error('no unset slot to measure')

  // ── OB-091: the pill sits on the column's centre line ─────────────────────
  // The wrapper is the absolutely-positioned box the layout pass reserved
  // (width = pl.w, the same box a resolved NodeChip fills edge to edge); the
  // pill is the content-sized span inside it.
  const geom = await slot.evaluate((el) => {
    const wrap = el.parentElement
    const pill = el.firstElementChild
    const w = wrap.getBoundingClientRect()
    const p = pill.getBoundingClientRect()
    return {
      wrapMid: w.left + w.width / 2,
      pillMid: p.left + p.width / 2,
      wrapW: Math.round(w.width),
      pillW: Math.round(p.width),
    }
  })
  const off = Math.abs(geom.wrapMid - geom.pillMid)
  ok('the pill is centred in its column, not left-anchored', off <= 1,
    `off by ${off.toFixed(2)}px · pill ${geom.pillW} in a ${geom.wrapW} box`)

  // the same centre line every resolved step sits on — proves the box itself is
  // the right thing to have centred in, not just that the pill is centred in it
  const chipMids = await page.locator('[data-road-root] [data-node]:not([data-runset])').evaluateAll(
    (els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2 }),
  )
  if (chipMids.length) {
    const near = chipMids.reduce((a, b) => (Math.abs(b - geom.pillMid) < Math.abs(a - geom.pillMid) ? b : a))
    ok('and on the same line as the resolved steps', Math.abs(near - geom.pillMid) <= 1,
      `pill ${geom.pillMid.toFixed(1)} vs chip ${near.toFixed(1)}`)
  }

  await page.screenshot({ path: `${OUT}/pickerslot-01-centred.png` })

  // ── OB-092: hover reveals a ✕, and it removes the slot ────────────────────
  const before = await page.locator('[data-rpicknode]').count()
  const del = slot.locator('button[aria-label="delete this node"], button[title="delete this node"]').first()
  ok('the slot carries a delete control', (await del.count()) > 0)

  if ((await del.count()) > 0) {
    const hidden = await del.evaluate((el) => getComputedStyle(el).opacity)
    ok('and it is receded at rest, not sitting on screen', Number(hidden) < 0.5, `opacity ${hidden}`)

    await slot.hover()
    await page.waitForTimeout(350)
    const shown = await del.evaluate((el) => getComputedStyle(el).opacity)
    ok('hovering the pill reveals it', Number(shown) > 0.5, `opacity ${shown}`)
    await page.screenshot({ path: `${OUT}/pickerslot-02-hover.png` })

    await del.click({ force: true })
    await page.waitForTimeout(500)
    const after = await page.locator('[data-rpicknode]').count()
    ok('clicking it removes the slot from the chain', after === before - 1, `${before} → ${after}`)
  }
} finally {
  console.log('\npage errors:', errors.length ? '\n  ' + errors.join('\n  ') : '(none)')
  await browser.close()
  vite.kill()
}

const failed = checks.filter((c) => !c).length
console.log(failed || errors.length ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed || errors.length ? 1 : 0)
