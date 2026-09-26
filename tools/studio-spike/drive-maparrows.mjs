// OB-116 / OB-107 / OB-117 (#227) — the walk's ARROWS on the map: the halo behind
// them, the bow that pulls a doubled-back pair apart, and the recede while a
// node's relationships are on screen.
//
// The arithmetic is unit-tested — `walkarrow.test.ts` measures the bow's own
// geometry, `nodearrow.test.ts` renders the component and reads the shaft back
// out. What only a browser can answer is whether the map PLACES the drawing where
// the arithmetic says: every arrow goes through a `rotate()` and a counter-scale
// that no unit test sees, and the whole reason `shaftTailOffset` exists is that
// the drawing's origin is not its shaft. Off by one `across / 2` and every line
// on the map runs beside the two pins it joins instead of between them — which
// looks like a slightly untidy map, not like a bug.
//
// So the load-bearing check here is geometric: read each drawn shaft's own start
// point out of the live SVG, in screen coordinates, and confirm it sits ON the
// line between the two pins. It fails by ~6px against the unoffset code, which is
// small enough to argue about in a screenshot and not at all small in a number.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine, so the
// script owns the server lifecycle. Same pattern as drive-mappins.mjs.
//
// Run from anywhere:  node tools/studio-spike/drive-maparrows.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/shots'
const PORT = 5212
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
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)

// give the map the whole desk, as drive-mappins does — the opening preset leaves
// it a quarter of the window and most of the walk outside the viewport
for (const inst of ['unfoldgraph', 'document', 'walkviewer']) {
  await page.getByLabel(`studio-inst-${inst}`).click()
  await page.waitForTimeout(150)
}
await page.waitForTimeout(500)

// OB-132 — THE BAND DRAWS ONLY WHAT IS NEAR THE WALK'S POSITION: five stops behind it,
// two ahead, nothing beyond. At the opening cursor (stop 1) that is three pins and two
// arrows, and the doubled-back pair this driver measures is not among them. Seeking to
// the third-last stop puts every stop of the seven-stop draft inside the band (at most
// five behind, two ahead), so the whole walk is drawn — faded toward the trail's floor,
// but drawn, and geometry does not care about opacity.
await page.locator('[aria-label="map-view"] [data-walk-dock]').focus()
await page.keyboard.press('End')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)

/** every walk arrow, measured in SCREEN coordinates: where its own painted shaft
 *  starts and ends, and where the two pins it joins actually are. The DOM cannot
 *  be asked this directly — the shaft's coordinates are in a rotated, scaled user
 *  space nested three transforms deep — so this goes through getScreenCTM, which
 *  is the browser's own answer to the same question. */
