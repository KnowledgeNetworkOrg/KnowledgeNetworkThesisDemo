// browsertest-connections.mjs — the connections pane rehaul (#253, DS OB-101 + OB-113).
//
// A TEST. It opens the real app in a real browser and asserts what a person sees.
//
// WHY IT HAD TO EXIST WITH THIS CHANGE, and not as a nicety: the rehaul replaced a
// 1276-line pane with a port of a design-system component, and almost nothing it
// promises is provable from Node. `npm test` reads SOURCE — it can say every prop is
// documented and no tooltip is unfolded, and it cannot say that two columns appear,
// that hovering a graph node narrows the card list under it, or that a stored divider
// width wider than the pane leaves the handle reachable. Those are the four things
// the issue's amendments are actually about.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT: how Connections OPENS. That is #22's question
// and it is still open. This driver opens the pane from the sidebar because that is
// how the app works today, and it reads the pane's absence beforehand as a fact about
// the current build rather than as the answer to that issue.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-connections.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5251

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

const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
/** cross INTO an element rather than teleport onto it: React synthesises enter/leave from
 *  pointerover/pointerout at the root, and a single teleporting move is a thin signal. */
const glideTo = async (p) => { await page.mouse.move(p.x, p.y, { steps: 12 }); await page.waitForTimeout(220) }
const centreOf = async (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const b = el.getBoundingClientRect()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}, sel)
/** park the pointer in the app's top-left chrome, off the pane entirely */
const park = async () => { await page.mouse.move(4, 4, { steps: 6 }); await page.waitForTimeout(200) }

// ── 0. the pane is CHOSEN, never ambushed (#22's current state, not its answer) ──
ok('Connections is not on the desk until it is picked', !(await has('[aria-label="connections-pane"]')))
await page.getByLabel('studio-inst-connections').click()
await page.waitForTimeout(600)
ok('picking it from the sidebar opens it', await has('[aria-label="connections-pane"]'))

// GIVE IT THE DESK. Sharing a 1750px window with three other columns leaves the
// relations column around 100px, where the cards drop their pill chrome for plain
// wrapping text by design (under 2x pillMin a name character-wrapped in a fixed box
// is less readable than the same words as text). That is a real mode and it is not
// the one amendment 4 is about — `cardMax` only bites on a WIDE pane, which is
// exactly the case that used to draw two capped pills either side of hundreds of
// pixels of hairline. So the other panes come off.
const others = await page.evaluate(() => [...document.querySelectorAll('[aria-label^="studio-pane-"][data-slot="on"]')]
  .map((p) => p.getAttribute('aria-label').replace('studio-pane-', ''))
  .filter((id) => id !== 'connections'))
for (const id of others) {
  await page.getByLabel(`studio-inst-${id}`).click().catch(() => {})
  await page.waitForTimeout(150)
}
await page.waitForTimeout(400)
const paneWidth = await page.evaluate(() => Math.round(document.querySelector('[aria-label="connections-pane"]').getBoundingClientRect().width))
ok('the pane has the desk to itself', paneWidth > 900, `${paneWidth}px wide, closed ${others.length} other pane(s)`)

// ── 1. the split: two columns, both on screen at once ───────────────────────
const columnHeads = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  return [...pane.querySelectorAll('div')].map((d) => d.firstChild?.textContent).filter((t) => t === 'Contains' || t === 'Relationships')
})
ok('the CONTAINS column has its head', columnHeads.includes('Contains'), JSON.stringify(columnHeads))
ok('the RELATIONS column has its head', columnHeads.includes('Relationships'))
ok('both are on screen at once — alwaysSplit, not a sliding single view', columnHeads.length >= 2)

// ── 2. the pane BODY does not scroll; each column owns its own scroller ─────
// CONNECTIONS_BODY_STYLE, and the reason it is published rather than described: a
// scrolling body puts the scrollbar 12px inboard behind a reserved gutter instead of
// flush at the pane's inner edge like every other pane's.
const bodyOverflow = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="studio-pane-connections"]')
  const body = pane?.querySelector('[data-pane-body]')
  return body ? getComputedStyle(body).overflow : null
})
ok('the pane body does not scroll', bodyOverflow === 'hidden', String(bodyOverflow))

