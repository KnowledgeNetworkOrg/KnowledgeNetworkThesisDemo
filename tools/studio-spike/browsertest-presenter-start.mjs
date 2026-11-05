// browsertest-presenter-start.mjs — OB-304 (#485): ▶ opens the start card, and the lecture starts
// on its choice.
//
// The toolbar's ▶ from idle (or from the palette's preview) opens `PresentStartCard` as a modal;
// the palette's Present still opens only the preview; an ended lecture resumes with no card.
// Cancelling writes nothing, Enter with the lit new session starts a lecture on it and opens the
// projector, a saved walk remembers where the lecture ended, and that record survives a reload.
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
    await page.locator('[data-lecture-recap]').getByRole('button', { name: 'close the presenter' }).click()
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
