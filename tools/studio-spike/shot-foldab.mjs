// Shoots the #91 fold A/B page (foldab/) and reports each fold's real box.
//
// The gate on #91 is whether the DS's folded drawing can replace the road's, and
// that has two halves: does it still READ as a container (the screenshot), and
// can layoutRoad reserve it (the numbers). This driver produces both, and it owns
// its own vite so nothing is left running.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5204
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
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

await page.goto(`http://localhost:${PORT}/tools/studio-spike/foldab/index.html`)
await page.waitForTimeout(900)
// the OB-222 edge and slot cases render only once the fonts are in (they measure text)
await page.waitForSelector('[data-cal-slot="plain"]', { timeout: 10000 }).catch(() => {})
await page.waitForTimeout(300)

await page.screenshot({ path: `${OUT}/foldab-01-all.png`, fullPage: true })
console.log('foldab-01-all.png taken (three folds, same content, on the road well)')

for (const name of ['road', 'ds-natural', 'ds-pillwidth', 'ds-narrow']) {
  await page.locator(`[data-case="${name}"]`).screenshot({ path: `${OUT}/foldab-02-${name}.png` })
  console.log(`foldab-02-${name}.png taken`)
}

// the numbers layoutRoad would have to reserve for each drawing
const boxes = await page.evaluate(() => {
  const out = {}
  for (const name of ['road', 'ds-natural', 'ds-pillwidth', 'ds-narrow']) {
    const well = document.querySelector(`[data-case="${name}"]`)
    // the fold is the middle child of the well (leaf, arrow, FOLD, arrow, leaf)
    const fold = well.children[2]
    const r = fold.getBoundingClientRect()
    out[name] = { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }
  }
  return out
})
console.log('fold boxes (what layoutRoad would reserve):', JSON.stringify(boxes))
console.log('  road pill is 150x34 + a 6px peek margin — the baseline every leaf shares')

