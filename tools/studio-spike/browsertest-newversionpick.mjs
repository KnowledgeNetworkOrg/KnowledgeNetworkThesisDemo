// browsertest-newversionpick.mjs — binding a node into a NEW version's empty slot.
//
// A TEST. It was not one until 2026-09-03: this file began as `drive-newversion.mjs`,
// a reproduction written during a debugging session for "I can't pick a node when I
// create a new version". It walked the whole gesture and PRINTED what it found at
// each step — its own header said it reported "rather than asserting a guess" — so
// it could not fail, and once the bug was fixed it sat in the folder passing forever
// while checking nothing. `run-browsertests.mjs` then counted it as a passing test,
// which is worse than not having it.
//
// The bug is fixed, and the gesture it walks is covered by nothing else:
// `drive-pickerslot.mjs` asserts that adding a version PUTS an empty slot on the
// road, and stops there. That the slot can then be FILLED — the actual complaint —
// was asserted nowhere. So this is converted rather than deleted.
//
// THE PICK IS MADE WITH A REAL MOUSE, and that is the point of the file. A
// programmatic `.click()` dispatches only the click event and skips mousedown and
// mouseup entirely, which is exactly where a "nothing happens when I select"
// bug hides: the picker's own dismiss handler and the road's drag gestures both
// listen on mousedown, so a menu that closes on mousedown eats the click that
// follows. This presses, checks the menu SURVIVED the press, and only then releases.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/browsertest-newversionpick.mjs
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5224
const WANT = 'TCP & UDP'

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
/** stop early rather than time out for 30s on a locator whose prerequisite failed */
const done = (why) => {
  console.log(checks.join('\n'))
  console.error(`\ncannot continue: ${why}\n\n${errors.length} failure(s):\n${errors.join('\n')}`)
  browser.close().then(() => vite.kill())
  process.exitCode = 1
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

await page.goto(`http://localhost:${PORT}/`)
await page.evaluate(() => localStorage.clear())
await page.reload()
await page.waitForTimeout(700)
await page.locator('[aria-label="studio-preset-plan"]').click()
await page.waitForTimeout(600)

const pickers = () => page.locator('[data-rpicknode]').count()
const SEARCH = 'input[placeholder="search nodes"]'

/** the option rows inside NodePicker's menu. They are DIVs, not buttons, and the
 *  menu is a portal with no role, so everything is scoped to the fixed-position
 *  ancestor of the search field rather than guessed at by tag. */
const menuRows = () =>
  page.evaluate(() => {
    const input = document.querySelector('input[placeholder="search nodes"]')
    if (!input) return []
    let el = input
    while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement
    if (!el) return []
    return [...el.querySelectorAll('div')]
      .filter((d) => d.children.length === 2 && d.textContent.trim())
      .map((d) => d.textContent.trim())
  })

// ── 1. open the first group card's version menu ─────────────────────────────
const cards = page.locator('[data-road-root] [data-rstage]')
if (!ok('there is a group card on the road', (await cards.count()) > 0)) done('no group card to open')
else {
  const firstCard = cards.first()
  await firstCard.scrollIntoViewIfNeeded()

  // The row is role="button" and its onClick is guarded by `if (!editing)`; the
  // version NAME inside it is an InlineText whose own onOpen starts a RENAME
  // instead. So the click lands on the row's LEFT EDGE (the check glyph), which is
  // the row itself and not the editable span.
  const versionRow = firstCard.locator('[role="button"]').filter({ hasText: /v\d/ }).first()
  if (!ok('the card carries a version row', (await versionRow.count()) > 0)) done('no version row to click')
  else {
    const rowBox = await versionRow.boundingBox()
    await page.mouse.click(rowBox.x + 6, rowBox.y + rowBox.height / 2)
    await page.waitForTimeout(400)

    // the menu portals to body, so the add row is looked for anywhere on the page
    const addRow = page.getByText(/new version|add version|\+ *version/i).first()
    if (!ok('the version menu offers a way to add one', (await addRow.count()) > 0)) done('no add-version row')
    else {
      await addRow.click()
      await page.waitForTimeout(600)

      // ── 2. the new version arrives with an empty slot to fill ─────────────
      const pickerCount = await pickers()
      if (!ok('the new version renders a node picker', pickerCount > 0, `${pickerCount} on the road`)) {
        done('the new empty version rendered no picker — this was the original bug')
      } else {
        const pk = page.locator('[data-rpicknode]').first()
        ok('the picker is visible, not merely present', await pk.isVisible())

        await pk.locator('button').first().click()
        await page.waitForTimeout(600)

        // NodePicker's menu is a plain div with no role — the search field is the
        // unambiguous tell that it opened (AuthorRoad passes `search`)
        if (!ok('the picker menu opens', (await page.locator(SEARCH).count()) > 0)) {
          done('the menu never opened')
        } else {
          const all = await menuRows()
          ok('the menu offers the corpus to pick from', all.length > 10, `${all.length} rows`)

          // ── 3. filter, then pick with a real press ────────────────────────
          await page.locator(SEARCH).fill('TCP')
          await page.waitForTimeout(350)
          const filtered = await menuRows()
          ok(`filtering narrows the list to "${WANT}"`,
            filtered.length > 0 && filtered.length < all.length && filtered.some((r) => r.includes(WANT)),
            JSON.stringify(filtered))

          const rowCentre = await page.evaluate(() => {
            const input = document.querySelector('input[placeholder="search nodes"]')
            let el = input
            while (el && getComputedStyle(el).position !== 'fixed') el = el.parentElement
            const row = [...el.querySelectorAll('div')].find((d) => d.children.length === 2 && d.textContent.trim())
            if (!row) return null
            const r = row.getBoundingClientRect()
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
          })

          if (!ok('the filtered row has a place to press', !!rowCentre)) {
            done('nothing to click')
          } else {
            await page.mouse.move(rowCentre.x, rowCentre.y)
            await page.waitForTimeout(80)
            await page.mouse.down()
            await page.waitForTimeout(80)
            // THE CHECK THE WHOLE FILE IS SHAPED AROUND: a menu that dismisses on
            // mousedown swallows the click that would have selected the row, and
            // the gesture reads as "I clicked it and nothing happened"
            ok('the menu survives the mouse going DOWN', (await page.locator(SEARCH).count()) > 0,
              'if it closes here, the click never lands on the row')
            await page.mouse.up()
            await page.waitForTimeout(450)

            // ── 4. the slot is filled ──────────────────────────────────────
            ok('the empty slot is gone once picked', (await pickers()) < pickerCount,
              `${pickerCount} before, ${await pickers()} after`)
            ok(`"${WANT}" is bound onto the road`,
              (await page.locator('[data-road-root]').getByText(WANT).count()) > 0)
          }
        }
      }
    }
  }
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