const measure = () =>
  page.evaluate(() => {
    const toScreen = (el, x, y) => {
      const m = el.getScreenCTM()
      return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
    }
    const centre = (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    }
    // by the pin's own walk-order index (`data-pin`): a pin outside the band is not
    // drawn at all, so a list in document order would misnumber every pin after a gap
    const pins = {}
    for (const g of document.querySelectorAll('[data-routestop]')) pins[Number(g.getAttribute('data-pin'))] = centre(g)
    const out = []
    for (const g of document.querySelectorAll('[data-routearrow]')) {
      const i = Number(g.getAttribute('data-routearrow'))
      const bow = Number(g.getAttribute('data-bow'))
      // the PAINTED shaft, not the casing: the casing is drawn first and strokes
      // --surface-raised, the paint second in --accent-walk / --bark-300
      const strokes = [...g.querySelectorAll('line, path[fill="none"]')]
      const shaft = strokes.filter((el) => !(el.getAttribute('stroke') || '').includes('surface-raised')).pop()
      if (!shaft) continue
      const start = shaft.tagName === 'line'
        ? toScreen(shaft, shaft.x1.baseVal.value, shaft.y1.baseVal.value)
        : (() => { const p = shaft.getPointAtLength(0); return toScreen(shaft, p.x, p.y) })()
      const cased = [...g.querySelectorAll('[stroke*="surface-raised"], [fill*="surface-raised"]')].length
      /* THE DRAWN HEAD, read as the rendered triangle's own bbox — OB-126's done-when asks
         for the bbox and not the attribute, because the attribute is the number we set and
         the bbox is the number a reader sees. Taken in the arrow's LOCAL user space, where a
         straight arrow's head is axis-aligned: bbox width is the head's length along the
         shaft, height its full across. The casing draws a larger triangle first, so the
         painted head is the last filled path that is neither `none` nor the casing. */
      const headEl = [...g.querySelectorAll('path')].filter((el) => {
        const f = el.getAttribute('fill') || ''
        return f && f !== 'none' && !f.includes('surface-raised')
      }).pop()
      const hb = headEl ? headEl.getBBox() : null
      const head = hb ? { along: Math.round(hb.width * 100) / 100, across: Math.round(hb.height * 100) / 100 } : null
      /* the shaft's own local length, for the ratio below. The component draws x2 at
         `length + 1` (a 1px overlap into the head), so this runs a pixel long — which makes
         the ratio very slightly conservative, in the safe direction. */
      const localLen = shaft.tagName === 'line'
        ? Math.round(Math.abs(shaft.x2.baseVal.value - shaft.x1.baseVal.value) * 100) / 100
        : null
      // and HOW FAR THE DRAWN LINE LEAVES ITS OWN CHORD, in screen px. The
      // formula's own answer is unit-tested; what only a browser can say is what
      // that becomes after the rotate and the counter-scale, which is the number
      // a reader actually sees.
      let bulge = 0
      let screenLen = 0
      if (shaft.tagName !== 'line') {
        const total = shaft.getTotalLength()
        const p0 = shaft.getPointAtLength(0)
        const p1 = shaft.getPointAtLength(total)
        const a = toScreen(shaft, p0.x, p0.y)
        const b = toScreen(shaft, p1.x, p1.y)
        const dx = b.x - a.x
        const dy = b.y - a.y
        screenLen = Math.hypot(dx, dy) || 1
        for (let k = 0; k <= 40; k++) {
          const q = shaft.getPointAtLength((k / 40) * total)
          const p = toScreen(shaft, q.x, q.y)
          bulge = Math.max(bulge, Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / screenLen)
        }
      }
      out.push({ i, bow, start, cased, bulge, screenLen, head, localLen, from: pins[i], to: pins[i + 1] })
    }
    return { pins: Object.keys(pins).length, arrows: out }
  })

/** how far a point sits OFF the line between two others, in px */
const offLine = (p, a, b) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
}

const first = await measure()
ok('the walk is drawn on the map', first.arrows.length > 0, `${first.arrows.length} arrows, ${first.pins} pins`)

// ── OB-116: the halo, on EVERY arrow, long and short ────────────────────────
const uncased = first.arrows.filter((a) => a.cased !== 2)
ok(
  'every arrow carries a casing behind BOTH its shaft and its head',
  uncased.length === 0,
  uncased.length ? `${uncased.length} without: ${JSON.stringify(uncased.map((a) => [a.i, a.cased]))}` : `${first.arrows.length}/${first.arrows.length}`,
)

// ── the placement, which is what only a browser can check ───────────────────
const off = first.arrows.map((a) => offLine(a.start, a.from, a.to))
const worst = Math.max(...off)
ok(
  'every shaft STARTS on the line between the two pins it joins',
  worst < 2,
  `worst ${worst.toFixed(2)}px off, median ${off.slice().sort((x, y) => x - y)[off.length >> 1].toFixed(2)}px`,
)

