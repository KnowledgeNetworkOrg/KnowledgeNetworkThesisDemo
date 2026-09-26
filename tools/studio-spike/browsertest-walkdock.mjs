// browsertest-walkdock.mjs — #246 (DS OB-130/131/133): the walk dock on the map.
//
// A TEST. It opens the Studio in a real browser and checks what the issue asked for,
// in the order a user would meet it:
//   - the dock is on the map's bottom edge as soon as a walk is on the map, closed;
//   - opening it does not move the map (the SVG's box is the same before and after);
//   - the optional stop reads "(optional)" on the strip AND in the dock's open row —
//     the drift OB-133 exists to end;
//   - a seek in the dock moves the map's pins; play on the dock moves the walk and
//     the viewer's strip reads the SAME clock (it shows pause), and pausing from the
//     strip stops the dock — one clock, every surface;
//   - hovering a pin shows the same preview card the strip shows, PREVIEW_GAP above
//     the pin, with no MapTooltip beside it, and it goes when the pointer leaves;
//   - with no walk being played there is no dock;
//   - OB-156: the map's floating chrome (levels, visibility, zoom) climbs with the dock's LIVE
//     height — 63 closed, 113 open — on the dock's own 280ms fold, so with the row open the
//     level picker and the zoom buttons are still clickable and still act;
//   - OB-157: the open row's line begins on the first dot's centre and ends on the last dot's,
//     and the walked fill draws nothing at stop 1 — two 1:1 screenshots, scrolled to each end;
//   - OB-196: at the last stop the transport is a replay arrow, its click puts the cursor on
//     stop 1 AT ONCE and starts the walk 600ms later, a seek in that beat cancels the start, and
//     the current stop's NAME opens the preview card;
//   - OB-199: that card is the stop's DOCUMENT — a stop with no walk note still says more than
//     its heading — and the dock's name, its rail, the viewer's strip and the presenter's strip
//     all show the same card for the same stop.
//
// THE FIXTURE is the opening composition: the desk's seed draft is already published
// on bus.route, so the map starts with a real walk (drive-mappins.mjs relies on the
// same fact). The seed's stops carry no notes — which makes every one of them OB-199's
// reported case — and the pin-hover half activates a SAVED walk from Trail, whose first
// stop has one.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-walkdock.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5234

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

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(800)
// THE PAGE SETTLES BEFORE ANYTHING IS MEASURED (#365). The three webfaces (tokens/fonts.css)
// come over the network with `font-display: swap`: text draws first in the platform fallback
// and is redrawn when its face lands, and the fallback's line boxes are not the real face's
// height. A face landing after the fixed 800ms moved the map's box partway through section B —
// top edge 1px up, box 1px taller, bottom edge where it was — and the box STAYED moved after the
// dock closed again, which a nudge from the dock would not do. `probe-walkdockbox.mjs` forces
// that late landing, and opens and closes the dock on a settled page to ask whether the dock
// moves the map at all.
// So: every face in, then the map's box still for 10 frames running — the second half also
// covers any late layout that is not a font. Capped, so a page that never settles fails a
// check here instead of hanging the run.
const settled = await page.evaluate(() => new Promise((res) => {
  const t0 = performance.now()
  let last = null
  let still = 0
  const f = () => {
    const svg = document.querySelector('[aria-label="map-view"] svg')
    const r = svg ? svg.getBoundingClientRect() : null
    const box = r ? `${r.x},${r.y},${r.width},${r.height}` : null
    const fontsIn = document.fonts.status === 'loaded'
    still = fontsIn && box !== null && box === last ? still + 1 : 0
    last = box
    const ms = Math.round(performance.now() - t0)
    if (still >= 10 || ms > 10000) res({ still, ms, fonts: document.fonts.status, box })
    else requestAnimationFrame(f)
  }
  requestAnimationFrame(f)
}))
ok('the page has SETTLED before anything is measured: every webface in, and the map\'s box still for 10 frames', settled.still >= 10, JSON.stringify(settled))

const map = page.locator('[aria-label="map-view"]')
const viewer = page.locator('[aria-label="walk-viewer"]')
const dock = () => map.locator('[data-walk-dock]')
const svgBox = () => map.locator('svg').first().boundingBox()
/** the readout pill's "cur / N", as numbers */
const readout = async () => {
  const t = await dock().locator('button').filter({ hasText: /\d+ \/ \d+/ }).first().textContent()
  const m = /(\d+) \/ (\d+)/.exec(t || '')
  return m ? { cur: Number(m[1]), n: Number(m[2]) } : null
}
const sameBox = (a, b) => a && b && ['x', 'y', 'width', 'height'].every((k) => Math.abs(a[k] - b[k]) < 0.5)
/** every pin's StepDot face, in pin order: computed background and border — what tells
 *  current from done from ahead. At a coarse level a pin can stand for a RANGE of stops
 *  (data-step "1-3"), so the faces are read as a whole rather than by one stop number. */
const pinFaces = () => map.locator('[data-routestop] foreignObject > *').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor + '|' + getComputedStyle(el).borderColor).join(' ; '))

process.on('uncaughtException', (e) => { console.log(checks.join('\n')); console.error('\nCRASHED: ' + e.message); vite.kill(); process.exit(1) })

// ── A. the dock is there, closed, the DS's closed height ────────────────────
ok('the map is on screen', (await map.count()) === 1)
ok('THE DOCK MOUNTS with the desk draft on the map', (await dock().count()) === 1)
ok('and it starts closed', (await dock().getAttribute('data-walk-dock')) === 'closed')
const closedBox = await dock().boundingBox()
ok('closed, it is WALK_DOCK_METRICS.closed (63) tall', !!closedBox && Math.abs(closedBox.height - 63) <= 1, `${closedBox?.height}`)
const mapBox = await map.boundingBox()
ok('and sits on the pane\'s bottom edge', !!closedBox && !!mapBox && Math.abs(closedBox.y + closedBox.height - (mapBox.y + mapBox.height)) <= 1)
const r0 = await readout()
ok('the readout reads stop 1 of the walk', !!r0 && r0.cur === 1 && r0.n > 1, JSON.stringify(r0))

// ── B. opening does not move the map; the optional suffix is on both surfaces ─
ok('the strip shows the seed\'s optional stop as "(optional)"', (await viewer.getByText('(optional)').count()) >= 1)
const before = await svgBox()
await map.getByLabel('show every stop').click()
await page.waitForTimeout(450)
ok('the chevron opens the dock', (await dock().getAttribute('data-walk-dock')) === 'open')
const openBox = await dock().boundingBox()
ok('open, it is WALK_DOCK_METRICS.open (113) tall', !!openBox && Math.abs(openBox.height - 113) <= 1, `${openBox?.height}`)
// one reading, compared AND printed: two calls could disagree, and the message would then show a
// box the check never saw
const after = await svgBox()
ok('THE MAP DID NOT MOVE: the SVG\'s box is identical before and after', sameBox(before, after), JSON.stringify({ before, after }))
ok('the open row shows the optional stop as "(optional)" too', (await dock().getByText('(optional)').count()) >= 1)
await map.getByLabel('hide the stops').click()
await page.waitForTimeout(450)
ok('and closes again', (await dock().getAttribute('data-walk-dock')) === 'closed')
const afterClose = await svgBox()
ok('still without moving the map', sameBox(before, afterClose), JSON.stringify({ before, after: afterClose }))

