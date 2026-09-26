// browsertest-dropverdict.mjs — a road refuses a duplicate drop, and the picker says why
// (#347, OB-219 + OB-220), reproduced live rather than asserted in a unit test alone.
//
// WHAT IT DRIVES. A road seeded with the same stop twice, NOT adjacent (a walk may return to a
// node — that is legitimate), plus three empty slots:
//
//      [0] DNS  [1] IP  [2] TCP  [3] DNS  [4] HTTP  [5] ·  [6] AUTH  [7] ·  [8] ·  [9] TLS
//
// Dragging the second DNS, the ONLY refused gaps are the two beside its twin — above [0] and
// between [0] and [1]. Everywhere else is a valid gap. The empty slot at [5] sits between two
// resolved stops, so its menu greys exactly those two; [7] and [8] each have a picker on one
// side, so each greys only its one resolved neighbour.
//
// THE DRAG IS SYNTHETIC, AND SPLIT ACROSS TWO TICKS, on purpose (the card's own warning).
// A driver's native drag is one opaque gesture that cannot be paused over a gap to read what the
// road is drawing, and a synthetic drag delivered in one tick can land its dragover before the
// dragstart's work has settled — it then reports "no handler" and looks like a broken port. So
// dragstart is dispatched, the page gets a tick, and only then do the dragovers arrive.
//
// THE DRAGOVERS CARRY AN EMPTY DataTransfer, which is what a real browser hands a page during a
// drag (the spec's protected mode: the payload reads '' until the drop). That is the case the
// road's in-flight record exists for, so it is the case driven. The map's own drops carry a
// READABLE payload instead, and section 3 drives that shape too, because a map drop is never
// refused by the browser and has to be refused by the road re-asking the rule.
//
// ACCEPTANCE IS READ OFF THE EVENT: a gap that accepts a drop cancels its dragover, so
// `dispatchEvent` returning false is "takes the drop", and true is "refuses it".
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/browsertest-dropverdict.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5264
const DRAFT_KEY = 'pkt.walkdesk.draft'

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

// ── the road it starts from ──────────────────────────────────────────────────
const S = (node) => ({ node, variants: [] })
const U = { node: '', unset: true, variants: [] }
const DNS = 'stk-dns-naming'
const TLS = 'cry-tls-certificates'
const FIXTURE = [S(DNS), S('stk-ip-routing'), S('stk-tcp-udp'), S(DNS), S('web-http-rest'), U, S('app-authentication-authorization'), U, U, S(TLS)]
const FIXTURE_ORDER = FIXTURE.map((s) => (s.unset ? '·' : s.node))

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
const logged = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  logged.push(`${m.type()}: ${m.text()}`)
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(({ key, stops }) => {
  localStorage.clear()
  localStorage.setItem(key, JSON.stringify({ stops, choices: {}, withOptionals: true }))
}, { key: DRAFT_KEY, stops: FIXTURE })
await page.reload()
await page.waitForTimeout(700)
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(700)

/** the road, top to bottom: a node id per bound stop, `·` per empty slot */
const roadOrder = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-road-root] [data-rnode]')].map((el) => (el.hasAttribute('data-runset') ? '·' : el.getAttribute('data-node'))))
const storedDraft = () => page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)
const notices = () => page.evaluate(() => document.querySelectorAll('[role="status"], [role="alert"]').length)

/** dispatch one drag event at an element — its centre, or a fraction `fy` down it. `data`
 *  makes the payload READABLE (a drop, or the map's own events); without it the event carries
 *  an empty DataTransfer, as a real dragover does. Returns whether the road ACCEPTED it. */
const fire = (type, sel, opts = {}) =>
  page.evaluate(({ type, sel, opts }) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = (opts.x ?? r.left + r.width / 2) + (opts.dx ?? 0)
    const y = r.top + (opts.fy ?? 0.5) * r.height
    const dt = new DataTransfer()
    if (opts.data) dt.setData('text/plain', opts.data)
    const notCancelled = el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt }))
    return { accepted: !notCancelled, x, y, rect: { left: r.left, top: r.top, width: r.width, height: r.height } }
  }, { type, sel, opts })