// ── OB-107: a doubled-back pin bows its pair, and the rest stay straight ────
// NOT AT L0. The walk's twelve stops collapse onto four territories up here, and
// four pins in a rough square double back through nothing. The case OB-090 and
// this item are both about — steps that leave a region and come back to it —
// only exists once the map is fine-grained enough to draw those stops apart, so
// the sweep dives the way a reader does (double-click a pin's own cell, the
// map's real dive gesture; the zoom button dives at the pane CENTRE and flies
// away from the walk) and measures at every level it reaches.
const levelNow = () => page.$eval('[data-nested]', (el) => Number(el.getAttribute('data-level')))
const diveOnAPin = async () => {
  const b = await page.locator('[data-routestop]').first().boundingBox()
  if (!b) return false
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForTimeout(800)
  return true
}

const sweep = [{ level: await levelNow(), ...first }]
for (let i = 0; i < 6; i++) {
  if ((await levelNow()) >= 6) break
  if (!(await diveOnAPin())) break
  sweep.push({ level: await levelNow(), ...(await measure()) })
}
const fmt = sweep.map((s) => `L${s.level}:${s.arrows.filter((a) => a.bow !== 0).length}/${s.arrows.length}`).join(' ')

// ── OB-126: ONE HEAD ACROSS THE WHOLE WALK, AND NOT A SPEARHEAD ───────────
// MEASURED OVER THE WHOLE SWEEP, NOT AT L0, and that is the difference between a check
// and a decoration. At L0 this walk's hops are all ~172px, every one of them under the
// ~267px where the length cap starts to bite, so all three draw the published 8px head
// whether or not the view sized them as a set — the assertion would pass on the code it
// is here to catch. Diving levels stretches the hops until they straddle that threshold,
// which is the only place the two behaviours differ.
//
// Straight arrows only: a bowed head is rotated by the curve's own tangent inside the
// same local space, so its axis-aligned bbox measures the rotation rather than the head.
const allStraightLens = sweep.flatMap((s) => s.arrows).filter((a) => a.bow === 0 && a.head && a.localLen).map((a) => a.localLen)
const straightBy = sweep.map((s) => {
  const st = s.arrows.filter((a) => a.bow === 0 && a.head && a.localLen)
  return {
    level: s.level,
    heads: [...new Set(st.map((a) => `${a.head.along}×${a.head.across}`))],
    lens: st.map((a) => a.localLen),
  }
}).filter((p) => p.lens.length >= 2)

ok('there are levels with straight arrows to compare', straightBy.length > 0,
  `${straightBy.length} of ${sweep.length}`)

// WHAT THIS MAP ACTUALLY DRAWS, AND IT IS NOT WHAT OB-126 DESCRIBES — measured here
// rather than argued, because the item's own premise is the thing that turned out to be
// wrong. It was filed off a screenshot read as "a 4px shaft over ~450px, scale 2.67, so a
// 21px head 23.5px across". The map passes `joins={PIN_RING_WIDTH}`, and PIN_RING_WIDTH is
// 1.5 — FULL RANK. At full rank the weight scale is 1, so the proportional head IS the
// published 8, and no length can lift it: the cap only ever reduces. This map has drawn an
// 8px head on every walk arrow at every length, all along. The 4px shaft in the screenshot
// is the screenshot's own scale, not the shaft.
//
// Which makes the two checks below REGRESSION GUARDS rather than proof of a fix, and saying
// so is the point of this comment. The uniformity check CANNOT currently fail: at full rank
// every arrow answers 8 whether the view sizes the set or each arrow answers for itself. It
// becomes able to fail the moment the pin ring gets heavier than full rank — which is
// precisely the state the item describes, and the state in which this map would have grown
// the spearhead it was opened about. The head assertion below therefore pins the WEIGHT as
// well as the size, so a heavier ring shows up here as a failure to look at rather than as a
// silent change of drawing.
const drawnHeads = [...new Set(straightBy.flatMap((p) => p.heads))]
ok('the walk draws ONE head, the published 8×8.8, at every level and every hop length',
  drawnHeads.length === 1 && drawnHeads[0] === '8×8.8',
  `${drawnHeads.join(', ')} over ${allStraightLens.length} straight hops, ${Math.round(Math.min(...allStraightLens))}–${Math.round(Math.max(...allStraightLens))}px`)