// ── B2. OB-188 / OB-190 / OB-187 ON THE OPEN ROW ────────────────────────────────────
// The seed draft is a NESTED walk — its step 2 is a group holding two stops — which is the one
// shape every clause here needs: on a flat walk the address IS the count and a test cannot tell.
{
  await map.getByLabel('show every stop').click()
  await page.waitForTimeout(450)
  const dotText = () => dock().locator('[data-walk-dock-stop] button').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  const labels = await dotText()
  // the seed's step 2 is a group of two stops: they read 2.1 and 2.2; every label is at most two
  // numbers; and the FIRST number walks the top-level steps in order (a top-level stop after a
  // group reads its step number, never its flat index)
  const firsts = labels.map((l) => Number(l.split('.')[0]))
  ok('OB-188 (2): the open row labels each dot with its two-number ADDRESS — the group\'s stops read 2.1, 2.2, not 2, 3 and not a full path', labels[0] === '1' && labels[1] === '2.1' && labels[2] === '2.2' && labels.every((l) => /^\d+(\.\d+)?$/.test(l)) && firsts.every((f, i) => i === 0 ? f === 1 : f === firsts[i - 1] || f === firsts[i - 1] + 1), labels.join(' '))
  // OB-190: the swell — pointer resting on one stop of the row: the ladder outward from it
  // evaluateAll, so a build without the hook reads NaN and FAILS instead of hanging the run
  const scaleOf = (i) => dock().locator(`[data-walk-dock-mark="${i}"]`).evaluateAll((els) => { if (!els.length) return NaN; const m = /matrix\(([^,]+),/.exec(getComputedStyle(els[0]).transform); return m ? Number(m[1]) : 1 })
  const stop2 = await dock().locator('[data-walk-dock-stop="2"] button').boundingBox()
  await page.mouse.move(stop2.x + stop2.width / 2, stop2.y + stop2.height / 2)
  await page.waitForTimeout(400)
  const ladder = await Promise.all([0, 1, 2, 3, 4, 5].map(scaleOf))
  const near = (a, b) => Math.abs(a - b) < 0.006
  ok('OB-190 (3): with the pointer on stop 3 the marks scale as the ladder — peak 1.18 on it, 1.13 beside, 1.098 next, the row\'s base 1.08 beyond', near(ladder[2], 1.18) && near(ladder[1], 1.13) && near(ladder[3], 1.13) && near(ladder[0], 1.098) && near(ladder[4], 1.098) && near(ladder[5], 1.08), ladder.map((v) => v.toFixed(3)).join(' '))
  const trackH = await dock().locator('[data-walk-dock-track]').evaluate((el) => el.getBoundingClientRect().height)
  ok('OB-190 (4): and the row\'s line is lineHover (4) tall while the pointer is on the row', Math.abs(trackH - 4) < 0.6, `${trackH}`)
  await page.mouse.move(4, 4)
  await page.waitForTimeout(400)
  const rest = await Promise.all([0, 1, 2, 3, 4, 5].map(scaleOf))
  ok('and every mark returns to 1 on pointer leave', rest.every((v) => near(v, 1)), rest.map((v) => v.toFixed(3)).join(' '))
  // OB-187: the wash — behind the cursor the dots are washed, the CURRENT dot is not (its face is
  // the one dark face in the system), ahead none
  await dock().focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  const washed = await dock().locator('[data-walk-dock-stop]').evaluateAll((els) => els.map((e) => !!e.querySelector('[data-stepdot-wash]')))
  ok('OB-187 (2)+(4): at stop 3, the two dots behind the cursor carry the wash, the CURRENT dot does NOT (white on --accent-walk stays readable), and none ahead does', washed[0] && washed[1] && !washed[2] && !washed[3] && !washed[4], washed.map((w) => (w ? 'washed' : 'bare')).join(' '))
  // the NUMBER is the dot's last span: since OB-214 (#344) a pill's face is an SVG in a wrapper
  // span of its own, so `button > span` alone would match the wrapper too
  const curInk = await dock().locator('[data-walk-dock-stop="2"] button > span:last-child').evaluate((el) => getComputedStyle(el).color)
  ok('the current dot\'s number is still the inverse ink', /25[0-5], 25[0-5], 25[0-5]|253, 252, 250/.test(curInk), curInk)
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
  await map.getByLabel('hide the stops').click()
  await page.waitForTimeout(450)
}

// ── A2. OB-156: the floating chrome climbs with the dock's LIVE height ─────────
// The level picker and the zoom column sit `bottom: 12 + dock height` inside the pane. They
// used to climb by `closed` only, so the open row grew up over them (owner's screenshot,
// 2026-09-05: the + cut in half, the control under it gone). Now the offset reads the
// controlled `open` the host holds, and moves on the dock's own fold.
const mapBottom = async () => { const m = await map.boundingBox(); return m.y + m.height }
const bottomOf = async (label) => { const b = await map.getByLabel(label, { exact: true }).boundingBox(); return Math.round((await mapBottom()) - (b.y + b.height)) }
ok('closed: the level picker sits 12 + closed (75) above the pane bottom', Math.abs((await bottomOf('levels')) - 75) <= 2, `${await bottomOf('levels')}`)
ok('closed: so does the zoom column (zoom out is its lowest button)', Math.abs((await bottomOf('zoom out')) - 75) <= 2, `${await bottomOf('zoom out')}`)
const chromeTransition = await map.getByLabel('levels', { exact: true }).evaluate((el) => {
  let n = el
  while (n && n.style.position !== 'absolute') n = n.parentElement
  const cs = n ? getComputedStyle(n) : null
  return cs ? cs.transitionProperty + ' ' + cs.transitionDuration + ' ' + cs.transitionTimingFunction : 'no positioned ancestor'
})
ok('the chrome transitions its `bottom` over WALK_DOCK_METRICS.fold (280ms), not by a retyped number', /bottom/.test(chromeTransition) && /0\.28s/.test(chromeTransition), chromeTransition)
await map.getByLabel('show every stop').click()
await page.waitForTimeout(450)
ok('OPEN: the level picker climbs to 12 + open (125)', Math.abs((await bottomOf('levels')) - 125) <= 2, `${await bottomOf('levels')}`)
ok('OPEN: and the zoom column with it', Math.abs((await bottomOf('zoom out')) - 125) <= 2, `${await bottomOf('zoom out')}`)
// the acceptance test: with the open row on screen, both controls are clickable AND ACT
const levelBefore = await page.$eval('[data-nested]', (el) => el.getAttribute('data-level'))
await map.getByLabel('zoom in', { exact: true }).click()
await page.waitForTimeout(700)
const levelAfter = await page.$eval('[data-nested]', (el) => el.getAttribute('data-level'))
ok('with the dock OPEN, zoom in is clickable and ACTS: the level changed', levelAfter !== levelBefore && Number(levelAfter) === Number(levelBefore) + 1, `L${levelBefore} -> L${levelAfter}`)
await map.getByLabel('zoom out', { exact: true }).click()
await page.waitForTimeout(700)
ok('and zoom out brings it back', (await page.$eval('[data-nested]', (el) => el.getAttribute('data-level'))) === levelBefore)
const optionsClosed = await map.getByText(/^L\d$/).count()
await map.getByLabel('levels', { exact: true }).click()
await page.waitForTimeout(300)
const optionsOpen = await map.getByText(/^L\d$/).count()
ok('with the dock OPEN, the level picker is clickable and ACTS: its levels appear', optionsOpen > optionsClosed, `${optionsClosed} -> ${optionsOpen} level labels`)
await map.getByLabel('levels', { exact: true }).click()
await page.waitForTimeout(300)

// ── A3. OB-157: the open row's line ends ON the last stop ──────────────────────
// Each stop is a `stopW` column with its dot centred, so a `left: 0; right: 0` track hung half a
// column past both ends — and on a WALK a line leaving the last stop says "there is another
// stop after this". The track now runs dot centre to dot centre; the walked fill starts on the
// first centre and ends on the current one, so at stop 1 it draws nothing.
const OUT = REPO + '/tools/studio-spike/shots'
const centreX = async (i) => { const b = await dock().locator(`[data-walk-dock-stop="${i}"]`).boundingBox(); return b.x + b.width / 2 }
const rect = (sel) => dock().locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width } })
await dock().focus()
await page.keyboard.press('Home')
await page.waitForTimeout(500)
const rHome = await readout()
const trackHome = await rect('[data-walk-dock-track]')
const fillHome = await rect('[data-walk-dock-fill]')
ok('at 1 / N the track BEGINS on the first dot\'s centre', Math.abs(trackHome.left - (await centreX(0))) <= 1, `track.left ${trackHome.left.toFixed(1)} vs dot ${(await centreX(0)).toFixed(1)}`)
ok('and nothing is drawn to the LEFT of the first dot: the walked fill has zero width at stop 1', fillHome.width === 0 && fillHome.left >= (await centreX(0)) - 1, `fill width ${fillHome.width}, left ${fillHome.left.toFixed(1)}`)
const dockBoxHome = await dock().boundingBox()
await page.screenshot({ path: OUT + '/walkdock-open-1-of-N.png', clip: dockBoxHome })
await page.keyboard.press('End')
await page.waitForTimeout(600)
const rEnd = await readout()
ok('End scrolled the open row to N / N', !!rEnd && !!rHome && rEnd.cur === rHome.n, JSON.stringify(rEnd))
const lastI = rEnd.n - 1
const trackEnd = await rect('[data-walk-dock-track]')
const fillEnd = await rect('[data-walk-dock-fill]')
ok('at N / N the track ENDS on the last dot\'s centre — no line past it', Math.abs(trackEnd.right - (await centreX(lastI))) <= 1, `track.right ${trackEnd.right.toFixed(1)} vs dot ${(await centreX(lastI)).toFixed(1)}`)
ok('and the walked fill ends exactly there too', Math.abs(fillEnd.right - (await centreX(lastI))) <= 1 && Math.abs(fillEnd.left - trackEnd.left) <= 1, `fill.right ${fillEnd.right.toFixed(1)}`)
const dockBoxEnd = await dock().boundingBox()
await page.screenshot({ path: OUT + '/walkdock-open-N-of-N.png', clip: dockBoxEnd })
await page.keyboard.press('Home')
await page.waitForTimeout(400)
await map.getByLabel('hide the stops').click()
await page.waitForTimeout(450)
ok('closed again: the chrome comes back down to 12 + closed', Math.abs((await bottomOf('levels')) - 75) <= 2, `${await bottomOf('levels')}`)

