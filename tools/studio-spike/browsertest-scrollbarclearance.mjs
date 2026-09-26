// browsertest-scrollbarclearance.mjs — DS OB-210 (#343): no scrolling column runs under its own
// scrollbar, in FIREFOX as well as Chromium.
//
// A TEST, in two engines. In Firefox this project's `base.css` sets `scrollbar-width: thin`, a bar
// that takes NO layout space, so `scrollbar-gutter: stable` reserves nothing and — before OB-210 —
// every scrolling column drew its last ~8px under the thumb. Chromium's styled 12px gutter hides
// the fault, which is why no Chromium driver could ever see it. The fix is `scrollerPadRight()`
// (`src/ds/chrome/Pane.tsx`): 0 where the bar takes real space, `SCROLLBAR_ROOM` (10) where not.
//
// For every scrolling box on screen in four states — the default desk with the Explorer rail open,
// a lecture with enough notes to scroll the During column, the stop finder, and a node picker on
// the plan desk — it reads the obligation's own numbers:
//   barPx     what the bar takes out of the box (offsetWidth − clientWidth − borders)
//   padRight  the box's computed right padding
//   overhang  static descendants whose right edge passes the box's client edge by > 0.5px
//   clear     the gap between the rightmost static content and the client edge
// and asserts, per engine, for each column under test that is actually scrolling:
//   Firefox   barPx 0, padRight ≥ 10, clear ≥ 8 (Firefox's thin thumb), overhang 0
//   Chromium  barPx 12 and overhang 0 — the regression half: the pad is conditional so this holds
//
// WHY `clear` AND NOT JUST THE OBLIGATION'S `overhang`: an overlay bar sits INSIDE the client
// box, on top of the content, so nothing ever passes the client edge and `overhang` reads 0 in
// Firefox before the fix as well as after (measured, 2026-09-26: 4px of pad, overhang 0). The
// fault is content inside the thumb's last 8px, and `clear` is the reading that can see it.
// It prints every reading, because the receipt carries them.
//
// The RELATIONS rail (#342 / PR #392) is not on this branch's main yet; when it lands, run this
// again — it is measured by the same sweep, with no edit needed, once it is on screen.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-scrollbarclearance.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5262

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
  return cond
}

/** every y-scrolling box on the page, with the obligation's three readings. A box is NAMED by the
 *  nearest data-* hook or aria-label at or above it, so a reading can be told apart in the log. */
const readScrollers = (page) => page.evaluate(() => {
  const nameOf = (el) => {
    for (let n = el, i = 0; n && i < 8; n = n.parentElement, i++) {
      const hook = [...n.attributes].find((a) => a.name.startsWith('data-') && !/^data-(pane-body|kn-)/.test(a.name))
      if (hook) return '[' + hook.name + (hook.value ? '=' + hook.value.slice(0, 24) : '') + ']' + (i ? ' +' + i : '')
      const aria = n.getAttribute('aria-label') || n.getAttribute('role')
      if (aria) return aria + (i ? ' +' + i : '')
    }
    return el.tagName.toLowerCase()
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el)
    if (!/auto|scroll/.test(s.overflowY)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 40 || r.height < 40) continue
    const borders = (parseFloat(s.borderLeftWidth) || 0) + (parseFloat(s.borderRightWidth) || 0)
    const barPx = Math.round(el.offsetWidth - el.clientWidth - borders)
    const edge = r.left + el.clientLeft + el.clientWidth
    const over = [...el.querySelectorAll('*')].filter((c) => {
      if (getComputedStyle(c).position !== 'static') return false
      const b = c.getBoundingClientRect()
      return b.width > 0 && b.height > 0 && b.right > edge + 0.5
    })
    out.push({
      name: nameOf(el),
      scrolling: el.scrollHeight > el.clientHeight + 1,
      barPx,
      padRight: Math.round(parseFloat(s.paddingRight) * 10) / 10,
      overhang: over.length,
      worst: Math.max(0, ...over.map((c) => Math.round(c.getBoundingClientRect().right - edge))),
      clear: Math.round((edge - Math.max(r.left, ...[...el.querySelectorAll('*')]
        .filter((c) => getComputedStyle(c).position === 'static')
        .map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0).map((b) => b.right))) * 10) / 10,
    })
  }
  return out
})

const report = (engine, state, list) => {
  for (const s of list) {
    console.log(`  ${engine.padEnd(8)} ${state.padEnd(16)} ${s.scrolling ? 'scrolls ' : 'at rest '} barPx ${String(s.barPx).padStart(2)}  padRight ${String(s.padRight).padStart(4)}  clear ${String(s.clear).padStart(4)}  overhang ${s.overhang}${s.overhang ? ' (worst ' + s.worst + 'px)' : ''}   ${s.name}`)
  }
}

/** the per-engine rule: Firefox's bar takes no space and the pad must cover it; Chromium's takes
 *  12 and the pad must be absent (nothing moved) — overhang 0 either way, for a box that scrolls */
