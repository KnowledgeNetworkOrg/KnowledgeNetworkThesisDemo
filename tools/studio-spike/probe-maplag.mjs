// probe-maplag.mjs — NOT a guard, a MEASUREMENT (#238). Answers "why does the map
// feel laggy" with numbers instead of a code read: what each kind of pointer input
// actually costs, at each zoom level, and how big the thing being re-rendered is.
//
// Scenarios, over comparable pointer paths so the only variable is what the map
// does with the move:
//   idle       — no input at all, same wall time. The floor.
//   over water — moves across a stretch of the pane with no cell under it, so
//                nothing is hovered and no tooltip mounts. The case a gate on the
//                per-move state update REMOVES entirely.
//   over cells — moves along a line that crosses several live cells, tooltip up
//                nearly the whole way. The case a gate CANNOT help, and therefore
//                the one that decides whether gating is enough on its own.
//   pan        — moves with the button down.
//   zoom       — a wheel step, i.e. a 260ms rAF flight that changes `view.s`,
//                which is the only gesture that moves every stroke-width.
//
// Cost is read from CDP Performance metrics rather than wall time, because wall
// time on a dev build in a headless browser is noise. Frame timing is NOT reported
// at all: a headless browser paces rAF at a flat 16.7ms regardless of load, so it
// proves nothing. TaskDuration is the number to read — it is the work, and on a
// real machine the work is what turns into dropped frames.
//
// TWO FIDELITY TRAPS, both of which produced confident wrong numbers in earlier
// cuts of this file, and both of which are now designed out:
//
//  1. THE CAMERA CARRIES BETWEEN SCENARIOS. A pan scenario at L0 leaves the map
//     somewhere else, so the L2 sweep that follows can run entirely over water and
//     report "hovering is free" — it was measuring nothing. Every level therefore
//     starts from a RELOAD and zooms in without panning.
//  2. SUB-PIXEL STEPS ARE NOT EVENTS. Dividing a narrow cell into 61 parts gives
//     steps the browser coalesces away; the scenario then reports a small number
//     because almost no pointermove happened. Steps are a fixed pixel size, and
//     every scenario reports the pointermove count it actually generated, so a
//     silently-empty run is visible in the output instead of looking like a win.
//  3. A PAN DRIFTS, AND A DRIFTING PAN MEASURES A DIFFERENT MAP EACH REP. The
//     hover scenarios bounce inside a run with a triangle wave, which is fine
//     when the camera is still. Under a BUTTON-DOWN shuttle the same wave leaves
//     the camera somewhere new at the end of every rep, so rep 5 pans a different
//     stretch of map than rep 1 — and if that stretch is cells rather than water
//     the tooltip comes up and the cost roughly triples. That produced a median
//     of 512ms over a (142-526) spread for a gesture whose real, repeatable cost
//     was 196ms: the row read as "no change" for a fix that had cut it by 60%.
//     The pan is therefore an EXACT out-and-back, ending on the camera it
//     started from, and it is aimed at water where water exists.
//
// It ends with ONE assertion, and it is a RATIO rather than a wall-clock number:
// moving the cursor with nothing to report must cost a small fraction of moving it
// with the tooltip up. Everything above it is a reading, to be looked at by a
// person; only that ratio is allowed to fail the run.
//
// Spawns vite ITSELF — backgrounded dev servers die on this machine.
// Run:  node tools/studio-spike/probe-maplag.mjs   (exits nonzero if the ratio goes)
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 5219
const LEVELS = [0, 2, 4]
const STEPS = 60
const STEP_PX = 6
// Every scenario runs REPS times and reports the MEDIAN, because a single run of
// one of these is worth about +/-20%: an untouched pan scenario moved 614 -> 519ms
// between two runs of code that could not affect it. One number per scenario is
// not enough to tell a real change from that.
const REPS = 5

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
    if (viteOut.includes('localhost:')) {
      clearTimeout(t)
      res()
    }
  }
  vite.stdout.on('data', watch)
  vite.stderr.on('data', watch)
  vite.on('exit', (c) => rej(new Error('vite exited early ' + c + ':\n' + viteOut)))
})

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1750, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const cdp = await page.context().newCDPSession(page)
await cdp.send('Performance.enable')

