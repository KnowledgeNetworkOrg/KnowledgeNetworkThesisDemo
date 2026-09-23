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
//   · the prepared note's pencil edits IN PLACE and the correction survives a reload, without
//     touching the walk the note was authored on;
//   · the deck draws eight undecided slots and keeps six real actions on the shelf behind More;
//   · a shelf tile RUNS its action (Project the map puts the map on the wall);
//   · dragging a shelf action onto a slot swaps them, and the arrangement survives a reload;
//   · ending the lecture replaces the row with the recap: the three counts, the same notes grouped
//     under the stops they were written about, the flagged list, and a way out.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-presenter-panes.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5244

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
    await notes().getByLabel('a note for this stop…').click()
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
  ok('the prepared column says plainly that nothing was written for this stop, rather than going blank',
    /nothing was written for this stop\./.test(preparedText) && preparedText.length > 30, preparedText.slice(0, 70))
  ok('the During column starts empty', (await during().locator('[data-lecture-note]').count()) === 0)

  // ── a note typed and sent ───────────────────────────────────────────────────
  await write('they stumbled on the handshake here')
  const first = await rows()
  ok('⏎ files the note in the During column', first.length === 1 && /stumbled on the handshake/.test(first[0] || ''), (first[0] || '').slice(0, 70))
  ok('the row carries a clock reading', /\d\d:\d\d/.test(first[0] || ''), first[0])
  ok('the head\'s tally counts it', /\b1 note\b/.test((await page.locator('[data-notes-tally]').innerText()).replace(/\s+/g, ' ')), (await page.locator('[data-notes-tally]').innerText()).replace(/\s+/g, ' ').trim())

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
    const book = JSON.parse(localStorage.getItem('pkt.lecture.notes.v1:draft') || '{}')
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
  await page.locator('[data-note-categories]').getByText('new category…').click()
  await page.waitForTimeout(300)
  await page.getByLabel('name the new category').fill('Homework')
  await page.getByLabel('add this category').click()
  await page.waitForTimeout(400)
  ok('the minted category is stored against the professor, not the lecture',
    await page.evaluate(() => (JSON.parse(localStorage.getItem('pkt.lecture.categories.v1') || '{}').list || []).some((c) => c.label === 'Homework')))
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
  await notes().getByLabel('edit the prepared notes for this stop').dispatchEvent('click')
  await page.waitForTimeout(250)
  await page.keyboard.press('Control+A')
  await page.keyboard.type('Say the handshake out loud before the diagram goes up.\n\nSYN, SYN-ACK, ACK — then ask what happens if the third is lost.')
  // PREPARED NOTES ARE PROSE, so the in-place editor treats the return key as a LINE BREAK and
  // commits on blur instead (or on a second press of the pencil). Looking away is the save.
  await leaveField()
  await page.waitForTimeout(500)
  ok('the pencil commits the correction in place', /Say the handshake out loud/.test(await prepared().innerText()))
  ok('and the blank line between the two paragraphs survives the round trip',
    await page.evaluate(() => {
      const book = JSON.parse(localStorage.getItem('pkt.lecture.notes.v1:draft') || '{}')
      return Object.values(book.prepared || {}).some((v) => /goes up\.\n\nSYN/.test(v))
    }))
  await page.reload()
  await page.waitForTimeout(1200)
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(800)
  ok('the correction survives a reload', /Say the handshake out loud/.test(await prepared().innerText()),
    'prepared = ' + (await page.evaluate(() => JSON.stringify((JSON.parse(localStorage.getItem('pkt.lecture.notes.v1:draft') || '{}')).prepared)))
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
    await page.evaluate(() => { const h = JSON.parse(localStorage.getItem('pkt.lecture.habits.v1') || '{}'); return !!h.shelfPosition && h.shelfPosition.x < -40 }),
    await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('pkt.lecture.habits.v1') || '{}').shelfPosition)))
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
  ok('it says when the lecture started and when it ended', /started/.test(await page.locator('[data-lecture-recap]').innerText()) && /ended/.test(await page.locator('[data-lecture-recap]').innerText()))
  ok('the same notes come back in review shape, grouped under the stops they were written about',
    (await page.locator('[data-lecture-notes="review"]').count()) === 1 && (await page.locator('[data-notes-group]').count()) >= 1,
    (await page.locator('[data-notes-group]').count()) + ' group heads')
  ok('the flagged stop is listed for revision', (await page.locator('[data-flagged-slide]').count()) === 1)
  ok('a flagged row is a readout, not a jump — the lecture is over', await page.locator('[data-flagged-slide]').first().isDisabled())
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