// ── calibration for the road's foldSize() ──────────────────────────────────
// What layoutRoad has to predict, over a spread of title lengths at the road's
// own width. `lines` is what the title's clamp actually resolved to, read off
// the rendered box rather than assumed, so the fit is against reality.
const cal = await page.evaluate(() => {
  return [...document.querySelectorAll('[data-cal]')].map((el) => {
    const shell = el.firstElementChild
    const face = shell.querySelector('[data-grab]')
    const title = el.querySelector('span[title]')
    const cs = title ? getComputedStyle(title) : null
    const lh = cs ? parseFloat(cs.lineHeight) : 0
    return {
      title: el.getAttribute('data-cal-title'),
      chars: el.getAttribute('data-cal-title').length,
      h: Math.round(el.getBoundingClientRect().height * 100) / 100,
      faceH: face ? Math.round(face.getBoundingClientRect().height * 100) / 100 : null,
      titleH: title ? Math.round(title.getBoundingClientRect().height * 100) / 100 : null,
      lineH: Math.round(lh * 100) / 100,
      lines: title && lh ? Math.round(title.getBoundingClientRect().height / lh) : null,
      // the room the title's WRAPPER gets in the row (its floor is 96) — what
      // FOLD_TITLE_W has to name; and the face + shell widths, which the DS's own
      // content-box regime (data-ds-host) puts at 190 / 196
      titleW: title ? Math.round(title.parentElement.getBoundingClientRect().width * 100) / 100 : null,
      faceW: face ? Math.round(face.getBoundingClientRect().width * 100) / 100 : null,
      shellW: Math.round(shell.getBoundingClientRect().width * 100) / 100,
      predH: Number(el.getAttribute('data-pred-h')), predW: Number(el.getAttribute('data-pred-w')),
    }
  })
})
// the OPEN head's rows, from the DS component itself — what headRows() predicts
// for the road-drawn GroupHead. Row 1 is the head row (index/title/tally), row 2
// the DescLine block, row 3 the picker; y is each row's top from the face's top.
const openCal = await page.evaluate(() => {
  return [...document.querySelectorAll('[data-cal-open]')].map((el) => {
    const shell = el.firstElementChild
    const face = shell.querySelector('[data-grab]')
    const fb = face.getBoundingClientRect()
    const rows = [...face.children].filter((c) => c.tagName === 'DIV')
    const r = (x) => { const b = x.getBoundingClientRect(); return { y: Math.round((b.y - fb.y) * 100) / 100, h: Math.round(b.height * 100) / 100 } }
    const title = face.querySelector('span[title]')
    const lh = title ? parseFloat(getComputedStyle(title).lineHeight) : 0
    const desc = face.querySelector('[data-grab] > div:nth-child(2) span')
    const picker = face.querySelector('[role="button"]')
    const sb = shell.getBoundingClientRect()
    return {
      k: el.getAttribute('data-cal-open'), faceW: Math.round(fb.width * 100) / 100, faceH: Math.round(fb.height * 100) / 100,
      shellH: Math.round(sb.height * 100) / 100,
      rows: rows.map(r), titleH: title ? Math.round(title.getBoundingClientRect().height * 100) / 100 : null,
      descTextH: desc ? Math.round(desc.getBoundingClientRect().height * 100) / 100 : null,
      pickerH: picker ? Math.round(picker.getBoundingClientRect().height * 100) / 100 : null,
      predH: Number(el.getAttribute('data-pred-h')), predBodyTop: Number(el.getAttribute('data-pred-bodytop')),
      measured: el.getAttribute('data-pred-measured'), slot: el.getAttribute('data-slot'),
      title: el.getAttribute('data-cal-title'), predLines: Number(el.getAttribute('data-pred-lines')),
      lines: title && lh ? Math.round(title.getBoundingClientRect().height / lh) : null,
    }
  })
})
const edgeMissing = await page.locator('[data-cal-edge-missing]').count()
console.log('\nGroupGeometry.openHeight vs the DS group OPEN with bodySlot @ width ' + (openCal[0] && openCal[0].faceW) + ' (text ' + (openCal[0] && openCal[0].measured === 'true' ? 'measured' : 'ESTIMATED') + '):')
let geomBad = 0
for (const c of openCal) {
  const slotTop = c.slot ? Number(c.slot.split(',')[1]) : null
  // the slot's CONTENT begins under its own 6px padding — bodyTop names that line
  const dH = Math.round((c.predH - c.shellH) * 100) / 100
  const dTop = slotTop === null ? null : Math.round((c.predBodyTop - (slotTop + 6)) * 100) / 100
  const ok = Math.abs(dH) <= 0.5 && (dTop === null || Math.abs(dTop) <= 1)
  if (!ok) geomBad++
  console.log(`  ${c.k.padEnd(9)} shell=${c.shellH} predicted=${c.predH} (${dH >= 0 ? '+' : ''}${dH})  slot=[${c.slot}] bodyTop=${c.predBodyTop} (${dTop === null ? '—' : (dTop >= 0 ? '+' : '') + dTop})  rows=${JSON.stringify(c.rows.slice(0, 3))} ${ok ? 'ok' : 'DRIFT'}`)
}
// OB-222's edge: the one title where `closable` decides the line count. If the page could not
// find one, the check below has nothing to bite on, and that is a failure in its own right.
const edge = openCal.filter((c) => c.k.startsWith('edge-'))
if (edgeMissing || edge.length !== 2) {
  geomBad++
  console.log(`  EDGE MISSING — no prefix of the edge sentence changes its line count with \`closable\` at ${openCal[0] && openCal[0].faceW}px, so nothing here checks it`)
} else {
  console.log(`  edge title "${edge[0].title}": ` + edge.map((c) => `${c.k} predicted ${c.predLines} line(s), drew ${c.lines}`).join('; '))
}