// ── 3. OB-113 — the pane's drags are gestures, its filter box is still text ─
const selectRules = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  const frame = pane.querySelector('[data-tip-layer]')?.parentElement
  const input = pane.querySelector('input[type="text"]')
  return {
    frame: frame ? getComputedStyle(frame).userSelect : null,
    input: input ? getComputedStyle(input).userSelect : null,
  }
})
ok('OB-113 — the pane frame refuses text selection', selectRules.frame === 'none', String(selectRules.frame))
ok('OB-113 — the filter box opts back in', selectRules.input === 'text', String(selectRules.input))

// ── 4. the contains tree, with the path to the selection already open ───────
// A "you are here" column showing a tree with nothing highlighted in it is the one
// state it may not be in, which is why the host drives the open set rather than
// leaving it to the component's own persistence.
const selectedRowVisible = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  const id = pane.querySelector('[data-selected-id]')?.getAttribute('data-selected-id')
  if (!id) return { id: null, drawn: false }
  const row = pane.querySelector(`[data-node-id="${CSS.escape(id)}"]`)
  return { id, drawn: !!row }
})
ok('the tree draws the node the pane is aimed at', selectedRowVisible.drawn, JSON.stringify(selectedRowVisible))
const pillCount = await page.evaluate(() => document.querySelectorAll('[aria-label="connections-pane"] [data-pill-title]').length)
ok('the tree draws pills', pillCount > 1, `${pillCount} pills`)

// ── 4b. TWO CARETS IN ONE BATCH BOTH SURVIVE (DS OB-167 clause 3) ────────────────────
// The tree here is CONTROLLED: the host owns the open set so the path down to the
// selection is always open. That used to carry a real fault — the tree resolved its
// next open map against the map it was last RENDERED with, so several caret toggles
// landing in one React batch all computed from the same base and only the last
// survived. A person clicks one caret per render and never sees it; this driver did,
// which is how it was found (`4b637d1`), and the design system took it upstream as a
// contract change: the callback receives an UPDATER now, handed out unresolved.
//
// So this asserts the fix rather than working around it. Both clicks go inside ONE
// page.evaluate — one synchronous task, therefore one React batch. That is the whole
// point of the check, and it is a state a person cannot produce by hand.
const batched = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  const closed = [...pane.querySelectorAll('[data-node-id]')]
    .filter((r) => r.getAttribute('data-open') === '0' && r.querySelector('[data-caret]'))
  if (closed.length < 2) return { enough: false, ids: [] }
  const ids = [closed[0], closed[1]].map((r) => r.getAttribute('data-node-id'))
  closed[0].querySelector('[data-caret]').click()
  closed[1].querySelector('[data-caret]').click()   // same task, same batch
  return { enough: true, ids }
})
if (!batched.enough) {
  // Not a skip. An empty set would make this check assert nothing at all, quietly.
  fail('fewer than two closed caret rows to batch — the OB-167 batching check asserted nothing')
} else {
  await page.waitForTimeout(400)
  const openNow = await page.evaluate((ids) => ids.map((id) => {
    const r = document.querySelector(`[aria-label="connections-pane"] [data-node-id="${CSS.escape(id)}"]`)
    return r ? r.getAttribute('data-open') : 'gone'
  }), batched.ids)
  ok('two caret toggles in ONE React batch both survive', openNow.every((v) => v === '1'),
    `${batched.ids.join(', ')} -> ${openNow.join(', ')}`)
}

// ── 4c. A CONTROLLED TREE IS NOT ALSO PERSISTED (DS OB-167 clause 5) ────────────────────
// Handing the pane `treeOpen` stops it giving the tree a storage key for the open set,
// so the host's store is the only claimant — two writers for one piece of state is the
// worse failure. The second assertion is the guard on the first: without it, a pane that
// persisted NOTHING at all would pass this as happily as a pane that got it right.
const storage = await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('kn-connections'))
  return { open: keys.filter((k) => k.includes('_open')), all: keys }
})
ok('no open-set key is written while the tree is controlled', storage.open.length === 0, JSON.stringify(storage.all))
ok('the pane still persists its OTHER layout state', storage.all.length > 0, JSON.stringify(storage.all))