const metrics = async () => {
  const { metrics: m } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(m.map((x) => [x.name, x.value]))
}

const box = () =>
  page.evaluate(() => {
    const r = document.querySelector('svg[data-nested]').getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })

const level = () => page.evaluate(() => +document.querySelector('svg[data-nested]').getAttribute('data-level'))

const size = () =>
  page.evaluate(() => {
    const svg = document.querySelector('svg[data-nested]')
    const all = svg.querySelectorAll('*')
    return {
      level: +svg.getAttribute('data-level'),
      els: all.length,
      paths: svg.querySelectorAll('path').length,
      texts: svg.querySelectorAll('text').length,
      // elements whose inline style declares a transition, and the subset a change
      // to `view.s` restarts wholesale, because FADE includes stroke-width
      transitioned: [...all].filter((e) => e.style && e.style.transition).length,
      strokeWidth: [...all].filter((e) => e.style && e.style.transition.includes('stroke-width')).length,
    }
  })

/** the pane's own horizontal midline, sampled: which stretches sit over a live
 *  cell and which over water. Both are needed as SEPARATE scenarios — the whole
 *  question is what each one costs. */
const midlineRuns = () =>
  page.evaluate(() => {
    const svg = document.querySelector('svg[data-nested]')
    const b = svg.getBoundingClientRect()
    const y = b.y + b.height / 2
    const hits = []
    for (let x = b.x + 8; x < b.x + b.width - 8; x += 4) {
      const el = document.elementFromPoint(x, y)
      const live = !!el && (el.hasAttribute('data-terr') || el.hasAttribute('data-region')) && getComputedStyle(el).pointerEvents !== 'none'
      hits.push({ x, live })
    }
    // longest contiguous run of each kind
    const longest = (want) => {
      let best = null
      let run = null
      for (const h of hits) {
        if (h.live === want) run = run ? { a: run.a, b: h.x } : { a: h.x, b: h.x }
        else run = null
        if (run && (!best || run.b - run.a > best.b - best.a)) best = { ...run }
      }
      return best && best.b - best.a >= 40 ? { ...best, y } : null
    }
    return { cells: longest(true), water: longest(false) }
  })

const tipUp = () => page.evaluate(() => !!document.querySelector('[data-maptip]'))

/** frame-by-frame through one zoom flight: how far the RENDERED stroke width sits
 *  from the attribute React has just written to the same element.
 *
 *  This is the second thing #238's fix 2 is about, and the more important one. The
 *  map sets stroke-width to px(k) every frame of a flight; a CSS transition on that
 *  property does not smooth anything (the value was already continuous) but it does
 *  EASE TOWARD a target that has already moved on, so the line-work renders at the
 *  wrong weight for the whole gesture. Sampled against the version that had
 *  `stroke-width` in FADE, the gap peaked at 98.8% — twice the intended weight —
 *  and was still >1% out 587ms into a 260ms flight. It should now read 0.
 *
 *  Returns the worst gap seen, as a percentage. Resolves after the flight. */
const strokeLagPct = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const svg = document.querySelector('svg[data-nested]')
        const els = [...svg.querySelectorAll('[data-border], [data-terr], [data-region]')].slice(0, 60)
        let worst = 0
        const t0 = performance.now()
        const tick = () => {
          for (const e of els) {
            const attr = parseFloat(e.getAttribute('stroke-width') || '0')
            const rendered = parseFloat(getComputedStyle(e).strokeWidth)
            if (!attr || !isFinite(rendered)) continue
            worst = Math.max(worst, Math.abs(rendered - attr) / attr)
          }
          if (performance.now() - t0 < 700) requestAnimationFrame(tick)
          else resolve(+(worst * 100).toFixed(1))
        }
        requestAnimationFrame(tick)
      }),
  )

