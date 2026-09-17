// browsertest-rules-washes-baselines.mjs — five small design-system items, measured on the real app.
//
// A TEST. Each block is one DS obligation, asserted on computed styles and laid-out boxes rather
// than on a screenshot, because every one of these faults is invisible in a still or a pixel off:
//   - OB-205: the walk editor docks TWO bars in one pane's actionBar slot. Exactly one hairline in
//     the stack (the last bar's), the first item of each row on the same x, the rows' buttons 6px
//     apart — and the app's own toolbar keeps its 16px gutter and its rule (the regression `seam`
//     defaults false to prevent).
//   - OB-204: a highlight that tracks the pointer down an open list does not animate. The version
//     dropdown's rows, the stop finder's rows and the note-category popover's rows compute
//     `transition-property: none`; the version picker's TRIGGER still washes.
//   - OB-201: a round close control draws the ✕ as an svg, centred on the button by construction.
//   - OB-195: a relationship card draws its rule on the TOP edge only — no card carries a bottom
//     border, so two adjacent cards share one hairline.
//   - OB-200: the three families' RENDERED baseline sits where the corrected metrics put it
//     (0.940em Nunito, 0.948em Quicksand and JetBrains Mono, at line-height 1.35), read off a
//     zero-width baseline strut after `document.fonts.ready` — never off canvas `measureText`,
//     which answers from whichever face is already loaded. Before the fix Nunito read 1.000.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/browsertest-rules-washes-baselines.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5241

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
const context = await browser.newContext({ viewport: { width: 1750, height: 950 } })
const page = await context.newPage()
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

const fresh = async () => {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
}
const openPalette = async () => {
  if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(500)
  }
}

