// browsertest-optionalgroup.mjs — #344 (DS OB-215, OB-214, OB-216): optionality, end to end.
//
// A TEST. The three obligations are one chain on the running page, so it is checked as one:
//
//   OB-215  the walk editor's Optional button acts on a whole GROUP — enabled with the group
//           selected, one press writes every leaf inside it in one undo step, the group itself
//           stores no flag, and a group whose leaves disagree shows the pill's third, MIXED rung.
//           A press from mixed makes every leaf optional.
//   OB-214  the map's pin for an optional stop draws a DASHED ring, and a run never merges
//           across an optional/required boundary, so the optional stop is a pin of its own.
//   OB-216  optionality's second channel: the pin's numeral is slanted (an oblique, never
//           italic), the stop's NAME is italic on the strip, the dock's open row, the dock's
//           closed rail and the hover card — and, per the amendment, NOTHING DROPS TO REGULAR:
//           the closed rail and the card heading stay semibold italic. The "(optional)" suffix
//           stays regular italic, and the closed rail's note after it stays upright.
//
// THE FIXTURE IS ITS OWN DRAFT, written into storage before the app boots, rather than the seed:
// the closed rail's third clause is about the text AFTER the suffix, and the seed's stops carry no
// notes, so on the seed that clause would pass by having nothing to look at. The draft is the seed's
// opening shape — a leaf, then "Reach the machine" holding two stops, then two leaves — with a note
// on every stop and nothing optional yet; the test makes it optional through the button.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run from anywhere:  node tools/studio-spike/browsertest-optionalgroup.mjs
// Exits nonzero on any failed check or any page error.
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5264

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

const DNS = 'stk-dns-naming'
const IP = 'stk-ip-routing'
const TCP = 'stk-tcp-udp'
const HTTP = 'web-http-rest'
const AUTH = 'app-authentication-authorization'
const GROUP = 'net'
/** walk order, 1-based, as the pins number it: dns 1, ip 2, tcp 3, http 4, auth 5 */
const DRAFT = {
  stops: [
    { node: DNS, note: 'a typed name becomes an address', variants: [] },
    {
      key: GROUP,
      title: 'Reach the machine',
      variants: [{ id: GROUP + '-v0', label: '', steps: [
        { node: IP, note: 'packets hop toward the address', variants: [] },
        { node: TCP, note: 'a stream out of the hops', variants: [] },
      ] }],
    },
    { node: HTTP, note: 'the browser finally talks', variants: [] },
    { node: AUTH, note: 'the page knows who it is for', variants: [] },
  ],
  choices: {},
  withOptionals: true,
}

