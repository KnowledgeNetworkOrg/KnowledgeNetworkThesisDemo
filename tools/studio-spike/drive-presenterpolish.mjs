// #343 — the presenter's three items from the visible-bugs batch, on the running page:
//
//   OB-246  the strip's OPEN row spans the row: `pitch` is a floor, not the spacing
//   OB-203  advancing the film roll plays a travel frame, so the direction is visible
//   OB-207  a during-class note's timestamp is `--fs-caption`, its tag sits 1px lower, and the
//           live column's four settled spacing values
//
// All three are read in the palette's Present PREVIEW — no projector window is needed for any
// of them, and browsertest-presenter.mjs already owns the live lecture. What is asserted is what
// a browser alone can say: where the dots land, whether the roll's row passes THROUGH a middle
// position rather than snapping (a screenshot cannot tell a slide from a snap), and what the
// note row's computed styles are. The arithmetic behind the strip is also pinned by
// src/ds/presenter/presenterstrip.test.ts, which renders the row with a long walk and a stale
// centre — the two cases this page's seven-stop walk cannot reach.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/drive-presenterpolish.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5270
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

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  await page.evaluate(() => document.fonts.ready)
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(900)
  ok('the Present preset opens the presenter preview', (await page.locator('[aria-label="studio-presenter"]').count()) === 1)
  const chipText = async () => (await page.locator('[data-presenter-chip]').innerText()).replace(/\s+/g, ' ').trim()

  // ── OB-246: the open row spans the row ─────────────────────────────────────
  const strip = page.locator('[data-presenter-strip]')
  const stripBox = await strip.boundingBox()
  const centres = (sel) => page.$$eval(sel, (els) => els
    .filter((e) => parseFloat(getComputedStyle(e).opacity) > 0)
    .map((e) => { const r = e.getBoundingClientRect(); return { i: Number(e.getAttribute('data-presenter-tick') ?? e.getAttribute('data-presenter-dot')), x: r.x + r.width / 2, op: parseFloat(getComputedStyle(e).opacity) } })
    .sort((a, b) => a.i - b.i))
  const ticks = await centres('[data-presenter-tick]')
  const N = ticks.length
  ok('the closed rail draws one tick per stop', N > 2, `${N} stops`)
  const closedIn = { left: ticks[0].x - stripBox.x, right: stripBox.x + stripBox.width - ticks[N - 1].x }
  await page.locator('[data-presenter-strip] [aria-label="show every stop"]').click()
  await page.waitForTimeout(600)
  ok('the strip opens', (await strip.getAttribute('data-presenter-strip')) === 'open')
  const dots = (await centres('[data-presenter-dot]')).filter((d) => d.op === 1)
  const openBox = await strip.boundingBox()
  const openIn = { left: dots[0].x - openBox.x, right: openBox.x + openBox.width - dots[dots.length - 1].x }
  console.log(`OB-246 outermost marks, px in from the strip's edges: closed ticks ${closedIn.left.toFixed(1)} / ${closedIn.right.toFixed(1)}, open dots ${openIn.left.toFixed(1)} / ${openIn.right.toFixed(1)}`)
  ok('(2) a walk that fits whole is shown whole', dots.length === N, `${dots.length} of ${N} dots labelled`)
  // the labelled end is inset by half a label (36) inside the row, the rail by half a knob (9):
  // the difference is the geometry the DS chose, so "as close" is that inset and no more
  ok(
    '(1) opening does not narrow the walk: each outermost dot sits within half a label of where the closed rail\'s tick sat',
    Math.abs(openIn.left - closedIn.left) <= 36 - 9 + 1 && Math.abs(openIn.right - closedIn.right) <= 36 - 9 + 1,
    `closed ${closedIn.left.toFixed(1)}/${closedIn.right.toFixed(1)} → open ${openIn.left.toFixed(1)}/${openIn.right.toFixed(1)}`,
  )
  const gaps = dots.slice(1).map((d, k) => d.x - dots[k].x)
  ok('(2) spread evenly — every gap the same', Math.max(...gaps) - Math.min(...gaps) < 0.75, gaps.map((g) => g.toFixed(1)).join(', '))
  ok('(4) and the drawn spacing is above the 68px floor, not at it', Math.min(...gaps) >= 68, `pitch ${gaps[0].toFixed(1)}px`)
  ok('(5) no "back to the active node" pill while the active stop is in the window', (await page.locator('[data-presenter-row]').getByText('active node').count()) === 0)
  // (5) the carry: drag the active dot onto another stop and it lands THERE, at the new spacing
  const activeBefore = await chipText()
  const act = await page.$eval('[data-presenter-row]', (row) => {
    const d = [...row.querySelectorAll('[data-presenter-dot]')].find((e) => e.style.cursor === 'grab')
    if (!d) return null
    const r = d.getBoundingClientRect()
    return { i: Number(d.getAttribute('data-presenter-dot')), x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (act) {
    const target = dots.find((d) => Math.abs(d.i - act.i) >= 2) ?? dots[dots.length - 1]
    await page.mouse.move(act.x, act.y)
    await page.mouse.down()
    await page.mouse.move((act.x + target.x) / 2, act.y, { steps: 4 })
    await page.mouse.move(target.x + 3, act.y, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(500)
    const moved = await page.$eval('[data-presenter-row]', (row) => {
      const d = [...row.querySelectorAll('[data-presenter-dot]')].find((e) => e.style.cursor === 'grab')
      return d ? Number(d.getAttribute('data-presenter-dot')) : null
    })
    ok('(5) dragging the active node lands it on the stop under the pointer', moved === target.i, `aimed at stop ${target.i + 1}, landed on ${moved == null ? '—' : moved + 1} (chip "${activeBefore}" → "${await chipText()}")`)
  } else {
    ok('(5) the active dot is a drag handle in the preview', false, 'no grab cursor on any dot')
  }
  await strip.screenshot({ path: OUT + '/ob246-strip-open.png' })
  /* A CARRY LEAVES ITS "that was a drag" MEMORY SET when it ends over a different stop than it
     began on — no click fires to consume it — so the row swallows the NEXT click on a stop. That
     is the strip's own behaviour, older than this item and not what these checks are about, so the
     row is remounted (closed and reopened) before anything below clicks a stop. */
  await page.locator('[data-presenter-strip] [aria-label="hide the stops"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-presenter-strip] [aria-label="show every stop"]').click()
  await page.waitForTimeout(500)

  // ── OB-203: the film roll's travel frame ───────────────────────────────────
  const row = page.locator('[data-filmroll-row]')
  ok('the roll\'s cards travel as ONE row element', (await row.count()) === 1)
  /** start sampling the row (and both chevrons) every frame, fire `act` the way a person would —
   *  a real click, a real key — then collect 360ms of samples. The sampler runs in the page so
   *  frames are frames, not round trips. */
  const sampleTravel = async (act) => {
    await page.evaluate(() => {
      const rowEl = document.querySelector('[data-filmroll-row]')
      const chev = (dir) => document.querySelector(`[data-filmroll-chevron="${dir}"]`)
      const m41 = (el) => { const t = getComputedStyle(el).transform; return t === 'none' ? 0 : new DOMMatrixReadOnly(t).m41 }
      const read = (el) => el ? { x: el.getBoundingClientRect().x, op: parseFloat(getComputedStyle(el).opacity), tx: m41(el) } : null
      const s = { samples: [], calls: 0, chev0: { next: read(chev('next')), prev: read(chev('prev')) }, t0: performance.now(), on: true }
      const orig = rowEl.animate
      rowEl.animate = function (...a) { s.calls++; return orig.apply(this, a) }
      s.restore = () => { rowEl.animate = orig }
      const step = () => {
        if (!s.on) return
        s.samples.push({ t: Math.round(performance.now() - s.t0), tx: m41(rowEl), op: parseFloat(getComputedStyle(rowEl).opacity), next: read(chev('next')), prev: read(chev('prev')) })
        requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      window.__travel = s
    })
    if (act.kind === 'chevron') await page.locator(`[data-filmroll-chevron="${act.dir}"]`).click()
    else if (act.kind === 'key') { await page.mouse.move(4, 4); await page.keyboard.press(act.key) }
    else if (act.kind === 'dot') await page.locator(`[data-presenter-dot="${act.i}"] button`).first().click()
    await page.waitForTimeout(360)
    return page.evaluate(() => {
      const s = window.__travel
      s.on = false
      s.restore()
      const rowEl = document.querySelector('[data-filmroll-row]')
      return { samples: s.samples, calls: s.calls, chev0: s.chev0, restStyle: { transform: rowEl.style.transform, opacity: rowEl.style.opacity } }
    })
  }
  const stepPx = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-filmroll-card]')]
    const live = cards.find((c) => c.getAttribute('data-filmroll-card') === 'live').getBoundingClientRect()
    const nb = cards.find((c) => c.getAttribute('data-filmroll-card') === 'neighbour').getBoundingClientRect()
    const gap = Math.abs(live.x - (nb.x + nb.width)) < Math.abs(nb.x - (live.x + live.width)) ? live.x - (nb.x + nb.width) : nb.x - (live.x + live.width)
    return (live.width + nb.width) / 2 + gap
  })
  const judge = (label, run, dir) => {
    const s = run.samples
    const first = s.find((p) => Math.abs(p.tx) > 0.5)
    const mid = s.find((p) => Math.abs(p.tx) > stepPx * 0.15 && Math.abs(p.tx) < stepPx * 0.85)
    ok(`${label}: the row starts displaced on the side it came FROM`, !!first && Math.sign(first.tx) === dir, first ? `first displaced frame ${first.tx.toFixed(1)}px at ${first.t}ms (step ${stepPx.toFixed(0)}px)` : 'never displaced')
    ok(`${label}: it passes THROUGH a middle position — a slide, not a snap`, !!mid, mid ? `${mid.tx.toFixed(1)}px at ${mid.t}ms` : s.map((p) => p.tx.toFixed(0)).join(' '))
    ok(`${label}: and ends at rest`, Math.abs(s[s.length - 1].tx) < 0.5 && s[s.length - 1].op === 1, `${s[s.length - 1].tx.toFixed(2)}px, opacity ${s[s.length - 1].op}`)
    ok(`${label}: the slide plays ONCE for one stop change`, run.calls === 1, `${run.calls} animate() calls`)
    return run
  }
  await page.mouse.move(4, 4)
  const fwd = judge('chevron →', await sampleTravel({ kind: 'chevron', dir: 'next' }), 1)
  const lean = fwd.samples.filter((p) => p.next && p.next.op === 1 && p.next.tx > 2.5)
  ok('chevron →: the pressed chevron goes full weight and leans outward while the row moves', lean.length > 0, lean.length ? `${lean.length} frames at opacity 1, lean up to ${Math.max(...lean.map((p) => p.next.tx)).toFixed(1)}px` : '')
  const chevMoved = Math.max(...fwd.samples.filter((p) => p.next).map((p) => Math.abs(p.next.x - fwd.chev0.next.x)))
  ok('chevron →: and the chevrons stay put — only the 3px lean, never the travel', chevMoved <= 3.5, `${chevMoved.toFixed(1)}px`)
  ok('the row\'s resting style carries no transform and no opacity of its own', fwd.restStyle.transform === '' && fwd.restStyle.opacity === '', JSON.stringify(fwd.restStyle))
  await page.waitForTimeout(300)
  judge('key ←', await sampleTravel({ kind: 'key', key: 'ArrowLeft' }), -1)
  await page.waitForTimeout(300)
  judge('key →', await sampleTravel({ kind: 'key', key: 'ArrowRight' }), 1)
  await page.waitForTimeout(300)
  // a ROAM to a non-adjacent stop from the (open) strip slides in the direction of the jump
  const shownNow = Number((await chipText()).match(/\d+/)[0]) - 1
  const far = shownNow >= 3 ? shownNow - 3 : Math.min(N - 1, shownNow + 3)
  const liveTitle = () => page.locator('[data-filmroll-card="live"] [data-slide-title]').innerText()
  const titleBefore = await liveTitle()
  judge(`roam to stop ${far + 1} from the strip`, await sampleTravel({ kind: 'dot', i: far }), far > shownNow ? 1 : -1)
  ok('and the live slide really moved three stops', (await liveTitle()) !== titleBefore, `"${titleBefore}" → "${await liveTitle()}"`)
  await page.keyboard.press('Backspace') // back to the record
  await page.waitForTimeout(400)
  await page.waitForTimeout(300)
  // reduced motion: `--dur-move` is 1ms, so the roll cuts — no visible displacement, no lean
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const rm = await sampleTravel({ kind: 'key', key: 'ArrowRight' })
  const rmMoved = rm.samples.filter((p) => Math.abs(p.tx) > 0.5)
  const rmLean = rm.samples.filter((p) => p.next && p.next.tx > 0.5)
  ok('reduced motion: the roll cuts — no displaced frame', rmMoved.length === 0, rmMoved.map((p) => `${p.tx.toFixed(0)}px@${p.t}ms`).join(' '))
  ok('reduced motion: and no lean', rmLean.length === 0, rmLean.map((p) => `${p.next.tx.toFixed(1)}px@${p.t}ms`).join(' '))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const src = readFileSync(join(REPO, 'src/ds/presenter/FilmRoll.tsx'), 'utf8')
  ok('FilmRoll.tsx carries no literal 200ms / 0.2s duration — the move reads --dur-move', !/\b200\s*ms\b|0\.2s\b|duration:\s*200\b/.test(src) && src.includes("'--dur-move'"))

  // ── OB-207: the during-class note ──────────────────────────────────────────
  const during = page.locator('[data-lecture-notes="live"] [data-notes-during]')
  const field = during.locator('textarea')
  for (const text of ['hello', 'a second note']) {
    await field.fill(text)
    await field.press('Enter')
    await page.waitForTimeout(200)
  }
  const notes = during.locator('[data-lecture-note]')
  ok('two notes saved in the preview', (await notes.count()) === 2, String(await notes.count()))
  const noteRead = await page.$$eval('[data-lecture-notes="live"] [data-notes-during] [data-lecture-note]', (rows) => rows.map((r) => {
    const cs = getComputedStyle(r)
    const tagWrap = r.firstElementChild
    const body = r.children[1]
    const meta = body.lastElementChild
    const m = getComputedStyle(meta)
    return {
      align: cs.alignItems, padTop: cs.paddingTop, padBottom: cs.paddingBottom,
      tagMargin: getComputedStyle(tagWrap).marginTop,
      metaSize: m.fontSize, metaFamily: m.fontFamily, metaWrap: m.overflowWrap, when: meta.textContent,
    }
  }))
  console.log('OB-207 rows: ' + JSON.stringify(noteRead))
  ok('(1) the timestamp is --fs-caption (12px), not --fs-micro (11px), and wraps rather than running on', noteRead.every((n) => n.metaSize === '12px' && n.metaWrap === 'anywhere'), noteRead.map((n) => `${n.metaSize} ${n.metaWrap} "${n.when}"`).join(' | '))
  ok('(1) and it is still the mono face', noteRead.every((n) => /mono/i.test(n.metaFamily) || /JetBrains|Consolas|monospace/i.test(n.metaFamily)), noteRead[0]?.metaFamily)
  ok('(2) the row is flex-start and the tag sits 1px lower', noteRead.every((n) => n.align === 'flex-start' && n.tagMargin === '1px'), noteRead.map((n) => `${n.align} ${n.tagMargin}`).join(' | '))
  ok('(8) the FIRST row pads 4px on top and every other row 7px; all pad 7px below', noteRead[0].padTop === '4px' && noteRead.slice(1).every((n) => n.padTop === '7px') && noteRead.every((n) => n.padBottom === '7px'), noteRead.map((n) => `${n.padTop}/${n.padBottom}`).join(' '))
  const scrollers = await page.evaluate(() => {
    const live = document.querySelector('[data-lecture-notes="live"]')
    const d = live.querySelector('[data-notes-during-scroller]')
    const all = [...live.querySelectorAll('[data-pane-body="scroller"]')]
    const prepared = all.find((s) => s !== d)
    const cs = (el) => el ? { top: getComputedStyle(el).marginTop, bottom: getComputedStyle(el).marginBottom } : null
    const composer = d.nextElementSibling
    return { during: cs(d), prepared: cs(prepared), composerPad: getComputedStyle(composer).paddingTop, gap: composer.firstElementChild.getBoundingClientRect().top - d.getBoundingClientRect().bottom }
  })
  ok('(8) the During scroller carries neither inset: margin-top 0, margin-bottom 0', scrollers.during.top === '0px' && scrollers.during.bottom === '0px', JSON.stringify(scrollers.during))
  ok('(6) the composer sits 6px under the scroller, not 8 (and not 12 + 8)', scrollers.composerPad === '6px' && Math.abs(scrollers.gap - 6) < 0.5, `wrapper ${scrollers.composerPad}, gap ${scrollers.gap.toFixed(1)}px`)
  console.log('OB-207 prepared column scroller (unchanged by this item): ' + JSON.stringify(scrollers.prepared))
  await page.locator('[data-lecture-notes="live"]').screenshot({ path: OUT + '/ob207-notes.png' })
} finally {
  await page.evaluate(() => localStorage.clear()).catch(() => {})
  await browser.close()
  vite.kill()
}

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shots at tools/studio-spike/shots/ob246-strip-open.png, ob207-notes.png')
