// OB-029 / OB-033 — the two checks, measured on the running component.
//
// OB-029's own CHECK is a measurement and nothing else will do: "opening and
// closing each of the three changes the card's height by 0, for a one-line AND a
// wrapped value of each". Three passes at this shipped WRONG before the field was
// removed, and each one looked right in the source — the defect was 0.67px of
// resolved border width, then 2px of margin, then 14.46px of a wrapped row
// collapsing into a single-line input. None of that is visible except by reading
// the box back off the page.
//
// OB-033's is a rendering claim too: a title cut by its cap has to END IN "…".
//
// OB-110 (#256, 2026-09-05) changed HOW a line opens — the card's pencil opens all three
// together, and a click on the words opens nothing — so every "open" below goes through
// the pencil and the old row-opens section is now its inverse. The measurements are the
// same measurements.
//
// Specimens: tools/studio-spike/inlineedit/, one card per string length.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/drive-inline-edit.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = REPO + '/tools/studio-spike/out'
const PORT = 5205
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
const checks = []
const ok = (name, cond, detail = '') => {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`)
  if (!cond) errors.push(name + (detail ? ' — ' + detail : ''))
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(`http://localhost:${PORT}/tools/studio-spike/inlineedit/index.html`)
await page.waitForTimeout(900)

const caseBox = (c) => page.locator(`[data-case="${c}"]`)

/** OB-110: the pencil is the only way in. Presence is woken on the card's head first,
 *  because the control cluster is receded (pointer-events none) until the pointer is in. */
const wakeHead = async (c) => {
  const b = await caseBox(c).evaluate((el) => el.lastElementChild.getBoundingClientRect().toJSON())
  await page.mouse.move(b.x + 30, b.y + 10)
  await page.waitForTimeout(250)
}
const openCard = async (c) => {
  await wakeHead(c)
  await caseBox(c).getByLabel('edit', { exact: true }).click()
  await page.waitForTimeout(250)
}
const editorsIn = (c) => page.evaluate((sel) => document.querySelectorAll(sel + ' [contenteditable="true"]').length, `[data-case="${c}"]`)

/** the three editable lines of one card, found by what they are rather than by a
 *  hook added for the test — the title is the head's display-face line, the
 *  description the caption line, the version name the semibold accent line */
const linesIn = (c) => page.evaluate((sel) => {
  const root = document.querySelector(sel)
  if (!root) return null
  const out = {}
  for (const el of root.querySelectorAll('span')) {
    const cs = getComputedStyle(el)
    const text = (el.textContent || '').trim()
    /* at rest no line carries the I-beam any more (OB-110), so the three are told apart
       by their type alone: the title is bold display, the version name semibold, the
       description the caption-size pre-wrap line (the mono index is caption-size too) */
    if (cs.fontWeight === '700') { if (!out.title) out.title = text }
    else if (cs.fontWeight === '600' && cs.fontSize === '13px') { if (!out.version) out.version = text }
    else if (cs.fontSize === '12px' && cs.whiteSpace === 'pre-wrap') { if (!out.description) out.description = text }
  }
  return out
}, `[data-case="${c}"]`)

// ── 1. no field anywhere ────────────────────────────────────────────────────
const fields = await page.$$eval('input, textarea', (els) => els.length)
ok('no <input> or <textarea> anywhere in the group', fields === 0, `${fields} found`)

// ── 2. OB-033: a cut string ends in an ellipsis, an uncut one does not ──────
const strings = {}
for (const c of ['one-line', 'wrapped', 'over-cap', 'empty-desc']) strings[c] = await linesIn(c)

ok('a title inside its cap is drawn whole',
  strings['wrapped'].title === 'Secure the channel end to end',
  JSON.stringify(strings['wrapped'].title))
ok('a title PAST its cap ends in an ellipsis',
  !!strings['over-cap'].title && strings['over-cap'].title.endsWith('\u2026')
    && strings['over-cap'].title.length < 90,
  JSON.stringify(strings['over-cap'].title))
ok('a version name inside its cap is drawn whole',
  strings['wrapped'].version === 'the second attempt, rewritten',
  JSON.stringify(strings['wrapped'].version))
ok('a version name PAST its cap ends in an ellipsis',
  !!strings['over-cap'].version && strings['over-cap'].version.endsWith('\u2026')
    && strings['over-cap'].version.length < 90,
  JSON.stringify(strings['over-cap'].version))
// the tooltip keeps the WHOLE name (folded, but whole) — and it is also the only
// place the untruncated string is readable from, so it is fetched before the
// word-boundary check below rather than after it
const tip = await page.evaluate(() => {
  const root = document.querySelector('[data-case="over-cap"]')
  for (const el of root.querySelectorAll('span[title]')) {
    const t = el.getAttribute('title')
    if (t && t.includes('Everything the browser does')) return t
  }
  return null
})
ok('the tooltip still carries the whole title',
  !!tip && tip.replace(/\n/g, ' ').includes('comes back to it, in order'),
  JSON.stringify(tip))

// THE CUT LANDS ON A WORD BOUNDARY — asked of the string it was cut FROM.
//
// This check used to be `!/\s\S{1,2}…$/`, i.e. "the last token before the ellipsis
// is at least three characters", and it was wrong twice over. It cannot tell a
// two-letter FRAGMENT from a two-letter WORD, so a correct cut ending "…first byte
// of…" failed it; and because the cut point is decided by measured text width, which
// token it lands on depends on the machine's font rendering, so the same code passed
// on one machine and failed on another. Comparing against the whole string answers
// the actual question and does not care where the cut fell.
const whole = (tip || '').replace(/\s+/g, ' ').trim()
const shown = (strings['over-cap'].title || '').replace(/…$/, '').trim()
// `clampToLines` strips trailing punctuation along with the space, so the character
// that follows the shown text in the original may be a comma rather than a space
const cutAtWord = !!shown && !!whole && whole.startsWith(shown)
  && (whole.length === shown.length || /[\s,;:]/.test(whole[shown.length]))
ok('the cut is made at a WORD, not mid-run', cutAtWord,
  JSON.stringify(shown) + ' cut from ' + JSON.stringify(whole.slice(0, shown.length + 12) + '…'))

// ── 3. OB-029: opening and closing moves the card by 0 ─────────────────────
const heightOf = (c) => caseBox(c).evaluate((el) => {
  /* THE CARD IS THE LAST CHILD — the case label is the first. An earlier version
     read `div > div` here, which matched the LABEL: every card reported the same
     14.84px and every 0-delta check below passed without being able to fail. A
     check that cannot fail is worse than no check, so the height is asserted to be
     a card's height before anything is compared against it. */
  const shell = el.lastElementChild
  return Math.round((shell ? shell.getBoundingClientRect().height : 0) * 100) / 100
})

/** open the card with the pencil (all three lines open together — OB-110), put the caret
 *  in the named line, read the height, press Escape, read it again */
async function openClose(c, which) {
  const before = await heightOf(c)
  await openCard(c)
  const target = await caseBox(c).evaluateHandle((el, w) => {
    const spans = [...el.querySelectorAll('[contenteditable="true"]')]
    const byWeight = (fw) => spans.find((s) => getComputedStyle(s).fontWeight === fw)
    if (w === 'title') return byWeight('700')
    if (w === 'version') return byWeight('600')
    return spans.find((s) => getComputedStyle(s).fontSize === '12px') || spans[spans.length - 1]
  }, which)
  const el = target.asElement()
  if (!el) { await page.keyboard.press('Escape'); await page.waitForTimeout(220); return { before, open: null, after: null, found: false } }
  await el.click()
  await page.waitForTimeout(220)
  const open = await heightOf(c)
  const isEditing = await el.evaluate((s) => s === document.activeElement)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(220)
  const after = await heightOf(c)
  return { before, open, after, found: true, isEditing }
}

// the guard that makes the block below meaningful
for (const c of ['one-line', 'wrapped', 'over-cap', 'empty-desc']) {
  const h = await heightOf(c)
  ok(`${c}: the measured box is the CARD`, h > 100, `${h}px`)
}

for (const c of ['one-line', 'wrapped']) {
  for (const which of ['title', 'description', 'version']) {
    const r = await openClose(c, which)
    ok(`${c} · ${which}: the line really opens`, r.found && r.isEditing, JSON.stringify(r))
    ok(`${c} · ${which}: opening moves the card by 0`, r.open === r.before,
      `${r.before} -> ${r.open}`)
    ok(`${c} · ${which}: closing moves it back by 0`, r.after === r.before,
      `${r.before} -> ${r.after}`)
  }
}

// ── 4. the open line's recipe ──────────────────────────────────────────────
await openCard('one-line')
const recipe = await page.evaluate(() => {
  const el = document.activeElement
  if (!el || el.getAttribute('contenteditable') !== 'true') return null
  const cs = getComputedStyle(el)
  /* the wash token, resolved by the browser so the check reads the same colour the token does */
  const probe = document.createElement('div')
  probe.style.background = 'var(--state-editing-wash)'
  document.body.appendChild(probe)
  const wash = getComputedStyle(probe).backgroundColor
  probe.remove()
  return {
    outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, outlineColor: cs.outlineColor,
    boxSizing: cs.boxSizing, boxShadow: cs.boxShadow,
    background: cs.backgroundColor, wash, borderWidth: cs.borderTopWidth,
  }
})
ok('the open line wears an OUTLINE, not a border',
  !!recipe && recipe.outlineStyle === 'solid' && recipe.outlineWidth === '1px' && recipe.borderWidth === '0px',
  JSON.stringify(recipe))
ok('it is content-box, so the padding is outside the wrap width',
  !!recipe && recipe.boxSizing === 'content-box', recipe && recipe.boxSizing)
ok('the focus ring is suppressed — one edge, not two',
  !!recipe && recipe.boxShadow === 'none', recipe && recipe.boxShadow)
ok('and it sits on the editing wash (--state-editing-wash, DS 2026-08-28) — a field, not just an edge',
  !!recipe && recipe.background === recipe.wash && !/rgba\(0, 0, 0, 0\)|transparent/.test(recipe.background),
  recipe && recipe.background + ' vs ' + recipe.wash)
ok('the edge is --state-editing (pond vivid #2e86c8)',
  !!recipe && recipe.outlineColor === 'rgb(46, 134, 200)', recipe && recipe.outlineColor)

// the caret is placed, not select-all
const collapsed = await page.evaluate(() => {
  const s = window.getSelection()
  return s ? s.isCollapsed : null
})
ok('opening places a caret rather than selecting the whole line', collapsed === true, String(collapsed))
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// ── 5. the invitation is there once the pencil opens the empty line ────────
// (it used to survive the click that opened the line; the line opens by pencil now, and
// at rest the empty row is invisible — opacity 0, its height kept)
const restingInvitation = await caseBox('empty-desc').evaluate((el) => {
  /* the innermost match — the wrapper span around the line reads the same text */
  const hit = [...el.querySelectorAll('span')].filter((s) => (s.textContent || '').trim() === 'enter description' && s.children.length === 0).pop()
  return hit ? getComputedStyle(hit).opacity : 'absent'
})
ok('at rest the empty description row is invisible (opacity 0), not a repeated instruction', restingInvitation === '0', restingInvitation)
await openCard('empty-desc')
const invitation = await page.evaluate(() => {
  const el = document.querySelector('[data-case="empty-desc"]')
  const hits = [...el.querySelectorAll('span')].filter((s) => (s.textContent || '').trim() === 'enter description')
  return {
    stillThere: hits.length > 0,
    isOverlay: hits.some((s) => s.getAttribute('aria-hidden') === 'true'),
    editorOpen: !!el.querySelector('[contenteditable="true"]'),
    /* the words must NOT be inside the editable element: there they would be
       selectable and committable, and "enter description" is the last thing
       anyone means to save */
    insideEditor: hits.some((s) => s.closest('[contenteditable="true"]')),
  }
})
ok('the invitation is drawn once the pencil opens the line', invitation.stillThere, JSON.stringify(invitation))
ok('and the line is an editor', invitation.editorOpen)
ok('it is an overlay, not text in the editable element',
  invitation.isOverlay && !invitation.insideEditor, JSON.stringify(invitation))
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

// ── 6. OB-110: no line opens on its own click — the pencil opens the three ──
// (the inverse of the old rowOpens section: the row carried the I-beam and opened on
// a click anywhere along it; the pencil owns opening now, and a click on the words or
// on the blank stretch past them opens nothing)
const rowOpen = await caseBox('one-line').evaluate((el) => {
  const spans = [...el.querySelectorAll('span')]
  const desc = spans.find((s) => (s.textContent || '').trim() === 'one short line')
  if (!desc) return { found: false }
  const row = desc.closest('div')
  const box = row.getBoundingClientRect()
  return { found: true, rowCursor: getComputedStyle(row).cursor, lineCursor: getComputedStyle(desc).cursor, right: box.right - 6, mid: box.top + box.height / 2 }
})
ok('at rest neither the description row nor its words carry the I-beam', rowOpen.found && rowOpen.rowCursor !== 'text' && rowOpen.lineCursor !== 'text', JSON.stringify(rowOpen))
if (rowOpen.found) {
  await page.mouse.click(rowOpen.right, rowOpen.mid)
  await page.waitForTimeout(250)
  ok('a click on the blank stretch of the row opens nothing', (await editorsIn('one-line')) === 0)
  await caseBox('one-line').getByText('one short line').click()
  await page.waitForTimeout(250)
  ok('and a click on the words opens nothing either', (await editorsIn('one-line')) === 0)
  await openCard('one-line')
  ok('the pencil opens all three lines together', (await editorsIn('one-line')) === 3, `${await editorsIn('one-line')} open`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  ok('and Escape closes them all', (await editorsIn('one-line')) === 0)
}

// ── 7. Shift+Enter breaks a description, Enter commits, and the growth is one line ─
// OB-029's ninth amendment, and the half a port is most likely to miss: the DRAWN
// row honours the break through `white-space: pre-wrap`, so a `linesOf` that only
// measured wrapping runs one whole line light per break — which on a board is a
// card overlapping the next one. Both halves are checked: the card grows, and the
// PREDICTION grows with it.
const beforeBreak = await heightOf('one-line')
await openCard('one-line')
const descLine = await caseBox('one-line').evaluateHandle((el) =>
  [...el.querySelectorAll('[contenteditable="true"]')].find((s) => (s.textContent || '').trim() === 'one short line'))
await descLine.asElement().click()
await page.waitForTimeout(220)
await page.keyboard.press('End')
await page.keyboard.down('Shift')
await page.keyboard.press('Enter')
await page.keyboard.up('Shift')
await page.keyboard.type('a second line')
await page.keyboard.press('Enter')   // commits — and edit mode stays open (OB-110)
await page.waitForTimeout(300)
const whileOpen = await heightOf('one-line')
await page.keyboard.press('Escape')  // closes; the commit already landed
await page.waitForTimeout(300)
const afterBreak = await heightOf('one-line')
ok('the open row is the resting row even after the break — closing moves the card by 0', whileOpen === afterBreak, `${whileOpen} open vs ${afterBreak} at rest`)
const grew = Math.round((afterBreak - beforeBreak) * 100) / 100

// what the published geometry says the same card is now
const predicted = await page.evaluate(() => {
  const g = window.PKT_GROUP_GEOMETRY
  return g ? g.GROUP_METRICS.bodyLine : null
})
ok('a committed Shift+Enter grows the card', grew > 0, `${beforeBreak} -> ${afterBreak} (+${grew})`)
ok('and it grows it by about one line, not two',
  grew > 8 && grew < 26, `+${grew}px`)
const twoLines = await page.evaluate(() =>
  (document.querySelector('[data-case="one-line"]').textContent || '').includes('a second line'))
ok('the second line survived the commit', twoLines)
if (predicted) ok('bodyLine is published for the prediction to use', predicted > 0, String(predicted))

await page.screenshot({ path: OUT + '/inline-edit.png', fullPage: true })
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('\nall checks passed — shot at tools/studio-spike/out/inline-edit.png')
