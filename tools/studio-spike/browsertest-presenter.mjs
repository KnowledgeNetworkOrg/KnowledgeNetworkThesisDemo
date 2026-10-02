// browsertest-presenter.mjs — #267 (DS OB-135..138): presenter mode, parts 1–4, on the real app.
//
// A TEST. It works the mode's rules as the DS filed them, in a real browser with a REAL second
// window: the palette's Present is a preview (chip "Preview stop N", no clock, ■ disabled, nothing
// projected); the toolbar ▶ starts the lecture (the chrome goes, the clock starts at 00:00, the
// projector window opens and shows the live slide); the roll's neighbour advances the record and
// the projector follows; the strip's tick only ROAMS (chip "Roaming stop N", the record unchanged),
// the finder's ↵ roams too, the hold ring makes the roamed stop active — and still does with the
// PROJECTOR window in front, where the page gets no animation frames (OB-165); ■ → confirm ends
// the lecture (chrome back, chip "Lecture ended", projector dark); the ▶ then reads "resume" and
// resumes; the palette's Present after an end returns to the preview.
//
// The projector is a second page in the same browser context, caught off the `page` event the
// ▶ click raises — headless Edge opens it like any popup, so what the room would see is asserted
// off its DOM rather than printed as an environment truth.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-presenter.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startVite } from './devserver.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const require = createRequire(REPO + '/package.json')
const { chromium } = require('playwright-core')