const split = straightBy.filter((p) => p.heads.length > 1)
ok('every arrow on a level draws the SAME head, however long its own hop',
  split.length === 0,
  split.length
    ? split.map((p) => `L${p.level}: ${p.heads.join(' vs ')}`).join('; ')
    : straightBy.map((p) => `L${p.level}:${p.heads[0]}`).join(' '))

// the fault this item was opened about: the map's 4px pin ring scales the published head
// by 2.67, so before the cap a long hop drew a 21px head 23.5px across — a spearhead on a
// hairline curve
const allStraight = sweep.flatMap((s) => s.arrows).filter((a) => a.bow === 0 && a.head && a.localLen)
const overCap = allStraight.filter((a) => a.head.along > Math.max(8.01, a.localLen * 0.03))
ok('no arrow anywhere draws a head over 3% of its own shaft',
  overCap.length === 0,
  overCap.length
    ? overCap.map((a) => `${a.head.along}px on ${Math.round(a.localLen)}px`).join(', ')
    /* reported over the LONG arrows only. A short hop sits at the 8px floor, so its ratio is
       naturally over 3% (8/171 = 4.7%) and quoting it as the worst case would read as a near
       miss when it is the floor doing exactly its job. */
    : (() => {
        const long = allStraight.filter((a) => a.localLen > 267)
        return long.length
          ? `worst ${Math.max(...long.map((a) => a.head.along / a.localLen * 100)).toFixed(2)}% over ${long.length} long arrows (${allStraight.length - long.length} more at the 8px floor)`
          : `${allStraight.length} straight arrows, all at the 8px floor`
      })())

const anyBowed = sweep.flatMap((s) => s.arrows).filter((a) => a.bow !== 0)
ok('the walk doubles back somewhere, and those arrows bow', anyBowed.length > 0, `bowed/total by level — ${fmt}`)
ok('and the arrows that run near nothing stay straight', sweep.some((s) => s.arrows.some((a) => a.bow === 0)), fmt)

// A BOWED PAIR TAKES ONE SIGN, NOT TWO. Both shafts at a doubled-back pin get
// the same signed bow, which — because they travel through the pin in opposite
// directions — puts them on opposite sides of the corridor they share. A pair
// that came out with two different signs would have curved together instead.
const pairsSplit = sweep.flatMap((s) =>
  s.arrows.filter((a, i) => a.bow !== 0 && s.arrows[i + 1] && s.arrows[i + 1].bow !== 0 && Math.sign(a.bow) !== Math.sign(s.arrows[i + 1].bow)),
)
ok('every bowed pair shares one sign', pairsSplit.length === 0, JSON.stringify(pairsSplit.map((a) => [a.i, a.bow])))

// AND THE BEND HAS TO SURVIVE THE SCALE, which is the regression that got past
// everything else. `bow` was first capped at a flat 28px, so every bowed arrow —
// a 308px one at L1 and a 5938px one at L6 alike — bent by exactly 14px: a
// visible lean on the short shaft, 0.24% and indistinguishable from straight on
// the long one. Every unit test passed and every geometric check here passed,
// because the arithmetic was doing precisely what it had been told to do. Only
// looking at the screen catches it, so this looks at the screen: the bulge must
// GROW with the shaft, and no bowed arrow may bend by so little that it reads as
// a straight line.
const bowedNow = sweep.flatMap((s) => s.arrows).filter((a) => a.bow !== 0)
const bulges = bowedNow.map((a) => Number(a.bulge.toFixed(1)))
const tooFlat = bowedNow.filter((a) => a.bulge < 10 || a.bulge / a.screenLen < 0.0075)
ok(
  'the bend is proportional to the shaft, not a flat offset that vanishes on a long one',
  new Set(bulges).size > 1,
  `${new Set(bulges).size} distinct bulges over ${bowedNow.length} bowed arrows — ${Math.min(...bulges)}px to ${Math.max(...bulges)}px`,
)
ok(
  'and no bowed arrow bends so little it still reads as straight',
  tooFlat.length === 0,
  tooFlat.length
    ? JSON.stringify(tooFlat.map((a) => [Math.round(a.screenLen), Number(a.bulge.toFixed(1))]))
    : `worst ${Math.min(...bowedNow.map((a) => a.bulge / a.screenLen * 100)).toFixed(2)}% of shaft`,
)

