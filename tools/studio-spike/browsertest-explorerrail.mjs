// browsertest-explorerrail.mjs — #341, the dissolution's step 2.
//
// A TEST. It opens the real app in a real browser and asserts what a person sees: the Explorer
// rail on the map pane, one selection across rail and map, the hover mirror both ways, the
// preview card, deselect/reselect, the fold-once open rule, the map's upper row, and the
// draggable seam. The unit suite pins the pure parts (`OpenOnSelect`, `OpenForVisible`,
// `ContainPaint`, `railWidth`); this proves the wiring — the half a correct function cannot.
//
// WHAT IT SELECTS BY, AND WHY NOT TITLES. Every surface it needs has a data-* hook:
// `[data-explorer-rail]` / `[data-explorer-corner]` (this mount's own, attributes only),
// `svg[data-nested][data-sel]` (the map's selection), `[data-node-id][data-open]` (the tree),
// `[data-tip-layer]`/`[data-preview-contains]` (the preview), `[data-spot]` (the map's
// spotlight). A driver that found these by their words would break on the next copy change.
//
// THE MOUSE HAS TO TRAVEL (see browsertest-maphover.mjs): `mouse.move(x, y)` teleports, and the
// preview card is placed from the previous move, so every approach steps.
//
// Spawns vite ITSELF on its own fixed port (--strictPort) — backgrounded dev servers die on
// this machine, and one port per test is what lets two checkouts run at once.
// Run from anywhere:  node tools/studio-spike/browsertest-explorerrail.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5262

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
  if (!cond) errors.push(name + (detail ? ' - ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
const selId = () => page.evaluate(() => document.querySelector('svg[data-nested]')?.getAttribute('data-sel') ?? null)
/** park the pointer in the app's top-left chrome, off every pane under test */
const park = async () => { await page.mouse.move(5, 5); await page.waitForTimeout(140) }
/** cross INTO a target rather than teleporting onto it — see the note at the top */
const glideTo = async (p) => { await page.mouse.move(p.x, p.y, { steps: 14 }); await page.waitForTimeout(300) }
/** the pill box is the row's first child; its background IS the wash under test */
const pillWash = (id) => page.evaluate((id) => {
  const row = document.querySelector(`[data-explorer-rail] [data-node-id="${id}"]`)
  const pill = row && row.firstElementChild
  return pill ? getComputedStyle(pill).backgroundColor : null
}, id)

// ── 0. the rail is on the map (closed at first), and its corner opens it ───
ok('the map is on the desk', await has('svg[data-nested]'))
ok('the Explorer rail is mounted on the map pane', await has('[data-explorer-rail]'))
ok('the rail starts closed, leaving the map as it was', !(await has('[data-explorer-rail] [data-node-id]')))
await page.locator('[data-explorer-corner] button').click()
await page.waitForTimeout(450)
ok('the corner in the map\'s row opens the rail', await has('[data-explorer-rail] [data-node-id]'))
ok('the rail filter is the system text box', await has('[data-explorer-rail] input'))
const rowCount0 = await page.locator('[data-explorer-rail] [data-node-id]').count()
ok('the tree drew its rows', rowCount0 >= 2, `${rowCount0} rows`)

// ── 1. ONE SELECTION, and selecting a container opens it (OB-227 cl.1, OB-244 cl.2) ──
const closedContainer = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
  const r = rows.find((el) => el.querySelector('[data-caret]') && el.getAttribute('data-open') === '0')
  return r ? r.getAttribute('data-node-id') : null
})
ok('a closed container row exists to select', !!closedContainer, String(closedContainer))
if (closedContainer) {
  const before = await page.locator('[data-explorer-rail] [data-node-id]').count()
  await page.locator(`[data-explorer-rail] [data-node-id="${closedContainer}"]`).first().click()
  await page.waitForTimeout(350)
  ok('selecting a pill selects the map\'s node', (await selId()) === closedContainer, String(await selId()))
  const after = await page.locator('[data-explorer-rail] [data-node-id]').count()
  ok('selecting a container opens it', after > before, `${before} -> ${after}`)
}

