// browsertest-presenter-panes.mjs — #267 (DS OB-145/146/147): presenter mode, parts 6–8, on the
// real app: the notes pane, the quick actions deck, and the recap the lecture ends into.
//
// A TEST, not a screenshot driver. It works the three panes as the DS filed them:
//   · the notes pane shows the SHOWN stop's prepared note, and says so when you roam away;
//   · a note typed and sent lands in the During column with its time and its category tag, filed
//     against the stop it was written about — so roaming to another stop hides it and coming back
//     shows it again, and a note written WHILE ROAMING files against the stop being read rather
//     than the one the class is seeing;
//   · a category the professor mints is theirs, and is offered again at the next stop and after
//     a reload;
//   · the prepared note is click-to-edit IN PLACE and the correction survives a reload, without
//     touching the walk the note was authored on;
//   · the deck draws eight undecided slots and keeps six real actions on the shelf behind More;
//   · a shelf tile RUNS its action (Project the map puts the map on the wall);
//   · dragging a shelf action onto a slot swaps them, and the arrangement survives a reload;
//   · ending the lecture replaces the row with the recap: the three counts, the same notes grouped
//     under the stops they were written about (since flags v4 there is no separate flagged
//     list), and a way out.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-presenter-panes.mjs
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

  const openPalette = async () => {
    if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
      await page.locator('[data-toolbar-hook="palette-toggle"]').click()
      await page.waitForTimeout(500)
    }
  }
  const notes = () => page.locator('[data-lecture-notes="live"]')
  const during = () => page.locator('[data-notes-during]')
  const prepared = () => page.locator('[data-notes-prepared]')
  // THE SHELF RENDERS INSIDE THE DECK'S OWN PANE, so "a tile in the panes row" is both. The
  // deck's scroller carries `data-quick-deck`; that is what separates the hand from the drawer.
  const deck = () => page.locator('[data-quick-deck] [data-quick-action]')
  const rows = async () => (await during().locator('[data-lecture-note]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
  // the composer keeps focus after the send, and every one of the screen's keys deliberately
  // steps aside for a focused field - so leave it before pressing an arrow or a letter, the
  // way a professor does by looking back up at the slide
  const leaveField = () => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  // ⏎ in the composer saves; the field must have focus first, and typing anywhere else would be
  // read by the screen's own single-letter shortcuts instead
  const write = async (text) => {
    await notes().getByLabel('a note for this slide…').click()
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
  }

  // ── the lecture starts, and the row under the strip has both panes ──────────
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(700)
  await page.locator('[data-toolbar-hook="present"]').click()
  await page.waitForTimeout(900)
  await page.bringToFront()
  ok('the panes row carries the notes pane and the quick actions deck, side by side',
    (await notes().count()) === 1 && (await page.locator('[data-presenter-panes] [data-quick-shelf-toggle]').count()) === 1)
  const preparedText = (await prepared().innerText()).replace(/\s+/g, ' ').trim()
  ok('the prepared column says plainly that nothing was written for this slide, rather than going blank',
    /nothing was written for this slide\./.test(preparedText) && preparedText.length > 30, preparedText.slice(0, 70))
  ok('the During column starts empty', (await during().locator('[data-lecture-note]').count()) === 0)

  // ── the divider between the notes and the deck (OB-254) ─────────────────────
  // The strip follows PaneDivider's resting rule: 14px, ew-resize, and nothing painted until
  // the pointer is on it. Its floors come from the panes' own fits, so the test reads the DOM.
  await page.mouse.move(2, 2)
  await page.waitForTimeout(200)
  const strip = page.locator('[data-presenter-panes] > [role="separator"]').first()
  ok('the notes and deck are joined by a 14px blank, ew-resize strip', await strip.evaluate((el) => {
    const line = el.querySelector('[aria-hidden="true"]')
    const bg = line ? getComputedStyle(line).backgroundColor : ''
    return Math.round(el.getBoundingClientRect().width) === 14
      && getComputedStyle(el).cursor === 'ew-resize'
      && (bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)')
  }))
  const widths = () => page.evaluate(() => {
    const row = document.querySelector('[data-presenter-panes]')
    const notesEl = document.querySelector('[data-lecture-notes="live"]')
    const deckEl = document.querySelector('[data-quick-deck]')
    const deck = deckEl && deckEl.closest('[data-pane-frame]')
    return {
      row: row ? row.getBoundingClientRect().width : 0,
      notes: notesEl ? notesEl.getBoundingClientRect().width : 0,
      deck: deck ? deck.getBoundingClientRect().width : 0,
    }
  })
  const start = await widths()
  const handle = await strip.boundingBox()
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(1700, handle.y + handle.height / 2, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const atDeckFloor = await widths()
  ok('dragging the handle right stops the deck at its 300px floor', Math.abs(atDeckFloor.deck - 300) <= 1, Math.round(atDeckFloor.deck) + 'px')
  ok('and only that boundary moved — the row is still notes + strip + deck',
    Math.abs(atDeckFloor.row - (atDeckFloor.notes + 14 + atDeckFloor.deck)) <= 1,
    `${Math.round(atDeckFloor.notes)} + 14 + ${Math.round(atDeckFloor.deck)} vs ${Math.round(atDeckFloor.row)}`)
  const handle2 = await strip.boundingBox()
  await page.mouse.move(handle2.x + handle2.width / 2, handle2.y + handle2.height / 2)
  await page.mouse.down()
  await page.mouse.move(40, handle2.y + handle2.height / 2, { steps: 16 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const atNotesFloor = await widths()
  ok('dragging the handle left stops the notes pane at its 522px floor', Math.abs(atNotesFloor.notes - 522) <= 1, Math.round(atNotesFloor.notes) + 'px')
  // A stored (or dragged) wide deck must not push the handle off a narrow window: the drawn
  // width is derived from the measured row, and it is the notes pane that gives way.
  await page.setViewportSize({ width: 700, height: 950 })
  await page.waitForTimeout(700)
  const narrowPanes = await page.evaluate(() => {
    const h = document.querySelector('[data-presenter-panes] > [role="separator"]')
    const r = document.querySelector('[data-presenter-panes]')
    const notesEl = document.querySelector('[data-lecture-notes="live"]')
    if (!h || !r) return null
    const hb = h.getBoundingClientRect(), rb = r.getBoundingClientRect()
    return { left: hb.left, right: hb.right, rowLeft: rb.left, rowRight: rb.right, winW: window.innerWidth, notes: notesEl ? notesEl.getBoundingClientRect().width : 0 }
  })
  ok('a narrow window keeps the handle on screen, the notes giving way first',
    !!narrowPanes && narrowPanes.left >= narrowPanes.rowLeft - 1 && narrowPanes.right <= narrowPanes.rowRight + 1
      && narrowPanes.left >= 0 && narrowPanes.right <= narrowPanes.winW && narrowPanes.notes < 522,
    narrowPanes ? `handle ${Math.round(narrowPanes.left)}–${Math.round(narrowPanes.right)} in ${Math.round(narrowPanes.rowLeft)}–${Math.round(narrowPanes.rowRight)} of a ${narrowPanes.winW}px window, notes ${Math.round(narrowPanes.notes)}` : 'no handle')
  const narrowDeck = (await widths()).deck
  ok('and the deck holds its 300px floor while the notes give way', Math.abs(narrowDeck - 300) <= 1, Math.round(narrowDeck) + 'px')
  await page.setViewportSize({ width: 1750, height: 950 })
  await page.waitForTimeout(700)
  // The narrow window clamped the DRAWN width only: back at full size the deck is where it was dragged.
  const restored = await widths()
  ok('the narrow clamp was not stored — the deck comes back to the width it was dragged to',
    Math.abs(restored.deck - atNotesFloor.deck) <= 1, `${Math.round(atNotesFloor.deck)}px → ${Math.round(restored.deck)}px`)
  // A click on the handle that moves nothing stores nothing and moves nothing.
  const clickHandle = await strip.boundingBox()
  await page.mouse.click(clickHandle.x + clickHandle.width / 2, clickHandle.y + clickHandle.height / 2)
  await page.waitForTimeout(300)
  const clicked = await widths()
  ok('a click on the handle with no travel leaves the deck where it was', Math.abs(clicked.deck - restored.deck) <= 1, `${Math.round(restored.deck)}px → ${Math.round(clicked.deck)}px`)
  const resetHandle = await strip.boundingBox()
  await page.mouse.dblclick(resetHandle.x + resetHandle.width / 2, resetHandle.y + resetHandle.height / 2)
  await page.waitForTimeout(300)
  const reset = await widths()
  ok('double-clicking the handle returns the deck to its 360px seed', Math.abs(reset.deck - 360) <= 1, Math.round(reset.deck) + 'px')
  ok('the drag moved the deck and left the notes the rest of the row',
    Math.abs(reset.row - (reset.notes + 14 + reset.deck)) <= 1,
    `${Math.round(reset.notes)} + 14 + ${Math.round(reset.deck)} vs ${Math.round(reset.row)} (started ${Math.round(start.deck)}px deck)`)
  // The separator is a keyboard control too: ← grows the deck by one step, → shrinks it, Enter
  // resets, and the arrows it owns do not ALSO step the lecture (the screen's handler yields to a
  // handled key). The lecture is at stop 1, where ← steps to nothing, so the no-leak check is made
  // with → : a leaked step would move the record to stop 2.
  const stopChip = async () => (await page.locator('[data-presenter-chip]').innerText()).replace(/\s+/g, ' ').trim()
  const chipBefore = await stopChip()
  await strip.focus()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  const nudged = await widths()
  ok('ArrowLeft on the focused handle grows the deck by one 16px step', Math.abs(nudged.deck - (reset.deck + 16)) <= 1, `${Math.round(reset.deck)}px → ${Math.round(nudged.deck)}px`)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  const shrunk = await widths()
  const chipAfter = await stopChip()
  ok('ArrowRight twice shrinks it by one step net', Math.abs(shrunk.deck - (reset.deck - 16)) <= 1, `${Math.round(reset.deck)}px → ${Math.round(shrunk.deck)}px`)
  ok('and the arrows did not also step the lecture', chipAfter === chipBefore, `${chipBefore} → ${chipAfter}`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  const keyReset = await widths()
  ok('Enter on the focused handle returns the deck to its seed', Math.abs(keyReset.deck - 360) <= 1, Math.round(keyReset.deck) + 'px')
  await page.mouse.move(2, 2)
  await page.waitForTimeout(200)

  // ── a note typed and sent ───────────────────────────────────────────────────
  await write('they stumbled on the handshake here')
  const first = await rows()
  ok('⏎ files the note in the During column', first.length === 1 && /stumbled on the handshake/.test(first[0] || ''), (first[0] || '').slice(0, 70))
  ok('the row carries a clock reading', /\d\d:\d\d/.test(first[0] || ''), first[0])
  // v4: the tally is a count per type glyph; the total is the head's own "1 flag"
  ok('the head\'s tally counts it', /\b1\b/.test(await page.locator('[data-notes-tally]').innerText()) && /\b1 flag\b/.test((await notes().innerText()).replace(/\s+/g, ' ')), (await page.locator('[data-notes-tally]').innerText()).replace(/\s+/g, ' ').trim())

  // ── a note belongs to the stop it was written about ─────────────────────────
  await leaveField()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  ok('stepping on shows a fresh During column — the note stayed with its own stop', (await during().locator('[data-lecture-note]').count()) === 0)
  await write('come back to the certificate chain')
  await leaveField()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(400)
  const back = await rows()
  ok('stepping back shows the first stop\'s note again, and only that one', back.length === 1 && /stumbled on the handshake/.test(back[0] || ''), String(back.length))

  // ── A NOTE WRITTEN WHILE ROAMING BELONGS TO THE STOP BEING READ ─────────────
  // The record stays where the class is; the professor reads ahead and writes about what they
  // are reading. Nothing in the host decides this — the pane stamps the note with the stop it
  // was showing, which is the roamed one.
  await leaveField()
  await page.locator('[data-presenter-tick="3"]').click()
  await page.waitForTimeout(400)
  const roamChip = (await page.locator('[data-presenter-chip]').innerText()).replace(/\s+/g, ' ').trim()
  ok('a click on a tick roams ahead while the record stays put', /^Roaming stop 4$/.test(roamChip), roamChip)
  await write('this slide needs an example, not a definition')
  const roamRows = await rows()
  ok('the note written while roaming shows on the ROAMED stop', roamRows.length === 1 && /needs an example/.test(roamRows[0] || ''), String(roamRows.length))
  ok('and it is stamped with the roamed stop, by the pane', await page.evaluate(() => {
    const book = (JSON.parse(localStorage.getItem('pkt.lecture.notes:draft') || '{}').data || {})
    const hit = (book.notes || []).find((n) => /needs an example/.test(n.text))
    return !!hit && hit.stop === 3
  }))
  await leaveField()
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(400)
  const backChip = (await page.locator('[data-presenter-chip]').innerText()).replace(/\s+/g, ' ').trim()
  ok('ending the roam returns to the record, and the roamed note is not on it', /^Presenting stop 1$/.test(backChip) && (await during().locator('[data-lecture-note]').count()) === 1, backChip)

  // ── A MINTED CATEGORY IS THE PROFESSOR'S, not the stop's ────────────────────
  await notes().locator('[data-note-composer] [aria-label]').first().click().catch(() => {})
  await page.locator('[data-note-composer]').locator('button').first().click()
  await page.waitForTimeout(300)
  ok('the category button opens the popover', (await page.locator('[data-note-categories]').count()) === 1)
  await page.locator('[data-note-categories]').getByText('new type…').click()
  await page.waitForTimeout(300)
  await page.getByLabel('name the new type').fill('Homework')
  await page.getByLabel('add this type').click()
  await page.waitForTimeout(400)
  ok('the minted category is stored against the professor, not the lecture',
    await page.evaluate(() => ((JSON.parse(localStorage.getItem('pkt.lecture.categories') || '{}').data || {}).list || []).some((c) => c.label === 'Homework')))
  await leaveField()
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  await page.locator('[data-note-composer]').locator('button').first().click()
  await page.waitForTimeout(300)
  ok('it is offered at the next stop too', (await page.locator('[data-note-categories]').getByText('Homework').count()) === 1)
  await page.keyboard.press('Escape')
  await leaveField()
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(400)

  // ── the prepared note, corrected at the lectern ─────────────────────────────
  await prepared().getByTitle(/^click to edit/).click()
  await page.waitForTimeout(250)
  await page.keyboard.press('Control+A')
  await page.keyboard.type('Say the handshake out loud before the diagram goes up.\n\nSYN, SYN-ACK, ACK — then ask what happens if the third is lost.')
  // PREPARED NOTES ARE PROSE, so the in-place editor treats the return key as a LINE BREAK and
  // commits on blur instead (v4 has no pencil; the words are click-to-edit). Looking away is the save.
  await leaveField()
  await page.waitForTimeout(500)
  ok('looking away commits the correction in place', /Say the handshake out loud/.test(await prepared().innerText()))
  ok('and the blank line between the two paragraphs survives the round trip',
    await page.evaluate(() => {
      const book = (JSON.parse(localStorage.getItem('pkt.lecture.notes:draft') || '{}').data || {})
      return Object.values(book.prepared || {}).some((v) => /goes up\.\n\nSYN/.test(v))
    }))
  await page.reload()
  await page.waitForTimeout(1200)
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(800)
  ok('the correction survives a reload', /Say the handshake out loud/.test(await prepared().innerText()),
    'prepared = ' + (await page.evaluate(() => JSON.stringify(((JSON.parse(localStorage.getItem('pkt.lecture.notes:draft') || '{}')).data || {}).prepared)))
    + ' · shown = ' + (await page.locator('[data-presenter-chip]').innerText()).replace(/\s+/g, ' ').trim())
  ok('and so do the notes taken', (await during().locator('[data-lecture-note]').count()) === 1)
  await page.locator('[data-note-composer]').locator('button').first().click()
  await page.waitForTimeout(300)
  ok('and so does the minted category — it belongs to the professor, not the session',
    (await page.locator('[data-note-categories]').getByText('Homework').count()) === 1)
  await page.keyboard.press('Escape')
  await leaveField()

  // ── the deck ────────────────────────────────────────────────────────────────
  ok('the deck draws eight tiles', (await deck().count()) === 8, String(await deck().count()))
  ok('all eight are still undecided placeholders', (await page.locator('[data-quick-deck] [data-quick-action^="class-"], [data-quick-deck] [data-quick-action^="other-"]').count()) === 8)
  await leaveField()
  await page.locator('[data-quick-shelf-toggle]').click()
  await page.waitForTimeout(400)
  const shelf = page.locator('[data-quick-shelf]')
  ok('More actions opens the shelf beside the pane, with this host\'s six real actions',
    (await shelf.count()) === 1 && (await shelf.locator('[data-quick-action]').count()) === 6,
    String(await shelf.locator('[data-quick-action]').count()))
  ok('the shelf sits BESIDE the deck, not over it — the drop targets stay reachable', await page.evaluate(() => {
    const s = document.querySelector('[data-quick-shelf]').getBoundingClientRect()
    const d = document.querySelector('[data-quick-deck] [data-quick-action]').getBoundingClientRect()
    return s.right <= d.left + 1 || s.left >= d.right - 1
  }))
  // a shelf tile is a control, not only a drag handle: clicking one runs it
  await shelf.locator('[data-quick-action="map"]').click()
  await page.waitForTimeout(500)
  ok('clicking "Project the map" on the shelf puts the map on the wall', (await page.locator('[data-projected-map]').count()) >= 1)
  await leaveField()
  await page.keyboard.press('m')
  await page.waitForTimeout(1500)
  ok('M takes it down again — and fires ONCE, not twice', (await page.locator('[data-projected-map]').count()) === 0,
    'maps on the wall: ' + (await page.locator('[data-projected-map]').count()))

  // ── drag a real action onto a slot, and keep it there ───────────────────────
  const started = await page.evaluate(() => {
    const shelfTile = document.querySelector('[data-quick-shelf] [data-quick-action="flag"]')
    if (!shelfTile) return false
    window.__dt = new DataTransfer()
    shelfTile.parentElement.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dt }))
    return true
  })
  await page.waitForTimeout(300)
  const swapped = started && await page.evaluate(() => {
    const slot = document.querySelector('[data-quick-deck] [data-quick-action="class-1"]')
    if (!slot) return false
    slot.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: window.__dt }))
    slot.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: window.__dt }))
    return true
  })
  await page.waitForTimeout(500)
  ok('a shelf action dropped on a slot takes its place', swapped && (await page.locator('[data-quick-deck] [data-quick-action="flag"]').count()) === 1)
  ok('and the displaced placeholder goes back to the shelf, LAST — where the eye looks for it',
    (await page.locator('[data-quick-shelf] [data-quick-action]').last().getAttribute('data-quick-action')) === 'class-1',
    await page.locator('[data-quick-shelf] [data-quick-action]').last().getAttribute('data-quick-action'))
  // THE SHELF IS MOVABLE AND ITS PLACE IS REMEMBERED — as a DELTA from wherever it opens, so a
  // position saved on a wide window cannot strand it off the edge of a narrow one.
  const shelfBox = await shelf.boundingBox()
  await page.mouse.move(shelfBox.x + 60, shelfBox.y + 12)
  await page.mouse.down()
  await page.mouse.move(shelfBox.x + 60 - 90, shelfBox.y + 12 - 60, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const moved = await shelf.boundingBox()
  ok('the shelf can be dragged by its header', Math.round(shelfBox.x - moved.x) > 40, `${Math.round(shelfBox.x)} → ${Math.round(moved.x)}`)
  ok('and where it was dropped is saved as a delta, not a point',
    await page.evaluate(() => { const h = (JSON.parse(localStorage.getItem('pkt.lecture.habits') || '{}').data || {}); return !!h.shelfPosition && h.shelfPosition.x < -40 }),
    await page.evaluate(() => JSON.stringify((JSON.parse(localStorage.getItem('pkt.lecture.habits') || '{}').data || {}).shelfPosition)))
  await page.reload()
  await page.waitForTimeout(1200)
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(800)
  ok('the arrangement survives a reload', (await page.locator('[data-quick-deck] [data-quick-action="flag"]').count()) === 1)
  await page.locator('[data-quick-shelf-toggle]').click()
  await page.waitForTimeout(500)
  const reopened = await page.locator('[data-quick-shelf]').boundingBox()
  ok('the shelf reopens where it was left', Math.abs(reopened.x - moved.x) < 4, `${Math.round(moved.x)} → ${Math.round(reopened.x)}`)
  // a delta saved on a wide window must not strand the shelf off a narrow one: the pane clamps
  // it to the viewport when it opens
  await page.setViewportSize({ width: 900, height: 950 })
  await page.waitForTimeout(600)
  const narrow = await page.locator('[data-quick-shelf]').boundingBox()
  ok('and a narrow window pulls it back inside rather than off the edge', narrow.x >= 0 && narrow.x + narrow.width <= 900, `x ${Math.round(narrow.x)}, right ${Math.round(narrow.x + narrow.width)}`)
  await page.setViewportSize({ width: 1750, height: 950 })
  await page.waitForTimeout(500)
  await page.locator('[data-quick-shelf-toggle]').click()
  await page.waitForTimeout(300)
  ok('a real tile on the deck now shows its key', /\(F\)/i.test(await page.locator('[data-quick-deck] [data-quick-action="flag"]').innerText()))

  // ── the recap ───────────────────────────────────────────────────────────────
  await page.locator('[data-toolbar-hook="present"]').click()
  await page.waitForTimeout(900)
  await page.bringToFront()
  await write('one more, on the live lecture')
  await leaveField()
  await page.keyboard.press('f')
  await page.waitForTimeout(300)
  ok('F flags the shown stop while the deck is bound to it too — once', (await page.locator('[data-quick-deck] [data-quick-action="flag"][aria-pressed="true"]').count()) === 1)
  await page.locator('[aria-label="end lecture"]').click()
  await page.getByRole('button', { name: 'end lecture' }).last().click()
  await page.waitForTimeout(800)
  ok('ending the lecture replaces the row with the recap', (await page.locator('[data-lecture-recap]').count()) === 1 && (await notes().count()) === 0)
  const stats = (await page.locator('[data-recap-stats]').innerText()).replace(/\s+/g, ' ').trim()
  ok('the recap counts stops, notes and flags', /stops? covered/.test(stats) && /notes? taken/.test(stats) && /slides? flagged/.test(stats), stats)
  // v4 (LectureClock): one line, `Fri 4 Sep 2026 13:12 – 13:40`, no "started" / "ended" words
  ok('it says when the lecture started and when it ended', /\d\d:\d\d – (\w{3} \d+ \w{3} \d{4} )?\d\d:\d\d/.test(await page.locator('[data-lecture-recap]').innerText()))
  ok('the same notes come back in review shape, grouped under the stops they were written about',
    (await page.locator('[data-lecture-notes="review"]').count()) === 1 && (await page.locator('[data-notes-group]').count()) >= 1,
    (await page.locator('[data-notes-group]').count()) + ' group heads')
  // v4 dropped the "flagged for revision" list: the review pane's flags, grouped by slide, are it,
  // and the preview beside them shows the slide a row is picked on. The rows come from the notes;
  // the host's F still writes the old flags array until OB-304 makes a flag a note, and OB-304
  // wires the row-to-preview pick, so those checks are OB-304's.
  ok('the notes written live are the recap\'s rows', (await page.locator('[data-lecture-notes="review"] [data-lecture-note]').count()) >= 1,
    (await page.locator('[data-lecture-notes="review"] [data-lecture-note]').count()) + ' rows')
  ok('and there is a way out', (await page.getByRole('button', { name: 'close the presenter' }).count()) === 1)
  await page.getByRole('button', { name: 'close the presenter' }).click()
  await page.waitForTimeout(600)
  ok('closing the presenter leaves the mode', (await page.locator('[data-presenter-header]').count()) === 0)

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
