// browsertest-relationsrail.mjs — #342, the dissolution's step 3.
//
// A TEST. It opens the real app in a real browser and asserts what a person sees on the Document
// pane's Relations rail, one obligation at a time:
//   OB-229  the rail: centred on the document's node, the card as the figure's hover, over the
//           prose and never over the figure, the closed button, the empty and one-kind shapes
//   OB-235  the space under the figure is a READING (totals, hop bar, kind bars), not a list
//   OB-242  the hover card's header is a SENTENCE — "1 direct relationship"
//   OB-224  the card's left bracket follows the TARGET count, not the item count
//   OB-230  the card and the map light each other — two channels: a relationship lights ONE road,
//           the hub lights the centre only, a map cell lights the figure's mark without a card,
//           and leaving clears both
//   OB-209  the Document pane follows a map hover while nothing is chosen, and a pane that has
//           never had a selection is the placeholder
//   OB-240  (clause 2, #386) clearing the selection — the Explorer row, empty water on the map, Esc —
//           turns the pill and the ring off and leaves the Document on the node it was reading
// and the seam's drag (OB-253), since the rail's card is sized against it.
//
// It runs against BOTH corpora, booting vite twice on its one port: the teaching corpus for the
// rail's own behaviour, and the course corpus (`VITE_CORPUS=courses`) for the two shapes the
// hand-authored one guarantees it cannot produce — a course with no relationships at all, and a
// corpus whose only relation kind is `depends_on`.
//
// WHAT IT SELECTS BY, AND WHY NOT TITLES. Every surface it needs has a data-* hook:
// `[data-relation-orbit]` / `[data-orbit]` / `[data-orbit-lit]` (the figure), `[data-orbit-card]`
// (the hover card: "rel" or "hub"), `[data-rel-sentence]` / `[data-rel-bracket]` (the card),
// `[data-relation-stats]` / `[data-stat-*]` (the reading), `[data-preview-banner]` /
// `[data-pane-placeholder]` (OB-209), `[data-seledge]` + `[data-elit]` / `[data-seloutline]` +
// `[data-sel-lit]` (the map's roads and its selected cell). A driver that found these by their
// words would break on the next copy change.
//
// THE MOUSE HAS TO TRAVEL (see browsertest-maphover.mjs): `mouse.move(x, y)` teleports, and the
// hover card is placed from the previous move, so every approach steps.
//
// Spawns vite ITSELF on its own fixed port (--strictPort) — backgrounded dev servers die on this
// machine, and one port per test is what lets two checkouts run at once.
// Run from anywhere:  node tools/studio-spike/browsertest-relationsrail.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5264

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const errors = []
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' - ' + detail : ''))
}
const near = (a, b, tol) => Math.abs(a - b) <= tol

async function startVite(env) {
  const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
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
  return vite
}

/** boot the app on one corpus, hand the page to `fn`, and take everything down again */
async function withApp(label, env, fn) {
  const vite = await startVite(env)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  // a duplicated React key is a console ERROR, and it is exactly the fault the rail's one-mark-per-
  // relationship rule exists to prevent — so console errors are failures here, not noise
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text().slice(0, 300)}`) })
  try {
    await page.goto(`http://localhost:${PORT}/`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(800)
    await fn(page)
  } finally {
    await page.evaluate(() => localStorage.clear()).catch(() => {})
    await browser.close()
    vite.kill()
  }
}