/** what the road is drawing right now: the verdict line (and how it is stroked), whether an
 *  arrow still stands in a gap, and the refusal pill */
const drawn = (gap) =>
  page.evaluate((gap) => {
    const line = document.querySelector('[data-road-root] [data-rverdict]')
    const bar = line?.firstElementChild
    const cs = bar ? getComputedStyle(bar) : null
    const pill = document.querySelector('[data-rrefusal]')
    const pr = pill?.getBoundingClientRect()
    /* SOLID is "no border at all, a 2px filled bar". Read the border's WIDTH, not its style:
       Tailwind's preflight gives every element `border: 0 solid`, so an unbordered bar reports
       `solid` as its style and would never read `none`. */
    return {
      verdict: line?.getAttribute('data-rverdict') ?? null,
      dashed: cs ? cs.borderTopStyle === 'dashed' : null,
      solid: cs ? parseFloat(cs.borderTopWidth) === 0 && parseFloat(cs.height) === 2 && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' : null,
      arrow: gap ? document.querySelectorAll(`[data-rarrow][data-rgap="${gap}"]`).length : null,
      pill: pill ? pill.textContent : null,
      pillAt: pr ? { cx: pr.left + pr.width / 2, top: pr.top } : null,
    }
  }, gap)

const settle = () => page.waitForTimeout(60)
const SOURCE = '[data-road-root] [data-rnode][data-rord="4"]' // the second DNS
const slot = (i) => `[data-road-root] [data-rslot="b.${i}"]`

// ── 0. the road is the fixture ───────────────────────────────────────────────
const before = await roadOrder()
if (!ok('the road opens on the fixture', JSON.stringify(before) === JSON.stringify(FIXTURE_ORDER), JSON.stringify(before))) {
  console.log(checks.join('\n'))
  await browser.close()
  vite.kill()
  process.exit(1)
}
const draftBefore = await storedDraft()

// ── 1. drag the second DNS over every gap ───────────────────────────────────
const start = await fire('dragstart', SOURCE)
ok('the drag starts on the second DNS', !!start)
await page.waitForTimeout(80) // THE SECOND TICK — see the header

for (let i = 0; i <= FIXTURE.length; i++) {
  const hit = await fire('dragover', slot(i))
  await settle()
  const d = await drawn(`b.${i}`)
  const twin = i === 0 || i === 1
  if (twin) {
    ok(`gap ${i} (beside the twin) refuses the drop`, hit && !hit.accepted)
    ok(`gap ${i} draws a STRUCK line`, d.verdict === 'refused' && d.dashed === true, JSON.stringify(d))
    ok(`gap ${i} shows "already adjacent" under the held node`, !!d.pill && d.pill.includes('already adjacent'), String(d.pill))
  } else {
    ok(`gap ${i} takes the drop`, hit && hit.accepted)
    ok(`gap ${i} draws a SOLID line and says nothing`, d.verdict === 'ok' && d.solid === true && d.pill === null, JSON.stringify(d))
  }
  // gaps 1..9 sit between two stops and carry an arrow; the line stands in its place
  if (i >= 1 && i < FIXTURE.length) ok(`gap ${i}'s arrow gives way to the line`, d.arrow === 0, `${d.arrow} arrow(s) left`)
}

// the upper and lower halves of a stop judge the gap they would land in
for (const [ord, fy, gap, refused] of [['1', 0.8, 1, true], ['2', 0.2, 1, true], ['2', 0.8, 2, false], ['1', 0.2, 0, true]]) {
  const hit = await fire('dragover', `[data-road-root] [data-rnode][data-rord="${ord}"]`, { fy })
  await settle()
  const d = await drawn(`b.${gap}`)
  ok(`stop ${ord}, ${fy < 0.5 ? 'upper' : 'lower'} half → gap ${gap} ${refused ? 'refused' : 'taken'}`,
    hit && hit.accepted === !refused && d.verdict === (refused ? 'refused' : 'ok'), JSON.stringify({ accepted: hit?.accepted, ...d }))
}