// ── OB-222: the head's right slot, drawn — the obligation's own 300px card with a 3-node tally ──
// `titleColumn()` takes max(cluster, tally) off the column; the drawn slot must BE that width.
// Then the "~40px wider" line, from the drawn tally: the old reservation was the two-button
// cluster, the tally and two gaps; the new one is the wider of the two and one gap.
const slots = await page.evaluate(() => [...document.querySelectorAll('[data-cal-slot]')].map((el) => {
  const tally = el.querySelector('span[title$="inside this version"]')
  const slot = tally && tally.parentElement.parentElement
  const n = (a) => Number(el.getAttribute(a))
  return {
    k: el.getAttribute('data-cal-slot'), cluster: n('data-cluster'), oldCluster: n('data-old-cluster'), gap: n('data-gap'),
    predTally: n('data-pred-tally'),
    tally: tally ? Math.round(tally.getBoundingClientRect().width * 100) / 100 : null,
    slot: slot ? Math.round(slot.getBoundingClientRect().width * 100) / 100 : null,
  }
}))
console.log('\nOB-222 right slot @ width 300, "3 nodes":')
if (slots.length !== 2) { geomBad++; console.log('  SLOT CASES MISSING') }
for (const s of slots) {
  const want = Math.max(s.cluster, s.tally)
  const ok = s.slot !== null && Math.abs(s.slot - want) <= 0.5
  if (!ok) geomBad++
  const widen = (t) => Math.round((s.oldCluster + s.gap + t - Math.max(s.cluster, t)) * 100) / 100
  console.log(`  ${s.k.padEnd(9)} tally drawn=${s.tally} predicted=${Math.round(s.predTally * 100) / 100}  slot=${s.slot} (want max(${s.cluster}, tally) = ${want})`
    + `  title column vs the old reservation: +${widen(s.tally)}px drawn, +${widen(s.predTally)}px predicted  ${ok ? 'ok' : 'DRIFT'}`)
}

console.log('\nfoldSize() calibration @ width 150, narrow, folded:')
for (const c of cal) {
  const dH = Math.round((c.predH - c.h) * 100) / 100
  const ok = Math.abs(dH) <= 0.5 && c.predW === c.shellW
  if (!ok) geomBad++
  console.log(`  ${String(c.chars).padStart(3)}ch  lines=${c.lines}  titleH=${c.titleH}  faceH=${c.faceH}  TOTAL=${c.h}  foldedSize=${c.predW}x${c.predH} (${dH >= 0 ? '+' : ''}${dH})  titleW=${c.titleW} face=${c.faceW} shell=${c.shellW} ${ok ? 'ok' : 'DRIFT'}   "${c.title}"`)
}
const byLines = new Map()
for (const c of cal) if (!byLines.has(c.lines)) byLines.set(c.lines, c.h)
console.log('  height by title lines:', JSON.stringify([...byLines.entries()].sort((a, b) => a[0] - b[0])))