// ── A4. OB-185: the preview is where it says it is, and a drag keeps it up ─────────
// The dock wears `backdrop-filter: blur(6px)`, which makes it the containing block for a
// `position: fixed` descendant — so a preview rendered in place is mounted, populated and drawn
// ~137px BELOW the rail, outside the pane, clipped by its overflow. Nothing errors and a DOM-count
// check passes; the owner found it by hovering. The card now mounts through a portal on
// `document.body`, and the checkable form is geometry: its bottom sits PREVIEW_GAP (12) above the
// rail's top and its box lies INSIDE the pane. And a drag on the rail keeps the card up, anchored
// on the stop being landed on (the knob), not on the pointer.
const preview = () => page.locator('[data-walk-preview]')
const railBox = await dock().locator('[data-walk-dock-rail]').boundingBox()
await page.mouse.move(railBox.x + railBox.width * 0.5, railBox.y + railBox.height / 2)
await page.waitForTimeout(250)
const mapBox0 = await map.boundingBox()
const cardBox0 = await preview().boundingBox()
ok('OB-185: hovering the closed rail raises the preview card', !!cardBox0, cardBox0 ? '' : 'no [data-walk-preview]')
ok('and the card sits PREVIEW_GAP (12) above the rail\'s top — not 137px below it', !!cardBox0 && Math.abs(railBox.y - (cardBox0.y + cardBox0.height) - 12) <= 1, cardBox0 ? `card bottom ${(cardBox0.y + cardBox0.height).toFixed(1)}, rail top ${railBox.y.toFixed(1)}` : '')
ok('inside the pane\'s own rect', !!cardBox0 && cardBox0.y >= mapBox0.y - 1 && cardBox0.y + cardBox0.height <= mapBox0.y + mapBox0.height + 1, cardBox0 ? `card y ${cardBox0.y.toFixed(1)}..${(cardBox0.y + cardBox0.height).toFixed(1)}, pane ${mapBox0.y.toFixed(1)}..${(mapBox0.y + mapBox0.height).toFixed(1)}` : '')
// the drag: down at 20%, move to 70% — the card stays up and tracks the sought stop's knob
await page.mouse.move(railBox.x + railBox.width * 0.2, railBox.y + railBox.height / 2)
await page.mouse.down()
await page.waitForTimeout(150)
ok('pressing down on the rail keeps the card mounted', (await preview().count()) === 1)
await page.mouse.move(railBox.x + railBox.width * 0.7, railBox.y + railBox.height / 2, { steps: 6 })
await page.waitForTimeout(200)
const cardMid = await preview().boundingBox()
const knob = await dock().locator('[data-walk-dock-knob]').boundingBox()
const rDrag = await readout()
ok('and moving keeps it up, anchored on the STOP being landed on (the knob), not on the pointer', (await preview().count()) === 1 && !!cardMid && !!knob && Math.abs((cardMid.x + cardMid.width / 2) - (knob.x + knob.width / 2)) <= 2, `card centre ${cardMid ? (cardMid.x + cardMid.width / 2).toFixed(1) : '-'} vs knob ${knob ? (knob.x + knob.width / 2).toFixed(1) : '-'}, readout ${JSON.stringify(rDrag)}`)
await page.mouse.move(railBox.x + railBox.width * 0.7, railBox.y - 60)
await page.mouse.up()
await page.waitForTimeout(200)
ok('releasing OUTSIDE the rail clears the card', (await preview().count()) === 0)
await dock().focus()
await page.keyboard.press('Home')
await page.waitForTimeout(300)

// ── C. a seek in the dock moves the pins ────────────────────────────────────
const facesBefore = await pinFaces()
await dock().focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(250)
const r1 = await readout()
ok('→ on the dock seeks one stop', !!r1 && r1.cur === 2, JSON.stringify(r1))
// End, not one more →: at L0 the seed's seven stops fold into two range pins ("1-3",
// "4-7"), and a cursor moving inside one range changes no pin's face. The last stop
// is in the other pin whatever the folding.
await page.keyboard.press('End')
await page.waitForTimeout(250)
ok('End seeks to the last stop', (await readout())?.cur === r1.n)
const facesAfter = await pinFaces()
ok('and the map\'s pins change face (the current stop moved to another pin)', facesBefore !== facesAfter, `${facesBefore} -> ${facesAfter}`)
await page.keyboard.press('Home')
await page.waitForTimeout(250)
ok('Home seeks back to the first', (await readout())?.cur === 1)

// ── C2. OB-196: THE TRANSPORT'S THIRD STATE — replay at the last stop, in two beats ──
// On the last stop the play triangle becomes a circular replay arrow, derived from
// `walkComplete` (so one stop early it is still a triangle). Its click means "back to stop 1
// and run", in TWO beats: the cursor goes back at once, the walk starts `restartPause` (600ms)
// later, and a seek during the beat cancels the start. The beat is sampled IN THE PAGE, one
// reading per animation frame, because the whole clause is about WHEN.
// `exact` on every label here: "play the walk" is a substring of the replay's label.
const REPLAY = 'replay the walk from the start'
const transportNow = async () => (await map.getByLabel(REPLAY, { exact: true }).count()) ? 'replay'
  : (await map.getByLabel('pause the walk', { exact: true }).count()) ? 'pause'
  : (await map.getByLabel('play the walk', { exact: true }).count()) ? 'play' : 'none'
{
  await dock().focus()
  await page.keyboard.press('End')
  await page.waitForTimeout(300)
  ok('OB-196 (2): on the last stop the dock\'s transport is the replay arrow', (await transportNow()) === 'replay', await transportNow())
  const d = await map.getByLabel(REPLAY, { exact: true }).locator('path').getAttribute('d').catch(() => null)
  ok('and it draws REPLAY_PATH (the ring\'s arc), not the triangle', !!d && d.includes('A6.7 6.7'), `${d}`)
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  ok('OB-196 (5): one stop back it is a play triangle again — the replay is never offered a stop early', (await transportNow()) === 'play', await transportNow())
  await page.keyboard.press('End')
  await page.waitForTimeout(300)
  const beat = await page.evaluate((label) => new Promise((res) => {
    const dockEl = document.querySelector('[aria-label="map-view"] [data-walk-dock]')
    const cur = () => { const b = [...dockEl.querySelectorAll('button')].find((x) => /\d+ \/ \d+/.test(x.textContent || '')); const m = /(\d+) \/ (\d+)/.exec(b ? b.textContent : ''); return m ? Number(m[1]) : null }
    const playing = () => !!dockEl.querySelector('[aria-label="pause the walk"]')
    const frames = []
    const t0 = performance.now()
    dockEl.querySelector(`[aria-label="${label}"]`).click()
    const f = () => { const t = performance.now() - t0; frames.push({ t, cur: cur(), playing: playing() }); if (t < 1100) requestAnimationFrame(f); else res(frames) }
    requestAnimationFrame(f)
  }), REPLAY)
  const tPlay = beat.find((fr) => fr.playing)?.t
  ok('OB-196 (3b): the cursor is on stop 1 IMMEDIATELY — the first frame after the click reads 1 / N, not yet playing', beat[0].cur === 1 && !beat[0].playing, JSON.stringify(beat[0]))
  ok('and it holds there, NOT playing, for the whole beat', beat.filter((fr) => tPlay === undefined || fr.t < tPlay).every((fr) => fr.cur === 1 && !fr.playing))
  ok('OB-196 (3)+(d): then the walk plays from stop 1, restartPause (600ms) after the click — not in the same frame', tPlay !== undefined && tPlay >= 560 && tPlay <= 760 && beat.find((fr) => fr.playing).cur === 1, tPlay === undefined ? 'never started' : `started at ${tPlay.toFixed(0)}ms`)
  await map.getByLabel('pause the walk', { exact: true }).click()
  await page.waitForTimeout(200)
  // a seek during the beat: the user has chosen where to be, and the walk must not start under them
  await dock().focus()
  await page.keyboard.press('End')
  await page.waitForTimeout(300)
  await map.getByLabel(REPLAY, { exact: true }).click()
  await page.waitForTimeout(150)
  await dock().focus()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  ok('OB-196 (3b): a seek DURING the beat cancels the pending start — the cursor where the user put it, still not playing', (await readout())?.cur === 2 && (await transportNow()) === 'play', `${JSON.stringify(await readout())}, transport ${await transportNow()}`)
  // space is the same control as the button, third state included
  await page.keyboard.press('End')
  await page.waitForTimeout(300)
  await page.keyboard.press(' ')
  await page.waitForTimeout(150)
  const spaceBeat = { cur: (await readout())?.cur, transport: await transportNow() }
  await page.waitForTimeout(700)
  ok('space on a finished walk restarts it the same way — stop 1 at once, playing after the beat', spaceBeat.cur === 1 && spaceBeat.transport === 'play' && (await transportNow()) === 'pause', `${JSON.stringify(spaceBeat)} then ${await transportNow()}`)
  await map.getByLabel('pause the walk', { exact: true }).click()
  await page.waitForTimeout(200)
  await dock().focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
}