// ── 4d. EVERY PILL DRAWS ITS OWN NODE'S TOPIC COLOUR (DS OB-174) ──────────────────
// The reported fault, in the owner's words: "the connections pane's contains tree node
// pill border colours are all the same colour, they should not be all the same colour
// they should be the colour of each node pill's topic colour from the map". The cause
// was that the pill graded ONE tree-level domain by sibling position, so the whole
// column drew one family — while `node.domain` was being read one line away for the
// hover card and dropped for the border.
//
// The arithmetic is pinned in src/ds/connections/containpaint.test.ts, where it belongs:
// a look cannot tell you a pill took slot 2 for the right reason. What is checked HERE is
// the part only a real page can answer — that the column is not monochrome, and that no
// two pills which actually TOUCH resolved to the same colour once the browser has
// computed them.
const pills = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  return [...pane.querySelectorAll('[data-node-id]')].map((row) => ({
    id: row.getAttribute('data-node-id'),
    colour: row.firstElementChild ? getComputedStyle(row.firstElementChild).borderTopColor : null,
  }))
})
const distinct = new Set(pills.map((p) => p.colour))
console.log(`contains pills = ${pills.length} · distinct border colours = ${distinct.size}`)
ok('the contains column is not one colour', pills.length > 2 && distinct.size > 1,
  `${pills.length} pills, ${distinct.size} colour(s): ${[...distinct].join(' | ')}`)

const touching = pills.slice(1).filter((p, i) => p.colour === pills[i].colour)
ok('no two pills that touch draw the same colour', touching.length === 0,
  touching.map((p) => p.id).join(', ') || 'none')

// ── 4e. THE NODE COUNT IS OFF THE PILL AND ONTO THE HOVER (DS OB-174) ──────────────────
// The owner's second ask. "2 nodes" doubled the height of every container row for a
// number that is furniture at rest — the caret already says a node HAS children. It is
// answered on the node you are pointing at instead, and the fuller reading at that
// (totals included), on the pane's own preview card.
const pillText = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-label="connections-pane"] [data-node-id]')]
    .map((r) => (r.innerText || '').trim())
    .filter((t) => /\b\d+\s+nodes?\b/.test(t)))
ok('no pill prints its own node count', pillText.length === 0, pillText.slice(0, 3).join(' / '))

// hover a row that HAS children — the count has to be readable somewhere, or it is simply gone
const containerId = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  const row = [...pane.querySelectorAll('[data-node-id]')].find((r) => r.querySelector('[data-caret]'))
  return row ? row.getAttribute('data-node-id') : null
})
if (!containerId) {
  fail('no container row on screen — the OB-174 count check asserted nothing')
} else {
  await page.locator(`[aria-label="connections-pane"] [data-node-id="${containerId}"]`).first().hover()
  await page.waitForTimeout(400)
  const contains = await page.evaluate(() => {
    const el = document.querySelector('[data-preview-contains]')
    return el ? el.textContent.trim() : null
  })
  console.log(`hover ${containerId} → preview contains line = ${JSON.stringify(contains)}`)
  ok('hovering a container answers the count on the preview card', !!contains && /\d/.test(contains), String(contains))
  await page.mouse.move(4, 4)
  await page.waitForTimeout(300)
}


// ── 5. aim the pane at a node that has relationships ───────────────────────
// One caret at a time here, deliberately — not to dodge the batching fault above, which
// is fixed, but because this sweep walks DOWN one branch and each step has to see the
// rows the step before it revealed.
const descend = async () => page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  const closed = [...pane.querySelectorAll('[data-node-id]')].filter((r) => r.getAttribute('data-open') === '0' && r.querySelector('[data-caret]'))
  if (!closed.length) return null
  // the DEEPEST closed row, so the sweep walks down one branch rather than fanning out
  const row = closed[closed.length - 1]
  row.querySelector('[data-caret]').click()
  return row.getAttribute('data-node-id')
})
let depth = 0
for (let i = 0; i < 14; i++) {
  const opened = await descend()
  await page.waitForTimeout(180)
  if (!opened) break
  depth++
}
ok('the caret opens one level at a time, down a branch', depth > 3, `${depth} levels opened`)