// ── ChipGeometry vs the rendered NodeChip ───────────────────────────────
// Two questions, because a told box can be wrong in two directions.
//
//   FIT      the chip is told chipSize()'s box and its own overflow is hidden, so a
//            box scored short does not grow — it crops, silently. `overflow` here is
//            the shell's scroll extent against its client box: any excess is text
//            the user cannot read. This is the #97 defect, and it is the check that
//            would have failed the day CHAR_W = 8 was written.
//   NATURAL  the same chip with no told size settles somewhere on its own. That is
//            the answer the prediction is claiming, so the two must agree.
const chipCal = await page.evaluate(() => {
  const boxOf = (host) => {
    const shell = host.firstElementChild
    const r = shell.getBoundingClientRect()
    const spans = [...shell.children].filter((c) => c.tagName === 'SPAN')
    const title = spans[spans.length - 1]
    const lh = title ? parseFloat(getComputedStyle(title).lineHeight) : 0
    /* THE NUMBER MUST SIT ON THE NAME'S LINE. A zero-height inline-block at
       `vertical-align: baseline` puts its own bottom edge exactly on the baseline
       of the line it is in, so one at the START of each span reads the FIRST line
       — the line the step number belongs on at any title length. The two spans
       have different line boxes (--fs-micro 11 × --lh-snug = 14.85 against
       --fs-body 13 × --lh-snug = 17.55), so neither top- nor centre-alignment can
       make them share a baseline: flex-start is a constant -3, center is -2.14 at
       one line and drifts to +15.41 at three. Only `baseline` is 0. */
    const baselineOf = (el) => {
      const probe = document.createElement('span')
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
      el.insertBefore(probe, el.firstChild)
      const y = probe.getBoundingClientRect().bottom
      probe.remove()
      return y
    }
    const mono = spans.find((c) => /mono|consol|courier|menlo/i.test(getComputedStyle(c).fontFamily))
    return {
      w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
      // overflow past the shell's own content box — what `overflow: hidden` eats
      overY: shell.scrollHeight - shell.clientHeight,
      overX: shell.scrollWidth - shell.clientWidth,
      lines: title && lh ? Math.round(title.getBoundingClientRect().height / lh) : null,
      // the column the title actually got, CONTENT box — the title span carries a
      // 4px right gutter of its own, and chipSize's titleColumn is the room for the
      // text, so the gutter has to come off or the two are not the same quantity
      col: title
        ? Math.round((title.getBoundingClientRect().width
            - parseFloat(getComputedStyle(title).paddingLeft)
            - parseFloat(getComputedStyle(title).paddingRight)) * 100) / 100
        : null,
      // + means the number sits BELOW the name's baseline, - means it rides high
      baseline: mono && title ? Math.round((baselineOf(mono) - baselineOf(title)) * 100) / 100 : null,
    }
  }
  return [...document.querySelectorAll('[data-cal-chip]')].map((el) => ({
    idx: el.getAttribute('data-cal-chip'),
    predW: Number(el.getAttribute('data-pred-w')),
    predH: Number(el.getAttribute('data-pred-h')),
    predLines: Number(el.getAttribute('data-pred-lines')),
    predCol: Number(el.getAttribute('data-pred-col')),
    measured: el.getAttribute('data-pred-measured'),
    told: boxOf(el.querySelector('[data-chip-told]')),
    natural: boxOf(el.querySelector('[data-chip-natural]')),
    title: el.querySelector('[data-chip-told] span:last-of-type').textContent,
  }))
})
console.log('\nChipGeometry.chipSize vs the rendered NodeChip, leaf form @ ' + 150 + '–220 (text '
  + (chipCal[0] && chipCal[0].measured === 'true' ? 'measured' : 'ESTIMATED') + '):')
if (!chipCal.length) { console.log('  NO CHIP CASES FOUND — the chip calibration is not on the page'); geomBad++ }
for (const c of chipCal) {
  const dW = Math.round((c.predW - c.natural.w) * 100) / 100
  const dLines = c.predLines - c.told.lines
  // the chrome arithmetic on its own: what chipSize claimed it was leaving the
  // title, against what the drawn chip actually left it
  const dCol = Math.round((c.predCol - c.told.col) * 100) / 100
  // the natural chip may sit BELOW the road's floor (a two-letter title wants less
  // than 150), and the prediction is clamped to it — so only judge width where the
  // clamp is not what produced the number
  const clamped = c.predW <= 150 + 0.01
  // the prediction must never be NARROWER than what the component would pick
  // (that is what crops), and must not waste much room being wider. Exact
  // agreement is not the bar: a shrink-to-fit flex container sizes a `flex: 1`
  // item from a 0 basis, which is a different algorithm from adding the parts
  // up — and the road never asks for that width anyway, it TELLS one. What the
  // arithmetic itself is judged on is the title column, below.
  const okW = clamped || (dW >= -0.5 && dW <= 3)
  const okFit = c.told.overY <= 1 && c.told.overX <= 1
  const okLines = dLines === 0
  // DIRECTION MATTERS more than size here. A prediction that claims MORE column
  // than the title gets is the one that clips: it scores a wrap that will not
  // happen, reserves too few lines, and the chip's overflow eats the rest. Under-
  // claiming only ever buys a line that was not needed. The canvas runs ~1px over
  // the laid-out width of the mono step number — constant, not per-character, so
  // it is a side-bearing or rounding difference between measureText and inline
  // layout rather than a font mismatch — which lands on the safe side and stays.
  const okCol = dCol <= 0.5 && dCol >= -2
  // half a pixel either way: the number and the name read as one line or they do not
  const okBase = c.told.baseline !== null && Math.abs(c.told.baseline) <= 0.5
    && c.natural.baseline !== null && Math.abs(c.natural.baseline) <= 0.5
  const ok = okW && okFit && okLines && okCol && okBase
  if (!ok) geomBad++
  const why = [okFit ? '' : `CLIPPED by ${c.told.overY}x${c.told.overX}px`,
    okW ? '' : `width off by ${dW}`, okLines ? '' : `lines off by ${dLines}`,
    okCol ? '' : `title column off by ${dCol}`,
    okBase ? '' : `step number off the title's line by ${c.told.baseline}/${c.natural.baseline} (told/natural)`,
  ].filter(Boolean).join(', ')
  console.log(`  ${c.idx.padEnd(6)} told=${c.told.w}x${c.told.h} predicted=${c.predW}x${c.predH}`
    + `  base=${c.told.baseline}`
    + `  natural=${c.natural.w}${clamped ? ' (under the 150 floor)' : ` (${dW >= 0 ? '+' : ''}${dW})`}`
    + `  lines=${c.told.lines}/${c.predLines}  col=${c.told.col}/${c.predCol} (${dCol >= 0 ? '+' : ''}${dCol})  ${ok ? 'ok' : 'DRIFT — ' + why}`
    + `   "${c.title}"`)
}