// the alignment invariant has to hold at EVERY level, bowed arrows included — a
// bow moves where the shaft sits inside the drawing, which is exactly why
// shaftTailOffset takes it as an argument
const offAll = sweep.flatMap((s) => s.arrows.map((a) => offLine(a.start, a.from, a.to)))
ok(
  'and every shaft, straight or bowed, still starts on its own pin-to-pin line',
  Math.max(...offAll) < 2,
  `worst ${Math.max(...offAll).toFixed(2)}px over ${offAll.length} arrows`,
)

await page.screenshot({ path: OUT + '/map-arrows-deep.png' })

// back up to L2, where a territory's own name is drawn large enough to judge the
// halo against, for the shots and the recede checks below
const zoomOut = page.locator('[aria-label="map-view"]').getByRole('button', { name: /zoom out/i })
while ((await levelNow()) > 2 && !(await zoomOut.isDisabled())) {
  await zoomOut.click()
  await page.waitForTimeout(700)
}

// ── OB-117: the walk recedes while a selection's relations are on screen ────
const recededOf = (sel) => page.$eval(sel, (el) => ({ flag: el.getAttribute('data-receded'), op: el.getAttribute('opacity') }))
const receded = () => recededOf('[data-routearrows]')
// OB-122 widened the recede to the numbered pins. Read as its OWN layer, not
// folded into the arrows' check: the two are separate wrappers precisely so one
// can regress without the other, and a check that reads only the arrows would go
// on passing while the pins sat at full weight — which is the bug OB-122 is.
const recededPins = () => recededOf('[data-routepins]')
const toneNow = () => page.$eval('[data-routearrow] line:not([stroke*="surface-raised"]), [data-routearrow] path[fill="none"]:not([stroke*="surface-raised"])', (el) => el.getAttribute('stroke'))

let r = await receded()
ok('at rest the walk draws at full weight', r.flag === '0' && r.op === '1', JSON.stringify(r))
let p = await recededPins()
ok('at rest the numbered pins draw at full weight too', p.flag === '0' && p.op === '1', JSON.stringify(p))
// the first drawn arrow is BEHIND the position, so it is walked: acorn (OB-132 — an arrow
// ahead of the position draws quiet, bark-400, until the walk reaches it)
ok('and a walked arrow in acorn — the hue of movement', (await toneNow()).includes('accent-walk'), await toneNow())

// SELECT A TERRITORY — and do it with a real pointer at a point known to be
// INSIDE the shape. Playwright's element click aims at a bounding-box position,
// and a map region is a concave polygon whose box corners are mostly other
// people's ground: the click lands on the <svg> behind it and is refused. Walk
// the pane's own centre line until a region takes it.
const pane = await page.locator('[aria-label="map-view"]').boundingBox()
let selected = false
for (const fx of [0.5, 0.42, 0.58, 0.34, 0.66]) {
  await page.mouse.click(pane.x + pane.width * fx, pane.y + pane.height * 0.5)
  await page.waitForTimeout(450)
  selected = (await page.locator('[data-seloverlay]').count()) === 1
  if (selected) break
}
ok('a node can be selected, which is what draws its relationships', selected)

r = await receded()
ok('with relations on screen the walk recedes', r.flag === '1' && r.op === '0.6', JSON.stringify(r))
ok('shaft AND head drop to --bark-300, not just the shaft', (await toneNow()).includes('bark-300'), await toneNow())
p = await recededPins()
ok('OB-122 — and the numbered pins recede with them, to the same 0.6', p.flag === '1' && p.op === '0.6', JSON.stringify(p))
ok('both layers dim on the same 120ms, so the walk moves as one',
  (await page.$eval('[data-routepins]', (el) => el.style.transition)) === (await page.$eval('[data-routearrows]', (el) => el.style.transition)),
  await page.$eval('[data-routepins]', (el) => el.style.transition))