// walk back UP from the deepest row: the edge-bearing grain is the topic, so the first
// row that draws a graph with counterparts on it is the one this pane is really about
const rowIds = await page.evaluate(() => [...document.querySelectorAll('[aria-label="connections-pane"] [data-node-id]')].map((r) => r.getAttribute('data-node-id')))
let aimedAt = null
for (const id of [...rowIds].reverse().slice(0, 14)) {
  await page.evaluate((nodeId) => {
    document.querySelector(`[aria-label="connections-pane"] [data-node-id="${CSS.escape(nodeId)}"]`)?.click()
  }, id)
  await page.waitForTimeout(380)
  const n = await page.evaluate(() => document.querySelectorAll('[data-relstar] [data-starnode]').length)
  if (n >= 2) { aimedAt = id; break }
}
ok('a tree-row click re-aims the pane at that node', !!aimedAt, aimedAt || 'no row produced a graph with counterparts')
ok("the RELATIONS column draws this app's real graph", await has('[data-relstar]'))

if (aimedAt) {
  const crumbTip = await page.evaluate(() => {
    const pane = document.querySelector('[aria-label="connections-pane"]')
    const crumbs = [...pane.querySelectorAll('[data-crumb]')]
    return crumbs.length
  })
  ok('the breadcrumb draws the path above it', crumbTip > 0, `${crumbTip} clickable ancestors`)

  // ── 6. the cards, grouped by source ───────────────────────────────────────
  const groupHeaders = await page.evaluate(() => {
    const pane = document.querySelector('[aria-label="connections-pane"]')
    return [...pane.querySelectorAll('div')].map((d) => d.childNodes[1]?.textContent).filter((t) => t === 'direct' || t === 'via children')
  })
  ok('the cards carry a collapsible "direct" group', groupHeaders.includes('direct'), JSON.stringify(groupHeaders))

  // ── 6b. OB-182: the group header's count sits on the LABEL'S BASELINE, not its box centre ──
  // The label is the UI face in caps, the count the mono face; centring two line boxes set in
  // different faces leaves their baselines apart by half the difference in metrics (0.67px on
  // the DS's probe), and against all-caps there are no descenders to hide it. Read out of the DOM
  // with the marker trick — a zero-size inline-block at `vertical-align: baseline` sits ON the
  // baseline — and only after `document.fonts.ready`: before the faces load this measures the
  // fallback's metrics, a real number about the wrong state (the DS wrote 1.33px the wrong way
  // round into five files that way).
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)
  const headerBaselines = await page.evaluate(() => {
    const baseOf = (el) => {
      const m = document.createElement('span')
      m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;padding:0;margin:0'
      el.appendChild(m)
      const y = m.getBoundingClientRect().top
      m.remove()
      return y
    }
    return [...document.querySelectorAll('[data-rel-group-header]')].map((h) => {
      const spans = [...h.children].filter((c) => c.tagName === 'SPAN' && !c.querySelector('svg'))
      const label = spans[spans.length - 2]
      const count = spans[spans.length - 1]
      const box = h.getBoundingClientRect()
      // the caret is a border-drawn mark inside the header's FIRST span (its 14px slot, drawn only
      // when the header is clickable); measure that slot, whatever the mark inside it is
      const caret = h.children.length === 3 ? h.children[0] : null
      const cb = caret ? caret.getBoundingClientRect() : null
      // the caret is centred on the LINE (the label's own box), not on the header's padding box —
      // the header pads 12px above and 4px below, so its box centre sits 4px off the line by design
      const lb = label.getBoundingClientRect()
      return { header: h.getAttribute('data-rel-group-header'), label: +baseOf(label).toFixed(2), count: +baseOf(count).toFixed(2), height: +box.height.toFixed(2), caretOffCentre: cb ? +((cb.top + cb.height / 2) - (lb.top + lb.height / 2)).toFixed(2) : null }
    })
  })
  ok('OB-182: on every group header the count\'s baseline IS the label\'s (read after fonts.ready)', headerBaselines.length >= 1 && headerBaselines.every((b) => Math.abs(b.label - b.count) <= 0.1), JSON.stringify(headerBaselines))
  ok('and the caret is still box-centred (its 1px lift is its own optical centring)', headerBaselines.every((b) => b.caretOffCentre === null || Math.abs(b.caretOffCentre) <= 2), JSON.stringify(headerBaselines.map((b) => b.caretOffCentre)))

  // ── 7. cardMax 620 on the MEASURED container ──────────────────────────────
  // In a pane this wide, every extra pixel used to become SHAFT — two capped pills
  // either side of hundreds of px of hairline. The surplus now stays outside the card.
  const cardBox = await page.evaluate(() => {
    const pane = document.querySelector('[aria-label="connections-pane"]')
    for (const d of pane.querySelectorAll('div')) {
      if (getComputedStyle(d).maxWidth === '620px') {
        return { card: Math.round(d.getBoundingClientRect().width), column: Math.round(d.parentElement.parentElement.getBoundingClientRect().width) }
      }
    }
    return null
  })
  ok('the card list stops growing at cardMax', !!cardBox && cardBox.card <= 620, JSON.stringify(cardBox))
  ok('and the surplus stays OUTSIDE the card, as pane margin', !!cardBox && cardBox.column > cardBox.card + 100, JSON.stringify(cardBox))
  // wide enough to be past 2x pillMin, so the rows really are drawing pills and arrows
  // rather than the plain-text fallback — which is what makes the cap worth asserting
  ok('the rows are in pill mode, which is the mode the cap exists for', !!cardBox && cardBox.card > 300, JSON.stringify(cardBox))

  // ── 8. hover a graph node — the cards below it filter to that node ─────────
  const nodeSel = await page.evaluate(() => {
    const n = document.querySelector('[data-relstar] [data-starnode]')
    return n ? n.getAttribute('data-starnode') : null
  })
  ok('the graph draws counterpart nodes', !!nodeSel, String(nodeSel))
  if (nodeSel) {
    const sel = `[data-starnode="${nodeSel.replace(/"/g, '\\"')}"]`
    const hintBefore = await page.evaluate(() => {
      const pane = document.querySelector('[aria-label="connections-pane"]')
      return [...pane.querySelectorAll('div')].map((d) => d.textContent)
        .find((t) => t && t.startsWith('Hover the graph to filter')) ?? null
    })
    ok('at rest the pane says what the graph does', !!hintBefore)

    const p = await centreOf(sel)
    await glideTo(p)
    const filtered = await page.evaluate(() => {
      const pane = document.querySelector('[aria-label="connections-pane"]')
      const line = [...pane.querySelectorAll('div')].map((d) => d.textContent).find((t) => t && t.startsWith('Filtered to '))
      return line ?? null
    })
    ok('hovering a graph node filters the cards, and says so', !!filtered, String(filtered))
    ok('a hover raises the node preview card', await has('[data-tip-layer] [style*="z-index: 1000"]'))

    // ── 9. clicking PINS, and does not navigate ─────────────────────────────
    const beforeAim = await page.evaluate(() => document.querySelector('[aria-label="connections-pane"]').getAttribute('data-current'))
    await page.mouse.click(p.x, p.y)
    await page.waitForTimeout(300)
    await park()
    const pinned = await page.evaluate(() => {
      const pane = document.querySelector('[aria-label="connections-pane"]')
      const line = [...pane.querySelectorAll('div')].map((d) => d.textContent).find((t) => t && t.startsWith('Pinned to '))
      return { line: line ?? null, current: pane.getAttribute('data-current'), ring: !!pane.querySelector('[data-pinned="1"]') }
    })
    ok('clicking a graph node PINS the card filter', !!pinned.line, String(pinned.line))
    ok('the pin survives the pointer leaving the node', pinned.ring)
    ok('and it does NOT navigate the pane', pinned.current === beforeAim, `${beforeAim} → ${pinned.current}`)

    await page.evaluate((s) => document.querySelector(s)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), sel)
    await page.waitForTimeout(300)
    const released = await page.evaluate(() => {
      const pane = document.querySelector('[aria-label="connections-pane"]')
      return [...pane.querySelectorAll('div')].map((d) => d.textContent).some((t) => t && t.startsWith('Pinned to '))
    })
    ok('clicking it again releases the pin', !released)
  }
}