// ── C3. OB-196 (4) + OB-199: THE NAME OPENS THE CARD, AND THE CARD IS THE DOCUMENT ──
// The current stop's name beside the button was the one named stop on the dock with no way to
// read what is in it. Hovering it opens the SAME card the rails open, centred on the WORDS (the
// name's slot is `flex: 1`, so its box centre sits far right of a short name). And the card is
// the stop's document: the owner's report was a card that printed the name and nothing else,
// for a stop the walk had never annotated — so the check is OB-199's own, "the card's text is
// longer than its own head", on a stop with no note. The stop is the reported one ("Transistors
// & Logic Gates") when the seed walk has it, the second stop otherwise.
const stopCard = () => page.locator('[data-stop-card]')
const cardText = async (loc) => ((await loc.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
let sameCard = null // { k, text, head } — the dock's card for stop k, for the presenter's check in I
{
  const nameEl = () => dock().locator('[data-walk-dock-name]')
  await dock().focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(250)
  const n = (await readout()).n
  let k = 1
  for (let i = 0; i < n; i++) {
    if (((await nameEl().textContent()) || '').startsWith('Transistors & Logic Gates')) { k = i; break }
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(60)
  }
  await page.keyboard.press('Home')
  for (let i = 0; i < k; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  const nameText = ((await nameEl().textContent()) || '').trim()
  ok('the stop under test carries NO walk note — the dock\'s name shows no " · note" (the reported case)', !!nameText && !nameText.includes(' · '), nameText)
  await nameEl().hover()
  await page.waitForTimeout(300)
  ok('OB-196 (4): hovering the current stop\'s NAME opens the preview card', (await stopCard().count()) === 1, `${await stopCard().count()} cards`)
  const head = await cardText(stopCard().locator('[data-stop-card-head]'))
  const text = await cardText(stopCard())
  ok('its heading is the stop\'s address and name', / · /.test(head) && head.endsWith(nameText), head)
  ok('OB-199 (3): and the card says MORE than its heading — the node\'s document opening, for a stop with no walk note', text.length > head.length + 20, `head "${head}" (${head.length}) · card ${text.length} chars: "${text.slice(0, 90)}…"`)
  const words = await nameEl().evaluate((el) => {
    const box = el.getBoundingClientRect()
    const r = document.createRange()
    r.selectNodeContents(el)
    const t = r.getBoundingClientRect()
    return { cx: (box.left + Math.min(box.right, t.right)) / 2, slotCx: box.left + box.width / 2, top: box.top, vw: innerWidth }
  })
  const cb = await page.locator('[data-walk-preview][aria-hidden="true"]').boundingBox()
  // the card clamps itself to the window (OB-191), so the centre it SHOULD have is the words' centre clamped the same way
  const want = cb ? Math.min(Math.max(words.cx, 8 + cb.width / 2), words.vw - 8 - cb.width / 2) : NaN
  ok('anchored on the WORDS, not on the name\'s flex slot — centred over the text, PREVIEW_GAP (12) above it', !!cb && Math.abs(cb.x + cb.width / 2 - want) <= 2 && Math.abs(words.top - (cb.y + cb.height) - 12) <= 1.5, cb ? `card centre ${(cb.x + cb.width / 2).toFixed(1)}, words ${words.cx.toFixed(1)}, slot ${words.slotCx.toFixed(1)}` : 'no card')
  ok('OB-199 (4): the card is the published 264px measure', !!cb && Math.abs(cb.width - 264) <= 1, `${cb?.width}`)
  ok('hovering the name moved nothing — the readout is still that stop', (await readout())?.cur === k + 1)
  await page.mouse.move(4, 4)
  await page.waitForTimeout(250)
  ok('leaving the name clears the card', (await stopCard().count()) === 0)
  sameCard = { k, text, head }
  // THE SAME CARD on the dock's own rail, over stop k's tick
  const rb = await dock().locator('[data-walk-dock-rail]').boundingBox()
  await page.mouse.move(rb.x + 9 + (n > 1 ? k / (n - 1) : 0) * (rb.width - 18), rb.y + rb.height / 2)
  await page.waitForTimeout(300)
  ok('the dock\'s RAIL shows the same card for the same stop', (await cardText(stopCard())) === text, await cardText(stopCard().locator('[data-stop-card-head]')))
  await page.mouse.move(4, 4)
  await page.waitForTimeout(250)
  // THE SAME CARD on the walk viewer's strip: its stop slots carry the name as their native title
  const title = head.split(' · ').slice(1).join(' · ')
  const slot = viewer.locator(`[title="${title.replace(/"/g, '\\"')}"]`).first()
  if ((await slot.count()) === 1) {
    await slot.hover()
    await page.waitForTimeout(300)
    ok('OB-199 (6): the walk viewer\'s strip shows the SAME card for the same stop', (await cardText(stopCard())) === text, `viewer "${(await cardText(stopCard())).slice(0, 60)}…" vs dock "${text.slice(0, 60)}…"`)
    await page.mouse.move(4, 4)
    await page.waitForTimeout(250)
  } else {
    ok('the viewer\'s strip draws the stop under test', false, `no slot titled "${title}"`)
  }
  // back to stop 1: the merged-pin checks below read the clamp from BEFORE the run
  await dock().focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
}

// ── D0a. OB-184: a MERGED pin's card names every stop under it, one card per pointer ──
// At a coarse level `walkPins` merges a contiguous run of stops resolving to one cell into ONE
// pin labelled "2-3". A card built from the first stop alone names one document where the pin
// stands for two, so the range card lists every stop, headed by the pin's own label. And while
// that card is up the cell's MapTooltip stays down — one card per pointer — and nothing about
// the focus or the cursor moves: a pin hover is the weakest channel on the pane.
{
  const pins = await map.locator('[data-routestop]').evaluateAll((els) => els.map((el) => ({ step: Number(el.getAttribute('data-step')), stepEnd: Number(el.getAttribute('data-step-end')), label: (el.textContent || '').trim(), cell: el.getAttribute('data-routestop') })))
  const merged = pins.find((p) => p.stepEnd > p.step)
  ok('OB-184 (3): at this level the walk has a MERGED pin to test against (a test that only runs at a fine level cannot see this clause)', !!merged, `pins: ${pins.map((p) => p.label).join(', ')}`)
  if (merged) {
    // OB-188 (3): a merged pin prints the run's two ends as ADDRESSES, en-dashed — on this nested
    // walk the pin covering stops 1, 2.1 and 2.2 reads "1–2.2", not the flat "1-2"
    ok('OB-188 (3): the merged pin prints the run\'s two end ADDRESSES joined by an EN DASH — "1–2.2", not the flat "1-2"', /^\d+(\.\d+)?\u2013\d+(\.\d+)?$/.test(merged.label) && merged.label.endsWith('2.2'), merged.label)
    ok('and a single-stop pin prints that stop\'s address', pins.filter((p) => p.stepEnd === p.step).every((p) => /^\d+(\.\d+)?$/.test(p.label)), pins.map((p) => p.label).join(' '))
    // the run's length is in STOPS (a grouped walk's "1–2.2" covers 1, 2.1 and 2.2)
    const under = merged.stepEnd - merged.step
    const rBefore = await readout()
    const spotBefore = await map.locator('[data-spot]').getAttribute('data-spot').catch(() => null)
    const pin = () => map.locator(`[data-routestop][data-step="${merged.step}"]`)
    const hoverPin = async () => { const pb = await pin().boundingBox(); await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.waitForTimeout(300); return pb }
    // the card is `StopCard` since OB-199; its heading and its footer are the DS's own hooks
    const card = page.locator('[data-stop-card]')
    // OB-186, BOTH ENDS OF THE CLAMP: cursor BEFORE the run → the run's first stop; cursor PAST it → its last
    const pb = await hoverPin()
    // "no per-stop list": one name line, and the run's other stops (2.1 …) are not written out on the card
    ok('OB-186 (1): hovering the merged pin raises ONE one-stop card — no per-stop list', (await card.count()) === 1 && (await card.locator('[data-stop-card-head]').count()) === 1 && !(await card.innerText()).includes('2.1 ·'), (await card.innerText().catch(() => '')).replace(/\n/g, ' | '))
    const nameBefore = (await card.locator('[data-stop-card-head]').textContent().catch(() => '')).trim()
    ok('OB-186 (3a): with the cursor BEFORE the run (stop 1) the card names the run\'s FIRST stop', /^1 · /.test(nameBefore), nameBefore)
    const more = (await card.locator('[data-stop-card-more]').textContent().catch(() => '')).trim()
    ok(`OB-186 (2): and carries the load-bearing footer — the pin's label, then "+${under} more stops under this pin"`, more === `${merged.label} · +${under} more stop${under === 1 ? '' : 's'} under this pin`, more)
    ok('OB-184 (4): ONE CARD PER POINTER — the cell\'s MapTooltip stays down while the pin\'s card is up', (await page.locator('[data-maptip]').count()) === 0)
    ok('OB-184 (2): the hover changed nothing — cursor and spot are what they were', JSON.stringify(await readout()) === JSON.stringify(rBefore) && (await map.locator('[data-spot]').getAttribute('data-spot').catch(() => null)) === spotBefore)
    await page.mouse.move(pb.x + pb.width / 2, pb.y - 120)
    await page.waitForTimeout(300)
    ok('leaving the pin clears the card', (await card.count()) === 0)
    // OB-187 (3): the pin takes the wash — inside its run (cursor on 2.1) the pill is 2/3 washed
    await dock().focus()
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(400)
    const wash = await pin().evaluate((el) => { const w = el.querySelector('[data-stepdot-wash]'); const pill = el.querySelector('button'); return w && pill ? w.getBoundingClientRect().width / pill.getBoundingClientRect().width : null })
    ok('OB-187 (3): the map\'s merged pin takes the same wash — with the cursor on the run\'s 2nd of 3 stops the pill is 2/3 washed, left to right', wash !== null && Math.abs(wash - 2 / 3) < 0.05, wash === null ? 'no wash' : wash.toFixed(3))
    await page.keyboard.press('End')
    await page.waitForTimeout(400)
    await hoverPin()
    const nameAfter = (await card.locator('[data-stop-card-head]').textContent().catch(() => '')).trim()
    ok('OB-186 (3b): with the cursor PAST the run (the last stop) the same pin\'s card names the run\'s LAST stop, by its address — "2.2 · …"', /^2\.2 · /.test(nameAfter), nameAfter)
    ok('the footer is the same at both ends', (await card.locator('[data-stop-card-more]').textContent().catch(() => '')).trim() === more)
    await page.mouse.move(4, 4)
    await page.waitForTimeout(300)
    await dock().focus()
    await page.keyboard.press('Home')
    await page.waitForTimeout(300)
  }
}

// ── D0. OB-181: THE NODE HIGHLIGHT LANDS WITH THE PIN'S POP, NOT ONE DWELL AFTER ──
// `walkAdvance` returns two cursors: the fractional `position` (which the pop, the fill and
// the band ride, completing ON the arrival at phase `travel`) and the integer `step` (the loop's
// bookkeeping, incremented only when the phase wraps, at the end of the dwell). The bus write
// that lights the stop used to ride `step`, so the highlight landed `walkArrivalLag()` — 270ms —
// after the animation had finished, and read as a second event. Sampled IN THE PAGE, one
// reading per animation frame, on a MOVING walk: the first spot change nearest the moment the
// next pin reaches its full pop must be within two frames of it. The walk starts on stop 3: at
// this level stops 1-3 share one merged pin (which does not re-pop between its own stops), so
// the arrival watched lands on a pin of its own — the one whose scale moved most in the window.
await dock().focus()
await page.keyboard.press('Home')
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(400)
const timing = await page.evaluate(() => new Promise((res) => {
  const mapEl = document.querySelector('[aria-label="map-view"]')
  const frames = []
  const t0 = performance.now()
  mapEl.querySelector('[aria-label="play the walk"]').click()
  const f = () => {
    const t = performance.now() - t0
    const pins = [...mapEl.querySelectorAll('[data-routestop]')].map((el) => ({ step: Number(el.getAttribute('data-step')), scale: Number((/scale\(([-\d.e]+)\)/.exec(el.getAttribute('transform') || '') || [])[1]) }))
    const spot = mapEl.querySelector('[data-spot]')
    frames.push({ t, pins, spot: spot ? spot.getAttribute('data-spot') : null })
    if (t < 1500) requestAnimationFrame(f); else res(frames)
  }
  requestAnimationFrame(f)
}))
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(150)
// THE PIN THAT POPS: at a coarse level the first stops may share one merged pin, so the pin
// to watch is whichever one's scale moved the most over the window — its peak is the arrival
const stepsSeen = [...new Set(timing.flatMap((fr) => fr.pins.map((p) => p.step)))]
const scaleOf = (fr, step) => fr.pins.find((p) => p.step === step)?.scale ?? 0
const ranges = stepsSeen.map((step) => { const s = timing.map((fr) => scaleOf(fr, step)); return { step, range: Math.max(...s) - Math.min(...s), peak: Math.max(...s) } })
const popped = ranges.sort((a, b) => b.range - a.range)[0]
ok('OB-181: the sampled window saw a pin pop at all', popped.range > 0.2, `largest scale range ${popped.range.toFixed(3)} on stop ${popped.step}`)
const nextStep = popped.step
const scaleAt = (fr) => scaleOf(fr, nextStep)
const peak = popped.peak
const tPop = timing.find((fr) => scaleAt(fr) >= peak - 1e-6).t
console.log(`   [OB-181 sampling] pins ${ranges.map((r) => r.step + ':' + r.range.toFixed(3)).join(' ')}; spot changes at ${timing.filter((fr, i) => i > 0 && fr.spot !== timing[i - 1].spot).map((fr) => fr.t.toFixed(0)).join(',')}ms`)
const spotChanges = timing.filter((fr, i) => i > 0 && fr.spot !== timing[i - 1].spot).map((fr) => fr.t)
const gap = spotChanges.length ? Math.min(...spotChanges.map((t) => Math.abs(t - tPop))) : Infinity
ok('OB-181: the stop\'s highlight lands WITH the pin\'s pop — within two frames of it on a moving walk', gap <= 40, `pop of stop ${nextStep} at ${tPop.toFixed(0)}ms, nearest spot change ${gap === Infinity ? 'none' : gap.toFixed(0) + 'ms away'} (${timing.length} frames sampled)`)
await dock().focus()
await page.keyboard.press('Home')
await page.waitForTimeout(300)

// ── D. one clock for every surface ──────────────────────────────────────────
await map.getByLabel('play the walk').click()
await page.waitForTimeout(2400)
const rPlay = await readout()
ok('PLAY on the dock walks the walk (900ms a stop: at least two stops in 2.4s)', !!rPlay && rPlay.cur >= 3, JSON.stringify(rPlay))
ok('and the VIEWER\'S STRIP reads the same clock — its transport shows pause', (await viewer.getByLabel('pause the walk').count()) === 1)
await viewer.getByLabel('pause the walk').click()
await page.waitForTimeout(150)
const rPaused = await readout()
await page.waitForTimeout(1200)
ok('PAUSE on the strip stops the dock', (await readout())?.cur === rPaused?.cur, `${rPaused?.cur} then ${(await readout())?.cur}`)
ok('and the dock\'s transport shows play again', (await map.getByLabel('play the walk').count()) === 1)

// ── D1b. A WALK STOP IS A HIGHLIGHT, NOT A SELECTION (DS OB-173) ────────
// Every seek and every tick writes the focus, and a focus is a SELECTION on this map: an
// outline, plus every relation the selected node has drawn across it. So playing a walk was
// flashing a different node's relationship diagram over the walk on every stop — the one
// drawing the professor is watching, removed by the act of watching it. The owner asked for
// the hover's treatment instead, and the map already had one: the spotlight another pane's
// hover lights a cell with.
//
// Asserted as BOTH halves. "Something is lit" would pass with the selection still drawn
// underneath it, which is the state this replaced.
const walkMarks = async () => await page.evaluate(() => ({
  spot: (document.querySelector('[data-spot]') || { getAttribute: () => null }).getAttribute('data-spot'),
  selOutlines: document.querySelectorAll('[data-seloutline]').length,
  receded: (document.querySelector('[data-routearrows]') || { getAttribute: () => null }).getAttribute('data-receded'),
}))
const beforeStep = await walkMarks()
await page.keyboard.press('Home')
await page.waitForTimeout(400)
await map.getByLabel('play the walk').click()
await page.waitForTimeout(1800)
const lit = await walkMarks()
await viewer.getByLabel('pause the walk').click()
await page.waitForTimeout(200)
ok('playing the walk LIGHTS the stop — the same spotlight a hover from another pane gives',
  !!lit.spot, JSON.stringify(lit))
ok('and draws NO selection outline for it — the stop is highlighted, not selected',
  lit.selOutlines === 0, `${lit.selOutlines} outline(s) · spot ${lit.spot}`)
ok('so the walk keeps full weight: nothing recedes because a stop became current',
  lit.receded === '0', `receded=${lit.receded} (was ${beforeStep.receded} before playing)`)

// ── D2. #247 (OB-132): THE WALK ON THE MAP MOVES — the band, the pop, the travelling head ─
// Down to L2, where the seven stops draw as separate pins rather than two ranges. THE
// CHECKS ARE ON THE MECHANISM, never on a pixel count a different band would satisfy by
// accident (the OB-129 lesson): each pin's opacity and scale are read off its own
// attributes, each arrow's split off its own strokes, and the pop is a RATIO of one pin's
// scale at two positions rather than a size.
// down two levels THE WAY THE WALK IS FOLLOWED — a double-click on a pin's own cell, the
// map's dive gesture (the drivers do the same), so the camera stays on the walk
for (let dive = 0; dive < 2; dive++) {
  const b = await map.locator('[data-routestop]').first().boundingBox()
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2)
  await page.waitForTimeout(800)
}
ok('two dives on a pin reach L2', (await page.$eval('[data-nested]', (el) => el.getAttribute('data-level'))) === '2')
// the dive's double-click also SELECTED the cell it landed on, and a selection recedes the
// whole walk to --bark-300 (OB-117) — Escape clears it, so the paints read below are the band's
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
ok('and Escape clears the selection the dive made, so the walk is at full weight', (await map.locator('[data-routearrows]').getAttribute('data-receded')) === '0')
/** every drawn pin, in walk order: its index, its band opacity and its drawn scale */
const pinInfo = () => map.locator('[data-routestop]').evaluateAll((els) => els.map((el) => ({
  k: Number(el.getAttribute('data-pin')),
  opacity: Number(el.getAttribute('opacity')),
  scale: Number((/scale\(([-\d.e]+)\)/.exec(el.getAttribute('transform') || '') || [])[1]),
})).sort((a, b) => a.k - b.k))
/** every drawn arrow: its index, its painted shafts' strokes in order, whether any is a
 *  dash-split stroke, and its head's fill */
const arrowInfo = () => map.locator('[data-routearrow]').evaluateAll((els) => els.map((el) => {
  const strokes = [...el.querySelectorAll('line, path[fill="none"]')].filter((s) => !(s.getAttribute('stroke') || '').includes('surface-raised'))
  const heads = [...el.querySelectorAll('path[fill]')].filter((p) => { const f = p.getAttribute('fill') || ''; return f !== 'none' && !f.includes('surface-raised') })
  return { i: Number(el.getAttribute('data-routearrow')), paints: strokes.map((s) => s.getAttribute('stroke')), split: strokes.some((s) => s.hasAttribute('stroke-dasharray')), head: heads.length ? heads[heads.length - 1].getAttribute('fill') : null, opacity: Number(el.getAttribute('opacity')) }
}).sort((a, b) => a.i - b.i))
const ACORN = 'var(--accent-walk)'
const QUIET = 'var(--bark-400)'

// the whole walk inside the band first, to learn how many pins this level draws
await dock().focus()
await page.keyboard.press('End')
await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)
const total = (await pinInfo()).length
ok('at L2 the draft draws more pins than the band shows at its first stop (so hiding is testable)', total > 3, `${total} pins`)

await page.keyboard.press('Home')
await page.waitForTimeout(300)
let pins = await pinInfo()
ok('AT THE FIRST STOP ONLY THE PINS WITHIN `lead` (2) OF IT ARE DRAWN — a pin outside the band draws nothing', pins.length === 3 && Math.max(...pins.map((p) => p.k)) === 2, JSON.stringify(pins))
ok('the current pin is at full opacity; the two ahead fade over the lead', pins[0].opacity === 1 && pins[1].opacity < 1 && pins[1].opacity > pins[2].opacity && pins[2].opacity > 0, JSON.stringify(pins.map((p) => p.opacity)))
const baseScale = pins[2].scale // two ahead: no arrival, no trail — the pin at rest
ok('THE POP: the current pin is 1 + grow (1.36×) the resting pin', Math.abs(pins[0].scale / baseScale - 1.36) < 0.01, `${(pins[0].scale / baseScale).toFixed(3)}`)
let arrows = await arrowInfo()
ok('nothing is walked yet: every drawn arrow is one quiet stroke with a quiet head, unsplit', arrows.length === 2 && arrows.every((a) => a.paints.length === 1 && a.paints[0] === QUIET && a.head === QUIET && !a.split), JSON.stringify(arrows))

await page.keyboard.press('End')
await page.waitForTimeout(300)
pins = await pinInfo()
arrows = await arrowInfo()
ok('at the last stop the pins behind it fade over the trail (5) and shrink; the one before it is not at full', pins.length >= 3 && pins[pins.length - 1].opacity === 1 && pins[pins.length - 2].opacity < 1 && pins[pins.length - 2].scale < pins[pins.length - 1].scale, JSON.stringify(pins))
ok('every drawn arrow is walked: one acorn stroke, acorn head, unsplit', arrows.length > 0 && arrows.every((a) => a.paints.length === 1 && a.paints[0] === ACORN && a.head === ACORN && !a.split), JSON.stringify(arrows))
const lastScaleAtEnd = pins[pins.length - 1].scale
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)
arrows = await arrowInfo()
ok('one stop back, the arrow INTO the last stop is quiet again while the one before it stays acorn', arrows.length >= 2 && arrows[arrows.length - 1].paints[0] === QUIET && arrows[arrows.length - 2].paints[0] === ACORN, JSON.stringify(arrows.map((a) => a.paints)))
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(300)
pins = await pinInfo()
ok('and two stops back the last pin has settled to rest — the same pin, 1.36× smaller than when it was current', Math.abs(lastScaleAtEnd / pins[pins.length - 1].scale - 1.36) < 0.01, `${(lastScaleAtEnd / pins[pins.length - 1].scale).toFixed(3)}`)