// PAINT ORDER: an SVG paints in document order, so "relations on top" is a
// question about which element comes later in the tree, not about z-index.
const relationsOnTop = await page.evaluate(() => {
  const walk = document.querySelector('[data-routepath]')
  const rels = document.querySelector('[data-seloverlay]')
  if (!walk || !rels) return null
  // Node.DOCUMENT_POSITION_FOLLOWING === 4
  return (walk.compareDocumentPosition(rels) & 4) !== 0
})
ok('every relationship arrow paints AFTER the walk, so it sits on top', relationsOnTop === true, String(relationsOnTop))

// AND PAINTING ON TOP IS NOT THE SAME AS READING ON TOP. The recede shipped,
// passed every check above, and the owner still reported the relations hard to
// see — because the two layers were sized the wrong way round: a relation head
// was 5.5 x 5.6 against the walk's ARROW_METRICS 8 x 8.8, so the RECEDED layer
// carried the bigger arrowheads and no amount of dimming could outrank that.
// Dimming adjusts contrast; it cannot reorder two things whose sizes disagree
// with their importance. So the invariant is about size, measured on screen.
const layerWeights = await page.evaluate(() => {
  // IN SCREEN AREA, not user units. The two heads live in different user
  // spaces — the walk's inside MapView's `scale(f / view.s)` counter-scale, the
  // relation's in world space where `px()` has already divided by the same zoom
  // — so their raw getBBox numbers are not comparable and comparing them says
  // nothing. |det(CTM)| is exactly the factor a user-space area is multiplied by
  // on its way to the screen, which makes the two answers the same question.
  const area = (el) => {
    const b = el.getBBox()
    const m = el.getScreenCTM()
    return b.width * b.height * Math.abs(m.a * m.d - m.b * m.c)
  }
  const relHead = document.querySelector('[data-seledge] [data-selhead]')
  const walkHead = [...document.querySelectorAll('[data-routearrow] path[fill]:not([fill="none"])')]
    .filter((el) => !(el.getAttribute('fill') || '').includes('surface-raised')).pop()
  const relShaft = document.querySelector('[data-seledge] path[fill="none"]:not([stroke="#ffffff"])')
  return {
    relHead: relHead ? area(relHead) : null,
    walkHead: walkHead ? area(walkHead) : null,
    relShaft: relShaft ? parseFloat(getComputedStyle(relShaft).strokeWidth) : null,
  }
})
ok(
  'a relation arrowhead is not smaller than the walk arrowhead it is meant to outrank',
  layerWeights.relHead !== null && layerWeights.walkHead !== null && layerWeights.relHead > layerWeights.walkHead,
  `relation ${layerWeights.relHead?.toFixed(1)} vs walk ${layerWeights.walkHead?.toFixed(1)} sq units`,
)
ok(
  'and every relation arrowhead carries its own casing, as its shaft does',
  await page.evaluate(() => [...document.querySelectorAll('[data-seledge] [data-selhead]')]
    .every((h) => h.previousElementSibling && (h.previousElementSibling.getAttribute('fill') || '') === '#ffffff')),
  `${await page.evaluate(() => document.querySelectorAll('[data-seledge] [data-selhead]').length)} heads`,
)