// ── 2. deselect and RESELECT the same row (OB-240) ─────────────────────────
if (closedContainer) {
  await page.locator(`[data-explorer-rail] [data-node-id="${closedContainer}"]`).first().click()
  await page.waitForTimeout(320)
  ok('clicking the selected row clears the selection (map ring out, data-sel gone)', (await selId()) === null, String(await selId()))
  await page.locator(`[data-explorer-rail] [data-node-id="${closedContainer}"]`).first().click()
  await page.waitForTimeout(320)
  ok('the node just deselected re-selects normally', (await selId()) === closedContainer, String(await selId()))
  /* …and clear it again, so the wash checks below are not read off a SELECTED row — a selected
     pill's background is the accent wash and does not change under any hover. */
  await page.locator(`[data-explorer-rail] [data-node-id="${closedContainer}"]`).first().click()
  await page.waitForTimeout(320)
  ok('and it clears again, leaving nothing selected for the wash checks', (await selId()) === null)
}

// ── 3. the map's hover washes the tree row, and it is THE SAME wash (OB-248 cl.1) ──
const cellPoint = await page.evaluate(() => {
  const svg = document.querySelector('svg[data-nested]')
  if (!svg) return null
  const b = svg.getBoundingClientRect()
  for (let y = b.y + 12; y < b.y + b.height - 12; y += 10) {
    for (let x = b.x + 10; x < b.x + b.width - 10; x += 8) {
      const el = document.elementFromPoint(x, y)
      const id = el && (el.getAttribute('data-terr') || el.getAttribute('data-region'))
      if (!id) continue
      if (getComputedStyle(el).pointerEvents === 'none') continue
      if (!document.querySelector(`[data-explorer-rail] [data-node-id="${id}"]`)) continue
      return { x, y, id }
    }
  }
  return null
})
ok('found a live map cell whose node is a visible tree row', !!cellPoint, JSON.stringify(cellPoint))
if (cellPoint) {
  await park()
  const rest = await pillWash(cellPoint.id)
  await glideTo(cellPoint)
  const mirrored = await pillWash(cellPoint.id)
  ok('hovering the map cell washes its tree row', mirrored !== rest && mirrored !== 'rgba(0, 0, 0, 0)', `${rest} -> ${mirrored}`)
  await park()
  await page.waitForTimeout(200)
  ok('leaving the map clears the row wash', (await pillWash(cellPoint.id)) === rest)
  // the direct hover on the row itself, for the "same wash" half of the clause
  const box = await page.locator(`[data-explorer-rail] [data-node-id="${cellPoint.id}"]`).first().boundingBox()
  if (box) {
    await glideTo({ x: box.x + box.width - 8, y: box.y + box.height / 2 })
    await page.waitForTimeout(250)
    ok('the mirrored wash is the one a DIRECT hover draws', (await pillWash(cellPoint.id)) === mirrored, await pillWash(cellPoint.id))
    await park()
    await page.waitForTimeout(200)
  }
}

// ── 4. a tree hover lights the map with the hover's own treatment (OB-248 cl.5) ──
const rowWithCell = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
  for (const r of rows) {
    const id = r.getAttribute('data-node-id')
    if (document.querySelector(`svg[data-nested] [data-region="${id}"]`) || document.querySelector(`svg[data-nested] [data-terr="${id}"]`)) return id
  }
  return null
})
ok('found a tree row with its own territory on the map', !!rowWithCell, String(rowWithCell))
if (rowWithCell) {
  await park()
  const box = await page.locator(`[data-explorer-rail] [data-node-id="${rowWithCell}"]`).first().boundingBox()
  if (box) {
    await glideTo({ x: box.x + box.width - 8, y: box.y + box.height / 2 })
    ok('a tree hover lights the map (the spotlight)', await has('svg[data-nested] [data-spot]'))
    await park()
    await page.waitForTimeout(260)
    ok('leaving the row puts the map light out', !(await has('svg[data-nested] [data-spot]')))
  }
}

// ── 5. the preview card answers a hover, and the pill carries no native title (OB-228) ──
const containerForCard = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
  const r = rows.find((el) => el.querySelector('[data-caret]'))
  return r ? r.getAttribute('data-node-id') : null
})
ok('a container row exists to hover', !!containerForCard, String(containerForCard))
if (containerForCard) {
  ok('a tree that draws a preview sets no native title on the row',
    await page.evaluate((id) => !document.querySelector(`[data-explorer-rail] [data-node-id="${id}"]`).hasAttribute('title'), containerForCard))
  await park()
  const box = await page.locator(`[data-explorer-rail] [data-node-id="${containerForCard}"]`).first().boundingBox()
  if (box) {
    await glideTo({ x: box.x + box.width - 8, y: box.y + box.height / 2 })
    await page.waitForTimeout(500)
    ok('hovering a pill raises the preview card', await has('[data-tip-layer] [data-preview-contains]'))
    const line = await page.evaluate(() => document.querySelector('[data-preview-contains]')?.textContent?.trim() ?? '')
    ok('the card carries the container\'s count line', /\d/.test(line), JSON.stringify(line))
    await park()
    await page.waitForTimeout(300)
    ok('leaving the rail takes the card down', !(await has('[data-preview-contains]')))
  }
}