// PLAYING: the animation IS the position. Sample the drawing while the clock runs.
// THE SAMPLING WINDOW OPENS WITH THE WALK (#374). This block used to count fps for a full
// second BEFORE the sampling loop, so the loop's first reading came at ~1.0s — after the
// pop it exists to read. The walk reaches stop 2 at 0.63s and the pin holds the full pop
// through the 0.27s dwell, so by ~0.95s it is over; what the old window saw was the falling
// tail, and it passed only because the tail at ~1.0s sat inside the 0.02 tolerance (it
// read 1.353 of 1.36). #372's heavier pane (54fps against 59) delayed the driver's first
// readings 50–150ms and pushed that tail out (1.25–1.33). In-page per-frame sampling of
// this same play-through reads the full 1.3600 for the whole dwell (`probe-walkpop.mjs`).
// So: samples first, the fps count after, both still inside one play.
await page.keyboard.press('Home')
await page.waitForTimeout(200)
await map.getByLabel('play the walk').click()
const samples = []
const tStart = Date.now()
while (Date.now() - tStart < 1400) {
  samples.push({ pins: await pinInfo(), arrows: await arrowInfo() })
  await page.waitForTimeout(30)
}
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0
  const t0 = performance.now()
  const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n) }
  requestAnimationFrame(f)
}))
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(150)
ok('the map keeps at least 30 frames a second while the walk plays', fps >= 30, `${fps} fps`)
const scalesOf1 = samples.map((s) => s.pins.find((p) => p.k === 1)?.scale).filter((v) => v !== undefined)
const distinct = new Set(scalesOf1.map((v) => v.toFixed(4))).size
ok('pin 2 POPS as the walk arrives — its scale passes through many values, not a jump', distinct >= 6, `${distinct} distinct scales over ${samples.length} samples`)
ok('and reaches the full pop, 1.36× rest', Math.abs(Math.max(...scalesOf1) / baseScale - 1.36) < 0.02, `${(Math.max(...scalesOf1) / baseScale).toFixed(3)}`)
const splitSeen = samples.filter((s) => s.arrows.some((a) => a.split))
ok('while travelling, an arrow is SPLIT — an acorn stroke and a quiet stroke on one path, the head at the seam', splitSeen.length > 0, `${splitSeen.length} of ${samples.length} samples`)
ok('and the split arrow\'s head is acorn (it has been reached)', splitSeen.every((s) => s.arrows.filter((a) => a.split).every((a) => a.head === ACORN)))
ok('a pin outside the band comes INTO it as the walk advances', samples.some((s) => s.pins.some((p) => p.k === 3)), `pins seen: ${[...new Set(samples.flatMap((s) => s.pins.map((p) => p.k)))].join(',')}`)

