// browsertest-presenter-start.mjs — OB-304 (#485): ▶ opens the start card, and the lecture starts
// on its choice.
//
// The toolbar's ▶ from idle (or from the palette's preview) opens `PresentStartCard` as a modal;
// the palette's Present still opens only the preview; an ended lecture resumes with no card.
// Cancelling writes nothing, Enter with the lit new session starts a lecture on it and opens the
// projector, a saved walk remembers where the lecture ended, and that record survives a reload.
// OB-304 (#486) adds the flags-v4 checks: the roll's chip and its ring, the recap's Flags list and
// Preview column, the lecture's own entries only, and the persisted types and pane sizes.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-presenter-start.mjs
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
  await page.evaluate(() => document.fonts.ready)

  const playBtn = () => page.locator('[data-toolbar-hook="present"]')
  const dialog = () => page.locator('[role="dialog"][aria-label="Start presenting"]')
  const chipText = async () => (await page.locator('[data-presenter-chip]').innerText()).replace(/\s+/g, ' ').trim()
  const liveTitle = async () => (await page.locator('[data-filmroll-card="live"] [data-slide-title]').innerText()).trim()
  const openPalette = async () => {
    if ((await page.locator('[aria-label="studio-sidebar"]').count()) === 0) {
      await page.locator('[data-toolbar-hook="palette-toggle"]').click()
      await page.waitForTimeout(500)
    }
  }
  /** the stored session list, or [] when nothing has been written under the key */
  const storedSessions = () => page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('pkt.lecture.sessions:'))
    if (!key) return []
    try { return JSON.parse(localStorage.getItem(key) || '{}').data ?? [] } catch { return [] }
  })
  /** every stored byte under the sessions key — what a cancel must leave exactly as it was */
  const sessionsRaw = () => page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('pkt.lecture.sessions:'))
    return key ? localStorage.getItem(key) : null
  })
  const openCard = async () => {
    await playBtn().click()
    await dialog().waitFor()
  }
  const startWithCard = async ({ projector = false } = {}) => {
    if (projector) {
      const [page2] = await Promise.all([
        context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
        (async () => { await openCard(); await page.keyboard.press('Enter') })(),
      ])
      return page2
    }
    await openCard()
    await page.keyboard.press('Enter')
    return null
  }
  const endLecture = async () => {
    await page.locator('[aria-label="end lecture"]').click()
    await page.getByRole('button', { name: 'end lecture' }).last().click()
    await page.waitForTimeout(700)
  }
  const leavePresenter = async () => {
    await page.locator('[data-presenter-header]').getByRole('button', { name: 'close the presenter' }).click()
    await page.waitForTimeout(700)
  }
  const stepTo = async (chip) => {
    for (let i = 0; i < 40 && (await chipText()) !== chip; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(250)
    }
    return chipText()
  }

  // ── 1. ▶ from idle opens the card, the new session is lit and the starts are enabled ────────
  await openCard()
  ok('1: ▶ from idle opens the start card', (await dialog().count()) === 1)
  ok('1: "+ New session" is lit', (await dialog().locator('[data-new-session="top"]').getAttribute('aria-pressed')) === 'true')
  const firstStart = dialog().getByRole('button').filter({ hasText: 'Start from the beginning' }).first()
  ok('1: the starts are enabled', (await firstStart.count()) === 1 && !(await firstStart.isDisabled()))

  // ── 4. Cancel leaves no new session ─────────────────────────────────────────────────────────
  const rawBeforeCancel = await sessionsRaw()
  await dialog().getByRole('button', { name: 'cancel (Esc)' }).click()
  await page.waitForTimeout(400)
  ok('4: the card\'s ✕ closes it', (await dialog().count()) === 0)
  ok('4: cancelling leaves the stored sessions exactly as they were', (await sessionsRaw()) === rawBeforeCancel && (await storedSessions()).length === 0, String(rawBeforeCancel))

  // ── 2. The palette's Present opens the preview and no card ─────────────────────────────────
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(700)
  ok('2: the palette\'s Present opens the preview and no card', (await page.locator('[aria-label="studio-presenter"]').count()) === 1 && (await dialog().count()) === 0 && /^Preview stop \d+$/.test(await chipText()), await chipText())

  // ── 8. Over a preview, Escape closes the card and ↓ moves its highlight only ───────────────
  const previewStop = await chipText()
  await openCard()
  ok('8: ▶ over the preview opens the card on top of it', (await dialog().count()) === 1 && /^Preview stop \d+$/.test(await chipText()), await chipText())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('8: Escape closes the card', (await dialog().count()) === 0)
  ok('8: and leaves the preview where it was', (await chipText()) === previewStop, await chipText())

  await openCard()
  const borderOf = (label) => dialog().getByRole('button').filter({ hasText: label }).first().evaluate((el) => getComputedStyle(el).borderTopColor)
  const continueOn = await borderOf('Start from the beginning')
  const loadOff = await borderOf('Load another walk')
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(250)
  const continueOff = await borderOf('Start from the beginning')
  const loadOn = await borderOf('Load another walk')
  ok('8: ↓ moves the card\'s highlight (the lit row\'s border swaps)', continueOn !== loadOff && continueOff === loadOff && loadOn === continueOn, `${continueOn} / ${loadOff} -> ${continueOff} / ${loadOn}`)
  ok('8: and the preview\'s slide does not step under it', (await chipText()) === previewStop, await chipText())
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // ── 5. Enter on the lit "+ New session" starts a lecture and opens the projector ────────────
  const projector = await startWithCard({ projector: true })
  await page.bringToFront()
  await page.waitForTimeout(900)
  if (projector) projector.on('pageerror', (e) => errors.push('projector pageerror: ' + e.message))
  ok('5: Enter starts the lecture', /^Presenting stop \d+$/.test(await chipText()), await chipText())
  ok('5: and opens the projector window', !!projector, projector ? projector.url() : 'no page event')
  const afterStart = await storedSessions()
  ok('5: one untitled session is in the stored list', afterStart.length === 1 && afterStart[0].name === '', JSON.stringify(afterStart))

  // ── 3. ▶ on an ended lecture resumes with no card ───────────────────────────────────────────
  const stopBeforeResume = await chipText()
  await endLecture()
  ok('3: the lecture ended into the recap', (await page.locator('[data-lecture-recap]').count()) === 1)
  await playBtn().click()
  await page.bringToFront()
  await page.waitForTimeout(800)
  ok('3: ▶ resumes an ended lecture and opens no card', (await dialog().count()) === 0 && /^Presenting stop \d+$/.test(await chipText()) && (await chipText()).match(/\d+/)[0] === stopBeforeResume.match(/\d+/)[0], `${stopBeforeResume} -> ${await chipText()}`)
  await endLecture()
  await leavePresenter()
  if (projector) await projector.close().catch(() => {})

  // ── 6. A saved walk's session remembers where it stopped, then that it finished ────────────
  // The same desk setup #484 uses: a built-in walk activated on the Trail strip.
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(800)
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(500)
  await openPalette()
  await page.getByLabel('studio-inst-trail', { exact: true }).click()
  await page.waitForTimeout(500)
  const trailStrip = page.locator('[aria-label="trail-strip"]')
  const playWalk = () => trailStrip.getByRole('button').filter({ hasText: '▶' })
  const walkTitle = (await playWalk().nth(0).innerText()).replace(/^▶\s*/, '').replace(/\s+/g, ' ').trim()
  await playWalk().nth(0).click()
  await page.waitForTimeout(700)
  const walkStops = Number((await trailStrip.innerText()).match(/stop \d+ of (\d+)/)?.[1] ?? 0)
  ok('6: the saved walk under test has at least five stops', walkStops >= 5, `${walkTitle}: ${walkStops} stops`)

  await startWithCard()
  await page.bringToFront()
  await page.waitForTimeout(800)
  await stepTo('Presenting stop 4')
  const stop4Title = await liveTitle()
  ok('6: the first lecture reaches stop 4', (await chipText()) === 'Presenting stop 4', `${await chipText()} "${stop4Title}"`)
  await endLecture()
  await leavePresenter()
  await openCard()
  const session = (await storedSessions())[0]
  await page.locator(`[data-session-id="${session.id}"]`).click()
  await page.waitForTimeout(300)
  const continueLine = (await dialog().innerText()).replace(/\s+/g, ' ')
  ok('6: the Continue row names the walk and the stop just taught', continueLine.includes(`${walkTitle}, stop 4 of ${walkStops}`) && continueLine.includes(stop4Title), continueLine)

  // the clicked session row keeps focus and handles Enter itself, so the resume is pressed on its row
  await dialog().getByRole('button').filter({ hasText: 'Continue from last presentation' }).first().click()
  await page.bringToFront()
  await page.waitForTimeout(800)
  await stepTo(`Presenting stop ${walkStops}`)
  ok('6: the resumed lecture reaches the walk\'s last stop', (await chipText()) === `Presenting stop ${walkStops}`, await chipText())
  await endLecture()
  await leavePresenter()
  await openCard()
  await page.locator(`[data-session-id="${session.id}"]`).click()
  await page.waitForTimeout(300)
  const finishedLine = (await dialog().innerText()).replace(/\s+/g, ' ')
  ok('6: and then it reads "Finished the walk"', finishedLine.includes('Finished the walk ' + walkTitle), finishedLine)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // ── 7. The sessions survive a reload ───────────────────────────────────────────────────────
  await page.reload()
  await page.waitForTimeout(900)
  await openCard()
  ok('7: after a reload the stored sessions are still there', (await storedSessions()).length === 1 && (await page.locator(`[data-session-id="${session.id}"]`).count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // ── OB-304 (#486): flags v4 in the lecture and the end screen ───────────────
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(900)
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(500)
  await openPalette()
  await page.getByLabel('studio-inst-trail', { exact: true }).click()
  await page.waitForTimeout(500)
  const walkStrip = page.locator('[aria-label="trail-strip"]')
  const walkPlay = () => walkStrip.getByRole('button').filter({ hasText: '▶' })
  const flagWalk = (await walkPlay().nth(0).innerText()).replace(/^▶\s*/, '').replace(/\s+/g, ' ').trim()
  await walkPlay().nth(0).click()
  await page.waitForTimeout(700)
  const flagStops = Number((await walkStrip.innerText()).match(/stop \d+ of (\d+)/)?.[1] ?? 0)
  ok('OB-304: the walk under test has at least five stops', flagStops >= 5, `${flagWalk}: ${flagStops} stops`)

  const habitsNow = () => page.evaluate(() => (JSON.parse(localStorage.getItem('pkt.lecture.habits') || '{}').data || {}))
  const storedNotes = () => page.evaluate(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('pkt.lecture.notes:'))
    const key = keys.find((k) => k.includes(':walk:')) || keys[0]
    if (!key) return []
    try { return (JSON.parse(localStorage.getItem(key) || '{}').data || {}).notes || [] } catch { return [] }
  })
  const liveChip = () => page.locator('[data-filmroll-card="live"] [aria-label="flag this slide"]')
  const liveRows = () => page.locator('[data-notes-during] [data-lecture-note]')
  const reviewRows = () => page.locator('[data-lecture-notes="review"] [data-lecture-note]')
  const reviewGroups = () => page.locator('[data-lecture-notes="review"] [data-notes-group]')
  const recapText = async () => (await page.locator('[data-lecture-recap]').innerText()).replace(/\s+/g, ' ').trim()
  const previewLine = async () => (await page.locator('[data-lecture-recap]').getByText(/^stop \d+ of \d+$/).first().innerText()).trim()
  const blurField = () => page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur() })
  const writeLive = async (text) => {
    await page.locator('[data-lecture-notes="live"]').getByLabel('a note for this slide…').click()
    await page.keyboard.type(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(350)
  }

  // 1 + 2: two flags on one slide, a note on the next, then the recap
  await startWithCard()
  await page.bringToFront()
  await page.waitForTimeout(800)
  ok('OB-304: the first flag lecture is live', /^Presenting stop 1$/.test(await chipText()), await chipText())
  await liveChip().click()
  await page.waitForTimeout(250)
  await liveChip().click()
  await page.waitForTimeout(400)
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  await writeLive('the second slide gets a note')
  const secondTitle = await liveTitle()
  await endLecture()
  ok('OB-304 1: two chip taps and one typed note make three rows', (await reviewRows().count()) === 3, String(await reviewRows().count()))
  ok('OB-304 1: the recap groups them under two slides', (await reviewGroups().count()) === 2, String(await reviewGroups().count()))
  const firstAt = await previewLine()
  ok('OB-304 1: the preview opens on stop 1', firstAt === `stop 1 of ${flagStops}`, firstAt)
  await reviewGroups().nth(1).locator('[data-lecture-note]').first().click()
  await page.waitForTimeout(300)
  const pickedAt = await previewLine()
  ok('OB-304 1: a row click shows that slide in the Preview column', pickedAt === `stop 2 of ${flagStops}`, pickedAt)
  const groupBgs = await reviewGroups().evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor))
  ok('OB-304 1: the picked slide\'s group is washed differently', new Set(groupBgs).size >= 2, groupBgs.join(' / '))
  const foot1 = await recapText()
  ok('OB-304 2: the recap names where next time starts', foot1.includes(`Next time, continue picks up at ${flagWalk}, stop 2 of ${flagStops} – ${secondTitle}`), foot1.slice(0, 260))

  // 3: the ended bar is the way out
  ok('OB-304 3: the recap carries no closing button', (await page.locator('[data-lecture-recap]').getByRole('button', { name: 'close the presenter' }).count()) === 0)
  const barClose = page.locator('[data-presenter-header]').getByRole('button', { name: 'close the presenter' })
  ok('OB-304 3: the ended bar carries the way out', (await barClose.count()) === 1)
  await barClose.click()
  await page.waitForTimeout(700)
  ok('OB-304 3: the bar\'s pill leaves the presenter', (await page.locator('[data-presenter-header]').count()) === 0 && (await page.locator('[data-lecture-recap]').count()) === 0)

  // 9 + 2: a second lecture on the same walk is clean, and finishes the walk
  await startWithCard()
  await page.bringToFront()
  await page.waitForTimeout(800)
  ok('OB-304 9: the second lecture opens on a clean pane', (await liveRows().count()) === 0, String(await liveRows().count()))
  await stepTo(`Presenting stop ${flagStops}`)
  ok('OB-304 9: none of the first lecture\'s flags are in its pane', (await liveRows().count()) === 0, String(await liveRows().count()))
  await endLecture()
  ok('OB-304 9: its recap holds none of the first lecture\'s flags', (await reviewRows().count()) === 0, String(await reviewRows().count()))
  const foot2 = await recapText()
  ok('OB-304 2: ending on the last stop reads "Finished the walk"', foot2.includes('Finished the walk ' + flagWalk), foot2.slice(0, 220))

  // 8: the palette's preview draws the chip and records nothing
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(700)
  const beforePreviewTap = (await storedNotes()).length
  ok('OB-304 8: the palette preview draws the roll chip', (await liveChip().count()) === 1)
  await liveChip().click()
  await page.waitForTimeout(400)
  ok('OB-304 8: tapping it in the preview stores no entry', (await storedNotes()).length === beforePreviewTap, `${beforePreviewTap} -> ${(await storedNotes()).length}`)

  // 4 + 5: the ring's type becomes the usual one, the composer follows, delete resolves
  await startWithCard()
  await page.bringToFront()
  await page.waitForTimeout(800)
  ok('OB-304: the third lecture is live for the ring', /^Presenting stop 1$/.test(await chipText()), await chipText())
  await liveChip().click({ button: 'right' })
  await page.waitForTimeout(300)
  const ring = page.locator('[aria-label="flag type"]')
  ok('OB-304 4: right-click opens the chip\'s ring', (await ring.count()) === 1)
  await ring.getByRole('menuitem').filter({ hasText: 'unclear' }).first().click()
  await page.waitForTimeout(400)
  const habitsAfterRing = await habitsNow()
  ok('OB-304 4: "unclear" becomes the stored usual type', habitsAfterRing.usualFlag === 'question', JSON.stringify(habitsAfterRing))
  const openBeforeTap = (await storedNotes()).filter((n) => !n.resolvedAt).length
  await liveChip().click()
  await page.waitForTimeout(400)
  const afterTapNotes = await storedNotes()
  const newest = afterTapNotes.filter((n) => !n.resolvedAt)[0]
  ok('OB-304 4: the chip taps a flag of that type', afterTapNotes.filter((n) => !n.resolvedAt).length === openBeforeTap + 1 && newest && newest.category === 'question', JSON.stringify(newest))
  ok('OB-304 4: the composer starts on unclear', (await page.locator('[data-note-composer] button[title="unclear"]').count()) === 1)

  const rowsBeforeResolve = await liveRows().count()
  await liveRows().first().hover()
  await liveRows().first().getByLabel('delete this flag').click()
  await page.waitForTimeout(250)
  const delDialog = page.locator('[role="alertdialog"][aria-label="delete this flag"]')
  ok('OB-304 5: the bin asks first', (await delDialog.count()) === 1)
  await delDialog.getByRole('button', { name: 'Keep' }).click()
  await page.waitForTimeout(250)
  ok('OB-304 5: Keep leaves it in the list', (await liveRows().count()) === rowsBeforeResolve, `${rowsBeforeResolve} -> ${await liveRows().count()}`)
  await liveRows().first().hover()
  await liveRows().first().getByLabel('delete this flag').click()
  await page.waitForTimeout(250)
  await page.locator('[role="alertdialog"][aria-label="delete this flag"]').getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(400)
  ok('OB-304 5: Delete takes it out of the list', (await liveRows().count()) === rowsBeforeResolve - 1, `${rowsBeforeResolve} -> ${await liveRows().count()}`)
  const afterResolve = await storedNotes()
  ok('OB-304 5: its stored entry is resolved, not erased', afterResolve.length === afterTapNotes.length && afterResolve.some((n) => typeof n.resolvedAt === 'number'), JSON.stringify(afterResolve.map((n) => !!n.resolvedAt)))

  // 6 + 7: a minted type, a prepared correction, and the two persisted sizes
  await page.locator('[data-note-composer]').locator('button').first().click()
  await page.waitForTimeout(300)
  await page.locator('[data-note-categories]').getByText('new type…').click()
  await page.waitForTimeout(250)
  await page.getByLabel('name the new type').fill('Homework')
  await page.getByLabel('add this type').click()
  await page.waitForTimeout(400)
  ok('OB-304 6: a minted type is stored', await page.evaluate(() => ((JSON.parse(localStorage.getItem('pkt.lecture.categories') || '{}').data || {}).list || []).some((c) => c.label === 'Homework')))

  await page.locator('[data-notes-prepared]').getByTitle(/^click to edit/).click()
  await page.waitForTimeout(250)
  await page.keyboard.press('Control+A')
  await page.keyboard.type('say the ring out loud before the example')
  await blurField()
  await page.waitForTimeout(500)
  const prepDivider = page.locator('[aria-label="resize the prepared notes and the flags"]')
  const pd = await prepDivider.boundingBox()
  await page.mouse.move(pd.x + pd.width / 2, pd.y + pd.height / 2)
  await page.mouse.down()
  await page.mouse.move(pd.x + pd.width / 2, pd.y + pd.height / 2 + 40, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const chatDivider = page.locator('[data-lecture-notes="live"] [title^="drag to resize ·"]')
  const cd = await chatDivider.boundingBox()
  await page.mouse.move(cd.x + cd.width / 2, cd.y + cd.height / 2)
  await page.mouse.down()
  await page.mouse.move(cd.x + cd.width / 2 - 60, cd.y + cd.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(400)
  const habitsAfterDrag = await habitsNow()
  ok('OB-304 7: the prepared height and the chat width are stored', typeof habitsAfterDrag.preparedHeight === 'number' && habitsAfterDrag.preparedHeight !== 150 && typeof habitsAfterDrag.chatWidth === 'number' && habitsAfterDrag.chatWidth !== 220, JSON.stringify(habitsAfterDrag))

  await endLecture()
  await leavePresenter()
  await startWithCard()
  await page.bringToFront()
  await page.waitForTimeout(800)
  const nextPrepared = (await page.locator('[data-notes-prepared]').innerText()).replace(/\s+/g, ' ').trim()
  ok('OB-304 7: the prepared note edited in one lecture shows in the next', /say the ring out loud before the example/.test(nextPrepared), nextPrepared.slice(0, 120))
  await endLecture()
  await leavePresenter()

  // 4 + 6 + 7 after a reload
  await page.reload()
  await page.waitForTimeout(900)
  const notesAfterReload = await storedNotes()
  ok('OB-304 6: the lecture\'s stored flag list survives a reload', notesAfterReload.length > 0, String(notesAfterReload.length))
  const habitsAfterReload = await habitsNow()
  ok('OB-304 4: the usual flag survives a reload', habitsAfterReload.usualFlag === 'question', JSON.stringify(habitsAfterReload.usualFlag))
  ok('OB-304 7: the prepared height and the chat width survive a reload', habitsAfterReload.preparedHeight === habitsAfterDrag.preparedHeight && habitsAfterReload.chatWidth === habitsAfterDrag.chatWidth, `${habitsAfterDrag.preparedHeight}/${habitsAfterDrag.chatWidth} -> ${habitsAfterReload.preparedHeight}/${habitsAfterReload.chatWidth}`)
  await page.getByLabel('studio-preset-explore').click()
  await page.waitForTimeout(500)
  await openPalette()
  await page.getByLabel('studio-inst-trail', { exact: true }).click()
  await page.waitForTimeout(500)
  await page.locator('[aria-label="trail-strip"]').getByRole('button').filter({ hasText: '▶' }).nth(0).click()
  await page.waitForTimeout(700)
  await openPalette()
  await page.getByLabel('studio-preset-present').click()
  await page.waitForTimeout(800)
  ok('OB-304 4: after a reload the composer reads unclear', (await page.locator('[data-note-composer] button[title="unclear"]').count()) === 1)
  await page.locator('[data-note-composer]').locator('button').first().click()
  await page.waitForTimeout(300)
  ok('OB-304 6: after a reload the minted type is still offered', (await page.locator('[data-note-categories]').getByText('Homework').count()) === 1)
  await page.keyboard.press('Escape')

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