// ── 6. the fold is ONCE: an ancestor collapsed after a selection STAYS collapsed (OB-244 cl.3) ──
if (closedContainer) {
  const child = await page.evaluate((parent) => {
    const rows = [...document.querySelectorAll('[data-explorer-rail] [data-node-id]')]
    const i = rows.findIndex((r) => r.getAttribute('data-node-id') === parent)
    return i >= 0 && rows[i + 1] ? rows[i + 1].getAttribute('data-node-id') : null
  }, closedContainer)
  if (child) {
    await page.locator(`[data-explorer-rail] [data-node-id="${child}"]`).first().click()
    await page.waitForTimeout(320)
    await page.locator(`[data-explorer-rail] [data-node-id="${closedContainer}"] [data-caret]`).first().click()
    await page.waitForTimeout(450)
    const state = await page.evaluate((id) => document.querySelector(`[data-explorer-rail] [data-node-id="${id}"]`).getAttribute('data-open'), closedContainer)
    ok('a collapsed ancestor of the selection STAYS collapsed (no per-render re-force)', state === '0', `data-open=${state}`)
    await page.locator(`[data-explorer-rail] [data-node-id="${closedContainer}"] [data-caret]`).first().click()
    await page.waitForTimeout(320)
  } else {
    ok('the selected container has a child row to collapse around', false, 'no child row found')
  }
}

// ── 7. the rail closes into the map's upper row, at one height (OB-241, OB-250's DOM clause) ──
/* the head's handle is the rail's FIRST button — the tree's rows and carets are divs/spans, so
   the only other button the rail holds is the filter's own clear glyph, further down. */
const handle = page.locator('[data-explorer-rail] button').first()
const handleBox = await handle.boundingBox()
ok('the rail\'s open head carries the handle', !!handleBox)
await handle.click()
await page.waitForTimeout(350)
ok('the closed rail is gone from the pane', !(await has('[data-explorer-rail] [data-node-id]')))
const cornerWord = await page.evaluate(() => document.querySelector('[data-explorer-corner] button')?.textContent ?? '')
ok('the way back sits in the map\'s row, not floating', cornerWord.includes('Explorer'), JSON.stringify(cornerWord))
/* OB-250's DOM clause compares the closed BUTTON's top with the open HEAD ROW's top — the row,
   not the handle's box inside it (an aligned flex row centres a smaller control). */
const headRowTop = await page.evaluate(() => {
  const rail = document.querySelector('[data-explorer-rail] > div')
  const head = rail && rail.firstElementChild && rail.firstElementChild.firstElementChild
  return head ? head.getBoundingClientRect().top : null
})
const cornerBox = await page.locator('[data-explorer-corner] button').boundingBox()
if (headRowTop != null && cornerBox) {
  ok('the open head row and the closed corner start at one height (±1px)', Math.abs(cornerBox.y - headRowTop) <= 1, `${headRowTop.toFixed(1)} vs ${cornerBox.y.toFixed(1)}`)
}
ok('the breadcrumb row is beside it', await has('[data-explorer-corner] + div button'))
await page.locator('[data-explorer-corner] button').click()
await page.waitForTimeout(350)
ok('the corner opens the rail again', await has('[data-explorer-rail] [data-node-id]'))

// ── 8. the seam drags, and a double-click fits it back (OB-253) ─────────────
const railBox = await page.locator('[data-explorer-rail]').boundingBox()
const sep = page.locator('[data-explorer-rail] [role="separator"]')
ok('the seam draws the divider', (await sep.count()) === 1, `${await sep.count()} found`)
if (railBox && (await sep.count()) === 1) {
  const sb = await sep.first().boundingBox()
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.down()
  await page.mouse.move(sb.x + sb.width / 2 + 80, sb.y + sb.height / 2, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const grown = (await page.locator('[data-explorer-rail]').boundingBox()).width
  ok('dragging the seam widens the rail by the drag', Math.abs((grown - railBox.width) - 80) <= 4, `${railBox.width} -> ${grown}`)
  await sep.first().dblclick()
  await page.waitForTimeout(300)
  const back = (await page.locator('[data-explorer-rail]').boundingBox()).width
  ok('double-click returns the seam to the rail\'s own fit', Math.abs(back - railBox.width) <= 2, `${grown} -> ${back}`)
}

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