try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate((draft) => {
    localStorage.clear()
    localStorage.setItem('pkt.walkdesk.draft', JSON.stringify(draft))
  }, DRAFT)
  await page.reload()
  await page.waitForTimeout(700)
  await page.getByLabel('studio-preset-plan').click()
  await page.waitForTimeout(600)
  // the strip is the fourth surface; Plan does not carry the walk viewer, so it is added
  await page.getByLabel('studio-inst-walkviewer').click()
  await page.waitForTimeout(600)
  await page.evaluate(() => document.fonts.ready)

  const editor = page.locator('[aria-label="studio-pane-walkeditor"]')
  const map = page.locator('[aria-label="map-view"]')
  const viewer = page.locator('[aria-label="walk-viewer"]')
  const dock = () => map.locator('[data-walk-dock]')
  const card = editor.locator(`[data-rstage="${GROUP}"]`)
  const chip = (node) => editor.locator(`[data-rnode][data-node="${node}"]`).first()
  const pill = editor.getByRole('button', { name: 'Optional', exact: true })
  const pressed = () => pill.getAttribute('aria-pressed')
  const chipOpt = async (node) => (await chip(node).getAttribute('data-ropt')) === '1'
  const chipSays = async (node) => ((await chip(node).innerText()) || '').includes('(optional)')
  /** a pill's resting face, read while the pointer is elsewhere — hover takes its own wash */
  const face = () => pill.evaluate((b) => ({ bg: getComputedStyle(b).backgroundColor, bd: getComputedStyle(b).borderTopColor }))
  const selectGroup = async () => {
    // the card's number in its head: a plain click there bubbles to the card, which selects it
    await card.locator('[data-grab] > span').first().click()
    await page.waitForTimeout(200)
  }
  const selectChip = async (node) => {
    await chip(node).click()
    await page.waitForTimeout(200)
  }
  const press = async () => {
    await pill.click()
    await page.mouse.move(4, 4)
    await page.waitForTimeout(250)
  }

  // ── OB-215 — the button acts on the group ──────────────────────────────────────────────
  ok('the stored draft loaded: the group is on the road with both its stops', (await card.count()) === 1 && (await chip(IP).count()) === 1 && (await chip(TCP).count()) === 1)
  ok('and nothing is optional yet', !(await chipOpt(IP)) && !(await chipOpt(TCP)))

  await selectGroup()
  await page.mouse.move(4, 4)
  await page.waitForTimeout(200)
  ok('OB-215 (2): with the group selected, the Optional button is ENABLED', await pill.isEnabled())
  ok('and reads OFF — a toggle, `aria-pressed="false"`', (await pressed()) === 'false', String(await pressed()))
  const offFace = await face()

  await press()
  ok('OB-215 (2): ONE press marks EVERY stop inside the group — both chips draw optional', (await chipOpt(IP)) && (await chipOpt(TCP)) && (await chipSays(IP)) && (await chipSays(TCP)))
  ok('and the stop outside it is untouched', !(await chipOpt(DNS)))
  ok('the button now reads fully ON', (await pressed()) === 'true', String(await pressed()))
  const onFace = await face()

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('pkt.walkdesk.draft') || 'null'))
  const box = stored && stored.stops[1]
  ok('OB-215 (1): the GROUP stores no `optional` field — only its leaves carry one', !!box && !('optional' in box) && box.variants[0].steps.every((s) => s.optional === true), JSON.stringify(box))

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(250)
  ok('OB-215 (2): it was ONE undo step — a single undo clears both stops together', !(await chipOpt(IP)) && !(await chipOpt(TCP)))
  await page.keyboard.press('Control+y')
  await page.waitForTimeout(250)
  ok('and a single redo sets both again', (await chipOpt(IP)) && (await chipOpt(TCP)))

  // mixed: toggle one leaf alone, then read the group
  await selectChip(TCP)
  ok('a lone optional stop reads ON', (await pressed()) === 'true', String(await pressed()))
  await press()
  ok('pressing on the lone stop clears just that one', (await chipOpt(IP)) && !(await chipOpt(TCP)))
  await selectGroup()
  await page.mouse.move(4, 4)
  await page.waitForTimeout(200)
  ok('OB-215 (3): the group is now MIXED and the button says so — `aria-pressed="mixed"`', (await pressed()) === 'mixed', String(await pressed()))
  const mixedFace = await face()
  ok('the mixed rung is the RING without the WASH — the ring of ON, the face of OFF', mixedFace.bd === onFace.bd && mixedFace.bd !== offFace.bd && mixedFace.bg === offFace.bg && mixedFace.bg !== onFace.bg, JSON.stringify({ offFace, mixedFace, onFace }))

  await press()
  ok('OB-215 (4): a press FROM MIXED makes every stop optional', (await chipOpt(IP)) && (await chipOpt(TCP)) && (await pressed()) === 'true')

  // leave the walk mixed for the map: 2.1 optional, 2.2 required
  await selectChip(TCP)
  await press()
  ok('the fixture for the map: 2.1 optional, 2.2 required', (await chipOpt(IP)) && !(await chipOpt(TCP)))
  // deselect, so the road's selection does not ride along into the map checks
  await page.keyboard.press('Escape')
  await page.mouse.move(4, 4)
  await page.waitForTimeout(400)

  // ── OB-214 + OB-216 (1) — the map's pins ───────────────────────────────────────────────
  ok('the map is on the desk with the walk docked', (await dock().count()) === 1)
  await dock().focus()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowRight') // the cursor on stop 2, the optional one — its pin is drawn
  await page.mouse.move(4, 4)
  await page.waitForTimeout(500)

  const pinAt = (step) => map.locator(`[data-routestop][data-step="${step}"]`).first()
  const pinRead = (step) => pinAt(step).evaluate((g) => {
    const btn = g.querySelector('button')
    const num = btn && btn.querySelector(':scope > span:last-child')
    const cs = num && getComputedStyle(num)
    return {
      end: Number(g.getAttribute('data-step-end')),
      label: (g.textContent || '').trim(),
      dash: !!g.querySelector('[data-stepdot-dash]'),
      style: cs ? cs.fontStyle : null,
      transform: cs ? cs.transform : null,
    }
  })
  if (ok('the optional stop has a pin of its own drawn (step 2)', (await pinAt(2).count()) === 1)) {
    const p2 = await pinRead(2)
    ok('OB-214 (5): it stands for step 2 ALONE — no run merges it with its required neighbours', p2.end === 2, JSON.stringify(p2))
    ok('OB-214 (1)-(3): its ring is DASHED', p2.dash, JSON.stringify(p2))
    ok('OB-216 (1): its numeral is SLANTED — an oblique, not an italic', /oblique/.test(p2.style || ''), JSON.stringify(p2))
    ok('and nudged back onto the mark\'s centre (a translate, on an inline-block)', !!p2.transform && p2.transform !== 'none', JSON.stringify(p2))
  }
  if ((await pinAt(3).count()) === 1) {
    const p3 = await pinRead(3)
    ok('its required neighbour (step 3) is a SOLID ring with an upright numeral', !p3.dash && p3.style === 'normal', JSON.stringify(p3))
  } else {
    ok('the required neighbour (step 3) has a pin of its own', false, `${await pinAt(3).count()} found`)
  }

  // ── OB-216 (3) — the hover card ────────────────────────────────────────────────────────
  if ((await pinAt(2).count()) === 1) {
    await pinAt(2).hover()
    await page.waitForTimeout(350)
    const head = page.locator('[data-stop-card-head]')
    if (ok('hovering the optional pin raises its card', (await head.count()) === 1)) {
      const h = await head.evaluate((el) => {
        const cs = getComputedStyle(el)
        const addr = el.querySelector('span')
        const as = addr && getComputedStyle(addr)
        return { style: cs.fontStyle, weight: cs.fontWeight, text: el.textContent, addrStyle: as && as.fontStyle, addrTransform: as && as.transform }
      })
      ok('OB-216 (3): the card\'s heading is ITALIC and KEEPS its semibold (the amendment)', h.style === 'italic' && h.weight === '600', JSON.stringify(h))
      ok('its address is slanted by the published angle, and NOT nudged — it sits in a run of text', /oblique/.test(h.addrStyle || '') && (h.addrTransform === 'none' || !h.addrTransform), JSON.stringify(h))
    }
    await page.mouse.move(4, 4)
    await page.waitForTimeout(300)
  }

  // ── OB-216 (4) — the dock's closed rail ────────────────────────────────────────────────
  const rail = () => dock().locator('[data-walk-dock-name]').evaluate((el) => {
    const title = el.querySelector('[data-walk-dock-name-title]')
    const spans = [...el.querySelectorAll(':scope > span')]
    const suffix = spans.find((s) => s.textContent.includes('(optional)'))
    const note = spans.find((s) => s.textContent.trim().startsWith('·'))
    const read = (s) => (s ? { style: getComputedStyle(s).fontStyle, weight: getComputedStyle(s).fontWeight, text: s.textContent } : null)
    return { title: read(title), suffix: read(suffix), note: read(note) }
  })
  const onOpt = await rail()
  ok('OB-216 (4): on the optional stop the closed rail\'s NAME is italic, at the row\'s semibold', onOpt.title && onOpt.title.style === 'italic' && onOpt.title.weight === '600', JSON.stringify(onOpt))
  ok('the "(optional)" after it is italic at REGULAR weight — it does not follow the name\'s', onOpt.suffix && onOpt.suffix.style === 'italic' && onOpt.suffix.weight === '400', JSON.stringify(onOpt.suffix))
  ok('and the note after THAT stays upright — the italic is on the name\'s own span, not the row', onOpt.note && onOpt.note.style === 'normal', JSON.stringify(onOpt.note))
  await dock().focus()
  await page.keyboard.press('ArrowRight') // stop 3, required
  await page.waitForTimeout(300)
  const onReq = await rail()
  ok('on the required stop the name is upright and there is no suffix', onReq.title && onReq.title.style === 'normal' && !onReq.suffix, JSON.stringify(onReq))
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)

  // ── OB-214 (1) + OB-216 (2) — the dock's open row ──────────────────────────────────────
  await map.getByLabel('show every stop').click()
  await page.waitForTimeout(450)
  const rowStop = (i) => dock().locator(`[data-walk-dock-stop="${i}"]`).evaluate((el) => {
    const title = [...el.querySelectorAll('span')].find((s) => getComputedStyle(s).webkitLineClamp !== 'none')
    return { dash: !!el.querySelector('[data-stepdot-dash]'), style: title ? getComputedStyle(title).fontStyle : null, text: title ? title.textContent : null }
  })
  const row2 = await rowStop(1)
  const row3 = await rowStop(2)
  ok('OB-214 (1): the dock\'s open row draws the optional stop\'s dot DASHED', row2.dash, JSON.stringify(row2))
  ok('OB-216 (2): and its name italic', row2.style === 'italic' && (row2.text || '').includes('(optional)'), JSON.stringify(row2))
  ok('the required stop beside it: solid dot, upright name', !row3.dash && row3.style === 'normal', JSON.stringify(row3))
  await map.getByLabel('hide the stops').click()
  await page.waitForTimeout(450)

  // ── OB-216 (2) — the walk viewer's strip ───────────────────────────────────────────────
  const strip = await viewer.evaluate((root) => {
    const titles = [...root.querySelectorAll('span')].filter((s) => getComputedStyle(s).webkitLineClamp !== 'none')
    const italic = titles.filter((s) => getComputedStyle(s).fontStyle === 'italic')
    return { titles: titles.length, italic: italic.map((s) => s.textContent), dashes: root.querySelectorAll('[data-stepdot-dash]').length }
  })
  ok('OB-216 (2): the strip draws exactly ONE name italic — the optional stop\'s, with its suffix', strip.titles >= 5 && strip.italic.length === 1 && strip.italic[0].includes('(optional)'), JSON.stringify(strip))
  ok('and dashes exactly one dot', strip.dashes === 1, JSON.stringify(strip))

  // ── the font the amendment rests on ────────────────────────────────────────────────────
  const italicFace = await page.evaluate(() => [...document.fonts]
    .filter((f) => f.family.replace(/['"]/g, '') === 'Nunito' && f.style === 'italic')
    .map((f) => ({ weight: f.weight, status: f.status })))
  ok('the running page declares Nunito\'s italic across 400-800 — a REAL semibold italic, not a synthesised one', italicFace.length > 0 && italicFace.every((f) => f.weight === '400 800'), JSON.stringify(italicFace))

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