// ── 10. THE CHAIN SAYS WHEN IT HAS LOST ITS ROOT — "../" (#254, DS OB-111) ───
// A card's source pill carries the ancestor chain above the name. When the chain does
// not fit, the fit drops segments from the FRONT, and the front is the true root — the
// one part a reader cannot infer back from what is left. So a chain that no longer
// starts at the root is prefixed "../ ", and a chain that does start there carries no
// prefix at all. Both halves are the rule; only asserting the marked one would pass a
// build that marked everything.
//
// IT TAKES A NARROW PANE TO SEE IT, which is why this sweeps widths rather than
// asserting once. At a full-width desk every chain in this corpus fits whole — exactly
// the case that must NOT be marked — and the cut only happens once the pill is small.
//
// The pane is re-aimed at a DOMAIN first: only a "via children" row draws a chain at all
// (a direct row's source IS the selection, which the breadcrumb above it already places),
// and Software Engineering is the branch that reaches four segments down.
await page.evaluate(() => document.querySelector('[aria-label="connections-pane"] [data-node-id="se"]')?.click())
await page.waitForTimeout(500)
/** every drawn chain in the pane. The chain is the only 8.5px run there
 *  (`CHIP_METRICS.pathFontPx`), and its container holds one span per DRAWN LINE — so
 *  filtering to elements that have children keeps the containers and drops the lines,
 *  and joining with a space undoes the line split that would otherwise read as one word. */
