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
import { spawn } from 'node:child_process'

const REPO = 'D:/ShiZhong/MyCode/KnowledgeNetworkThesisDemo'
const PORT = 5240

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

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)

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
  await page.getByRole('button', { name: 'end lecture' }).last().click()
  await page.waitForTimeout(700)
  ok('ending brings the app chrome back', (await page.locator('[aria-label="studio-header"]').count()) === 1 && (await playBtn().count()) === 1)
  ok('the chip reads "Lecture ended <total>"', /^Lecture ended \d\d:\d\d total$/.test(await chipText()), await chipText())
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
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const svgBox = (await boxesOf('[data-projected-map] svg'))[0]
  const pinsUp = await boxesOf('[data-routestop]')
  const capBox = (await boxesOf('[data-projected-caption]'))[0]
  const wallFoot = (await boxesOf('[data-projected-map-foot]'))[0]
  ok('OB-163 (1): with the map up, the frame already contains EVERY stop\'s pin', pinsUp.length >= 3 && pinsUp.every((b) => inside(b, svgBox)), `${pinsUp.filter((b) => !inside(b, svgBox)).length} of ${pinsUp.length} pins outside the ${Math.round(svgBox.w)}×${Math.round(svgBox.h)} frame`)
  ok('clear of the caption and the foot', !!capBox && !!wallFoot && pinsUp.every((b) => !overlaps(b, capBox) && !overlaps(b, wallFoot)))
  const cx = pinsUp.map((b) => b.x + b.w / 2), cy = pinsUp.map((b) => b.y + b.h / 2)
  const extW = Math.max(...cx) - Math.min(...cx), extH = Math.max(...cy) - Math.min(...cy)
  ok('and the walk FILLS the wall rather than sitting in a corner: the pins\' extent spans at least 60% of the frame on one axis', extW / svgBox.w >= 0.6 || extH / svgBox.h >= 0.6, `extent ${Math.round(extW)}×${Math.round(extH)} in ${Math.round(svgBox.w)}×${Math.round(svgBox.h)}`)
  ok('the map is drawn at the box\'s TRUE size, not the size it measured through the mount transform: a pin is at most its 22px, never 73', pinsUp.every((b) => b.w <= 26), `pin widths ${pinsUp.map((b) => b.w.toFixed(0)).join(', ')}`)
  /** two screenshots of the map slot compared pixel by pixel IN THE PAGE (a canvas, no PNG
   *  library), skipping the masks — rects in CSS px relative to the slot */
  const maskedDiff = async (a, b, masks) => {
    const slot = (await boxesOf('[data-projected-map]'))[0]
    const rel = masks.map((m) => ({ x: m.x - slot.x - 6, y: m.y - slot.y - 6, w: m.w + 12, h: m.h + 12 })) // padded: a stroke and a shadow draw outside a <g>'s geometric box
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
  ok('and pixel-wise, outside the pins, the walk line, the spotlight and the caption, the two screenshots are ONE picture', d1.compared > 100000 && d1.diff === 0, `${d1.diff} of ${d1.compared} compared pixels differ ${d1.where}`)
  await page.keyboard.press('j')
  await page.waitForTimeout(300)
  await page.keyboard.type('6')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(600)
  ok('a roam with the map up (J, 6, ↵): the chip reads "Roaming stop 6" and the caption follows', (await chipText()) === 'Roaming stop 6' && /stop 6 of 7/i.test(await caption()), `${await chipText()} / ${await caption()}`)
  ok('OB-163 (2): the roam moved the lit pin and the caption, and the camera is STILL identical', (await camera()) === cam0)
  const shot2 = (await wallMap().screenshot()).toString('base64')
  const d2 = await maskedDiff(shot0, shot2, [...masks0, ...(await moving())])
  ok('pixel-wise too', d2.compared > 100000 && d2.diff === 0, `${d2.diff} of ${d2.compared} compared pixels differ ${d2.where}`)
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