// -- the well's tint steps by depth -----------------------------------------
// OB-073: the shell is ONE face now, open or folded — the depth/fold tint moved
// to a separate peek plate behind it, rendered only when isFolded || depth > 0.
// An open, un-nested (depth 0) card therefore carries NO tint at all; only a
// folded or nested card does, alternating even/odd by depth. The DS delivers
// depth through a React context, which cannot reach a board's floated siblings,
// so the `depth` prop is what carries it here — this checks the prop reaches
// the peek plate for depth > 0, and that a depth-0 card stays plain.
const { tints, even, odd } = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement)
  const want = {
    even: root.getPropertyValue('--surface-sunken').trim(),
    odd: root.getPropertyValue('--surface-sunken-2').trim(),
  }
  // paint both tokens into a probe so they can be compared as resolved rgb()
  const probe = document.createElement('span')
  document.body.appendChild(probe)
  const resolve = (v) => { probe.style.backgroundColor = v; return getComputedStyle(probe).backgroundColor }
  const res = { even: resolve(want.even), odd: resolve(want.odd) }
  probe.remove()
  const tints = [...document.querySelectorAll('[data-cal-open]')].map((host) => {
    // the well is the card's own face: the descendant painted in either tint
    const face = [...host.querySelectorAll('*')]
      .find((n) => { const b = getComputedStyle(n).backgroundColor; return b === res.even || b === res.odd })
    const got = face ? getComputedStyle(face).backgroundColor : null
    const depth = +host.getAttribute('data-cal-depth')
    return { k: host.getAttribute('data-cal-open'), depth, got, want: depth === 0 ? null : (depth % 2 ? res.odd : res.even) }
  })
  return { tints, even: res.even, odd: res.odd }
})
const tintBad = tints.filter((t) => t.got !== t.want)
console.log(`well tint by depth: ${tints.map((t) => `${t.k}@${t.depth}${t.got === t.want ? '' : ' MISMATCH'}`).join(', ')}`)
console.log(`  even=${even}  odd=${odd}`)
for (const t of tintBad) {
  console.log(`TINT DRIFT: ${t.k} sits at depth ${t.depth} painted ${t.got}, expected ${t.want}`)
}

await browser.close()
vite.kill()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1) }
if (geomBad) { console.log(`GEOMETRY DRIFT: ${geomBad} case(s) where the published geometry disagrees with what rendered`); process.exit(1) }
if (tintBad.length) { console.log(`TINT DRIFT: ${tintBad.length} well(s) painted the wrong depth tint`); process.exit(1) }
console.log('DONE — GroupGeometry agrees with the rendered card, and ChipGeometry with the rendered chip, in every case')