// ── E. a saved walk: the pin's own hover ────────────────────────────────────
// give the map the room: the pin has to be inside the pane to be hovered
for (const inst of ['unfoldgraph', 'document']) {
  await page.getByLabel(`studio-inst-${inst}`).click()
  await page.waitForTimeout(150)
}
await page.getByLabel('studio-inst-trail').click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /From transistor to running program/ }).click()
await page.waitForTimeout(600)
ok('a SAVED walk keeps the dock (the played prefix is the walk)', (await dock().count()) === 1)
const pin = map.locator('[data-routestop]').first()
const pinBox = await pin.boundingBox()
const mapBox2 = await map.boundingBox()
ok('its first pin is in the pane', !!pinBox && !!mapBox2 && pinBox.y > mapBox2.y && pinBox.y + pinBox.height < mapBox2.y + mapBox2.height, JSON.stringify(pinBox))
await pin.hover()
await page.waitForTimeout(250)
// the card by its own hook, not by its text: the dock's transport row shows the
// current stop's note too (`name · note`), so the note's text is on screen twice
const card = page.locator('[data-stop-card]')
ok('HOVERING THE PIN shows the stop\'s preview card', (await card.count()) === 1, `${await card.count()} cards; note in dock row: ${await dock().getByText('Before any hardware').count()}`)
const cardBox = await card.first().boundingBox()
ok('the card floats PREVIEW_GAP (12) above the pin', !!cardBox && !!pinBox && Math.abs(pinBox.y - (cardBox.y + cardBox.height) - 12) <= 2, `card bottom ${cardBox && cardBox.y + cardBox.height}, pin top ${pinBox?.y}`)
// centred on the pin — or as near it as the window-edge clamp (OB-191, 8px) lets a 264px card sit
const vw = await page.evaluate(() => innerWidth)
const pinCx = pinBox ? pinBox.x + pinBox.width / 2 : NaN
const wantCx = cardBox ? Math.min(Math.max(pinCx, 8 + cardBox.width / 2), vw - 8 - cardBox.width / 2) : NaN
ok('centred on it', !!cardBox && !!pinBox && Math.abs(cardBox.x + cardBox.width / 2 - wantCx) <= 2, cardBox ? `card centre ${(cardBox.x + cardBox.width / 2).toFixed(1)}, pin ${pinCx.toFixed(1)}` : '')
ok('OB-199: the saved walk\'s first stop HAS a note, and the card carries it above the document', /Before any hardware/.test(await cardText(card)) && (await cardText(card)).length > (await cardText(card.locator('[data-stop-card-head]'))).length + 40, (await cardText(card)).slice(0, 120))
ok('and no MapTooltip beside it — one card at a time', (await page.locator('[data-maptip]').count()) === 0)
await page.mouse.move(mapBox2.x + 4, mapBox2.y + 4)
await page.waitForTimeout(250)
ok('the card goes when the pointer leaves the pin', (await card.count()) === 0)