// ── DS OB-197: a relation between two ADJACENT cells is lengthened, and its bow capped ──
// A road clipped to the boundary two neighbouring cells share was a stub a few units long whose
// whole drawing was its head, and the fixed px(14) bulge turned that head up to 70° off its own
// road — "two heads overlapped". The map now clips, then `extendToMin` (three of this set's heads),
// then `capBow` (20° of head rotation) against the length that came back. Read off the DRAWN
// path, in the scene's own units: the chord, the control point, the head.
const roadGeom = () => page.evaluate(() => {
  const heads = [...document.querySelectorAll('[data-seledge] [data-selhead]')]
  const hm = heads.length ? /M0,0 L(-?[\d.e]+),/.exec(heads[0].getAttribute('d')) : null
  const head = hm ? Math.abs(Number(hm[1])) : null
  const inside = (id, x, y) => {
    const el = document.querySelector(`[data-terr="${id}"], [data-region="${id}"]`)
    return el ? el.isPointInFill(new DOMPoint(x, y)) : null
  }
  return { head, roads: [...document.querySelectorAll('[data-seledge]')].map((g) => {
    const m = /M([-\d.e]+),([-\d.e]+) Q([-\d.e]+),([-\d.e]+) ([-\d.e]+),([-\d.e]+)/.exec(g.querySelector('path').getAttribute('d'))
    const [ax, ay, cx, cy, bx, by] = m.slice(1).map(Number)
    const [src, tgt] = g.getAttribute('data-seledge').split('>')
    const t = g.querySelector('text')
    return {
      key: g.getAttribute('data-seledge'), grew: g.getAttribute('data-grew') === '1', hasHead: !!g.querySelector('[data-selhead]'),
      ax, ay, cx, cy, bx, by, label: t ? { x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')) } : null,
      aInTgt: inside(tgt, ax, ay), bInSrc: inside(src, bx, by),
    }
  }) }
})
const deg = (r) => {
  // the head points along the curve's END tangent (b - c); the road runs a → b
  const t = Math.atan2(r.by - r.cy, r.bx - r.cx)
  const c = Math.atan2(r.by - r.ay, r.bx - r.ax)
  let d = Math.abs(t - c) * 180 / Math.PI
  if (d > 180) d = 360 - d
  return d
}
const allRoads = []
let headLen = null
const paneBox = await page.locator('[aria-label="map-view"]').boundingBox()
for (const fy of [0.35, 0.5, 0.65]) {
  for (const fx of [0.3, 0.42, 0.5, 0.58, 0.7]) {
    await page.keyboard.press('Escape')
    await page.mouse.click(paneBox.x + paneBox.width * fx, paneBox.y + paneBox.height * fy)
    await page.waitForTimeout(350)
    const g = await roadGeom()
    if (g.head) headLen = g.head
    allRoads.push(...g.roads.map((r) => ({ ...r, at: { fx, fy } })))
  }
}
const floor = headLen === null ? null : 3 * headLen
const grew = allRoads.filter((r) => r.grew)
const len = (r) => Math.hypot(r.bx - r.ax, r.by - r.ay)
console.log(`OB-197 over ${allRoads.length} roads from 15 selections: ${grew.length} lengthened (adjacent cells), head ${headLen?.toFixed(2)} units, floor ${floor?.toFixed(2)}`)
ok('OB-197: the sweep drew relation roads, and at least one between two ADJACENT cells', allRoads.length > 0 && grew.length > 0, `${allRoads.length} roads, ${grew.length} lengthened`)
ok(
  'OB-197 (3): every road is at least three of the set\'s heads long — the stub is gone',
  floor !== null && allRoads.every((r) => len(r) >= floor - 0.01),
  floor === null ? 'no head' : `shortest ${Math.min(...allRoads.map(len)).toFixed(2)} against ${floor.toFixed(2)}`,
)
ok(
  'OB-197 (4): a road already past the floor was left at its own length — only the short ones grew',
  allRoads.filter((r) => !r.grew).every((r) => len(r) > floor - 0.01) && grew.every((r) => Math.abs(len(r) - floor) < 0.01),
  `lengthened roads at ${[...new Set(grew.map((r) => len(r).toFixed(2)))].join(', ')}`,
)
ok(
  'OB-197 (3): a lengthened road CROSSES the shared boundary — its tail is not inside the target, its head not inside the source',
  grew.every((r) => r.aInTgt === false && r.bInSrc === false),
  grew.map((r) => `${r.key} tail-in-target ${r.aInTgt} head-in-source ${r.bInSrc}`).slice(0, 4).join('; '),
)
const worstDeg = Math.max(...allRoads.filter((r) => r.hasHead).map(deg))
ok('OB-197 (10): no arrowhead points more than 20° off its own road', worstDeg <= 20.05, `worst ${worstDeg.toFixed(2)}°`)
const counted = allRoads.filter((r) => r.label)
if (counted.length) {
  ok(
    'OB-197 (9): the ×n count sits on the CAPPED curve\'s own midpoint',
    counted.every((r) => Math.abs(r.label.x - (0.25 * r.ax + 0.5 * r.cx + 0.25 * r.bx)) < 0.01),
    `${counted.length} counts checked`,
  )
} else {
  console.log('OB-197 (9): no road in this sweep carries a ×n count — not checked here (the count reads the same capped control point as the head)')
}
if (grew.length) {
  // a close-up of one lengthened stub, for the eye
  const r = grew[0]
  await page.keyboard.press('Escape')
  await page.mouse.click(paneBox.x + paneBox.width * r.at.fx, paneBox.y + paneBox.height * r.at.fy)
  await page.waitForTimeout(450)
  const box = await page.evaluate(({ key }) => {
    const g = document.querySelector(`[data-seledge="${key}"]`)
    if (!g) return null
    const b = g.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  }, { key: r.key })
  if (box) {
    await page.mouse.move(4, 4)
    await page.waitForTimeout(250)
    await page.screenshot({ path: OUT + '/ob197-short-road.png', clip: { x: Math.max(0, box.x - 60), y: Math.max(0, box.y - 60), width: box.w + 120, height: box.h + 120 } })
  }
}

// back to one selection for the shots below
await page.keyboard.press('Escape')
for (const fx of [0.5, 0.42, 0.58, 0.34, 0.66]) {
  await page.mouse.click(pane.x + pane.width * fx, pane.y + pane.height * 0.5)
  await page.waitForTimeout(450)
  if ((await page.locator('[data-seloverlay]').count()) === 1) break
}

await page.mouse.move(4, 4)
await page.waitForTimeout(250)
await page.screenshot({ path: OUT + '/map-arrows-receded.png' })

// deselect and confirm it comes back — the item asks for both directions
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
r = await receded()
ok('deselecting returns the walk to full weight', r.flag === '0' && r.op === '1', JSON.stringify(r))
p = await recededPins()
ok('and the pins come back with it — both directions, both layers', p.flag === '0' && p.op === '1', JSON.stringify(p))
ok('and the walked arrow to acorn', (await toneNow()).includes('accent-walk'), await toneNow())

// park the pointer off the map first — MapTooltip follows it and would sit over
// the very arrows these shots exist to show
await page.mouse.move(4, 4)
await page.waitForTimeout(250)
await page.screenshot({ path: OUT + '/map-arrows.png' })

// AND ONE CLOSE-UP, cropped to the walk itself. The full-pane shot is what the
// map looks like; it is not enough to judge a 1.5px shaft's halo or a 14px bulge
// against, and OB-116 and OB-107 are both judged at exactly that scale.
{
  const boxes = await page.$$eval('[data-routestop]', (els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })))
  const pad = 60
  const x = Math.min(...boxes.map((b) => b.x)) - pad
  const y = Math.min(...boxes.map((b) => b.y)) - pad
  const right = Math.max(...boxes.map((b) => b.x + b.w)) + pad
  const bottom = Math.max(...boxes.map((b) => b.y + b.h)) + pad
  await page.screenshot({ path: OUT + '/map-arrows-close.png', clip: { x: Math.max(0, x), y: Math.max(0, y), width: right - Math.max(0, x), height: bottom - Math.max(0, y) } })
}

await page.evaluate(() => localStorage.clear())
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shots at tools/studio-spike/shots/map-arrows{,-receded,-close,-deep}.png')