/** the helpers every suite below shares, bound to one page */
function kit(page) {
  const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel)
  const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel)
  const rectOf = (sel) => page.evaluate((s) => {
    const e = document.querySelector(s)
    if (!e) return null
    const r = e.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }
  }, sel)
  const text = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? e.textContent : null }, sel)
  const attr = (sel, a) => page.evaluate(([s, n]) => { const e = document.querySelector(s); return e ? e.getAttribute(n) : null }, [sel, a])
  /** park the pointer in the app's top-left chrome, off every pane under test */
  const park = async () => { await page.mouse.move(5, 5); await page.waitForTimeout(220) }
  /** cross INTO a target rather than teleporting onto it — see the note at the top */
  const glideTo = async (p) => { await page.mouse.move(p.x, p.y, { steps: 14 }); await page.waitForTimeout(380) }
  /** the corpus's own data, read through the same modules the app imports — one instance */
  const corpus = (fn, arg) => page.evaluate(async ([src, a]) => {
    const g = await import('/src/corpus/graph.ts')
    const r = await import('/src/instruments/relations.ts')
    return new Function('g', 'r', 'a', 'return (' + src + ')(g, r, a)')(g, r, a)
  }, [fn.toString(), arg])

  const DOC = '[aria-label="document-panel"]'

  /** open the Explorer rail if it is closed, filter it to `title`, and click `id`'s row. Clicking
   *  the row that is ALREADY selected clears the selection — see `deselect` */
  const select = async (id, title) => {
    if (!(await has('[data-explorer-rail] [data-node-id]'))) {
      await page.locator('[data-explorer-corner] button').click()
      await page.waitForTimeout(450)
    }
    await page.locator('[data-explorer-rail] input').fill(title)
    await page.waitForTimeout(350)
    await page.locator(`[data-explorer-rail] [data-node-id="${id}"]`).first().click()
    await page.waitForTimeout(800)
    await park()
  }
  const deselect = async (id, title) => { await select(id, title) }

  /** where to put the pointer so it is on the figure's mark `key`, verified with `elementFromPoint`:
   *  a relationship is a LINE (found part-way along it, clear of its own dot and its neighbours'),
   *  a neighbour is its DOT, the hub is the hub */
  const markPoint = (key) => page.evaluate((key) => {
    const svg = document.querySelector('svg[data-relation-orbit]')
    if (!svg) return null
    const r = svg.getBoundingClientRect()
    const owns = (x, y) => {
      const el = document.elementFromPoint(x, y)
      const g = el && el.closest ? el.closest('[data-orbit]') : null
      return !!g && g.getAttribute('data-orbit') === key
    }
    if (key.includes('|')) {
      const line = [...svg.querySelectorAll('line[data-orbit]')].find((l) => l.getAttribute('data-orbit') === key)
      if (!line) return null
      const a = { x: +line.getAttribute('x1'), y: +line.getAttribute('y1') }
      const b = { x: +line.getAttribute('x2'), y: +line.getAttribute('y2') }
      for (const t of [0.8, 0.75, 0.7, 0.85, 0.65, 0.6, 0.9, 0.55, 0.5, 0.45]) {
        const x = r.left + a.x + (b.x - a.x) * t, y = r.top + a.y + (b.y - a.y) * t
        if (owns(x, y)) return { x, y }
      }
      return null
    }
    const c = [...svg.querySelectorAll('g[data-orbit]')].find((g) => g.getAttribute('data-orbit') === key)
    const hit = c && c.querySelector('circle')
    if (!hit) return null
    const x = r.left + +hit.getAttribute('cx'), y = r.top + +hit.getAttribute('cy')
    return owns(x, y) ? { x, y } : null
  }, key)

  /** everything about the hover card and the figure it must clear, in one read */
  const cardState = () => page.evaluate((DOC) => {
    const card = document.querySelector('[data-orbit-card]')
    const fig = document.querySelector('[data-relations-figure]')
    const prose = document.querySelector('[data-document-prose]')
    const doc = document.querySelector(DOC)
    const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom } }
    const s = card && card.querySelector('[data-rel-sentence]')
    return {
      kind: card ? card.getAttribute('data-orbit-card') : null,
      card: box(card), figure: box(fig), prose: box(prose), doc: box(doc),
      sentence: s ? s.getAttribute('data-rel-sentence') : null,
      sentences: card ? [...card.querySelectorAll('[data-rel-sentence]')].map((e) => e.getAttribute('data-rel-sentence')) : [],
      brackets: card ? card.querySelectorAll('[data-rel-bracket]').length : 0,
      text: card ? card.textContent : null,
    }
  }, DOC)

  /** what the map is lit with: roads, the one that is lit, how many are dimmed, and the centre */
  const mapState = () => page.evaluate(() => {
    const roads = [...document.querySelectorAll('[data-seledge]')]
    const lit = roads.filter((g) => g.getAttribute('data-elit') === '1').map((g) => g.getAttribute('data-seledge'))
    const dimmed = roads.filter((g) => g.getAttribute('opacity') === '0.22').length
    const out = document.querySelector('[data-seloutline]')
    return { roads: roads.length, lit, dimmed, centre: out ? out.getAttribute('data-sel-lit') : null }
  })
  const figureLit = () => page.evaluate(() => [...document.querySelectorAll('svg[data-relation-orbit] g[data-orbit][data-orbit-lit="1"]')].map((g) => g.getAttribute('data-orbit')))
  const marks = () => page.evaluate(() => [...document.querySelectorAll('svg[data-relation-orbit] line[data-orbit]')].map((l) => l.getAttribute('data-orbit')))
  const goLevel = async (n) => {
    await page.locator('[aria-label="levels"]').click()
    await page.locator('[aria-label="levels"] ~ div button', { hasText: new RegExp(`^L${n + 1}$`) }).click()
    await page.waitForTimeout(1300)
  }
  return { has, count, rectOf, text, attr, park, glideTo, corpus, DOC, select, deselect, markPoint, cardState, mapState, figureLit, marks, goLevel }
}

/** blank out comments so a rule's own prose — which necessarily quotes the thing it bans — is never
 *  read as a violation of itself */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))