/** a bouncing shuttle of fixed-size steps inside [a, b] at height y — fixed size
 *  because sub-pixel steps get coalesced into no event at all (trap 2 above) */
const shuttle = (run, down) => async () => {
  const span = Math.max(STEP_PX * 2, run.b - run.a)
  if (down) await page.mouse.down()
  await page.evaluate(() => {
    window.__pm = 0
    if (!window.__pmOn) {
      document.querySelector('svg[data-nested]').addEventListener('pointermove', () => window.__pm++, true)
      window.__pmOn = 1
    }
  })
  let up = 0
  for (let i = 0; i <= STEPS; i++) {
    const raw = (i * STEP_PX) % (2 * span)
    await page.mouse.move(run.a + (raw < span ? raw : 2 * span - raw), run.y)
    if (i % 10 === 0 && (await tipUp())) up++
  }
  if (down) await page.mouse.up()
  return { tips: `${up}/7`, moves: await page.evaluate(() => window.__pm) }
}

/** the pan gesture: exactly `STEPS/2` steps out and the same back, so the camera
 *  is returned to where the rep found it (trap 3). Deliberately NOT `shuttle` —
 *  a triangle wave inside a run only returns to its start when the run happens
 *  to divide evenly, and under a held button that difference accumulates. */
const panGesture = (run) => async () => {
  const half = STEPS >> 1
  const reach = Math.min(half * STEP_PX, Math.max(STEP_PX * 4, run.b - run.a))
  const steps = Math.round(reach / STEP_PX)
  await page.evaluate(() => {
    window.__pm = 0
    if (!window.__pmOn) {
      document.querySelector('svg[data-nested]').addEventListener('pointermove', () => window.__pm++, true)
      window.__pmOn = 1
    }
  })
  let x = run.a
  await page.mouse.move(x, run.y)
  await page.mouse.down()
  let up = 0
  let seen = 0
  for (const dir of [1, -1])
    for (let i = 0; i < steps; i++) {
      x += dir * STEP_PX
      await page.mouse.move(x, run.y)
      if (i % 5 === 0) {
        seen++
        if (await tipUp()) up++
      }
    }
  await page.mouse.up()
  return { tips: `${up}/${seen}`, moves: await page.evaluate(() => window.__pm) }
}

const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b)
  return v[v.length >> 1]
}