// ── F. the walk changes under the dock ──────────────────────────────────────
// "stop this walk" nulls bus.activeWalk; the viewer then publishes the desk draft
// again and the map draws it, so the dock follows the walk being played: it stays,
// and its readout is the draft's again (seven stops, the cursor where the clock left
// it). The "no walk at all, no dock" case (an empty route, a bus.teach curriculum)
// has no control on screen to reach it and is the unit test on `routeIsWalk`.
const rSaved = await readout()
await page.getByTitle('stop this walk').click()
await page.waitForTimeout(400)
const rBack = await readout()
ok('stopping the saved walk hands the dock the draft back', !!rSaved && !!rBack && rSaved.n !== rBack.n && rBack.n === r0.n, `${JSON.stringify(rSaved)} -> ${JSON.stringify(rBack)}`)

// ── G. OB-179: PLAYBACK MOVES THE CAMERA ONLY WHEN THE STOP IS OFF-SCREEN ──────
// (last, on purpose: its pans leave the map where the hand put it)
// The owner's call: motion on every advance becomes scenery; motion that is rare reads as "we
// have gone somewhere new". So an arrival INSIDE the view moves the camera by nothing at all —
// the scene transform is byte-identical — and an arrival OUTSIDE it brings the stop into view,
// clear of the 12% edge band. A pause moves nothing. A user's own pan wins: after a pan during
// playback the next arrival leaves the view alone. And the focus is untouched by any of it:
// the spot (which follows the focus) is the same cell before and after a camera move.
// the scene group is the svg's first `<g>` after `<defs>`; the camera is its transform attribute
const cameraNow = () => page.evaluate(() => document.querySelector('[aria-label="map-view"] svg > defs + g').getAttribute('transform'))
const svgRect = () => map.locator('svg').first().boundingBox()
/** is the pin COVERING `step` (a merged pin covers a run; its data-step is the run's first)
 *  inside the VISIBLE view — the svg above the dock's top — clear of the 12% band of the
 *  smaller side? Measured in the page: an off-screen SVG pin has a rect Playwright's
 *  boundingBox may refuse. */
const pinInside = (step) => page.evaluate((step) => {
  const mapEl = document.querySelector('[aria-label="map-view"]')
  const svg = mapEl.querySelector('svg').getBoundingClientRect()
  const dockTop = mapEl.querySelector('[data-walk-dock]').getBoundingClientRect().top
  const r = { x: svg.x, y: svg.y, width: svg.width, height: dockTop - svg.y }
  const pins = [...mapEl.querySelectorAll('[data-routestop]')].map((el) => ({ el, step: Number(el.getAttribute('data-step')) })).filter((p) => p.step <= step).sort((a, b) => b.step - a.step)
  if (!pins.length) return null
  const p = pins[0].el.getBoundingClientRect()
  const inset = Math.min(r.width, r.height) * 0.12
  const cx = p.x + p.width / 2, cy = p.y + p.height / 2
  return cx >= r.x + inset && cx <= r.x + r.width - inset && cy >= r.y + inset && cy <= r.y + r.height - inset
}, step)
/** drag the map so the pin covering `step` sits at the visible view's centre — a pan while
 *  PAUSED, which is plain navigation and raises no flag */