const { vite, port: PORT } = await startVite()

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

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  // the three webfaces (tokens/fonts.css) load over the network — OB-200's fix — and a font
  // finishing mid-test between two close-together screenshots redraws whatever text it touches,
  // which the wall-map pixel-diff below reads as content moving. Settle it once, up front.
  await page.evaluate(() => document.fonts.ready)

  const playBtn = () => page.locator('[data-toolbar-hook="present"]')
  const chip = () => page.locator('[data-presenter-chip]')
  const chipText = async () => (await chip().innerText()).replace(/\s+/g, ' ').trim()
  const strip = () => page.locator('[data-presenter-strip]')
  // picking a preset closes the palette (OB-106); reopen it from the toolbar before the next pick
  const openPalette = async () => {
    if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
      await page.locator('[data-toolbar-hook="palette-toggle"]').click()
      await page.waitForTimeout(500)
    }
  }

  // ── the palette's Present is a PREVIEW ──────────────────────────────────────
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(700)
  ok('the Present preset opens the presenter as a preview, framed beside the chrome', (await page.locator('[aria-label="studio-presenter"]').count()) === 1 && (await page.locator('[aria-label="studio-header"]').count()) === 1)
  ok('the chip reads "Preview stop N"', /^Preview stop \d+$/.test(await chipText()), await chipText())
  ok('no clock is drawn anywhere on the screen', (await page.locator('[data-presenter-clock]').count()) === 0)
  ok('■ is disabled in the preview', await page.locator('[aria-label="end lecture"]').isDisabled())
  ok('the roll\'s live card reads "Not on the projector"', (await page.locator('[data-filmroll-label]').filter({ hasText: /Not on the projector/i }).count()) === 1)
  ok('the toolbar ▶ is pressable during the preview and reads "present"', !(await playBtn().isDisabled()) && (await playBtn().getAttribute('title')) === 'present')

  // ── ▶ turns the preview into the lecture, and projects ──────────────────────
  const [projector] = await Promise.all([
    context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
    playBtn().click(),
  ])
  // THE PRESENTER'S WINDOW COMES BACK TO THE FRONT. Opening the projector focuses it, and a
  // background window gets no animation frames from Chromium — the walk's own clock runs on
  // them (the hold ring's no longer does: OB-165, exercised on purpose further down with the
  // projector left in front). A professor's window is the one they are working in; this puts
  // the test's window in the same position.
  await page.bringToFront()
  await page.waitForTimeout(900)
  ok('▶ opened a second window — the projector', !!projector, projector ? projector.url() : 'no page event')
  ok('a live lecture hides the app chrome: no header, no toolbar, no palette', (await page.locator('[aria-label="studio-header"]').count()) === 0 && (await page.locator('[aria-label="studio-sidebar"]').count()) === 0)
  ok('the chip reads "Presenting stop N"', /^Presenting stop \d+$/.test(await chipText()), await chipText())
  ok('the clock starts at 00:0x of 50:00', /00:0\d\s*of 50:00/.test((await page.locator('[data-presenter-clock]').innerText()).replace(/\s+/g, ' ')), (await page.locator('[data-presenter-clock]').innerText()).replace(/\s+/g, ' '))
  ok('the roll\'s live card reads "On the projector now" with a running time', (await page.locator('[data-filmroll-label]').filter({ hasText: /On the projector now/i }).count()) === 1 && (await page.locator('[data-filmroll-elapsed]').count()) === 1)
  ok('the toolbar is gone, so the ▶ is not on screen', (await playBtn().count()) === 0)
  const liveTitle = async () => (await page.locator('[data-filmroll-card="live"] [data-slide-title]').innerText()).trim()
  const t1 = await liveTitle()
  if (projector) {
    projector.on('pageerror', (e) => errors.push('projector pageerror: ' + e.message))
    await projector.waitForSelector('[data-projector="live"]', { timeout: 8000 }).catch(() => null)
    ok('the projector shows the live slide — the same title the roll\'s live card shows', (await projector.locator('[data-slide-title]').count()) === 1 && (await projector.locator('[data-slide-title]').innerText()).trim() === t1, `roll "${t1}"`)
  }

  // ── the roll's next card advances the record; the projector follows ──────────
  await page.locator('[data-filmroll-card="neighbour"]').last().click()
  await page.waitForTimeout(600)
  const t2 = await liveTitle()
  ok('clicking the next card moves the record to the next stop', t2 !== t1 && /^Presenting stop \d+$/.test(await chipText()), `${t1} → ${t2} · ${await chipText()}`)
  if (projector) {
    await projector.waitForTimeout(300)
    ok('and the projector follows', (await projector.locator('[data-slide-title]').innerText()).trim() === t2)
  }
  const activeAfterStep = (await chipText()).match(/\d+/)[0]

  // ── a tick on the strip only ROAMS ───────────────────────────────────────────
  await page.locator('[data-presenter-tick="0"]').click()
  await page.waitForTimeout(400)
  ok('a click on a tick roams: the chip reads "Roaming stop 1"', (await chipText()) === 'Roaming stop 1', await chipText())
  ok('and the active node is unchanged: the pill still counts it', (await page.locator('[data-presenter-pill]').innerText()).startsWith(activeAfterStep + ' /'), await page.locator('[data-presenter-pill]').innerText())
  ok('the strip grew for the roaming labels (81, not 64)', Math.round((await strip().boundingBox()).height) === 81, String((await strip().boundingBox()).height))
  if (projector) {
    await projector.waitForTimeout(300)
    ok('the projector shows the ROAMED stop — the room follows where the professor looks', (await projector.locator('[data-slide-title]').innerText()).trim() !== t2)
  }
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(300)
  ok('Backspace ends the roam', /^Presenting stop/.test(await chipText()), await chipText())

  // ── the finder: J opens, typing a number selects, ↵ roams there ───────────────
  await page.keyboard.press('j')
  await page.waitForTimeout(400)
  ok('J opens the finder under the magnifier', (await page.locator('[data-stop-finder]').count()) === 1)
  await page.keyboard.type('3')
  await page.waitForTimeout(200)
  ok('typing "3" selects stop 3', (await page.locator('[data-stop-finder-row="2"][aria-selected="true"]').count()) === 1)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  ok('↵ roams there and closes the finder: chip "Roaming stop 3", active unchanged', (await chipText()) === 'Roaming stop 3' && (await page.locator('[data-stop-finder]').count()) === 0, await chipText())

  // ── the hold ring is the one gesture that makes a roamed stop active ─────────
  const ring = page.locator('[data-hold-ring]')
  ok('the roaming stop carries the hold ring', (await ring.count()) === 1)
  const rb = await ring.boundingBox()
  await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(900)
  await page.mouse.up()
  await page.waitForTimeout(300)
  ok('holding the ring makes stop 3 the active node', (await chipText()) === 'Presenting stop 3', await chipText())
  ok('the strip fell back to its closed height (64)', Math.round((await strip().boundingBox()).height) === 64, String((await strip().boundingBox()).height))

  // ── OB-165: the hold must not depend on animation frames ─────────────────────
  // With the PROJECTOR in front, Chromium stops this page's `requestAnimationFrame` outright
  // (measured below: a handful of frames in a second) while its intervals keep the full 16ms
  // cadence — the page still reports `visibilityState` "visible". A frame-driven hold clock
  // therefore never advanced: the ring filled to nothing and the commit was dead until the
  // presenter's own window came forward. The hold now ticks on an interval and reads
  // `performance.now()`, so this hold — begun and released entirely in the background — commits.
  // The frames are counted DURING the hold, not before it: they keep flowing for a couple of
  // seconds after the page goes to the background and only then stop (measured 2026-09-12 —
  // 61 frames in the first second, 2 in 1.5s once settled), so the page is given that settle
  // first. The frame count is its own check so that, should Chromium ever keep frames flowing
  // to a background page, the run says the condition is no longer being exercised rather than
  // quietly passing on a hold that never left the foreground.
  await page.locator('[data-presenter-tick="0"]').click()
  await page.waitForTimeout(400)
  ok('a second roam, to stop 1, ahead of the background hold', (await chipText()) === 'Roaming stop 1', await chipText())
  if (projector) {
    await projector.bringToFront()
    await projector.waitForTimeout(3000)
    const rb2 = await ring.boundingBox()
    await page.mouse.move(rb2.x + rb2.width / 2, rb2.y + rb2.height / 2)
    const framesDuringHold = page.evaluate(() => new Promise((res) => {
      let frames = 0
      const raf = () => { frames++; requestAnimationFrame(raf) }
      requestAnimationFrame(raf)
      setTimeout(() => res({ frames, visibility: document.visibilityState }), 900)
    }))
    await page.mouse.down()
    await page.waitForTimeout(900)
    await page.mouse.up()
    const bg = await framesDuringHold
    await page.waitForTimeout(300)
    ok('with the projector in front the presenter page got (almost) no animation frames during the hold — the state the hold must survive', bg.frames <= 5, `${bg.frames} frames in 900ms, visibility "${bg.visibility}"`)
    ok('a 900ms hold with the projector window in front still makes stop 1 the active node (OB-165)', (await chipText()) === 'Presenting stop 1', await chipText())
    // BACK IN FRONT, THE RECORD GOES BACK ON STOP 3: every check after the ■ was written against
    // it. This is also the focused-window control — the same gesture, frames flowing.
    await page.bringToFront()
    await page.waitForTimeout(300)
    await page.locator('[data-presenter-tick="2"]').click()
    await page.waitForTimeout(400)
    const rb3 = await ring.boundingBox()
    await page.mouse.move(rb3.x + rb3.width / 2, rb3.y + rb3.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(900)
    await page.mouse.up()
    await page.waitForTimeout(300)
    ok('back in front, a hold on stop 3 makes it the active node again — the record the later checks expect', (await chipText()) === 'Presenting stop 3', await chipText())
  } else {
    ok('the background hold ran', false, 'skipped: the projector window never opened')
  }

  // ── ■ → confirm ends the lecture; the chrome comes back ───────────────────────
  await page.locator('[aria-label="end lecture"]').click()
  await page.waitForTimeout(200)
  ok('■ asks first', (await page.locator('[role="dialog"][aria-label="end this lecture"]').count()) === 1)
  // ── OB-164: the pill's manners on the presenter's two pill surfaces — the header bar's
  // "keep going" (here) and the recap's closing action (below); photographed for the pull
  /** OB-164: the pill's computed manners — the three properties the DS's PillButton.jsx carries
   *  and every pill surface must draw: baseline alignment, a --space-1 gap, the glyph's 1px lift */
  const pillManners = (btn) => btn.evaluate((b) => {
    const cs = getComputedStyle(b)
    const g = b.querySelector('span')
    const gs = g ? getComputedStyle(g) : null
    return { alignItems: cs.alignItems, gap: cs.gap, glyph: !!g, glyphPos: gs && gs.position, glyphTop: gs && gs.top, glyphFs: gs && gs.fontSize, labelFs: cs.fontSize }
  })
  {
    const dialog = page.locator('[role="dialog"][aria-label="end this lecture"]')
    const km = await pillManners(dialog.getByRole('button', { name: 'keep going' }))
    ok('OB-164: the header bar\'s "keep going" pill aligns on the baseline with the --space-1 gap', km.alignItems === 'baseline' && km.gap === '4px', JSON.stringify(km))
    await dialog.screenshot({ path: 'tools/studio-spike/shots/ob164-headerbar-confirm.png' })
  }
  await page.getByRole('button', { name: 'end lecture' }).last().click()
  await page.waitForTimeout(700)
  ok('ending brings the app chrome back', (await page.locator('[aria-label="studio-header"]').count()) === 1 && (await playBtn().count()) === 1)
  ok('the chip reads "Lecture ended <total>"', /^Lecture ended \d\d:\d\d total$/.test(await chipText()), await chipText())
  {
    const closing = page.locator('[data-lecture-recap]').getByRole('button', { name: 'close the presenter' })
    ok('the recap\'s closing pill is on screen', (await closing.count()) === 1)
    const cm = await pillManners(closing)
    ok('OB-164: the recap\'s closing pill aligns on the baseline with the --space-1 gap', cm.alignItems === 'baseline' && cm.gap === '4px', JSON.stringify(cm))
    await closing.locator('xpath=..').screenshot({ path: 'tools/studio-spike/shots/ob164-recap-closing.png' })
  }
  ok('the toolbar ▶ reads "resume" and is pressable', (await playBtn().getAttribute('title')) === 'resume' && !(await playBtn().isDisabled()))
  if (projector) {
    await projector.waitForTimeout(300)
    ok('the projector went dark', (await projector.locator('[data-projector="dark"]').count()) === 1)
  }

  // ── ▶ resumes; the palette's Present after an end returns to the preview ─────
  await playBtn().click()
  await page.bringToFront()
  await page.waitForTimeout(700)
  ok('▶ resumes: the lecture is live again, chrome gone, chip "Presenting stop 3"', (await page.locator('[aria-label="studio-header"]').count()) === 0 && (await chipText()) === 'Presenting stop 3', await chipText())

  // ── OB-203: advancing the film roll plays a TRAVEL FRAME, so the direction is visible ────────────
  // The roll used to CUT: all three cards swapped contents between two frames and nothing on screen
  // said which way the lecture had just moved. Now every stop CHANGE slides the row of three cards one
  // step — half the live card + the gap + half the neighbour it trades places with — from the side it
  // came FROM, at half opacity, over `--dur-move`, and the chevron for that direction goes full weight
  // and leans 3px. THE ONLY WAY TO TELL A SLIDE FROM A SNAP IS TO SAMPLE IT MID-MOVE: "it ends up at
  // rest" is exactly what the broken build (a CSS transition that arrived after the row was home) also
  // did, and a screenshot cannot tell them apart. So each press below is watched frame by frame and an
  // INTERMEDIATE value has to exist.
  //
  // WHAT THESE PRESSES DO NOT DO IS MOVE THE RECORD: later checks (the wall's arrow count, "stop 3 of 7")
  // are written against stop 3 having been active and nothing else covered, so everything here is a
  // ROAM — which plays the slide exactly as a step does, because the roll is driven by the stop actually
  // on the wall — and the roam is ended at the close.
  const matrixTx = (m) => (!m || m === 'none' ? 0 : Number(m.match(/matrix\(([^)]+)\)/)[1].split(',')[4]))
  /** run `act()` while the roll's row and both chevrons are sampled on every animation frame */
  const sampleRoll = async (act, ms = 800) => {
    const sampling = page.evaluate((span) => new Promise((res) => {
      const row0 = document.querySelector('[data-filmroll-row]')
      const live = document.querySelector('[data-filmroll-card="live"]')
      const nb = document.querySelector('[data-filmroll-card="neighbour"]')
      const gap = parseFloat(getComputedStyle(row0).columnGap) || 0
      const step = (live.getBoundingClientRect().width + nb.getBoundingClientRect().width) / 2 + gap
      const durMove = getComputedStyle(row0).getPropertyValue('--dur-move').trim()
      const t0 = performance.now()
      const frames = []
      const tick = () => {
        const row = document.querySelector('[data-filmroll-row]')
        const cs = getComputedStyle(row)
        const chev = (label) => { const el = document.querySelector(`[data-filmroll] [aria-label="${label}"]`); return el ? getComputedStyle(el) : null }
        const nx = chev('next stop')
        const pv = chev('previous stop')
        frames.push({
          row: cs.transform, op: cs.opacity, inline: row.getAttribute('style') || '',
          next: nx ? nx.transform : 'none', nextOp: nx ? nx.opacity : null, prev: pv ? pv.transform : 'none', prevOp: pv ? pv.opacity : null,
          durations: row.getAnimations().map((a) => a.effect.getTiming().duration),
        })
        if (performance.now() - t0 < span) requestAnimationFrame(tick)
        else res({ frames, step, durMove })
      }
      requestAnimationFrame(tick)
    }), ms)
    await page.waitForTimeout(80)
    await act()
    return sampling
  }
  /** what a run of frames shows: the biggest displacement and its sign, whether an INTERMEDIATE value
   *  exists, how many separate slides were played, and where it ended */
  const readSlide = ({ frames, step, durMove }) => {
    const tx = frames.map((f) => matrixTx(f.row))
    const abs = tx.map(Math.abs)
    const peak = Math.max(...abs)
    let starts = 0
    let resting = true
    for (const a of abs) {
      if (resting && a > 0.4 * step) { starts++; resting = false } else if (a < 0.05 * step) resting = true
    }
    const last = frames[frames.length - 1]
    return {
      step, durMove, peak, dir: Math.sign(tx[abs.indexOf(peak)]), starts,
      mid: abs.some((a) => a > 0.1 * step && a < 0.9 * step),
      opMin: Math.min(...frames.map((f) => Number(f.op))),
      // the row's style may carry `will-change: transform` (a hint, moves nothing), so match the
      // PROPERTIES `transform:` / `opacity:`, not the word — `will-change: transform` contains it
      endsAtRest: matrixTx(last.row) === 0 && Number(last.op) === 1 && !/(^|;)\s*(transform|opacity)\s*:/.test(last.inline),
      nextLean: Math.max(...frames.map((f) => matrixTx(f.next))), prevLean: Math.min(...frames.map((f) => matrixTx(f.prev))),
      nextEnds: matrixTx(last.next), prevEnds: matrixTx(last.prev),
      durations: [...new Set(frames.flatMap((f) => f.durations))],
    }
  }
  const explain = (s) => `peak ${s.peak.toFixed(1)} of step ${s.step.toFixed(1)}, dir ${s.dir}, ${s.starts} slide(s), mid ${s.mid}, ends at rest ${s.endsAtRest}`
  await page.mouse.move(4, 4)

  // a ROAM to a non-adjacent stop, from the strip: stop 3 → stop 1, a jump BACK — it plays, toward the jump
  const jump = readSlide(await sampleRoll(() => page.locator('[data-presenter-tick="0"]').click()))
  ok('OB-203: a roam to a non-adjacent stop from the strip plays the slide, in the direction of the jump (back)', jump.starts === 1 && jump.peak >= 0.4 * jump.step && jump.dir === -1, explain(jump))
  ok('OB-203: SAMPLED MID-MOVE there is an INTERMEDIATE value — a slide, not a snap', jump.mid, explain(jump))
  ok('and the row ends at REST: no transform and no opacity of its own left in its style — kill the animation and the cards are home', jump.endsAtRest, explain(jump))
  ok('the row also fades in — it starts at half opacity', jump.opMin <= 0.75, `lowest opacity sampled ${jump.opMin}`)
  ok('the duration is the token\'s, `--dur-move`, read at play time', jump.durations.length > 0 && jump.durations.every((d) => `${d}ms` === (jump.durMove || '')), `animation durations ${JSON.stringify(jump.durations)} vs --dur-move ${jump.durMove}`)

  // → with NO MOUSE anywhere near the roll: the clause that proves `stopIndex` is wired
  await page.mouse.move(4, 4)
  const fwd = readSlide(await sampleRoll(() => page.keyboard.press('ArrowRight')))
  ok('OB-203: pressing → (no pointer near the roll) plays the SAME slide, in the matching direction (forward)', fwd.starts === 1 && fwd.dir === 1 && fwd.mid, explain(fwd))
  ok('and the chevron for that direction is at full weight and leans 3px outward while it runs, then is released', fwd.nextLean >= 2 && fwd.nextEnds === 0, `next chevron peak lean ${fwd.nextLean.toFixed(2)}px, ends ${fwd.nextEnds}px`)
  // ← has to LAND on a stop that still has one behind it: the previous chevron is only drawn when a
  // previous stop exists, and the jump above went to stop 1, so a single → then ← would come back to
  // stop 1 where there is no chevron to lean. One more → first (unsampled), so ← lands on stop 2.
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(500)
  const back = readSlide(await sampleRoll(() => page.keyboard.press('ArrowLeft')))
  ok('OB-203: pressing ← plays it the other way, and leans the OTHER chevron', back.starts === 1 && back.dir === -1 && back.mid && back.prevLean <= -2 && back.prevEnds === 0, `${explain(back)}; previous chevron lean ${back.prevLean.toFixed(2)}px`)
  ok('the chevrons are fixed furniture: they never travel with the row', fwd.nextEnds === 0 && back.prevEnds === 0)

  // a CLICK on the chevron: with `stopIndex` passed the roll's own click path is off, so ONE press is ONE slide
  const click = readSlide(await sampleRoll(() => page.locator('[data-filmroll] [aria-label="next stop"]').click()))
  ok('OB-203: one chevron click plays the slide ONCE — not once for the click and once for the index change', click.starts === 1 && click.mid && click.dir === 1, explain(click))
  await page.mouse.move(4, 4)

  // REDUCED MOTION cuts: `--dur-move` collapses to 1ms, so the animation is one millisecond long
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(200)
  const cut = readSlide(await sampleRoll(() => page.keyboard.press('ArrowLeft')))
  // the token collapses, and whatever animation was caught is that long — a 1ms animation can be gone
  // before the first frame samples it, so an EMPTY list is not a failure, but the token reading is
  ok('OB-203: with prefers-reduced-motion the roll CUTS — `--dur-move` reads 1ms and the animation is that long, not the normal 200', cut.durMove === '1ms' && cut.durations.every((d) => d <= 2), `--dur-move ${cut.durMove}; animation durations ${JSON.stringify(cut.durations)}`)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.waitForTimeout(200)

  // end the roam: back on the record, which none of this moved
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(700)
  ok('the roam ends where the record is — the presses above never moved it (stop 3)', (await chipText()) === 'Presenting stop 3', await chipText())

  // ── OB-246: the open strip SPANS THE ROW; `pitch` is a floor, not the spacing ────────────────────
  // The closed rail has always spread its ticks across its own width, while the open row placed dots at
  // the CONSTANT `PRESENTER_STRIP_METRICS.pitch` either side of centre, so its drawn span was a function
  // of the stop COUNT and every pixel of spare width went unused: opening the strip made the same walk
  // look squashed. Measured off the running page, in screen px, because the fault is a comparison of two
  // modes' reach: the drawn spacing never falls under the floor (68) once the row is wide enough to label
  // anything, and the outermost DRAWN stops sit as far out as the row lets a labelled (36) or unlabelled
  // peek (9) end sit — where the constant pitch left this walk in a huddle in the middle of a 1.7k pane.
  const closedTicks = await page.locator('[data-presenter-tick]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.x + r.width / 2 }))
  const railSpan = Math.max(...closedTicks) - Math.min(...closedTicks)
  await page.keyboard.press('e')
  await page.waitForTimeout(700)
  ok('E opens the strip', (await strip().getAttribute('data-presenter-strip')) === 'open')
  const rowBox = await page.locator('[data-presenter-row]').boundingBox()
  const openDots = (await page.locator('[data-presenter-dot]').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect()
    return { i: Number(e.getAttribute('data-presenter-dot')), x: r.x + r.width / 2, op: Number(getComputedStyle(e).opacity) }
  }))).filter((d) => d.op > 0.05).sort((a, b) => a.i - b.i)
  const gaps = openDots.slice(1).map((d, k) => d.x - openDots[k].x)
  ok('OB-246: the open row draws stops', openDots.length >= 2, `${openDots.length} drawn of ${closedTicks.length}`)
  ok('the drawn spacing never falls below the published floor (68px) — `pitch` is a floor', gaps.every((g) => g >= 68 - 0.5), `spacings ${gaps.map((g) => g.toFixed(1)).join(', ')}`)
  const leftReach = openDots[0].x - rowBox.x
  const rightReach = rowBox.x + rowBox.width - openDots[openDots.length - 1].x
  ok('the outermost drawn stops sit as close to the pane\'s edges as a labelled end (36) or a peek (9) allows — the walk SPANS the row, not a huddle at its centre', leftReach <= 40 && rightReach <= 40, `left reach ${leftReach.toFixed(1)}px, right reach ${rightReach.toFixed(1)}px of a ${Math.round(rowBox.width)}px row (closed rail spans ${Math.round(railSpan)}px)`)
  ok('and the drawn span is most of the row it was given', (openDots[openDots.length - 1].x - openDots[0].x) / rowBox.width >= 0.9, `${Math.round(openDots[openDots.length - 1].x - openDots[0].x)} of ${Math.round(rowBox.width)}px`)
  ok('the "back to the active node" marker is absent while the active stop is IN the drawn window — even where a spread row puts a dot a long way from the edge', (await page.locator('[data-presenter-strip="open"] [aria-label="back to the active node"]').count()) === 0)
  await page.screenshot({ path: 'tools/studio-spike/shots/ob246-open-strip.png', clip: { x: rowBox.x - 20, y: rowBox.y - 60, width: rowBox.width + 40, height: 150 } })
  await page.keyboard.press('e')
  await page.waitForTimeout(500)
  ok('E closes it again, to the closed height (64)', Math.round((await strip().boundingBox()).height) === 64, String((await strip().boundingBox()).height))

  // ── M puts the map on the wall; a second M takes it down (OB-139) ───────────
  const liveCard = () => page.locator('[data-filmroll-card="live"]')
  const caption = async () => ((await liveCard().locator('[data-projected-caption]').count()) ? (await liveCard().locator('[data-projected-caption]').innerText()).replace(/\s+/g, ' ') : '')
  await page.keyboard.press('m')
  await page.waitForTimeout(1200)
  ok('M puts the map on the roll\'s live card', (await liveCard().locator('[data-projected-map]').count()) === 1)
  ok('with the caption "where we are · stop 3 of 7 / Territory › Stop"', /where we are · stop 3 of 7/i.test(await caption()) && /›/.test(await caption()), await caption())
  ok('the neighbours stay slides', (await page.locator('[data-filmroll-card="neighbour"] [data-projected-map]').count()) === 0)
  ok('the live label still reads "On the projector now"', (await page.locator('[data-filmroll-label]').filter({ hasText: /On the projector now/i }).count()) === 1)
  const pins0 = await liveCard().locator('[data-routestop]').count()
  const arrows0 = await liveCard().locator('[data-routearrow]').count()
  ok('the map on the wall carries the walk\'s pins, unbanded (every pin drawn)', pins0 >= 3, `${pins0} pins, ${arrows0} arrows`)
  // THIS USED TO LOOK FOR `[aria-label="map-level"], [data-levelpicker]`. Neither
  // name has ever existed in the app: the level control is a DS LevelPicker whose
  // button is labelled "levels", and the zoom control beside it "zoom in"/"zoom out".
  // So that half of the check passed no matter what was on the wall — a green tick
  // for a question never asked. Found by src/studio/browsertestguard.test.ts.
  const wallChrome = await liveCard().locator('[aria-label="levels"], [aria-label="zoom in"], [aria-label="zoom out"]').count()
  ok('and no dock, no floating chrome on the wall', (await liveCard().locator('[data-walk-dock]').count()) === 0 && wallChrome === 0, `${wallChrome} floating controls`)
  if (projector) {
    await projector.waitForTimeout(600)
    ok('the projector shows the map too', (await projector.locator('[data-projected-map]').count()) === 1)
  }
  // ── OB-163: THE WALL FITS THE WHOLE WALK ONCE, THEN NEVER MOVES ──────────────────
  // The owner's ruling (2026-09-06): the map on the wall fits, at the moment it first goes up, to
  // the extent of EVERY stop — not the covered ones, which would re-frame on each arrival — and
  // holds that frame for the rest of the lecture. Advancing, roaming, and taking the map down
  // and putting it back up all leave the camera exactly where it is. Measured: (1) every pin is
  // inside the frame, clear of the caption and the foot, and the walk FILLS the wall rather than
  // sitting in a corner of a province; (2) → and a roam leave the scene transform byte-identical
  // AND two screenshots of the map slot pixel-identical outside the pins, the walk line and the
  // caption; (3) M down then M up returns the same transform. Also: the map is drawn at the
  // box's TRUE size — it used to measure itself through `WallTransition`'s scale(0.3) mount and
  // drew every label and pin 3.3× too large for the whole lecture (a pin box of 73px for a 22px pin).
  const wallMap = () => liveCard().locator('[data-projected-map]')
  const camera = () => wallMap().locator('svg').first().evaluate((svg) => svg.querySelector('defs + g').getAttribute('transform'))
  const boxesOf = (sel) => liveCard().locator(sel).evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } }))
  const inside = (b, r) => b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h
  /** how deep two boxes intersect, 0 or less when they do not — the caption's box ends on the
   *  line box's descender edge, so a fit that is right to the pixel can still graze it by a
   *  fraction; the check below allows 1px of this and nothing more */
  const overlapDepth = (a, b) => Math.min(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  const svgBox = (await boxesOf('[data-projected-map] svg'))[0]
  // THE VISIBLE CARD, not the svg's own box (what a pin must lie inside — the room cannot see
  // an svg that runs past the card). `inside` wants w/h; boundingBox gives width/height.
  const cardRect = await liveCard().boundingBox()
  const cardBox = { x: cardRect.x, y: cardRect.y, w: cardRect.width, h: cardRect.height }
  const pinsUp = await boxesOf('[data-routestop]')
  const capBox = (await boxesOf('[data-projected-caption]'))[0]
  const wallFoot = (await boxesOf('[data-projected-map-foot]'))[0]
  // THE MAP'S DRAWING BOX IS THE SLOT ABOVE THE FOOT, measured on screen. It used to be the
  // svg's own 1440:960 viewBox ratio — 686×457 in a 686×365 slot — so the wall fit believed it
  // had 92px more room than the card shows and stop 7's pin drew under the foot and off the
  // card while every check here still passed: they measured the svg's box, not the card's.
  const slotH = wallFoot ? wallFoot.y - svgBox.y : 0
  ok('OB-163 (1): the map is sized to its slot above the foot, not to the viewBox\'s own 3:2 ratio', svgBox.h <= slotH + 1, `svg ${Math.round(svgBox.h)} tall in a ${Math.round(slotH)} tall slot`)
  ok('OB-163 (1): with the map up, the VISIBLE card already contains EVERY stop\'s pin', pinsUp.length >= 3 && pinsUp.every((b) => inside(b, cardBox)), `${pinsUp.filter((b) => !inside(b, cardBox)).length} of ${pinsUp.length} pins outside the ${Math.round(cardBox.w)}×${Math.round(cardBox.h)} card`)
  ok('clear of the caption and clear ABOVE the foot band — a pin below the foot is off the card, not clear of it', !!capBox && !!wallFoot && pinsUp.every((b) => overlapDepth(b, capBox) <= 1 && b.y + b.h <= wallFoot.y + 0.5), `${pinsUp.filter((b) => overlapDepth(b, capBox) > 1).length} pins overlap the caption, ${pinsUp.filter((b) => b.y + b.h > wallFoot.y + 0.5).length} dip below the foot`)
  const cx = pinsUp.map((b) => b.x + b.w / 2), cy = pinsUp.map((b) => b.y + b.h / 2)
  const extW = Math.max(...cx) - Math.min(...cx), extH = Math.max(...cy) - Math.min(...cy)
  ok('and the walk FILLS the wall rather than sitting in a corner: the pins\' extent spans at least 60% of the frame on one axis', extW / svgBox.w >= 0.6 || extH / svgBox.h >= 0.6, `extent ${Math.round(extW)}×${Math.round(extH)} in ${Math.round(svgBox.w)}×${Math.round(svgBox.h)}`)
  ok('the map is drawn at the box\'s TRUE size, not the size it measured through the mount transform: a pin is at most its 22px, never 73', pinsUp.every((b) => b.w <= 26), `pin widths ${pinsUp.map((b) => b.w.toFixed(0)).join(', ')}`)
  /** two screenshots of the map slot compared pixel by pixel IN THE PAGE (a canvas, no PNG
   *  library), skipping the masks — rects in CSS px relative to the slot */
  const maskedDiff = async (a, b, masks) => {
    const slot = (await boxesOf('[data-projected-map]'))[0]
    // PADDED: a stroke and a shadow draw outside a <g>'s geometric box. 10, not 6 — on the
    // corrected wall box (the pin's box is now the real 22px at the fitted camera) the lit
    // pin's own pill edge, changing face as the walk advances, lands up to 7px outside the
    // box, and a 6px pad counted that allowed change as camera movement.
    const rel = masks.map((m) => ({ x: m.x - slot.x - 10, y: m.y - slot.y - 10, w: m.w + 20, h: m.h + 20 }))
    return page.evaluate(async ({ a, b, masks, sw }) => {
      const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + src })
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const w = ia.width, h = ia.height, k = w / sw
      const data = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data }
      const da = data(ia), db = data(ib)
      let diff = 0, compared = 0, bx0 = w, by0 = h, bx1 = 0, by1 = 0
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (masks.some((m) => x >= m.x * k && x < (m.x + m.w) * k && y >= m.y * k && y < (m.y + m.h) * k)) continue
        compared++
        const i = (y * w + x) * 4
        if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) { diff++; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y) }
      }
      return { diff, compared, where: diff ? `x ${Math.round(bx0 / k)}..${Math.round(bx1 / k)} y ${Math.round(by0 / k)}..${Math.round(by1 / k)} (slot px)` : '' }
    }, { a, b, masks: rel, sw: slot.w })
  }
  // what a step or a roam is ALLOWED to change: the pins, the walk line, the lit cell (its spotlight and its bold name), the caption, and the roll's clock
  const litLabel = async () => { const id = await liveCard().locator('svg[data-sel]').first().getAttribute('data-sel').catch(() => null); return id ? boxesOf(`[data-label="${id}"]`) : [] }
  const moving = async () => [...(await boxesOf('[data-routestop]')), ...(await boxesOf('[data-routearrow]')), ...(await boxesOf('[data-spot]')), ...(await litLabel()), ...(await boxesOf('[data-projected-caption]')), ...(await page.locator('[data-filmroll-label]').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })))]
  const cam0 = await camera()
  const masks0 = await moving()
  const shot0 = (await wallMap().screenshot()).toString('base64')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(600)
  const arrows1 = await liveCard().locator('[data-routearrow]').count()
  ok('→ with the map up: the caption advances and the map stays up', /stop 4 of 7/i.test(await caption()) && (await liveCard().locator('[data-projected-map]').count()) === 1, await caption())
  ok('the walk line grew by the stop just covered', arrows1 > arrows0, `${arrows0} → ${arrows1}`)
  ok('OB-163 (2): → moved the lit pin and the caption and left the camera IDENTICAL — the scene transform is byte-for-byte the same', (await camera()) === cam0, `${cam0} -> ${await camera()}`)
  const shot1 = (await wallMap().screenshot()).toString('base64')
  const d1 = await maskedDiff(shot0, shot1, [...masks0, ...(await moving())])
  // STILL means still: 0 differing pixels was the reading on every run in isolation before the
  // OB-200 font fix; under a parallel load a single anti-aliased pixel at a mask's edge had flaked
  // once (1 of 209,851). Since tokens/fonts.css started actually loading Nunito/Quicksand/JetBrains
  // Mono (they never had before — the Google @import that was meant to supply them followed a CSS
  // rule and was silently dropped, so every string on this map drew in the fallback system font),
  // the SAME two renders of the identical DOM differ by 10-11 anti-aliased pixels reliably: a real
  // webfont's rasterization is not perfectly deterministic frame to frame the way the fallback's
  // was, at whatever text sits in this crop. Raised with headroom rather than re-measured exactly,
  // because the point of the gate is unchanged — the readout prints the number, and a camera move
  // differs by thousands, not tens.
  const STILL = 30
  ok('and pixel-wise, outside the pins, the walk line, the spotlight and the caption, the two screenshots are ONE picture', d1.compared > 100000 && d1.diff <= STILL, `${d1.diff} of ${d1.compared} compared pixels differ ${d1.where}`)
  await page.keyboard.press('j')
  await page.waitForTimeout(300)
  await page.keyboard.type('6')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  ok('a roam with the map up (J, 6, ↵): the chip reads "Roaming stop 6" and the caption follows', (await chipText()) === 'Roaming stop 6' && /stop 6 of 7/i.test(await caption()), `${await chipText()} / ${await caption()}`)
  ok('OB-163 (2): the roam moved the lit pin and the caption, and the camera is STILL identical', (await camera()) === cam0)
  const shot2 = (await wallMap().screenshot()).toString('base64')
  const d2 = await maskedDiff(shot0, shot2, [...masks0, ...(await moving())])
  ok('pixel-wise too', d2.compared > 100000 && d2.diff <= STILL, `${d2.diff} of ${d2.compared} compared pixels differ ${d2.where}`)
  await wallMap().screenshot({ path: 'tools/studio-spike/shots/ob163-wall-after.png' }) // for the receipt; shots/ is gitignored
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(300)
  await page.keyboard.press('m')
  await page.waitForTimeout(1500)
  ok('a second M brings the slide back', (await liveCard().locator('[data-projected-map]').count()) === 0 && (await liveCard().locator('[data-slide-title]').count()) === 1)
  await page.keyboard.press('m')
  await page.waitForTimeout(1200)
  ok('OB-163 (3): M down then M up returns the SAME frame, not a fresh fit', (await liveCard().locator('[data-projected-map]').count()) === 1 && (await camera()) === cam0, `${cam0} -> ${await camera()}`)
  await page.keyboard.press('m')
  await page.waitForTimeout(1500)

  // ── what the room actually SEES on a slide (DS OB-172, closing #217) ─────────
  // The owner's ruling: "the room (projector) should see just the thing being projected
  // on the projector, which is the contents of the node's document so far". So the slide
  // draws the NODE'S DOCUMENT, not the walk's note about the stop — the wall shows the
  // corpus, the tour through it is the professor's business.
  //
  // Asserted as a DIFFERENCE, not just as presence: the slide printed the note until
  // 2026-09-12, and a note is a non-empty string too, so "the body has text in it" would
  // have passed for the whole time the wall was wrong.
  const slideBody = async () => (await liveCard().locator('[data-slide-body]').innerText()).replace(/\s+/g, ' ').trim()
  const body = await slideBody()
  ok('the slide draws a body at all', body.length > 20, JSON.stringify(body.slice(0, 60)))
  // the presenter's own notes column holds the stop's note (or the prepared note that
  // falls back to it). Whatever it holds, the wall must not be showing the same thing.
  const notesText = ((await page.locator('[data-lecture-notes]').count())
    ? (await page.locator('[data-lecture-notes]').innerText()).replace(/\s+/g, ' ').trim()
    : '')
  ok('and it is NOT the professor\'s notes column — neither column is ever projected (OB-166)',
    notesText === '' || !notesText.includes(body), `notes ${notesText.length} chars, body ${body.length}`)

  // ── pressing M moves nothing but the content (OB-172 clause 3) ─────────────
  // `ProjectedMap` 6b pins the map's foot to the same band the slide's own foot occupies,
  // precisely so the flip never shifts the picture. Measured rather than trusted: the two
  // feet are different elements in different components, which is exactly how a band
  // drifts. The owner asked whether the foot should stay at all; it stays because
  // dropping it would make M shift everything up, and this is the check that says so.
  const footBox = await liveCard().locator('[data-slide-foot]').boundingBox()
  await page.keyboard.press('m')
  await page.waitForTimeout(1200)
  /* THE MAP'S FOOT CARRIES NO HOOK OF ITS OWN, so it is found by structure — the last child
     of the map, which `ProjectedMap` renders only when the host passes a `footer`. A
     structural selector is exactly the kind that rots in silence, so this one CHECKS WHAT IT
     FOUND: a band under 60px tall (the 32px slot, scaled) carrying a top border. If the map's
     layout changes shape, this fails saying so rather than measuring some other box. */
  // OB-177: the foot carries `data-projected-map-foot` now (the DS named it beside the equal-band
  // guarantee, on this driver's offer), so it is selected rather than located by structure. The
  // validate-what-you-found check stays: it is what caught the hook's absence.
  const mapFoot = await liveCard().locator('[data-projected-map-foot]').boundingBox()
  const mapFootIsABand = await page.evaluate(() => {
    const el = document.querySelector('[data-filmroll-card="live"] [data-projected-map-foot]')
    if (!el) return 'no [data-projected-map-foot]'
    const cs = getComputedStyle(el)
    if (parseFloat(cs.borderTopWidth) < 0.5) return 'no top border: ' + cs.borderTopWidth
    if (el.getBoundingClientRect().height > 60) return 'too tall: ' + el.getBoundingClientRect().height
    return 'ok'
  })
  ok('the element measured as the map\'s foot really is one', mapFootIsABand === 'ok', String(mapFootIsABand))
  await page.keyboard.press('m')
  await page.waitForTimeout(1200)
  const footBack = await liveCard().locator('[data-slide-foot]').boundingBox()
  const near = (a, b, tol) => a !== null && b !== null && Math.abs(a - b) <= tol
  ok('the map\'s foot lands in the SAME band as the slide\'s — M moves the content, not the frame',
    footBox && mapFoot && near(footBox.y, mapFoot.y, 2) && near(footBox.height, mapFoot.height, 2),
    `slide foot y=${footBox && footBox.y.toFixed(1)} h=${footBox && footBox.height.toFixed(1)} | map foot y=${mapFoot && mapFoot.y.toFixed(1)} h=${mapFoot && mapFoot.height.toFixed(1)}`)
  ok('and the slide comes back to the band it left',
    footBox && footBack && near(footBox.y, footBack.y, 2), `${footBox && footBox.y.toFixed(1)} -> ${footBack && footBack.y.toFixed(1)}`)
  // full screen: the ✕ is a second M, never a way out of full screen (rule 7)
  const lb = await liveCard().boundingBox()
  await page.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2)
  await page.waitForTimeout(300)
  await page.locator('[aria-label="full screen"]').click()
  await page.waitForTimeout(400)
  ok('the expand button opens full screen', (await page.locator('[data-presenter-fullscreen]').count()) === 1)
  await page.keyboard.press('m')
  await page.waitForTimeout(1200)
  ok('in full screen the map comes up with a ✕', (await page.locator('[data-presenter-fullscreen] [aria-label="close the map"]').count()) === 1)
  const fb = await page.locator('[data-presenter-fullscreen] [data-projected-map]').boundingBox()
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2)
  await page.waitForTimeout(300)
  await page.locator('[data-presenter-fullscreen] [aria-label="close the map"]').click({ force: true })
  await page.waitForTimeout(1500)
  ok('the ✕ is exactly a second M: the map comes down and the room STAYS in full screen', (await page.locator('[data-presenter-fullscreen]').count()) === 1 && (await page.locator('[data-presenter-fullscreen] [data-projected-map]').count()) === 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('Escape leaves full screen', (await page.locator('[data-presenter-fullscreen]').count()) === 0)
  await page.locator('[aria-label="end lecture"]').click()
  await page.getByRole('button', { name: 'end lecture' }).last().click()
  await page.waitForTimeout(600)
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(600)
  ok('the palette\'s Present after an end returns to the PREVIEW', /^Preview stop \d+$/.test(await chipText()) && (await page.locator('[data-presenter-clock]').count()) === 0, await chipText())
  await openPalette()
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(600)
  ok('picking a composition preset leaves the presenter', (await page.locator('[data-presenter-header]').count()) === 0 && (await page.locator('[aria-label="studio-pane-map"]').count()) === 1)
  ok('no page errors', errors.filter((e) => e.includes('pageerror')).length === 0)
} catch (e) {
  errors.push('exception: ' + (e && e.stack || e))
}

await page.evaluate(() => localStorage.clear()).catch(() => {})
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log(`\n${checks.length} checks passed`)