// the pill hangs dropGap (4) under the held node and travels with it. The drag was picked up at
// the source's centre, so the held node is centred on the pointer: its bottom is half its height
// below it, and the pill is centred under it.
{
  const h = start.rect.height
  const a = await fire('dragover', slot(1))
  await settle()
  const pa = (await drawn()).pillAt
  ok('the pill sits 4px under the held node, centred on it', !!pa && Math.abs(pa.top - (a.y + h / 2 + 4)) <= 1 && Math.abs(pa.cx - a.x) <= 1,
    JSON.stringify({ pill: pa, want: { cx: a.x, top: a.y + h / 2 + 4 } }))
  const b = await fire('dragover', slot(1), { dx: 24 })
  await settle()
  const pb = (await drawn()).pillAt
  ok('and it moves with the pointer inside one verdict', !!pb && Math.abs(pb.cx - b.x) <= 1, JSON.stringify({ pill: pb, pointer: b.x }))
}

// ── 2. release over a refused gap: nothing happens, and nothing is said ─────
{
  await fire('dragover', slot(1))
  await settle()
  const noticesBefore = await notices() // the pill itself is a role="status" while the drag runs
  const loggedBefore = logged.length
  // a real browser fires NO drop on a gap that refused it — dragleave there, then dragend
  await fire('dragleave', slot(1))
  await fire('dragend', SOURCE)
  await page.waitForTimeout(250)
  const d = await drawn('b.1')
  ok('on release the pill and the line are gone', d.pill === null && d.verdict === null, JSON.stringify(d))
  ok('the arrow is back in its gap', d.arrow === 1)
  ok('the road is exactly as it was', JSON.stringify(await roadOrder()) === JSON.stringify(FIXTURE_ORDER), JSON.stringify(await roadOrder()))
  ok('the saved draft is untouched', (await storedDraft()) === draftBefore)
  ok('no notice appears', (await notices()) === noticesBefore - 1, `${noticesBefore} while dragging, ${await notices()} after`)
  ok('nothing is logged', logged.length === loggedBefore, logged.slice(loggedBefore).join(' | '))
  // an empty history stays empty — undo has nothing to take back
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  ok('undo after the refusal changes nothing', JSON.stringify(await roadOrder()) === JSON.stringify(FIXTURE_ORDER))
}

// ── 3. the map's shape of drop: readable, dispatched, never refused by the browser ──
{
  const over = await fire('dragover', slot(1), { data: 'pal:' + DNS })
  await settle()
  ok('a map drag over the twin\'s gap is refused too', over && !over.accepted && (await drawn('b.1')).verdict === 'refused')
  await fire('drop', slot(1), { data: 'pal:' + DNS })
  await page.waitForTimeout(250)
  ok('…and its drop, which the map dispatches anyway, does nothing', JSON.stringify(await roadOrder()) === JSON.stringify(FIXTURE_ORDER), JSON.stringify(await roadOrder()))

  // the board's catch-all appends at the end, so it is judged as the tail gap — next to TLS
  const tail = await fire('dragover', '[data-road-root]', { data: 'pal:' + TLS, fy: 0.97 })
  await settle()
  ok('the board\'s catch-all refuses a node that would follow its own twin', tail && !tail.accepted && (await drawn()).verdict === 'refused',
    JSON.stringify({ accepted: tail?.accepted, ...(await drawn()) }))
  await fire('drop', '[data-road-root]', { data: 'pal:' + TLS, fy: 0.97 })
  await fire('dragleave', '[data-road-root]')
  await page.waitForTimeout(250)
  ok('…and appends nothing', JSON.stringify(await roadOrder()) === JSON.stringify(FIXTURE_ORDER), JSON.stringify(await roadOrder()))
  ok('no pill is left behind', (await drawn()).pill === null)
}

// ── 4. the picker greys exactly the refused rows, and they refuse the click ─
const SEARCH = 'input[placeholder="search nodes"]'
/** the open menu's refused rows, as their text (title + reason) */
const refusedRows = () =>
  page.evaluate(() => {
    const input = document.querySelector('input[placeholder="search nodes"]')
    let el = input
    while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement
    return el ? [...el.querySelectorAll('[aria-disabled="true"]')].map((d) => d.textContent.trim()) : null
  })
