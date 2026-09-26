// browsertest-groupedit.mjs — OB-110 (#256): a group card's WHOLE-CARD edit mode.
//
// A TEST. It opens the real walk editor in a real browser, makes a group, and works the
// five clauses of the item on the card the road draws:
//   (5) a freshly-made group opens straight into edit mode, the title holding the caret;
//   (3) a mousedown outside the card COMMITS what was typed and closes edit mode;
//   (1) clicking a line at rest opens nothing — only the pencil opens the three together;
//   (4) Escape reverts all three to their last-committed values;
//   (2) committing an empty title clears it, and at rest an empty title draws nothing;
//   (5b) adding a version puts the card back into edit mode;
//   and, OB-160 (1): with edit mode open, picking another version from the picker shows THAT
//   version's name in the field, and a commit writes it to that version, not to the one that
//   was showing before.
// Two later items on the same head ride along, read on the seeded card before anything moves:
//   OB-245: the head's number ends in the dot the pills inside it end in ("2." over "1." "2.");
//   OB-222: the tally and the receding controls share one slot — flush right at rest, a
//   cross-fade on waking with nothing moving sideways — and the pressed pencil wears the
//   editing wash rather than the inert grey.
// Every reading is off the DOM: how many `contenteditable` lines the card holds, which one
// has the focus, and what the card's text reads after each gesture.
//
// The outside click is dispatched as a real `mousedown` on the document body rather than
// aimed at a blank patch of the road — the listener under test is a document-level
// mousedown, and a blank patch is not something the seed road promises to have.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-groupedit.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5238

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

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(600)

  // ── OB-164: THE PILL'S THREE CHANGES, ON THE WALK DESK'S ACTION BAR ──────────────────
  // The one pill surface in this app that draws GLYPHS beside labels (New walk, Add node, Group,
  // Optional, Extract, Reset data), so the one where all three read: the row aligns on the
  // BASELINE (a drawn mark needs a text baseline to land on, not its box centred against the
  // label's line height), the glyph gap is --space-1, and every glyph gets the same 1px optical
  // lift. Asserted off the computed style of the Group pill; the bar is photographed for the
  // pull's before/after (shots/ is gitignored; the pull carries copies).
  /** OB-164: the pill's computed manners — the three properties the DS's PillButton.jsx carries
   *  and every pill surface must draw: baseline alignment, a --space-1 gap, the glyph's 1px lift */
  const pillManners = (btn) => btn.evaluate((b) => {
    const cs = getComputedStyle(b)
    const g = b.querySelector('span')
    const gs = g ? getComputedStyle(g) : null
    return { alignItems: cs.alignItems, gap: cs.gap, glyph: !!g, glyphPos: gs && gs.position, glyphTop: gs && gs.top, glyphFs: gs && gs.fontSize, labelFs: cs.fontSize }
  })
  const groupPill = page.getByTitle('group the selected steps')
  const gm = await pillManners(groupPill)
  ok('OB-164 (1): the action bar\'s pill aligns glyph and label on the BASELINE, not the centre', gm.alignItems === 'baseline', JSON.stringify(gm))
  ok('its glyph gap is --space-1 (4px), not --space-15 (6px)', gm.gap === '4px', gm.gap)
  ok('and the glyph carries the 1px upward nudge', gm.glyph && gm.glyphPos === 'relative' && gm.glyphTop === '-1px', `${gm.glyphPos} ${gm.glyphTop}`)
  ok('the glyph inherits the pill\'s own font size — a sm pill\'s glyph is no longer a size larger than its label', gm.glyphFs === gm.labelFs, `${gm.glyphFs} vs ${gm.labelFs}`)
  {
    const bar = groupPill.locator('xpath=..')
    const bb = await bar.boundingBox()
    await page.mouse.move(bb.x + bb.width - 8, bb.y + bb.height / 2) // wake the bar's presence without hovering a pill
    await page.waitForTimeout(400)
    await bar.screenshot({ path: 'tools/studio-spike/shots/ob164-actionbar.png' })
    await page.mouse.move(4, 4)
    await page.waitForTimeout(200)
  }

  const road = () => page.locator('[data-road-root]')
  const chip = (node) => road().locator(`[data-rnode][data-node="${node}"]`)
  const newCards = () => road().locator('[data-rstage^="draft-"]')
  const groupButton = () => page.getByTitle('group the selected steps')
  const card = () => newCards().first()
  const open = () => card().locator('[contenteditable="true"]')
  const openCount = () => open().count()
  const focusedIs = (n) => open().nth(n).evaluate((el) => el === document.activeElement)
  const text = () => card().innerText()
  const outsideMousedown = () => page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })))
  // the card's CENTRE is under a step chip (the road floats the version's steps over the
  // body slot as board-level siblings), so presence is woken on the head row instead
  const wakeHead = async () => {
    const b = await card().boundingBox()
    await page.mouse.move(b.x + 30, b.y + 10)
    await page.waitForTimeout(250)
  }
  const pencil = async () => {
    await wakeHead()
    await card().getByLabel('edit', { exact: true }).click()
    await page.waitForTimeout(250)
  }

  ok('the walk editor is on the desk', (await road().count()) === 1)

  // ── OB-245 + OB-222: THE HEAD OF A VERSIONED CARD, read on the seeded one ─────────────────
  // (OB-245) one notation per card: the head's number and the pills inside it all end in a dot,
  // while the road still hands the head its dot-less outline "2" — the dot is the component's.
  // (OB-222) the tally and the receding controls share ONE right-hand slot: at rest the count
  // sits flush against the head row's right edge, and waking the card fades the buttons in over
  // that same space and the count out, with nothing in the head moving sideways.
  {
    const seed = road().locator('[data-rstage="seed-net"]')
    await seed.scrollIntoViewIfNeeded()
    await page.mouse.move(4, 4)
    await page.waitForTimeout(900) // the recede clock (500ms) and the fade (250ms), with room
    const headIndex = (await seed.locator('[data-grab] > span').first().innerText()).trim()
    const pillNumber = async (node) => ((await chip(node).innerText()).match(/\d+(?:\.\d+)*\.?/) || [''])[0]
    const pills = [await pillNumber('stk-ip-routing'), await pillNumber('stk-tcp-udp')]
    ok('OB-245: the card head reads "2." though the road still hands it "2"', headIndex === '2.', JSON.stringify(headIndex))
    ok('and the pills inside it read "1." "2." — one notation on one card', pills[0] === '1.' && pills[1] === '2.', JSON.stringify(pills))

    const head = () => seed.evaluate((card) => {
      const tally = card.querySelector('span[title$="inside this version"]')
      const row = tally.closest('[data-grab]')
      const edges = (el) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right } }
      const button = (label) => card.querySelector(`button[aria-label="${label}"]`)
      return {
        tally: edges(tally), row: edges(row), wrap: edges(row.parentElement),
        tallyOpacity: getComputedStyle(tally.parentElement).opacity,
        ctlOpacity: getComputedStyle(button('edit').parentElement).opacity,
        index: edges(row.querySelector(':scope > span')),
        title: edges(row.querySelector(':scope > span[data-grab]')),
        edit: edges(button('edit')), fold: edges(button('minimize')), ungroup: edges(button('ungroup nodes')),
      }
    })
    const rest = await head()
    ok('OB-222: at rest the tally shows and the controls do not', rest.tallyOpacity === '1' && rest.ctlOpacity === '0', `tally ${rest.tallyOpacity}, controls ${rest.ctlOpacity}`)
    ok('OB-222: at rest the tally sits flush against the head row\'s right edge — no reserved strip beside it, only the row\'s own 2px',
      Math.abs(rest.row.r - rest.tally.r) < 0.5 && Math.abs(rest.wrap.r - rest.tally.r - 2) < 0.5,
      `${(rest.row.r - rest.tally.r).toFixed(2)}px to the row's edge, ${(rest.wrap.r - rest.tally.r).toFixed(2)}px to the card's inner edge`)
    const sb = await seed.boundingBox()
    await page.mouse.move(sb.x + 30, sb.y + 10)
    await page.waitForTimeout(450)
    const live = await head()
    ok('OB-222: waking the card fades the controls in and the tally out', live.tallyOpacity === '0' && live.ctlOpacity === '1', `tally ${live.tallyOpacity}, controls ${live.ctlOpacity}`)
    const moved = ['index', 'title', 'edit', 'fold', 'ungroup'].filter((k) => Math.abs(live[k].l - rest[k].l) > 0.5 || Math.abs(live[k].r - rest[k].r) > 0.5)
    ok('with no horizontal movement of the index, the title or the buttons between the two states', moved.length === 0, moved.join(', ') || 'none moved')
    ok('and the buttons end where the figure did — one slot, two occupants', Math.abs(live.ungroup.r - rest.tally.r) < 0.5, `${live.ungroup.r.toFixed(2)} vs ${rest.tally.r.toFixed(2)}`)
    await page.mouse.move(4, 4)
    await page.waitForTimeout(200)
  }

  await chip('web-sockets-apis').click({ modifiers: ['Control'] })
  await chip('app-authentication-authorization').click({ modifiers: ['Control'] })
  await page.waitForTimeout(200)
  await groupButton().click()
  await page.waitForTimeout(700)
  ok('Group made one new card', (await newCards().count()) === 1)

  // (5) a fresh group opens straight into edit mode
  ok('clause 5: the fresh card opens with its three lines editable', (await openCount()) === 3, `${await openCount()} open`)
  ok('and the TITLE holds the caret, not the other two', await focusedIs(0) && !(await focusedIs(1)) && !(await focusedIs(2)))
  ok('the pencil reads "done editing" while open', (await card().getByLabel('done editing', { exact: true }).count()) === 1)

  // (3) an outside mousedown commits, then closes
  await page.keyboard.type('Alpha stage')
  await outsideMousedown()
  await page.waitForTimeout(300)
  ok('clause 3: an outside mousedown closes edit mode', (await openCount()) === 0, `${await openCount()} still open`)
  ok('and what was typed is COMMITTED, not reverted', (await text()).includes('Alpha stage'), (await text()).replace(/\n/g, ' | '))

  // (1) a click on the words opens nothing
  await card().getByText('Alpha stage').click()
  await page.waitForTimeout(250)
  ok('clause 1: clicking the title at rest opens nothing', (await openCount()) === 0)
  await pencil()
  ok('the pencil opens all three lines together', (await openCount()) === 3, `${await openCount()} open`)
  ok('with the caret on the title again', await focusedIs(0))

  // OB-222 clause 6: the pencil's ON face is the EDITING pair — the wash, edge and ink the three
  // open lines wear — never the inert --surface-sunken-2 grey. Read twice: with the pointer still
  // on the pencil, and again after it has left, because leaving is what re-sets IconButton's
  // `border` shorthand and would wipe a `borderColor` set on its own (the local ★ on this face).
  {
    const want = await page.evaluate(() => {
      const probe = document.createElement('i')
      probe.style.cssText = 'color: var(--state-editing); background-color: var(--state-editing-wash); outline-color: var(--surface-sunken-2)'
      document.body.appendChild(probe)
      const cs = getComputedStyle(probe)
      const out = { ink: cs.color, face: cs.backgroundColor, grey: cs.outlineColor }
      probe.remove()
      return out
    })
    const face = () => card().getByLabel('done editing', { exact: true }).evaluate((b) => {
      const cs = getComputedStyle(b)
      return { ink: cs.color, face: cs.backgroundColor, edges: [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor] }
    })
    const isEditing = (f) => f.ink === want.ink && f.face === want.face && f.edges.every((c) => c === want.ink)
    await page.waitForTimeout(200) // the wash's own 140ms
    const onIt = await face()
    ok('OB-222 (6): with edit mode on, the pencil wears --state-editing-wash with a --state-editing edge and ink', isEditing(onIt), JSON.stringify({ got: onIt, want }))
    await wakeHead() // the pointer leaves the pencil for the title, inside the card
    await page.waitForTimeout(200)
    const offIt = await face()
    ok('and keeps that face once the pointer has left it — the edge is not wiped by the hover reset', isEditing(offIt), JSON.stringify(offIt))
    ok('no --surface-sunken-2 on the pressed pencil in either state', onIt.face !== want.grey && offIt.face !== want.grey)
  }

  // (4) Escape reverts every line
  await open().nth(1).click()
  await page.keyboard.type('scratch words')
  ok('typing into the description lands there', (await text()).includes('scratch words'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('clause 4: Escape closes edit mode', (await openCount()) === 0)
  ok('and the description reverted', !(await text()).includes('scratch words'))
  ok('while the committed title stands', (await text()).includes('Alpha stage'))

  // (2) an empty commit clears the title; at rest an empty title draws nothing
  await pencil()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(250)
  ok('Enter commits without leaving edit mode', (await openCount()) === 3)
  ok('the emptied title shows its invitation while open', (await text()).includes('name this stage'))
  await outsideMousedown()
  await page.waitForTimeout(300)
  const rest = await text()
  ok('clause 2: an empty commit CLEARED the title', !rest.includes('Alpha stage'), rest.replace(/\n/g, ' | '))
  ok('and at rest an empty title draws nothing — not the invitation either', !rest.includes('name this stage'))

  // ── OB-192: AN EMPTY IN-PLACE FIELD — the invitation is its width floor, an empty line at rest
  // carries a baseline strut, and the stage number does not step between the two states. The
  // owner's report on an unnamed stage: the editing outline drawn as a 12px ring around the first
  // two letters of "name this stage", and the stage number and node tally stepping 1.33px down on
  // the click into edit mode and back up on the click out. Measured here on the card just emptied:
  // the head row's index `y` at rest (empty title), open (blank field with its invitation), after
  // one keystroke, and at rest again — all equal; the field never narrower than the invitation.
  const indexY = () => card().locator('[data-grab] > span').first().evaluate((el) => el.getBoundingClientRect().y)
  const titleSpan = () => card().locator('span[data-grab] > span > span').first() // the title box > InlineText's wrapper > the line
  const yRestEmpty = await indexY()
  ok('OB-192: at rest an empty title holds a zero-width strut (U+200B), so the row has a baseline', (await titleSpan().evaluate((el) => el.textContent)) === '\u200b', JSON.stringify(await titleSpan().evaluate((el) => el.textContent)))
  ok('and the strut never reached the store: nothing persisted carries U+200B', await page.evaluate(() => !Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes('\u200b'))))
  await pencil()
  const yOpenBlank = await indexY()
  const floor = await open().first().evaluate((el) => {
    const w = el.getBoundingClientRect().width
    const inv = [...el.parentElement.querySelectorAll('span[aria-hidden]')].map((s) => s.getBoundingClientRect().width).filter((x) => x > 0)
    return { field: w, invitation: Math.max(0, ...inv) }
  })
  ok('open and blank, the field is at least as wide as its invitation — a textbox, not a ring round two letters', floor.invitation > 40 && floor.field >= floor.invitation - 1, `field ${floor.field.toFixed(1)}px, invitation ${floor.invitation.toFixed(1)}px`)
  ok('the stage number did not move on the click INTO edit mode', Math.abs(yOpenBlank - yRestEmpty) < 0.5, `${yRestEmpty.toFixed(2)} -> ${yOpenBlank.toFixed(2)}`)
  await page.keyboard.type('B')
  await page.waitForTimeout(150)
  const fieldAfterKey = await open().first().evaluate((el) => el.getBoundingClientRect().width)
  ok('and the floor holds through the first keystroke — no width jump', Math.abs(fieldAfterKey - floor.field) < 1, `${floor.field.toFixed(1)} -> ${fieldAfterKey.toFixed(1)}`)
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  ok('Escape reverted to the empty title', (await openCount()) === 0 && !(await text()).includes('B'))
  ok('and the stage number is back where it was — the row stepped nowhere in either direction', Math.abs((await indexY()) - yRestEmpty) < 0.5, `${yRestEmpty.toFixed(2)} -> ${(await indexY()).toFixed(2)}`)

  // (5b) adding a version re-enters edit mode
  await wakeHead()
  await card().locator('[role="button"]').first().click()
  await page.waitForTimeout(250)
  await page.getByText('add new version').click()
  await page.waitForTimeout(400)
  ok('clause 5b: adding a version puts the card into edit mode', (await openCount()) === 3, `${await openCount()} open`)
  await open().nth(2).click()
  await page.keyboard.type('Second take')
  await outsideMousedown()
  await page.waitForTimeout(300)
  ok('and the new version can be named at once', (await text()).includes('Second take'), (await text()).replace(/\n/g, ' | '))

  // ── OB-160 (1): the name field belongs to the version showing, not to the edit session ──
  // The field seeds its value once, when editing opens. Without a remount on the version's id,
  // picking another version while editing kept showing the previous version's name, and a
  // commit then wrote that name onto the newly-picked version.
  await pencil()
  const verField = () => open().nth(2).innerText()
  // the picker row is clicked at its LEFT EDGE (the check mark): while editing, the version
  // name in that row is an open field that swallows a click on the row's centre
  const openPicker = async () => { await card().locator('[role="button"]').first().click({ position: { x: 8, y: 10 } }); await page.waitForTimeout(250) }
  ok('OB-160: the pencil reopens the three lines with the version field reading "Second take"', (await openCount()) === 3 && (await verField()).includes('Second take'), await verField())
  await openPicker()
  await page.locator('[role="option"]').first().click()
  await page.waitForTimeout(300)
  ok('picking the first version WHILE editing keeps edit mode open', (await openCount()) === 3, `${await openCount()} open`)
  ok('and the version field now shows the picked version, not "Second take"', !(await verField()).includes('Second take'), JSON.stringify(await verField()))
  await open().nth(2).click()
  await page.keyboard.type('First take')
  await outsideMousedown()
  await page.waitForTimeout(300)
  ok('a commit writes the typed name to the PICKED version', (await text()).includes('First take') && !(await text()).includes('Second take'), (await text()).replace(/\n/g, ' | '))
  await wakeHead()
  await openPicker()
  await page.locator('[role="option"]').nth(1).click()
  await page.waitForTimeout(300)
  ok('and the other version still carries its own name — "Second take" was not overwritten', (await text()).includes('Second take') && !(await text()).includes('First take'), (await text()).replace(/\n/g, ' | '))
  ok('no page errors', errors.filter((e) => e.startsWith('pageerror')).length === 0)
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