const drawnChains = () => page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  return [...pane.querySelectorAll('span')]
    .filter((el) => getComputedStyle(el).fontSize === '8.5px' && el.children.length)
    .map((el) => [...el.children].map((c) => c.textContent).join(' ').trim())
})
const wideChains = await drawnChains()
ok('a via-children card draws the chain above its source', wideChains.length > 0, `${wideChains.length} chains`)
ok('at full width the chain is whole, so it carries NO marker',
  wideChains.length > 0 && wideChains.every((p) => !p.includes('../')), JSON.stringify(wideChains.slice(0, 2)))
ok('and the chains run deep enough that a cut would really lose something',
  wideChains.some((p) => p.split('/').filter((seg) => seg.trim()).length >= 3), JSON.stringify(wideChains[0] ?? null))

// 620, NOT 680: #337 (OB-213) removed `fitLines`' 12% width slack, so at 680 the
// two-line chain now genuinely fits whole and is correctly unmarked — the squeeze has
// to go narrower to witness the drop. The floor is the plain-text fallback (`avail <
// 2 x pillMin`, under a 156px card), and 620 clears it by 60px — MEASURED by sweeping
// the viewport over this state: the chains stop being drawn at 555px (card 151, avail
// 95) and at 620 the card measures 216px (avail 160). The assertion below fails on
// zero chains anyway, so the fallback cannot be fallen through quietly.
await page.setViewportSize({ width: 620, height: 950 })
await page.waitForTimeout(600)
const cutChains = await drawnChains()
ok('squeezed, the pill drops the root — and says so',
  cutChains.length > 0 && cutChains.every((p) => p.startsWith('../')),
  `${cutChains.length} chains, e.g. ${JSON.stringify(cutChains[0] ?? null)}`)
await page.setViewportSize({ width: 1750, height: 950 })
await page.waitForTimeout(400)

// ── 11. THE DRAWN WIDTH IS DERIVED, and a stored width is never written back ──
// Amendment 1, and the one fault a port loses by omission: a width restored from
// storage into a smaller pane used to push the divider past the right edge, where the
// body's overflow:hidden clips it — the handle you need in order to fix it is the thing
// that goes missing. 9999 is far past any clamp this pane could produce by dragging.
await page.evaluate(() => localStorage.setItem('kn-connections_leftWidth', '9999'))
await page.reload()
await page.waitForTimeout(900)
await page.getByLabel('studio-inst-connections').click().catch(() => {})
await page.waitForTimeout(700)
const clamped = await page.evaluate(() => {
  const pane = document.querySelector('[aria-label="connections-pane"]')
  if (!pane) return null
  const layer = pane.querySelector('[data-tip-layer]')
  const paneRight = layer.getBoundingClientRect().right
  // the divider is the 14px-wide flex child between the two columns — found by its own
  // resize cursor rather than by a test-only attribute added to a design-system port
  const divider = [...layer.children].find((c) => getComputedStyle(c).cursor === 'col-resize')
  const stored = localStorage.getItem('kn-connections_leftWidth')
  return divider ? { right: Math.round(divider.getBoundingClientRect().right), paneRight: Math.round(paneRight), stored } : { right: null, paneRight: Math.round(paneRight), stored }
})
ok('a stored width wider than the pane still leaves the divider reachable',
  !!clamped && clamped.right !== null && clamped.right <= clamped.paneRight, JSON.stringify(clamped))
ok('and the stored PREFERENCE is not written back capped', clamped && clamped.stored === '9999', String(clamped && clamped.stored))

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