// ════════════════════════════════════════════════════════════════════════════
// THE TEACHING CORPUS — the rail's own behaviour
// ════════════════════════════════════════════════════════════════════════════
await withApp('teaching', {}, async (page) => {
  const k = kit(page)
  const { has, count, rectOf, text, attr, park, glideTo, corpus, DOC } = k

  const pick = await corpus((g, r) => {
    const hood = (id) => r.neighbourhoodOf(id)
    const rich = g.topicIds.map((id) => [id, hood(id).direct.length]).sort((a, b) => b[1] - a[1])
    const [a, b] = [rich[0][0], rich[1][0]]
    const title = (id) => g.byId.get(id).title
    // a container whose roll-up has a mark carried by ONE descendant and one carried by SEVERAL
    let via = null
    for (const id of g.allContainerIds) {
      if (id === 'root') continue
      const raw = r.viaRelationsOf(id)
      const by = new Map()
      for (const v of raw) { const key = v.rel.targetId + '|' + v.rel.kind; by.set(key, (by.get(key) || 0) + 1) }
      const one = [...by].find(([, n]) => n === 1), many = [...by].find(([, n]) => n > 1)
      if (one && many && !hood(id).direct.length) { via = { id, title: title(id), one: one[0], many: many[0], manyN: many[1] }; break }
    }
    // a real node below the topic tier: it has no relationships of its own, and nothing beneath it does
    const deep = g.nodes.find((n) => n.kind === 'leaf' && !n.topic && !hood(n.id).direct.length && !hood(n.id).via.length)
    return {
      a: { id: a, title: title(a), n: rich[0][1], marks: r.relationsOfNode(a).map((x) => x.targetId + '|' + x.kind) },
      b: { id: b, title: title(b) },
      via, deep: deep && { id: deep.id, title: deep.title }, rootTitle: title('root'),
    }
  })
  ok('found a topic with several relationships, a container that rolls up, and a real relationship-free node',
    !!(pick.a && pick.via && pick.deep), JSON.stringify({ a: pick.a.id, via: pick.via && pick.via.id, deep: pick.deep && pick.deep.id }))

  // ── OB-209: FIRST LOAD, nothing chosen — the Document pane is the placeholder ─────────────────
  ok('first load: the Document pane draws the placeholder', await has(`${DOC} [data-pane-placeholder]`))
  ok('first load: it says "Nothing chosen"', ((await text(`${DOC} [data-pane-placeholder]`)) ?? '').includes('Nothing chosen'))
  ok('first load: it names no node — the corpus root is not read', !((await text(DOC)) ?? '').includes(pick.rootTitle))
  ok('first load: no head, no rail, no walks list', !(await has(`${DOC} [data-relation-orbit]`)) && !(await has(`${DOC} [data-relations-figure]`)) && !((await text(DOC)) ?? '').includes('walks through here'))
  ok('first load: the preview row is mounted ALWAYS, and empty', (await attr(`${DOC} [data-preview-banner]`, 'data-preview-banner')) === '')

  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(800)
  const docBox = await rectOf(DOC)
  ok('Explore: the Document pane is wide enough for its rail (the rail\'s own floor is 396)', !!docBox && docBox.w >= 396, `${docBox && Math.round(docBox.w)}px`)

  // ── OB-209: a MAP hover previews the document while nothing is chosen ─────────────────────────
  /* found afresh each time it is needed: opening the Explorer rail narrows the canvas, and a cell's
     centre from before that is somewhere else afterwards */
  const findCell = () => page.evaluate(() => {
    for (const c of document.querySelectorAll('path[data-region][data-rtier="0"]')) {
      const b = c.getBoundingClientRect()
      const x = b.x + b.width / 2, y = b.y + b.height / 2
      if (document.elementFromPoint(x, y) === c) return { x, y, id: c.getAttribute('data-region') }
    }
    return null
  })
  const cell = await findCell()
  ok('found a map cell to hover', !!cell, JSON.stringify(cell))
  const restTop = await page.evaluate((DOC) => {
    const b = document.querySelector(DOC + ' [data-preview-banner]')
    return { banner: b.getBoundingClientRect().top, first: b.nextElementSibling.getBoundingClientRect().top }
  }, DOC)
  let hoverTop = null
  if (cell) {
    await park()
    await glideTo({ x: cell.x, y: cell.y })
    const cur = await attr(DOC, 'data-current')
    ok('hovering a map cell with nothing chosen reads THAT node in the Document pane', cur === cell.id, `hovered ${cell.id}, pane reads ${cur}`)
    ok('the preview row says which node it is showing', (await attr(`${DOC} [data-preview-banner]`, 'data-preview-banner')) === cell.id)
    const shown = (await text(DOC)) ?? ''
    ok('the head, the body and the walks list all follow the hover', shown.includes('walks through here') && !(await has(`${DOC} [data-pane-placeholder]`)), shown.slice(0, 60))
    hoverTop = await page.evaluate((DOC) => {
      const b = document.querySelector(DOC + ' [data-preview-banner]')
      return { banner: b.getBoundingClientRect().top, first: b.nextElementSibling.getBoundingClientRect().top }
    }, DOC)
    ok('the pane does not reflow under a sweeping cursor: the row and the first element under it sit at the same top, hovered and not (±0.5px)',
      near(hoverTop.banner, restTop.banner, 0.5) && near(hoverTop.first, restTop.first, 0.5), `${JSON.stringify(restTop)} vs ${JSON.stringify(hoverTop)}`)
    await park()
    ok('leaving the cell returns the pane to the placeholder, NOT to the node just hovered',
      (await has(`${DOC} [data-pane-placeholder]`)) && (await attr(DOC, 'data-current')) === null)
  }

  // ── selecting pins the pane ───────────────────────────────────────────────────────────────────
  await k.select(pick.a.id, pick.a.title)
  ok('selecting a node makes it the Document\'s node', (await attr(DOC, 'data-current')) === pick.a.id)
  ok('the rail draws for it: figure and reading', (await has(`${DOC} [data-relation-orbit]`)) && (await has(`${DOC} [data-relation-stats]`)))
  const pinCell = await findCell()
  ok('found a map cell to hover with a selection in place', !!pinCell, JSON.stringify(pinCell))
  if (pinCell) {
    await glideTo({ x: pinCell.x, y: pinCell.y })
    ok('a selection PINS the pane: a map hover changes neither the node nor the preview row',
      (await attr(DOC, 'data-current')) === pick.a.id && (await attr(`${DOC} [data-preview-banner]`, 'data-preview-banner')) === '', `pane reads ${await attr(DOC, 'data-current')} while hovering ${pinCell.id}`)
    await park()
  }

  // ── OB-240 clause 2 (#386): clearing the selection turns the highlight off and keeps the page ──
  /* Three gestures clear it — the Explorer's click on the selected row, a click on empty water on
     the map, and Esc. Each starts from `pick.a` selected through the Explorer, so the node being
     read is the same every time and the gesture is the only thing that varies. What each must do:
     the Explorer pill and the map's ring both go OFF, and the Document pane stays on the node. */
  const mapSel = () => attr('svg[data-nested]', 'data-sel')
  /** the pill is the row's first child and its background IS the selection wash (the pair of
   *  `browsertest-explorerrail.mjs`'s own `pillWash`) */
  const pillWash = (id) => page.evaluate((id) => {
    const row = document.querySelector(`[data-explorer-rail] [data-node-id="${id}"]`)
    const pill = row && row.firstElementChild
    return pill ? getComputedStyle(pill).backgroundColor : null
  }, id)
  /** a point where the topmost thing is the map's own svg — water, which is what the map's click
   *  handler clears the selection on (`ev.target === svgRef.current`) */
  const waterPoint = () => page.evaluate(() => {
    const svg = document.querySelector('svg[data-nested]')
    if (!svg) return null
    const b = svg.getBoundingClientRect()
    for (let y = b.y + 8; y < b.y + b.height - 8; y += 12) {
      for (let x = b.x + 8; x < b.x + b.width - 8; x += 12) {
        if (document.elementFromPoint(x, y) === svg) return { x, y }
      }
    }
    return null
  })
  const gestures = [
    ['clicking the selected row in the Explorer', async () => { await k.deselect(pick.a.id, pick.a.title) }],
    ['clicking empty water on the map', async () => {
      const w = await waterPoint()
      ok('found empty water on the map to click', !!w, JSON.stringify(w))
      if (w) await page.mouse.click(w.x, w.y)
      await page.waitForTimeout(500)
      await park()
    }],
    ['pressing Esc on the map', async () => {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      await park()
    }],
  ]
  for (const [i, [gesture, clear]] of gestures.entries()) {
    // the first pass arrives with `pick.a` already selected; the later ones re-select it, and in
    // doing so check that a node cleared a moment ago selects again as it always did
    if ((await mapSel()) !== pick.a.id) {
      await k.select(pick.a.id, pick.a.title)
      ok(`re-selecting the node just cleared moves the Document to it again (before ${gesture})`,
        (await attr(DOC, 'data-current')) === pick.a.id && (await mapSel()) === pick.a.id, `pane ${await attr(DOC, 'data-current')}, map ${await mapSel()}`)
    }
    ok(`before ${gesture}: the node is selected on the map and read in the Document`, (await mapSel()) === pick.a.id && (await attr(DOC, 'data-current')) === pick.a.id)
    const washOn = await pillWash(pick.a.id)
    await clear()
    ok(`${gesture} turns the map's ring off`, (await mapSel()) === null, String(await mapSel()))
    const washOff = await pillWash(pick.a.id)
    ok(`${gesture} turns the Explorer pill off`, !!washOn && !!washOff && washOn !== washOff, `${washOn} -> ${washOff}`)
    ok(`${gesture} leaves the Document on the node it was reading`, (await attr(DOC, 'data-current')) === pick.a.id, String(await attr(DOC, 'data-current')))
    const rested = (await text(DOC)) ?? ''
    ok('  …with its page still drawn: the title, the walks list, the rail, and no placeholder',
      rested.includes(pick.a.title) && rested.includes('walks through here') && (await has(`${DOC} [data-relation-orbit]`)) && !(await has(`${DOC} [data-pane-placeholder]`)))
    ok('  …and no preview stands in for it', (await attr(`${DOC} [data-preview-banner]`, 'data-preview-banner')) === '')
    if (i === gestures.length - 1) {
      // a MAP hover still previews over the remembered page while nothing is selected, and the
      // pane comes back to the remembered page, not to the placeholder, when the cursor leaves
      const restCell = await findCell()
      ok('found a map cell to hover over the resting page', !!restCell, JSON.stringify(restCell))
      if (restCell) {
        await glideTo({ x: restCell.x, y: restCell.y })
        ok('hovering a map cell with nothing selected previews THAT node over the resting page', (await attr(DOC, 'data-current')) === restCell.id, `hovered ${restCell.id}, pane reads ${await attr(DOC, 'data-current')}`)
        await park()
        ok('leaving the cell returns the pane to the node it was resting on', (await attr(DOC, 'data-current')) === pick.a.id && !(await has(`${DOC} [data-pane-placeholder]`)), String(await attr(DOC, 'data-current')))
      }
    }
  }
  // the pane remembers the LAST node selected: select another, clear it, and it rests on THAT one
  await k.select(pick.b.id, pick.b.title)
  ok('selecting a different node moves the Document to it, from the one it was resting on', (await attr(DOC, 'data-current')) === pick.b.id, String(await attr(DOC, 'data-current')))
  await k.deselect(pick.b.id, pick.b.title)
  ok('clearing that one rests the pane on IT, the last node selected, not on the first', (await attr(DOC, 'data-current')) === pick.b.id && (await mapSel()) === null, `pane ${await attr(DOC, 'data-current')}, map ${await mapSel()}`)

  // ── OB-229 clause 1: the centre is the document's node, always ────────────────────────────────
  await k.select(pick.a.id, pick.a.title)
  const keysA = await k.marks()
  ok('the figure draws one mark per relationship of the Document\'s node', keysA.length === pick.a.marks.length && pick.a.marks.every((m) => keysA.includes(m)), `${keysA.length} drawn, ${pick.a.marks.length} authored`)
  const hub = await k.markPoint('@self')
  ok('the hub is pointable', !!hub)
  if (hub) {
    await glideTo(hub)
    const s = await k.cardState()
    ok('hovering the hub opens the node\'s document preview, not a relationship card', s.kind === 'hub' && (s.text ?? '').includes(pick.a.title), `${s.kind}`)
    const m = await k.mapState()
    ok('the hub lights the CENTRE only: the selected cell is emphasised, no road is lit, none is dimmed (OB-230 clause 2)',
      m.centre === '1' && m.lit.length === 0 && m.dimmed === 0 && m.roads > 0, JSON.stringify(m))
    await park()
    const off = await k.mapState()
    ok('leaving the hub clears the centre light and the card', off.centre === '0' && !(await has('[data-orbit-card]')), JSON.stringify(off))
  }
  await k.select(pick.b.id, pick.b.title)
  ok('a new selection re-centres the rail: the Document\'s node moved, and the figure with it', (await attr(DOC, 'data-current')) === pick.b.id)
  const keysB = await k.marks()
  ok('…and the marks are the NEW node\'s, not the last one\'s', keysB.length > 0 && JSON.stringify(keysB) !== JSON.stringify(keysA), `${keysA.length} then ${keysB.length}`)
  const hubB = await k.markPoint('@self')
  if (hubB) {
    await glideTo(hubB)
    ok('…and the hub\'s card is the NEW node\'s', ((await k.cardState()).text ?? '').includes(pick.b.title))
    await park()
  }
  await k.select(pick.a.id, pick.a.title)

  // ── OB-235: the space under the figure is a READING, not a list ───────────────────────────────
  const under = await page.evaluate((DOC) => {
    const fig = document.querySelector(DOC + ' [data-relations-figure]')
    const rule = fig && fig.nextElementSibling
    const stats = rule && rule.nextElementSibling
    return {
      ruleH: rule ? rule.getBoundingClientRect().height : null,
      statsIsReading: !!stats && stats.hasAttribute('data-relation-stats'),
      groupHeaders: document.querySelectorAll(DOC + ' [data-rel-group-header]').length,
      cards: document.querySelectorAll(DOC + ' [data-orbit-card]').length,
      statsText: stats ? stats.textContent : '',
    }
  }, DOC)
  ok('directly under the figure: a hairline, then the reading', under.ruleH !== null && under.ruleH <= 1.5 && under.statsIsReading, JSON.stringify({ ruleH: under.ruleH, reading: under.statsIsReading }))
  ok('the rail renders NO standing card list: no group header, no card', under.groupHeaders === 0 && under.cards === 0)
  ok('the reading says something: two totals, the hop split and the kinds', /neighbours/.test(under.statsText) && /relationships/i.test(under.statsText) && /by hop/i.test(under.statsText) && /by kind/i.test(under.statsText))
  const total = Number((await text(`${DOC} [data-stat="relationships"] span`)) ?? NaN)
  const inks = await page.evaluate(() => document.querySelectorAll('svg[data-relation-orbit] line:not([data-orbit])').length)
  ok('the chart\'s relationships total equals the number of marks the figure draws', total === inks && inks === keysA.length, `${total} vs ${inks} drawn`)
  const kindRow = await rectOf(`${DOC} [data-stat-kind]`)
  const kind = await attr(`${DOC} [data-stat-kind]`, 'data-stat-kind')
  ok('the reading has a row for the kind', !!kindRow && !!kind, String(kind))
  if (kindRow) {
    await glideTo({ x: kindRow.x + kindRow.w / 2, y: kindRow.y + kindRow.h / 2 })
    ok('hovering a kind row washes that wedge in the figure (the filters are one state)', (await count(`${DOC} path[data-orbit-wedge="${kind}"]`)) === 1)
    await park()
    ok('…and the wash goes when the pointer does', (await count(`${DOC} path[data-orbit-wedge]`)) === 0)
  }

  // ── OB-229 clauses 2–3, OB-242 clause 1, OB-230 clause 1: a relationship's card, and its road ──
  const three = pick.a.marks.slice(0, 3)
  for (const key of three) {
    const p = await k.markPoint(key)
    ok(`the mark ${key.split('|')[0].slice(0, 22)}… can be pointed at`, !!p)
    if (!p) continue
    await park()
    await glideTo(p)
    const s = await k.cardState()
    ok('  opens the card for THAT relationship, as a sentence (OB-242)', s.kind === 'rel' && s.sentence === '1 direct relationship', `${s.kind} "${s.sentence}"`)
    ok('  the card opens over the PROSE and never over the figure (clears it, and stays in the pane)',
      !!s.card && !!s.figure && !!s.doc && (s.card.r <= s.figure.x + 0.5 || s.card.x >= s.figure.r - 0.5) && s.card.x >= s.doc.x - 0.5 && s.card.r <= s.doc.r + 0.5,
      JSON.stringify({ card: s.card && [Math.round(s.card.x), Math.round(s.card.r)], figure: s.figure && [Math.round(s.figure.x), Math.round(s.figure.r)] }))
    ok('  …starting inside the prose column, under the header', !!s.card && !!s.prose && s.card.x >= s.prose.x - 0.5 && s.card.y >= s.doc.y)
    ok('  one target, however many kinds, draws no left bracket (OB-224)', s.brackets === 0, `${s.brackets}`)
    const m = await k.mapState()
    const target = key.split('|')[0]
    ok('  lights exactly ONE road on the map — the road to that target — and dims the rest (OB-230 clause 1)',
      m.lit.length === 1 && m.lit[0].split('>').includes(target) && m.dimmed === m.roads - 1, JSON.stringify(m))
    ok('  the centre stays unlit: a relationship never lights the source', m.centre === '0')
    ok('  the figure lights the mark it is on', (await k.figureLit()).includes(target))
    await park()
    const off = await k.mapState()
    ok('  leaving clears BOTH channels: no road lit, none dimmed, no card, nothing lit in the figure',
      off.lit.length === 0 && off.dimmed === 0 && off.centre === '0' && !(await has('[data-orbit-card]')) && (await k.figureLit()).length === 0, JSON.stringify(off))
  }

  // a neighbour (its dot) opens the card for the neighbour, and lights the same one road
  const dot = await k.markPoint(three[0].split('|')[0])
  if (dot) {
    await glideTo(dot)
    const s = await k.cardState()
    ok('hovering a NEIGHBOUR (its dot) opens the card for that neighbour', s.kind === 'rel' && /^\d+ direct relationships?$/.test(s.sentence ?? ''), `"${s.sentence}"`)
    const m = await k.mapState()
    ok('…and lights the same single road', m.lit.length === 1 && m.dimmed === m.roads - 1, JSON.stringify(m))
    await park()
  } else ok('the neighbour\'s dot can be pointed at', false)

  // ── OB-230, the REVERSE: a map cell lights the figure's mark — without opening the card ──────
  await k.goLevel(2)
  const nbrs = [...new Set(pick.a.marks.map((m) => m.split('|')[0]))]
  const nbrCell = await page.evaluate((ids) => {
    for (const id of ids) {
      for (const c of document.querySelectorAll(`path[data-terr="${id}"]`)) {
        const b = c.getBoundingClientRect()
        for (const f of [0.5, 0.35, 0.65, 0.25, 0.75]) {
          const x = b.x + b.width * f, y = b.y + b.height * f
          if (document.elementFromPoint(x, y) === c) return { x, y, id }
        }
      }
    }
    return null
  }, nbrs)
  ok('found a neighbour\'s cell on the map to point at', !!nbrCell, JSON.stringify(nbrCell))
  if (nbrCell) {
    await park()
    await glideTo({ x: nbrCell.x, y: nbrCell.y })
    const lit = await k.figureLit()
    ok('hovering the neighbour\'s cell on the MAP lights its mark in the figure', lit.includes(nbrCell.id) && lit.length === 1, JSON.stringify(lit))
    ok('…WITHOUT opening the card: the card belongs to the figure\'s own pointer', !(await has('[data-orbit-card]')))
    ok('…and the Document did not re-aim (a selection pins it)', (await attr(DOC, 'data-current')) === pick.a.id)
    await park()
    ok('leaving the map cell clears the figure', (await k.figureLit()).length === 0)
  }

  // (OB-242 clause 2 / OB-224 — "the Connections pane's LIST headers and bracket are
  // unchanged" — were checked here until #339 unmounted that pane; `RelationCards`, which
  // drew them, is kept in src/ds for one release with no host to measure it in.)

  // ── the seam (OB-253), because the card is sized against the figure the rail is drawing ────────
  const sepSel = `${DOC} [role="separator"]`
  ok('the rail\'s seam draws a divider', (await count(sepSel)) === 1)
  const railBefore = await page.evaluate((DOC) => document.querySelector(DOC + ' [data-relations-figure]').parentElement.getBoundingClientRect().width, DOC)
  const figBefore = (await rectOf(`${DOC} svg[data-relation-orbit]`)).w
  if ((await count(sepSel)) === 1) {
    const sb = await rectOf(sepSel)
    await page.mouse.move(sb.x + sb.w / 2, sb.y + sb.h / 2)
    await page.mouse.down()
    await page.mouse.move(sb.x + sb.w / 2 + 30, sb.y + sb.h / 2, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    const railAfter = await page.evaluate((DOC) => document.querySelector(DOC + ' [data-relations-figure]').parentElement.getBoundingClientRect().width, DOC)
    const figAfter = (await rectOf(`${DOC} svg[data-relation-orbit]`)).w
    ok('dragging the seam right narrows the rail by the drag', near(railBefore - railAfter, 30, 4), `${Math.round(railBefore)} -> ${Math.round(railAfter)}`)
    ok('the figure follows the seam', near(figBefore - figAfter, railBefore - railAfter, 2), `${Math.round(figBefore)} -> ${Math.round(figAfter)}`)
    const p = await k.markPoint(three[0])
    if (p) {
      await park()
      await glideTo(p)
      const s = await k.cardState()
      ok('and the card is sized against the figure the rail is NOW drawing: it still clears it', !!s.card && !!s.figure && s.card.r <= s.figure.x + 0.5, JSON.stringify({ card: s.card && Math.round(s.card.r), figure: s.figure && Math.round(s.figure.x) }))
      await park()
    }
    await page.locator(sepSel).first().dblclick()
    await page.waitForTimeout(400)
    const railBack = await page.evaluate((DOC) => document.querySelector(DOC + ' [data-relations-figure]').parentElement.getBoundingClientRect().width, DOC)
    ok('double-click fits the seam back', near(railBack, railBefore, 2), `${Math.round(railAfter)} -> ${Math.round(railBack)}`)
  }

  // ── OB-229 clause 4: the rail closes, and its way back is a labelled button in the top-right ───
  /* the handle is the first button in the rail's column, at the seam end of its head — found by
     where it is rather than by its label, which the frame builds from the rail's name */
  await page.locator(`${DOC} [data-relations-figure]`).locator('xpath=..').locator('button').first().click()
  await page.waitForTimeout(450)
  ok('the rail closes entirely — no figure, no reading', !(await has(`${DOC} [data-relations-figure]`)) && !(await has(`${DOC} [data-relation-stats]`)))
  const back = await page.evaluate((DOC) => {
    const doc = document.querySelector(DOC).getBoundingClientRect()
    const b = document.querySelector(DOC + ' button[title="Show Relations"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { label: b.textContent, fromRight: doc.right - r.right, fromTop: r.top - doc.top }
  }, DOC)
  ok('closed, the way back is a labelled button carrying the mark and the count', !!back && /Relations/.test(back.label) && /\d/.test(back.label), JSON.stringify(back))
  ok('…in the pane\'s top-right corner, mirroring the Explorer\'s top-left', !!back && back.fromRight < 40 && back.fromTop < 70, JSON.stringify(back))
  await page.locator(`${DOC} button[title="Show Relations"]`).first().click()
  await page.waitForTimeout(450)
  ok('one click opens it again', await has(`${DOC} [data-relation-orbit]`))

  /* THE FIGURE CAN VANISH UNDER A RESTING POINTER, and an unmounted mark fires no leave: the rail
     closed from the KEYBOARD while the pointer stays on a mark must still take back the card and
     whatever it lit on the map — the hub's centre channel and a relationship's road alike */
  for (const key of ['@self', ...(await k.marks()).slice(0, 1)]) {
    const p = await k.markPoint(key)
    ok(`the mark ${key} is pointable before the keyboard close`, !!p)
    if (!p) continue
    await glideTo(p)
    const on = await k.mapState()
    ok(`pointing at ${key} opens the card and lights the map`, (await has('[data-orbit-card]')) && (key === '@self' ? on.centre === '1' : on.lit.length === 1), JSON.stringify(on))
    await page.locator(`${DOC} [data-relations-figure]`).locator('xpath=..').locator('button').first().focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(450)
    const off = await k.mapState()
    ok(`closing the rail from the keyboard with the pointer on ${key} takes back the card, the centre and the road`,
      !(await has(`${DOC} [data-relations-figure]`)) && !(await has('[data-orbit-card]')) && off.centre === '0' && off.lit.length === 0 && off.dimmed === 0, JSON.stringify(off))
    await park()
    await page.locator(`${DOC} button[title="Show Relations"]`).first().click()
    await page.waitForTimeout(450)
    ok('…and one click opens it again', await has(`${DOC} [data-relation-orbit]`))
  }

  // ── a CONTAINER: relationships found through its children (OB-242's other wording) ─────────────
  await k.select(pick.via.id, pick.via.title)
  ok('a container centres the rail on itself', (await attr(DOC, 'data-current')) === pick.via.id)
  const oneKey = pick.via.one, manyKey = pick.via.many
  for (const [key, n] of [[oneKey, 1], [manyKey, pick.via.manyN]]) {
    const p = await k.markPoint(key)
    ok(`the indirect mark ${key.split('|')[0].slice(0, 22)}… can be pointed at`, !!p)
    if (!p) continue
    await park()
    await glideTo(p)
    const s = await k.cardState()
    const want = n === 1 ? '1 relationship via children' : `${n} relationships via children`
    ok(`  its card says "${want}" — the count of the descendants that carry it, the plural the component's`, s.sentence === want, `"${s.sentence}"`)
    ok('  and clears the figure', !!s.card && !!s.figure && s.card.r <= s.figure.x + 0.5)
    const m = await k.mapState()
    ok('  and lights ONE road on the map', m.lit.length === 1 && m.dimmed === m.roads - 1, JSON.stringify(m))
    await park()
  }

  // ── the empty shape: a REAL node with no relationships ────────────────────────────────────────
  await k.select(pick.deep.id, pick.deep.title)
  ok('a real node with no relationships is the Document\'s node', (await attr(DOC, 'data-current')) === pick.deep.id, String(await attr(DOC, 'data-current')))
  const empty = await page.evaluate((DOC) => {
    const fig = document.querySelector(DOC + ' [data-relations-figure]')
    const next = fig && fig.nextElementSibling
    const ph = [...document.querySelectorAll(DOC + ' [data-pane-placeholder]')]
    const lines = ph[0] ? [...ph[0].children].map((c) => c.textContent) : []
    return {
      figureEmpty: !!fig && fig.children.length === 0,
      orbit: !!document.querySelector(DOC + ' [data-relation-orbit]'),
      nextIsPlaceholder: !!next && next.hasAttribute('data-pane-placeholder'),
      placeholders: ph.length, lines,
    }
  }, DOC)
  ok('no figure, and NO hairline under it (the reading\'s own placeholder follows the empty figure directly)', empty.figureEmpty && !empty.orbit && empty.nextIsPlaceholder, JSON.stringify(empty))
  ok('the placeholder\'s two lines: the NODE\'s absence, then a fact', empty.lines[0] === 'No relationships' && empty.lines[1] === 'Nothing connects to this node', JSON.stringify(empty.lines))
  ok('the host adds no second empty state beside it', empty.placeholders === 1, `${empty.placeholders}`)
  ok('the second line is a `note`, never an instruction', !/point|click|select|choose/i.test(empty.lines[1] ?? ''))

  // ── source rules the done-when blocks state as greps ──────────────────────────────────────────
  const panel = stripComments(readFileSync(join(REPO, 'src/instruments/DocumentPanel.tsx'), 'utf8'))
  ok('OB-209: no resting-node fallback remains in the Document pane (`history.stack`, `ROOT_ID`)', !/history\.stack/.test(panel) && !/\bROOT_ID\b/.test(panel))
  ok('OB-242 clause 3: no pluralisation logic at the call site', !/=== 1 \?|\?\s*'s'|'relationships?'/.test(panel))
  ok('OB-235: the pane renders no `RelationCards` list', !/<RelationCards\b/.test(panel))
})

// ════════════════════════════════════════════════════════════════════════════
// THE COURSE CORPUS — the two shapes the hand-authored one cannot produce
// ════════════════════════════════════════════════════════════════════════════
await withApp('courses', { VITE_CORPUS: 'courses' }, async (page) => {
  const k = kit(page)
  const { has, count, text, attr, glideTo, corpus, DOC } = k
  const pick = await corpus((g, r) => {
    const hood = (id) => r.neighbourhoodOf(id)
    const rich = g.topicIds.map((id) => [id, hood(id).direct.length]).sort((a, b) => b[1] - a[1])[0]
    const none = g.nodes.find((n) => n.topic && !hood(n.id).direct.length && !hood(n.id).via.length)
    return { rich: { id: rich[0], title: g.byId.get(rich[0]).title, n: rich[1] }, none: none && { id: none.id, title: none.title }, kinds: [...new Set(g.edges.map((e) => e.type))] }
  })
  ok('the course corpus loads with ONE relation kind', pick.kinds.length === 1 && pick.kinds[0] === 'depends_on', JSON.stringify(pick.kinds))
  ok('found a course with prerequisites and a course with none at all', !!(pick.rich && pick.none), JSON.stringify(pick))
  ok('first load on the course corpus: the Document pane is the placeholder too', await has(`${DOC} [data-pane-placeholder]`))

  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(800)

  // OB-229 clause 6: one kind does not draw marks at every angle
  await k.select(pick.rich.id, pick.rich.title)
  const geom = await page.evaluate(() => {
    const svg = document.querySelector('svg[data-relation-orbit]')
    const cx = +svg.getAttribute('width') / 2
    const ends = [...svg.querySelectorAll('line:not([data-orbit])')].map((l) => +l.getAttribute('x2'))
    return { cx, ends }
  })
  ok(`a course with ${pick.rich.n} prerequisites draws ${pick.rich.n} marks`, geom.ends.length === pick.rich.n, `${geom.ends.length}`)
  ok('ONE kind takes half the circle: every mark sits on one side of the hub (OB-229 clause 6)', geom.ends.every((x) => x >= geom.cx - 0.01), JSON.stringify(geom.ends.map((x) => Math.round(x - geom.cx))))
  const row = await page.evaluate((DOC) => {
    const e = document.querySelector(DOC + ' [data-stat-kind]'); if (!e) return null
    const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, DOC)
  if (row) {
    await glideTo(row)
    const wedge = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-relation-orbit]')
      const p = svg.querySelector('path[data-orbit-wedge]')
      if (!p) return null
      const n = p.getAttribute('d').match(/-?[\d.]+/g).map(Number) // M cx cy L x0 y0 A rx ry 0 0 1 x1 y1 Z
      return { cx: +svg.getAttribute('width') / 2, x0: n[2], y0: n[3], x1: n[9], y1: n[10], cy: n[1] }
    })
    ok('the kind wash covers that SAME half: its two edges run straight up and straight down from the hub', !!wedge && near(wedge.x0, wedge.cx, 0.5) && near(wedge.x1, wedge.cx, 0.5) && near(wedge.y0 - wedge.cy, -(wedge.y1 - wedge.cy), 0.5), JSON.stringify(wedge))
    await k.park()
  } else ok('the reading has a kind row', false)

  // OB-229 clause 5 / OB-235 clause 6: an unconnected course
  await k.select(pick.none.id, pick.none.title)
  ok('a course that states no prerequisite and that nothing depends on is the Document\'s node', (await attr(DOC, 'data-current')) === pick.none.id)
  const empty = await page.evaluate((DOC) => {
    const fig = document.querySelector(DOC + ' [data-relations-figure]')
    const next = fig && fig.nextElementSibling
    const ph = [...document.querySelectorAll(DOC + ' [data-pane-placeholder]')]
    return {
      figureEmpty: !!fig && fig.children.length === 0, orbit: !!document.querySelector(DOC + ' [data-relation-orbit]'),
      nextIsPlaceholder: !!next && next.hasAttribute('data-pane-placeholder'), placeholders: ph.length,
      lines: ph[0] ? [...ph[0].children].map((c) => c.textContent) : [],
    }
  }, DOC)
  ok('no figure and no hairline: "No relationships" over "Nothing connects to this node", once', empty.figureEmpty && !empty.orbit && empty.nextIsPlaceholder && empty.placeholders === 1 && empty.lines[0] === 'No relationships' && empty.lines[1] === 'Nothing connects to this node', JSON.stringify(empty))
  ok('the reading offers no totals for a node with nothing to total', !(await has(`${DOC} [data-relation-stats]`)) && (await count(`${DOC} [data-stat]`)) === 0 && !((await text(DOC)) ?? '').includes('by kind'))
})

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed')