const judge = (engine, state, list, want) => {
  const hit = list.filter((s) => want.test(s.name))
  if (!ok(`${engine} · ${state}: the column under test is on screen`, hit.length > 0, want.toString())) return
  for (const s of hit) {
    const label = `${engine} · ${state} · ${s.name}`
    ok(`${label}: it is actually scrolling, so the reading means something`, s.scrolling)
    if (engine === 'firefox') {
      ok(`${label}: the thin bar takes no layout space (the fault's condition)`, s.barPx === 0, 'barPx ' + s.barPx)
      ok(`${label}: the column holds off at least SCROLLBAR_ROOM`, s.padRight >= 10, 'padRight ' + s.padRight)
      ok(`${label}: the content stops clear of the 8px thumb`, s.clear >= 8, 'clear ' + s.clear)
    } else {
      ok(`${label}: the styled gutter is real (12px)`, s.barPx === 12, 'barPx ' + s.barPx)
    }
    ok(`${label}: nothing runs under the bar`, s.overhang === 0, s.overhang ? `${s.overhang} past the edge, worst ${s.worst}px` : '')
  }
}

const runEngine = async (engine) => {
  const browser = engine === 'firefox'
    ? await firefox.launch({ headless: true })
    /* Playwright passes --hide-scrollbars to headless Chromium, which turns every bar into an
       overlay (barPx 0) and would test Firefox's branch twice. Dropping it draws the real 12px
       styled gutter — the case every Chromium install is in, and the regression half. */
    : await chromium.launch({ channel: 'msedge', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] })
  // a SHORT window, so the columns under test have to scroll
  const page = await browser.newPage({ viewport: { width: 1600, height: 720 } })
  page.on('pageerror', (e) => errors.push(`${engine} pageerror: ` + e.message))
  try {
    await page.goto(`http://localhost:${PORT}/`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(900)

    // ── 1. the default desk: the document pane, and the Explorer rail opened ─────
    // a shorter window still, so the rail's tree has to scroll
    await page.setViewportSize({ width: 1600, height: 420 })
    await page.waitForTimeout(300)
    if (await page.locator('[data-explorer-corner] button').count()) {
      await page.locator('[data-explorer-corner] button').click()
      await page.waitForTimeout(500)
    }
    const desk = await readScrollers(page)
    report(engine, 'desk + explorer', desk)
    judge(engine, 'desk + explorer', desk, /explorer-rail/)
    await page.setViewportSize({ width: 1600, height: 720 })
    await page.waitForTimeout(300)

    // ── 2. a lecture, with enough notes to scroll the During column ─────────────
    await page.getByLabel('studio-preset-present').click()
    await page.waitForTimeout(700)
    await page.locator('[data-toolbar-hook="present"]').click()
    await page.waitForTimeout(900)
    const field = page.locator('[data-lecture-notes="live"]').getByLabel('a note for this stop…')
    for (let i = 1; i <= 14; i++) {
      await field.click()
      await page.keyboard.type(`note ${i} — the handshake, the certificate chain, and what the class asked about it`)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(120)
    }
    await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
    await page.waitForTimeout(300)
    const lecture = await readScrollers(page)
    report(engine, 'lecture notes', lecture)
    judge(engine, 'lecture notes', lecture, /notes-during/)

    // ── 3. the stop finder ─────────────────────────────────────────────────────
    await page.keyboard.press('j')
    await page.waitForTimeout(500)
    const finder = await readScrollers(page)
    report(engine, 'stop finder', finder.filter((s) => /listbox|stop-finder/.test(s.name)))
    judge(engine, 'stop finder', finder, /listbox|stop-finder/)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // ── 4. a node picker, on the plan desk ─────────────────────────────────────
    await page.goto(`http://localhost:${PORT}/`)
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForTimeout(800)
    await page.locator('[aria-label="studio-preset-plan"]').click()
    await page.waitForTimeout(600)
    const cards = page.locator('[data-road-root] [data-rstage]')
    const card = cards.nth((await cards.count()) - 1)
    await card.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    const row = card.locator('[role="button"]').filter({ hasText: /v\d/ }).first()
    const rb = await row.boundingBox()
    await page.mouse.click(rb.x + 6, rb.y + rb.height / 2)
    await page.waitForTimeout(400)
    await page.getByText(/add new version/i).first().click()
    await page.waitForTimeout(700)
    const pk = page.locator('[data-rpicknode]').first()
    await pk.locator('button').first().click()
    await page.waitForTimeout(600)
    const picker = await readScrollers(page)
    // the picker's list is the scroller that holds the search field's sibling rows
    const pickerList = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder="search nodes"]')
      let menu = input
      while (menu && getComputedStyle(menu).position !== 'fixed') menu = menu.parentElement
      if (!menu) return null
      const list = [...menu.querySelectorAll('div')].find((d) => /auto|scroll/.test(getComputedStyle(d).overflowY))
      if (!list) return null
      list.setAttribute('data-probe-picker-list', '')
      return true
    })
    ok(`${engine} · node picker: its menu opened`, !!pickerList)
    const picked = (await readScrollers(page)).filter((s) => /probe-picker-list/.test(s.name))
    void picker
    report(engine, 'node picker', picked)
    judge(engine, 'node picker', picked, /probe-picker-list/)
  } finally {
    await browser.close()
  }
}

try {
  for (const engine of ['firefox', 'chromium']) await runEngine(engine)
} catch (e) {
  errors.push('driver: ' + (e && e.stack ? e.stack : e))
} finally {
  vite.kill()
}

console.log('\n' + checks.join('\n'))
const passed = checks.filter((c) => c.startsWith('PASS')).length
console.log(`\n${passed} passed, ${checks.length - passed} failed`)
if (errors.length) {
  console.log('\nERRORS:\n' + errors.map((e) => '  ' + e).join('\n'))
  process.exit(1)
}