const rows = []
const strokeLag = []
const run = async (lvl, name, body, park) => {
  const takes = []
  let last = {}
  for (let k = 0; k < REPS; k++) {
    if (park) await page.mouse.move(park.x, park.y)
    await page.waitForTimeout(300)
    const a = await metrics()
    last = (await body()) ?? {}
    const z = await metrics()
    takes.push({
      task: +((z.TaskDuration - a.TaskDuration) * 1000).toFixed(0),
      script: +((z.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0),
      recalcs: z.RecalcStyleCount - a.RecalcStyleCount,
      layouts: z.LayoutCount - a.LayoutCount,
    })
  }
  const tasks = takes.map((t) => t.task)
  rows.push({
    level: lvl,
    name,
    task: median(tasks),
    lo: Math.min(...tasks),
    hi: Math.max(...tasks),
    script: median(takes.map((t) => t.script)),
    recalcs: median(takes.map((t) => t.recalcs)),
    layouts: median(takes.map((t) => t.layouts)),
    moves: last.moves ?? '',
    tips: last.tips ?? '',
  })
}

const sizes = []
for (const target of LEVELS) {
  // TRAP 1: every level starts from a clean camera, never from wherever the last
  // level's pan left it
  await page.goto(`http://localhost:${PORT}/`)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForTimeout(700)
  // give the map the whole desk — the opening preset leaves it a quarter of the
  // window, which is not the geometry anyone reports lag against
  for (const inst of ['unfoldgraph', 'document', 'walkviewer']) {
    await page.getByLabel(`studio-inst-${inst}`).click()
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(800)

  while ((await level()) < target) {
    const b = await box()
    const before = await level()
    await page.mouse.move(b.x + b.w * 0.5, b.y + b.h * 0.5)
    await page.mouse.wheel(0, -60)
    await page.waitForTimeout(700)
    if ((await level()) === before) break
  }

  const s = await size()
  sizes.push(s)
  const { cells, water } = await midlineRuns()

  // one flight, sampled — see strokeLagPct. Taken before the timed scenarios so
  // it starts from the same settled camera they do.
  if (s.level < 4) {
    const b0 = await box()
    await page.mouse.move(b0.x + b0.w * 0.5, b0.y + b0.h * 0.5)
    await page.waitForTimeout(300)
    const pending = strokeLagPct()
    await page.mouse.wheel(0, -60)
    strokeLag.push({ level: s.level, pct: await pending })
    await page.mouse.wheel(0, 60)
    await page.waitForTimeout(700)
  }

  await run(s.level, 'idle (no input)', () => page.waitForTimeout(1200))
  if (water) await run(s.level, 'moves over WATER (no tooltip)', shuttle(water, false), { x: water.a, y: water.y })
  if (cells) await run(s.level, 'moves over CELLS (tooltip up)', shuttle(cells, false), { x: cells.a, y: cells.y })
  // WATER first, unlike the hover rows: a pan over cells drags the tooltip along
  // with it, and the tooltip's own per-move cost then swamps the camera's — which
  // is a real finding (see the tip column at L4, where the midline has no water
  // long enough to pan along) but not what this row is trying to isolate.
  const panRun = water ?? cells
  if (panRun) await run(s.level, 'pan (button down)', panGesture(panRun), { x: panRun.a, y: panRun.y })
  // A ROUND TRIP, in and back out, not a single step in. `run` repeats a scenario
  // REPS times to take a median, and a one-way zoom runs out of levels: reps 3
  // onward sat at L_MAX and measured an ignored wheel event, which is where the
  // absurd (4-361ms) spread in the first version of this row came from. In-and-out
  // returns to the level it started at, so every rep measures the same thing and
  // the row is repeatable. Two flights per rep — read it against itself across
  // runs, not against the single-gesture rows above.
  if (s.level < 4)
    await run(s.level, 'ZOOM round trip (2 flights)', async () => {
      const b = await box()
      await page.mouse.move(b.x + b.w * 0.5, b.y + b.h * 0.5)
      const at = await level()
      await page.mouse.wheel(0, -60)
      await page.waitForTimeout(600)
      await page.mouse.wheel(0, 60)
      await page.waitForTimeout(600)
      const back = await level()
      return { tips: back === at ? '' : `LEVEL DRIFT ${at}->${back}` }
    })
}

console.log('\n=== WHAT IS ON SCREEN AT EACH LEVEL ===')
console.log('level   els  paths  texts  transitioned  of which stroke-width')
for (const s of sizes)
  console.log(
    String(s.level).padStart(5),
    String(s.els).padStart(5),
    String(s.paths).padStart(6),
    String(s.texts).padStart(6),
    String(s.transitioned).padStart(13),
    String(s.strokeWidth).padStart(22),
  )

console.log('\n=== COST (deltas over each scenario; TaskDuration is the number) ===')
console.log(`median of ${REPS} runs, with the spread, per scenario`)
console.log('lvl  scenario                      task (min-max)      script  recalcs  layouts   moves  tip')
for (const r of rows)
  console.log(
    String(r.level).padStart(3),
    ' ' + r.name.padEnd(30),
    String(r.task + 'ms').padStart(6),
    `(${r.lo}-${r.hi})`.padStart(12),
    String(r.script + 'ms').padStart(8),
    String(r.recalcs).padStart(8),
    String(r.layouts).padStart(8),
    String(r.moves).padStart(7),
    String(r.tips).padStart(5),
  )
console.log('\n`moves` is the pointermove count the SVG actually received — a scenario')
console.log('with far fewer than 61 measured less input, not less cost.')

// ── the one thing here that is an ASSERTION and not a reading ───────────────
// A RATIO, never a wall-clock threshold. Absolute times on this harness swing
// about +/-20% run to run and are meaningless on another machine, but the SHAPE of
// the result is stable and is the whole point of #238's first fix: moving the
// cursor with nothing to report must cost a small fraction of moving it with the
// tooltip up, because in the first case there is nothing to render.
//
// Before the gate the two were the same number (253ms vs 255ms at L0, 356 vs 407
// at L2) — that equality IS the bug, stated as a check. After it they are 13 vs
// 280 and 15 vs 412. The bar is set at a quarter, which no run of either version
// has come close to straddling.
const LIMIT = 0.25

// A PAN MUST BE CHEAPER PER MOVE THAN A HOVER (#238 fix 3). Moving the camera
// changes one attribute on one <g> and nothing about what is drawn under it;
// moving the cursor across cells changes what the map REPORTS, which is a real
// render. So the first has to cost materially less than the second, and if the
// two are ever the same number again it means the camera has been let back into
// the render path.
//
// Per MOVE, not per scenario: a level whose midline has no long stretch of water
// gets a shorter pan (L4 manages 31 moves against the hover rows' 61), and the
// raw totals would then flatter the pan for doing less work.
//
// Falsified in both directions on the run that set it: with the camera in React
// the ratio was 0.86 / 1.00 / 1.07 at L0 / L2 / L4 — a pan cost the same as a
// hover, which is the bug stated as a check — and with it out, 0.43 / 0.36 /
// 0.31. Nothing has landed between 0.43 and 0.86, so the bar sits at 0.6.
const PAN_LIMIT = 0.6
const STROKE_LIMIT = 5
const failures = []
for (const { level: lvl, pct } of strokeLag) {
  const ok = pct < STROKE_LIMIT
  console.log(`${ok ? 'PASS' : 'FAIL'}  L${lvl} stroke width tracks its attribute through a flight — worst gap ${pct}%, limit ${STROKE_LIMIT}%`)
  if (!ok) failures.push(`L${lvl} stroke lag ${pct}%`)
}
for (const lvl of LEVELS) {
  const water = rows.find((r) => r.level === lvl && r.name.includes('WATER'))
  const cells = rows.find((r) => r.level === lvl && r.name.includes('CELLS'))
  if (!water || !cells || !cells.task) continue
  const ratio = water.task / cells.task
  const ok = ratio < LIMIT
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  L${lvl} idle-hover ratio ${ratio.toFixed(3)} (${water.task}ms over water / ${cells.task}ms over cells), limit ${LIMIT}`,
  )
  if (!ok) failures.push(`L${lvl} ratio ${ratio.toFixed(3)}`)
}
for (const lvl of LEVELS) {
  const pan = rows.find((r) => r.level === lvl && r.name.startsWith('pan'))
  const cells = rows.find((r) => r.level === lvl && r.name.includes('CELLS'))
  if (!pan || !cells || !cells.task || !pan.moves || !cells.moves) continue
  const ratio = pan.task / pan.moves / (cells.task / cells.moves)
  const ok = ratio < PAN_LIMIT
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  L${lvl} pan-hover ratio ${ratio.toFixed(3)} (${pan.task}ms over ${pan.moves} pan moves / ${cells.task}ms over ${cells.moves} hover moves), limit ${PAN_LIMIT}`,
  )
  if (!ok) failures.push(`L${lvl} pan ratio ${ratio.toFixed(3)}`)
}
if (errors.length) console.log('\nERRORS:\n' + errors.join('\n'))

await browser.close()
vite.kill()
if (failures.length || errors.length) {
  console.log('\nFAILED: ' + [...failures, ...errors].join('; '))
  process.exit(1)
}
process.exit(0)