const chipText = (ord) => page.locator(`[data-road-root] [data-rnode][data-rord="${ord}"]`).textContent()
const openPicker = async (i) => {
  await page.locator(`[data-rpicknode="b.${i}"] button`).first().click()
  await page.waitForTimeout(400)
  return (await page.locator(SEARCH).count()) > 0
}
const closePicker = async () => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
}
/** does every refused row name one of these chips, with the drag's own sentence under it? */
const namesExactly = async (rows, ords) => {
  const chips = await Promise.all(ords.map(chipText))
  const titles = rows.map((r) => r.replace(/already adjacent$/, '').trim())
  return rows.length === ords.length &&
    rows.every((r) => r.endsWith('already adjacent')) &&
    chips.every((c) => titles.some((t) => t && c.includes(t)))
}

if (ok('the slot between HTTP and AUTH opens its menu', await openPicker(5))) {
  const rows = await refusedRows()
  ok('exactly its two neighbours are greyed, each with "already adjacent"', !!rows && (await namesExactly(rows, ['5', '7'])), JSON.stringify(rows))

  // a greyed row refuses a real press — the menu stays open and the slot stays empty. Looked
  // for INSIDE the menu: the app's own chrome can carry aria-disabled too, and it comes first
  const box = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="search nodes"]')
    let el = input
    while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement
    const row = el?.querySelector('[aria-disabled="true"]')
    if (!row) return null
    row.scrollIntoView({ block: 'nearest' })
    const r = row.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  if (ok('a greyed row is on screen to press', !!box)) {
    await page.mouse.move(box.x, box.y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(350)
    ok('pressing it picks nothing', (await page.locator('[data-rpicknode="b.5"]').count()) === 1 && (await page.locator(SEARCH).count()) > 0)
  }

  // …while every other row still picks. Found by its exact title: the row is the div that
  // holds that title's span, and nothing else in the menu is
  await page.locator(SEARCH).fill('TCP')
  await page.waitForTimeout(300)
  const free = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="search nodes"]')
    let el = input
    while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement
    const title = el && [...el.querySelectorAll('span')].find((s) => s.textContent === 'TCP & UDP')
    const row = title?.closest('div')
    if (!row || row.hasAttribute('aria-disabled')) return null
    const r = row.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  if (ok('a free row is offered', !!free)) {
    await page.mouse.move(free.x, free.y)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForTimeout(450)
    const now = await roadOrder()
    ok('a free row still picks', now[5] === 'stk-tcp-udp', JSON.stringify(now))
  }
}

if (ok('the slot between AUTH and another picker opens its menu', await openPicker(7))) {
  const rows = await refusedRows()
  ok('only the resolved side is greyed', !!rows && (await namesExactly(rows, ['7'])), JSON.stringify(rows))
  await closePicker()
}

if (ok('the slot between a picker and TLS opens its menu', await openPicker(8))) {
  const rows = await refusedRows()
  // TLS stands at [9], which the road numbers 10.
  ok('only the resolved side is greyed', !!rows && (await namesExactly(rows, ['10'])), JSON.stringify(rows))
  await closePicker()
}

// ── 5. a valid gap takes a real drop ─────────────────────────────────────────
{
  const expected = await roadOrder()
  await fire('dragstart', SOURCE)
  await page.waitForTimeout(80)
  const over = await fire('dragover', slot(2))
  await settle()
  ok('the second DNS may land between IP and TCP', over && over.accepted)
  await fire('drop', slot(2), { data: 'blk:b.3' })
  await fire('dragend', SOURCE)
  await page.waitForTimeout(350)
  const want = [...expected]
  want.splice(2, 0, ...want.splice(3, 1))
  const now = await roadOrder()
  ok('…and it does', JSON.stringify(now) === JSON.stringify(want), JSON.stringify(now))
}

ok('no page or console errors', errors.filter((e) => /^(pageerror|console):/.test(e)).length === 0,
  errors.filter((e) => /^(pageerror|console):/.test(e)).join(' | '))

await page.evaluate(() => localStorage.clear()).catch(() => {})
await browser.close()
vite.kill()

console.log(checks.join('\n'))
if (errors.length) {
  console.error('\n' + errors.length + ' failure(s):\n' + errors.join('\n'))
  process.exit(1)
}
console.log('all checks passed')
