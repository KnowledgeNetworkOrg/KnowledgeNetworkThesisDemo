// browsertest-connections-caret-and-release.mjs — two connections-pane obligations, measured on
// the running app (DS OB-198, OB-202).
//
// OB-198: the contains tree's force-open set excludes the SELECTED node itself, so its caret can
// still close it. The pure exclusion arithmetic is pinned in openancestors.test.ts; what a unit
// test cannot see is the INTEGRATION — does the real ConnectionsPane host actually pass the
// ancestors-only union, and does deselecting from elsewhere in the app actually clear the pill's
// wash without moving the pane's aim. Both are invisible in a still: an open-because-forced pill
// looks identical to an open-because-you-opened-it one, and the fix is a background colour on an
// inline style.
//
// OB-202: clicking empty graph releases the pin the connections pane holds; a background PAN must
// not. Extends the existing pin coverage in browsertest-connections.mjs (pin / click-again-release)
// rather than duplicating it — this file only adds the two cases that test file predates.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/browsertest-connections-caret-and-release.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5242

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
const fail = (name) => { checks.push('FAIL  ' + name); errors.push(name) }

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  const openPalette = async () => {
    if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
      await page.locator('[data-toolbar-hook="palette-toggle"]').click()
      await page.waitForTimeout(400)
    }
  }
  await openPalette()
  await page.getByLabel('studio-inst-connections').click()
  await page.waitForTimeout(700)

  const pane = () => page.locator('[aria-label="connections-pane"]')
  const rows = () => pane().locator('[data-node-id]')
  const isLit = (id) => page.evaluate(
    (nodeId) => (document.querySelector(`[aria-label="connections-pane"] [data-node-id="${CSS.escape(nodeId)}"] [data-pill-title]`)
      ?.parentElement?.parentElement?.style.background || '').includes('accent-primary-wash'),
    id,
  )
  const openAttr = (id) => page.evaluate(
    (nodeId) => document.querySelector(`[aria-label="connections-pane"] [data-node-id="${CSS.escape(nodeId)}"]`)?.getAttribute('data-open'),
    id,
  )

  // ── find a node that draws a graph, the same sweep browsertest-connections.mjs uses ────────
  // walk down one branch opening the deepest closed row each step, then walk back UP clicking
  // each row until one aims the pane at a node with typed relations (a topic, not a container)
  const descend = () => page.evaluate(() => {
    const p = document.querySelector('[aria-label="connections-pane"]')
    const closed = [...p.querySelectorAll('[data-node-id]')].filter((r) => r.getAttribute('data-open') === '0' && r.querySelector('[data-caret]'))
    if (!closed.length) return null
    const row = closed[closed.length - 1]
    row.querySelector('[data-caret]').click()
    return row.getAttribute('data-node-id')
  })
  for (let i = 0; i < 14; i++) {
    const opened = await descend()
    await page.waitForTimeout(150)
    if (!opened) break
  }
  const rowIds = await page.evaluate(() => [...document.querySelectorAll('[aria-label="connections-pane"] [data-node-id]')].map((r) => r.getAttribute('data-node-id')))
  let topicId = null
  for (const id of [...rowIds].reverse().slice(0, 14)) {
    await page.evaluate((nodeId) => {
      document.querySelector(`[aria-label="connections-pane"] [data-node-id="${CSS.escape(nodeId)}"] [data-pill-title]`)?.click()
    }, id)
    await page.waitForTimeout(350)
    const n = await page.evaluate(() => document.querySelectorAll('[data-relstar] [data-starnode]').length)
    if (n >= 1) { topicId = id; break }
  }
  ok('found a node whose graph draws counterparts', !!topicId, String(topicId))

  // ── OB-202: click empty graph releases the pin; a pan does not ──────────────────────────
  const svgBox = () => pane().locator('[data-relstar]').boundingBox()
  const starnode = () => pane().locator('[data-starnode]').first()
  // the DOM attribute, not the hint text: the text reads "Filtered to" instead of "Pinned to"
  // while the pointer still rests on the just-pinned node (hover outranks the pin in that one
  // line by design), which Playwright's own .click() leaves it doing
  const pinnedText = () => page.evaluate(() => !!document.querySelector('[aria-label="connections-pane"] [data-pinned="1"]'))
  if (topicId && (await starnode().count()) > 0) {
    const n = await starnode().boundingBox()
    await page.mouse.click(n.x + n.width / 2, n.y + n.height / 2)
    await page.waitForTimeout(300)
    ok('a node is pinned before the empty-graph test', await pinnedText())
    if (await pinnedText()) {
      const box = await svgBox()
      // a corner of the graph, away from any node or the centre — water
      await page.mouse.click(box.x + box.width - 6, box.y + 6)
      await page.waitForTimeout(300)
      ok('OB-202: a click on EMPTY graph releases the pin', !(await pinnedText()))
    }
    // re-pin, then PAN across the water — must NOT release
    await page.mouse.click(n.x + n.width / 2, n.y + n.height / 2)
    await page.waitForTimeout(300)
    ok('re-pinned for the pan check', await pinnedText())
    if (await pinnedText()) {
      const box = await svgBox()
      const sx = box.x + box.width - 6, sy = box.y + 6
      await page.mouse.move(sx, sy)
      await page.mouse.down()
      await page.mouse.move(sx - 40, sy + 30, { steps: 6 }) // well past graphClickSlop (4px)
      await page.mouse.up()
      await page.waitForTimeout(300)
      ok('OB-202: a background PAN does not release the pin', await pinnedText())
    }
  } else {
    fail('no graph node to pin — OB-202 checks asserted nothing')
  }

  // ── OB-198(a): the ROOT's caret works with NOTHING selected — the owner's exact report ──
  // a fresh reload: the drill-down above left many rows open and a node selected, which is
  // not the state the original bug report started from ("Computer Science… nothing selected")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  await openPalette()
  await page.getByLabel('studio-inst-connections').click()
  await page.waitForTimeout(700)

  const root0 = await page.evaluate(() => {
    const r = document.querySelector('[aria-label="connections-pane"] [data-node-id]')
    return r ? { id: r.getAttribute('data-node-id'), open: r.getAttribute('data-open') } : null
  })
  ok('the tree draws a root row', !!root0, JSON.stringify(root0))
  if (root0) {
    ok('the root starts open', root0.open === '1', root0.open)
    const rootCaret = rows().first().locator('[data-caret]')
    const before = await rows().count()
    await rootCaret.click()
    await page.waitForTimeout(250)
    const rowsClosed = await rows().count()
    ok('OB-198: clicking the root\'s caret with NOTHING selected still closes it', (await openAttr(root0.id)) === '0', `open=${await openAttr(root0.id)}`)
    ok('and its children leave the DOM (the six territories hide)', rowsClosed < before, `${before} -> ${rowsClosed}`)
    await rootCaret.click()
    await page.waitForTimeout(250)
    ok('clicking it again reopens — the territories return', (await openAttr(root0.id)) === '1' && (await rows().count()) === before, `open=${await openAttr(root0.id)}`)
  }

  // ── OB-198(a) continued: a SELECTED node that is OPEN still closes on its own caret ─────
  const territoryId = await page.evaluate(() => {
    const list = [...document.querySelectorAll('[aria-label="connections-pane"] [data-node-id]')]
    const t = list.slice(1).find((r) => r.querySelector('[data-caret]')) // first territory, not the root
    return t ? t.getAttribute('data-node-id') : null
  })
  ok('there is a territory row to select and collapse', !!territoryId, String(territoryId))
  if (territoryId) {
    const row = pane().locator(`[data-node-id="${territoryId}"]`).first()
    // select it (click the title, never the caret — the caret is carved out of selection)
    await row.locator('[data-pill-title]').first().click()
    await page.waitForTimeout(350)
    ok('selecting the row moved the pane\'s aim to it', (await page.evaluate(() => document.querySelector('[aria-label="connections-pane"]').getAttribute('data-current'))) === territoryId)
    // open it, so there is something for its OWN caret to close while it stays selected — this
    // is the shape of the actual fault: the inclusive path used to re-force it open on every
    // render, so a caret click on a SELECTED, OPEN row could never reach '0'
    if ((await openAttr(territoryId)) === '0') { await row.locator('[data-caret]').first().click(); await page.waitForTimeout(300) }
    ok('the selected territory is open, ready to test its own caret', (await openAttr(territoryId)) === '1', await openAttr(territoryId))
    await row.locator('[data-caret]').first().click()
    await page.waitForTimeout(300)
    ok('OB-198: the SELECTED node\'s own caret closes it — the force-open set excludes the target', (await openAttr(territoryId)) === '0', `open=${await openAttr(territoryId)}`)
    // and it STAYS closed — the fault this guards against is a re-render forcing it back open
    await page.waitForTimeout(400)
    ok('and it does not spring back open on a later render', (await openAttr(territoryId)) === '0', `open=${await openAttr(territoryId)}`)

    // ── OB-198(b): deselecting from the MAP clears the lit pill, keeps the aim ──────────────
    ok('the selected territory draws the accent wash before deselecting', await isLit(territoryId))
    // the map owns Escape's clearFocus effect and is not open in this preset by default — open
    // it briefly to fire the effect, exactly what the owner's own report describes doing
    await page.getByLabel('studio-inst-map').click()
    await page.waitForTimeout(500)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    const anyLit = await page.evaluate(() => [...document.querySelectorAll('[aria-label="connections-pane"] [data-node-id]')]
      .some((r) => (r.querySelector('[data-pill-title]')?.parentElement?.parentElement?.style.background || '').includes('accent-primary-wash')))
    ok('OB-198: no pill anywhere in the tree draws the selected wash after a deselect', !anyLit)
    ok('and the pane\'s AIM is unchanged — it keeps its resting reading (#6)', (await page.evaluate(() => document.querySelector('[aria-label="connections-pane"]').getAttribute('data-current'))) === territoryId)
  }
} catch (e) {
  errors.push('threw: ' + (e && e.stack ? e.stack : e))
} finally {
  await browser.close().catch(() => {})
  vite.kill()
}

console.log(checks.join('\n'))
if (errors.length) {
  console.log('\n' + errors.length + ' problem(s):\n  ' + errors.join('\n  '))
  process.exit(1)
}
console.log('\nall ' + checks.length + ' checks passed')