const centreOn = async (step) => {
  const d = await page.evaluate((step) => {
    const mapEl = document.querySelector('[aria-label="map-view"]')
    const svg = mapEl.querySelector('svg').getBoundingClientRect()
    const dockTop = mapEl.querySelector('[data-walk-dock]').getBoundingClientRect().top
    const pins = [...mapEl.querySelectorAll('[data-routestop]')].map((el) => ({ el, step: Number(el.getAttribute('data-step')) })).filter((p) => p.step <= step).sort((a, b) => b.step - a.step)
    const p = pins[0].el.getBoundingClientRect()
    return { dx: svg.x + svg.width / 2 - (p.x + p.width / 2), dy: svg.y + (dockTop - svg.y) / 2 - (p.y + p.height / 2), x0: svg.x + 30, y0: svg.y + 30 }
  }, step)
  await page.mouse.move(d.x0, d.y0)
  await page.mouse.down()
  await page.mouse.move(d.x0 + d.dx, d.y0 + d.dy, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}
const spotNow = () => map.locator('[data-spot]').getAttribute('data-spot').catch(() => null)
// (1) an arrival INSIDE the view: from Home, with stop 2 dragged to the view's centre while paused
await dock().focus()
await page.keyboard.press('Home')
await page.waitForTimeout(300)
await centreOn(2)
const inside2 = await pinInside(2)
const cam0 = await cameraNow()
await map.getByLabel('play the walk').click()
await page.waitForTimeout(1000)
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(400)
const cam1 = await cameraNow()
ok('OB-179 (1): arriving at a stop INSIDE the view moves the camera by nothing — the scene transform is byte-identical', inside2 === true ? cam1 === cam0 : inside2 === null ? false : true, `stop 2 inside before: ${inside2}; ${cam0 === cam1 ? 'identical' : cam0 + ' -> ' + cam1}`)
// (4) a PAUSED walk moves the camera for nothing
const camPaused = await cameraNow()
await page.waitForTimeout(700)
ok('OB-179 (4): a paused walk stands still and the camera with it', (await cameraNow()) === camPaused)
// (2) an arrival OUTSIDE the view brings the stop into view, clear of the band. Push the map so
// the NEXT stop is off-screen, then play into it.
const sr = await svgRect()
await page.mouse.move(sr.x + sr.width * 0.5, sr.y + 40)
await page.mouse.down()
await page.mouse.move(sr.x + sr.width * 0.5 - sr.width * 0.6, sr.y + 40, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(300)
const rNow = await readout()
const nextStop = rNow.cur + 1
const outsideBefore = await pinInside(nextStop)
const camBeforeFly = await cameraNow()
const spotBefore = await spotNow()
await map.getByLabel('play the walk').click()
await page.waitForTimeout(1000)
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(900)
const camAfterFly = await cameraNow()
const insideAfter = await pinInside(nextStop)
ok('OB-179 (2): arriving at a stop OUTSIDE the view brings it into view, clear of the edge band', outsideBefore === false && camAfterFly !== camBeforeFly && insideAfter === true, `stop ${nextStop} inside before: ${outsideBefore}, after: ${insideAfter}; camera ${camAfterFly === camBeforeFly ? 'unchanged' : 'moved'}`)
ok('OB-179 (6): the camera move left the FOCUS alone — the spot is the cell the walk stands on, before and after', (await spotNow()) !== spotBefore && (await readout())?.cur === nextStop, `spot ${spotBefore} -> ${await spotNow()}, readout ${JSON.stringify(await readout())}`)
// (5) A USER'S OWN PAN WINS: pan during playback, and the next arrival does not yank the view back
const sr2 = await svgRect()
await map.getByLabel('play the walk').click()
await page.waitForTimeout(150)
await page.mouse.move(sr2.x + sr2.width * 0.5, sr2.y + 40)
await page.mouse.down()
await page.mouse.move(sr2.x + sr2.width * 0.5 - sr2.width * 0.6, sr2.y + 40, { steps: 8 })
await page.mouse.up()
await page.waitForTimeout(100)
const camAfterPan = await cameraNow()
await page.waitForTimeout(500) // past the next arrival (630ms into the step), before the one after
await map.getByLabel('pause the walk').click()
await page.waitForTimeout(500)
ok('OB-179 (5): after the room pans during playback, the next arrival leaves the view where the hand put it', (await cameraNow()) === camAfterPan, `${(await cameraNow()) === camAfterPan ? 'held' : 'yanked'}`)

// ── H. OB-189: THE WALK EDITOR'S HOVER REACHES THE DOCK — a halo, an off-screen pan, no selection ─
// The editor is added to this desk and the window narrowed so the dock's open row shows fewer
// stops than the walk has: a test on a walk that fits the row cannot see the pan at all. Both
// halves: a pill whose stop is ON the row lights it and MOVES NOTHING; one whose stop is off the
// row's edge lights it and pans. Leaving clears and the row returns to the cursor. A click still
// selects on the map and changes NOTHING in the dock. And OB-131 clause 3, open since 2026-09-05:
// a hover published by another pane lights the stop and draws NO preview card.
{
  await page.getByLabel('studio-inst-walkeditor').click()
  await page.waitForTimeout(500)
  await page.setViewportSize({ width: 880, height: 950 })
  await page.waitForTimeout(600)
  const road = page.locator('[data-road-root]')
  ok('the walk editor is on the desk beside the map', (await road.count()) === 1)
  if ((await dock().getAttribute('data-walk-dock')) !== 'open') { await map.getByLabel('show every stop').click(); await page.waitForTimeout(450) }
  await dock().focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(400)
  const row = () => dock().locator('[data-sb-off]')
  const rowW = await row().evaluate((el) => el.clientWidth)
  const stopCount = await dock().locator('[data-walk-dock-stop]').count()
  ok('the open row is NARROWER than the walk, so a stop can be off-screen (the condition the pan needs)', rowW < stopCount * 68, `row ${rowW}px for ${stopCount} stops`)
  const halo = (i) => dock().locator(`[data-walk-dock-mark="${i}"]`).evaluateAll((els) => (els.length ? getComputedStyle(els[0]).boxShadow : 'no mark hook'))
  const chips = road.locator('[data-rnode][data-node]')
  const nChips = await chips.count()
  const scroll0 = await row().evaluate((el) => el.scrollLeft)
  await chips.first().hover()
  await page.waitForTimeout(400)
  ok('OB-189 (2a): hovering the editor\'s FIRST pill lights dock stop 1 with a halo OUTSIDE its mark', (await halo(0)) !== 'none', await halo(0))
  ok('and MOVES NOTHING: the stop is on the row, so the row did not pan', Math.abs((await row().evaluate((el) => el.scrollLeft)) - scroll0) < 1)
  // the DS card is `aria-hidden`; the walk editor's own preview PANE shares the hook name and is not a card
  const dsCard = () => page.locator('[data-walk-preview][aria-hidden="true"]')
  ok('OB-189 (5) = OB-131 clause 3: no preview card for a hover published by another pane', (await dsCard().count()) === 0, (await dsCard().count()) ? 'card: ' + (await dsCard().first().innerText()).replace(/\n/g, ' | ') + ' at ' + JSON.stringify(await page.locator('[data-walk-preview]').first().boundingBox()) : '')
  ok('OB-189 (1): nothing was seeked — the readout is still stop 1', (await readout())?.cur === 1)
  await chips.nth(nChips - 1).hover()
  await page.waitForTimeout(500)
  const scroll1 = await row().evaluate((el) => el.scrollLeft)
  ok('OB-189 (2b): hovering the LAST pill lights the last stop and PANS the row to it (it was off the edge)', (await halo(stopCount - 1)) !== 'none' && scroll1 > scroll0 + 20, `scrollLeft ${scroll0} -> ${scroll1}`)
  ok('the first stop\'s halo went with the pointer', (await halo(0)) === 'none')
  await page.mouse.move(4, 4)
  await page.waitForTimeout(500)
  ok('OB-189 (3): leaving the pill clears the halo and the row returns to the cursor', (await halo(stopCount - 1)) === 'none' && Math.abs((await row().evaluate((el) => el.scrollLeft)) - scroll0) < 1, `scrollLeft back to ${await row().evaluate((el) => el.scrollLeft)} (was ${scroll0})`)
  // (4) a click in the editor selects on the MAP and changes NOTHING in the dock
  const rBefore = await readout()
  await chips.nth(1).click()
  await page.waitForTimeout(400)
  const sel = await map.locator('svg[data-sel]').getAttribute('data-sel').catch(() => null)
  ok('OB-189 (4): a click on a pill selects that node on the map', !!sel, `data-sel ${sel}`)
  await page.mouse.move(4, 4)
  await page.waitForTimeout(300)
  const halos = await Promise.all([...Array(stopCount).keys()].map(halo))
  ok('and changes NOTHING in the dock — no mark, no seek, no scroll', halos.every((h) => h === 'none') && JSON.stringify(await readout()) === JSON.stringify(rBefore) && Math.abs((await row().evaluate((el) => el.scrollLeft)) - scroll0) < 1, `${halos.filter((h) => h !== 'none').length} halos, readout ${JSON.stringify(await readout())}`)
}

// ── I. OB-199 (6)+(7): THE PRESENTER'S STRIP SHOWS THE SAME CARD — ADDRESS INCLUDED ──
// (last, on purpose: the Present preset replaces the desk.) The presenter wrapped the call as
// `renderStopPreview(play.steps[i])` and dropped `i`, so even with `StopCard` in place its card
// carried no number while the dock's did. The lecture IS the walk being played — the same draft,
// the same step order — so the presenter's card for stop k must be the dock's card for stop k,
// character for character, heading and address included.
{
  await page.setViewportSize({ width: 1750, height: 950 })
  await page.waitForTimeout(400)
  // the presenter draws its active stop's KNOB over that stop's tick, and the knob takes the
  // pointer — so the walk stands somewhere other than the stop under test before the switch
  const k = sameCard ? sameCard.k : 1
  await dock().focus()
  await page.keyboard.press(k === 0 ? 'End' : 'Home')
  await page.waitForTimeout(300)
  if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
    await page.locator('[data-toolbar-hook="palette-toggle"]').click()
    await page.waitForTimeout(500)
  }
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(1200)
  ok('the Present preset opens the presenter', (await page.locator('[aria-label="studio-presenter"]').count()) === 1)
  const tick = page.locator(`[data-presenter-tick="${k}"]`)
  const dot = page.locator(`[data-presenter-dot="${k}"]`)
  const mark = (await tick.count()) ? tick : dot
  if (sameCard && (await mark.count()) === 1) {
    // Playwright's own hover, not a move to a box read once: it waits for the mark to stop
    // moving, and the presenter is still settling from the preset switch and the resize above
    await page.mouse.move(4, 4)
    await mark.hover({ timeout: 5000 }).catch((e) => ok('the presenter\'s tick for the stop under test takes the pointer', false, String(e.message).split('\n')[0]))
    await page.waitForTimeout(350)
    const head = await cardText(stopCard().locator('[data-stop-card-head]'))
    ok('OB-199 (7): the presenter\'s card carries the ADDRESS, the same heading the dock\'s card has', head === sameCard.head, `presenter "${head}" vs dock "${sameCard.head}"`)
    ok('OB-199 (6): and the presenter\'s strip shows the SAME card as the dock for the same stop — the node\'s document included', (await cardText(stopCard())) === sameCard.text && sameCard.text.length > head.length + 20, `presenter ${(await cardText(stopCard())).length} chars vs dock ${sameCard.text.length}`)
    await page.mouse.move(4, 4)
  } else {
    ok('the presenter\'s strip draws the stop under test', false, sameCard ? `no [data-presenter-tick|dot="${k}"]` : 'no dock card was captured in C3')
  }
}

await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\nFAILED:\n' + errors.map((e) => '  ' + e).join('\n'))
  process.exit(1)
}
console.log(`\nall ${checks.length} checks passed`)