try {
  await fresh()

  // ── OB-200: the rendered baseline, per family ──────────────────────────────
  const baselines = await page.evaluate(async () => {
    const families = { Nunito: "'Nunito'", Quicksand: "'Quicksand'", 'JetBrains Mono': "'JetBrains Mono'" }
    const out = {}
    for (const [name, css] of Object.entries(families)) {
      await document.fonts.load(`400 400px ${css}`, 'Hxd')
      const box = document.createElement('div')
      box.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;font:400 400px/1.35 ${css};white-space:nowrap`
      box.textContent = 'Hxd'
      const strut = document.createElement('i')
      strut.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
      box.appendChild(strut)
      document.body.appendChild(box)
      await document.fonts.ready
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      out[name] = (strut.getBoundingClientRect().top - box.getBoundingClientRect().top) / 400
      box.remove()
    }
    return out
  })
  const near = (v, want) => v > 0 && Math.abs(v - want) <= 0.003
  ok('OB-200: Nunito\'s baseline renders at 0.940em (1.000 uncorrected)', near(baselines.Nunito, 0.9406), baselines.Nunito?.toFixed(4))
  ok('OB-200: Quicksand\'s baseline renders at 0.948em', near(baselines.Quicksand, 0.9485), baselines.Quicksand?.toFixed(4))
  ok('OB-200: JetBrains Mono\'s baseline renders at 0.948em', near(baselines['JetBrains Mono'], 0.9485), baselines['JetBrains Mono']?.toFixed(4))
  // THE FACES ARE REGISTERED AND LOADED. Found writing this check: the Google `@import` this
  // replaced was NEVER in effect. It sat in `tokens/fonts.css`, which `src/index.css` pulls in
  // after `@import "tailwindcss"` and five other token files, so once bundled it followed rules,
  // and an `@import` after a rule is invalid and dropped ("@import rules must precede all rules",
  // the production build's own warning). The unfixed app registered ZERO font faces and drew
  // every string in the platform fallback. `document.fonts.check()` cannot see that — it answers
  // true when no face needs loading — so count the faces instead.
  const faces = await page.evaluate(async () => {
    await document.fonts.ready
    const loaded = (fam) => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === fam && f.status === 'loaded')
    return { Nunito: loaded('Nunito'), Quicksand: loaded('Quicksand'), 'JetBrains Mono': loaded('JetBrains Mono') }
  })
  ok('OB-200: all three webfaces are registered and loaded (the unfixed app had none)', Object.values(faces).every(Boolean), JSON.stringify(faces))

  // ── OB-205: the walk editor's two bars ─────────────────────────────────────
  await openPalette()
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(900)
  const stack = await page.evaluate(() => {
    const slot = [...document.querySelectorAll('[data-pane-actionbar]')].find((s) => /read the walk/.test(s.textContent))
    if (!slot) return null
    const bars = [...slot.children].filter((c) => c.getBoundingClientRect().height > 0 && c.querySelector('button'))
    const ruled = [...slot.children].map((c) => parseFloat(getComputedStyle(c).borderBottomWidth) || 0)
    const firstBtn = (bar) => bar.querySelector('button').getBoundingClientRect()
    return {
      bars: bars.length,
      ruled: ruled.filter((w) => w > 0).length,
      lastRuled: ruled.length > 0 && ruled[ruled.length - 1] > 0,
      leftUpper: firstBtn(bars[0]).left,
      leftLower: bars[1] ? firstBtn(bars[1]).left : null,
      gap: bars[1] ? firstBtn(bars[1]).top - firstBtn(bars[0]).bottom : null,
    }
  })
  if (ok('OB-205: the walk editor docks two bars in its actionBar slot', !!stack && stack.bars === 2, JSON.stringify(stack))) {
    ok('OB-205: exactly ONE hairline in the stack, and it is the last bar\'s', stack.ruled === 1 && stack.lastRuled, `${stack.ruled} ruled`)
    ok('OB-205: the first item of each row starts on the same x (±0.5px)', Math.abs(stack.leftUpper - stack.leftLower) <= 0.5, `${stack.leftUpper.toFixed(2)} vs ${stack.leftLower.toFixed(2)}`)
    ok('OB-205: the rows\' buttons sit 6px apart (±0.5px)', Math.abs(stack.gap - 6) <= 0.5, `${stack.gap.toFixed(2)}px`)
  }
  const appBar = await page.evaluate(() => {
    const bar = document.querySelector('[data-toolbar-hook="palette-toggle"]')?.closest('button')?.parentElement?.parentElement
    if (!bar) return null
    const cs = getComputedStyle(bar)
    return { padLeft: cs.paddingLeft, rule: cs.borderBottomWidth }
  })
  ok('OB-205 regression: the app toolbar keeps its 16px gutter and its rule', !!appBar && appBar.padLeft === '16px' && appBar.rule === '1px', JSON.stringify(appBar))
  ok('OB-205: the walk bar still labels its items (not "corrected" to glyph-only)',
    (await page.locator('[data-pane-actionbar] button').filter({ hasText: /save as walk/ }).count()) === 1)

  // ── OB-204: the version dropdown ───────────────────────────────────────────
  const card = page.locator('[data-road-root] [data-rstage]').first()
  if (ok('OB-204: there is a group card on the road', (await card.count()) > 0)) {
    await card.scrollIntoViewIfNeeded()
    const trigger = card.locator('[role="button"]').filter({ hasText: /v\d/ }).first()
    const triggerTransition = await trigger.evaluate((el) => getComputedStyle(el).transitionProperty)
    ok('OB-204: the version picker TRIGGER still washes', /background-color/.test(triggerTransition), triggerTransition)
    const tb = await trigger.boundingBox()
    await page.mouse.click(tb.x + 6, tb.y + tb.height / 2)
    await page.waitForTimeout(400)
    const rows = await page.evaluate(() => [...document.querySelectorAll('[role="listbox"] button')]
      .map((b) => ({ text: b.textContent.trim().slice(0, 24), prop: getComputedStyle(b).transitionProperty }))
      .filter((r) => r.text))
    const options = rows.filter((r) => !/version/i.test(r.text) || /^v\d/.test(r.text))
    ok('OB-204: the version menu is open with rows in it', rows.length >= 2, JSON.stringify(rows))
    ok('OB-204: every row in the version menu, the add row included, has transition-property none',
      rows.length >= 2 && rows.every((r) => r.prop === 'none'), JSON.stringify(rows.map((r) => r.prop)))
    // hover down the rows: exactly one is lit at every moment, and the light leaves with the pointer
    const optionButtons = page.locator('[role="listbox"] button[role="option"]')
    if ((await optionButtons.count()) >= 1) {
      const ob = await optionButtons.first().boundingBox()
      await page.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2, { steps: 4 })
      await page.waitForTimeout(40)
      const litNow = await optionButtons.first().evaluate((el) => getComputedStyle(el).backgroundColor)
      await page.mouse.move(ob.x + ob.width / 2, ob.y - 400, { steps: 2 })
      await page.waitForTimeout(20)
      const after = await optionButtons.first().evaluate((el) => getComputedStyle(el).backgroundColor)
      ok('OB-204: the row lights at once and clears the instant the pointer leaves (read 20ms after)',
        litNow !== 'rgba(0, 0, 0, 0)' && after === 'rgba(0, 0, 0, 0)', `${litNow} -> ${after}`)
    }
    void options
    await page.keyboard.press('Escape')
  }

  // ── OB-201: a round close control draws its ✕ ──────────────────────────────
  const close = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[aria-label="close"], button[aria-label^="close "]')]
      .find((b) => b.getBoundingClientRect().width > 0 && !b.textContent.trim())
    if (!btn) return null
    const svg = btn.querySelector('svg')
    const b = btn.getBoundingClientRect()
    const s = svg?.getBoundingClientRect()
    return { label: btn.getAttribute('aria-label'), svg: !!svg, text: btn.textContent, dx: s ? (s.x + s.width / 2) - (b.x + b.width / 2) : null, dy: s ? (s.y + s.height / 2) - (b.y + b.height / 2) : null }
  })
  if (ok('OB-201: a round close control is on screen', !!close, JSON.stringify(close))) {
    ok('OB-201: it draws the ✕ as an svg, no typed character', close.svg && !close.text.includes('✕'))
    ok('OB-201: the mark is centred on the button (±0.5px both ways)', close.svg && Math.abs(close.dx) <= 0.5 && Math.abs(close.dy) <= 0.5, `dx ${close.dx?.toFixed(2)} dy ${close.dy?.toFixed(2)}`)
  }
  const typedClose = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.textContent.trim() === '✕' && b.getBoundingClientRect().width > 0).length)
  ok('OB-201: no button on the authoring desk shows a typed ✕ as its whole face', typedClose === 0, `${typedClose} found`)

  // ── OB-195: relationship cards draw one rule per boundary ──────────────────
  await fresh()
  await openPalette()
  await page.getByLabel('studio-inst-connections').click()
  await page.waitForTimeout(900)
  const cards = await page.evaluate(() => {
    const pane = document.querySelector('[aria-label="connections-pane"]')
    if (!pane) return null
    const headers = [...pane.querySelectorAll('[data-rel-group-header]')]
    const rows = []
    for (const h of headers) {
      let el = h.nextElementSibling
      while (el && !el.hasAttribute('data-rel-group-header')) {
        const cs = getComputedStyle(el)
        if (cs.borderTopWidth === '1px') rows.push({ top: cs.borderTopWidth, bottom: cs.borderBottomWidth })
        el = el.nextElementSibling
      }
    }
    return { groups: headers.length, rows }
  })
  if (ok('OB-195: the relations column draws grouped cards', !!cards && cards.rows.length >= 2, JSON.stringify(cards && { groups: cards.groups, rows: cards.rows.length }))) {
    ok('OB-195: no card carries a bottom border — two adjacent cards share one hairline',
      cards.rows.every((r) => r.bottom === '0px'), JSON.stringify([...new Set(cards.rows.map((r) => r.bottom))]))
  }

  // ── OB-204: the stop finder and the category popover, in a live lecture ────
  await fresh()
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(700)
  await page.locator('[data-toolbar-hook="present"]').click()
  await page.waitForTimeout(900)
  await page.bringToFront()
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  await page.keyboard.press('j')
  await page.waitForTimeout(400)
  const finderRows = await page.evaluate(() => [...document.querySelectorAll('[data-stop-finder-row]')].map((r) => getComputedStyle(r).transitionProperty))
  ok('OB-204: the stop finder\'s rows have transition-property none', finderRows.length > 0 && finderRows.every((p) => p === 'none'), `${finderRows.length} rows, ${JSON.stringify([...new Set(finderRows)])}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.locator('[data-note-composer]').locator('button').first().click()
  await page.waitForTimeout(400)
  const popRows = await page.evaluate(() => [...document.querySelectorAll('[data-note-categories] button')]
    .filter((b) => b.getBoundingClientRect().height >= 20)
    .map((b) => getComputedStyle(b).transitionProperty))
  ok('OB-204: the category popover\'s rows have transition-property none', popRows.length > 0 && popRows.every((p) => p === 'none'), `${popRows.length} rows, ${JSON.stringify([...new Set(popRows)])}`)
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
