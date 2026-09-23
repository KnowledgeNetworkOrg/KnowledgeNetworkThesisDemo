// browsertestguard.test.ts — the browser tests are still aimed at things that exist,
// and none of them has quietly fallen out of the run.
//
// WHY THIS EXISTS, and why it is a unit test rather than a convention. #294 turned up
// three different failures with one cause:
//
//   1. Two files in the browser-test folder held about fifty real assertions between
//      them and had not run in months, because the runner collects by FILENAME PREFIX
//      and theirs said `shot-`. Nothing anywhere noticed.
//   2. When they were finally run, a third of what they reached for had been renamed
//      or deleted underneath them — a level-button row replaced by a picker, a pane
//      rebuilt, a panel retired.
//   3. And a test that DID run every time was checking for an element by two names
//      the app has never used, so that assertion passed no matter what was on screen.
//
// The common cause is that a browser test's link to the app is a STRING, and nothing
// type-checks a string. This file does — in the unit suite, in milliseconds, with no
// browser. It cannot tell you a test still asserts the right thing; it can tell you
// the test is still talking to something that is there, which is the failure that
// actually happened and the one nobody can see by reading.
//
// It lives under src/ because that is where vitest looks (`src/**/*.test.ts`), and in
// studio/ because the registry it validates against is next door.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const REPO = fileURLToPath(new URL('../..', import.meta.url))
const DRIVER_DIR = join(REPO, 'tools', 'studio-spike')

/** The runner's own rule, restated: `run-browsertests.mjs` collects these two
 *  prefixes. `drive-` is the older invented name kept while that rename is
 *  outstanding — both are the run, so both are checked here. */
const isCollected = (f: string) => f.startsWith('browsertest-') || f.startsWith('drive-')

/** Files in the driver folder that are deliberately NOT part of the run, each with
 *  the reason. This list is the point of the first test below: a new `.mjs` in that
 *  folder has to be either named into the suite or written down here, so "it does
 *  not run" is always a decision somebody made rather than a side effect of what it
 *  was called.
 *
 *  EVERY `shot-*` FILE BELOW STILL CONTAINS ASSERTIONS, and nothing runs them. That
 *  is the same shape as #294 and is tracked as its own ticket rather than fixed in
 *  passing — promoting one is not a rename, it is an afternoon of finding out what
 *  moved underneath it. */
const NOT_IN_THE_RUN: Record<string, string> = {
  'run-browsertests.mjs': 'the runner itself',
  'probe-maplag.mjs': 'a MEASUREMENT — prints a speed ratio, which is the assertion that fails randomly on a loaded machine',
  'shot-apptoolbar.mjs': 'screenshot instrument, holds assertions — see #299',
  'shot-cardhead.mjs': 'screenshot instrument, holds assertions — see #299',
  'shot-domaindot.mjs': 'screenshot instrument, holds assertions — see #299',
  'shot-foldab.mjs': 'calibration fixture for GroupGeometry, drives tools/studio-spike/foldab rather than the app',
  'shot-nested.mjs': 'screenshot instrument, holds assertions — see #299',
  'shot-palette.mjs': 'screenshot instrument, holds assertions — see #299',
  'shot-toolbox.mjs': 'screenshot instrument, holds assertions — see #299',
  'shot-walkpath.mjs': 'screenshot instrument, holds assertions — see #299',
}

// ── the app, as text ────────────────────────────────────────────────────────
// src/ is the app. tools/ is included because a few drivers drive a SPIKE FIXTURE
// (foldab/, inlineedit/) rather than the app itself, and a hook that fixture stamps
// is just as real as one src stamps.
const sourceText = (() => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'out' || e.name === 'shots') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx|css)$/.test(e.name)) files.push(p)
    }
  }
  walk(join(REPO, 'src'))
  walk(join(REPO, 'tools'))
  return files.map((f) => readFileSync(f, 'utf8')).join('\n')
})()

// ── the registry, READ rather than imported ─────────────────────────────────
// This file has to be a node program — it reads the driver folder off disk — and
// tsconfig keeps `node` out of the app's types on purpose, so that app code cannot
// reach for APIs the browser does not have. `adherence.test.ts` and
// `edgecolor.test.ts` are the two existing tests in that position and they read
// source too; this is the third.
//
// Parsing rather than importing means the parse itself can rot silently, so it
// CHECKS ITSELF below: if the registry ever changes shape enough that these regexes
// stop matching, the counts collapse and the self-check fails loudly, instead of an
// empty id set quietly approving every label in the suite.
const registrySource = readFileSync(join(REPO, 'src', 'studio', 'instruments.tsx'), 'utf8')
const presetsAt = registrySource.indexOf('export const PRESETS')
const idsIn = (text: string) => [...text.matchAll(/^\s+id: '([a-z0-9-]+)',$/gm)].map((m) => m[1])

const EDGE_TYPES = (readFileSync(join(REPO, 'src', 'corpus', 'graphshape.ts'), 'utf8').match(/export type EdgeType = ([^\n]+)/)?.[1] ?? '')
  .split('|')
  .map((t) => t.trim().replace(/'/g, ''))
  .filter(Boolean)

const INSTRUMENT_IDS = new Set([
  ...idsIn(registrySource.slice(0, presetsAt)),
  // the lens panes are GENERATED, one per relation type — there is no literal id
  // to read for them, so they are composed the same way the registry composes them
  ...EDGE_TYPES.map((t) => `lens-${t}`),
])
const PRESET_IDS = new Set(idsIn(registrySource.slice(presetsAt)))

/** The DOM hooks one driver reaches for. Only FULLY LITERAL ones: a selector built
 *  from a template (`studio-inst-${id}`) names whatever the loop is over, not a hook,
 *  and the regexes below exclude anything containing an interpolation on purpose. */
function hooksOf(source: string) {
  // A comment explaining a hook that was RETIRED is prose, not a reach — these files
  // carry a lot of that by design, and counting it would make the guard cry wolf.
  const code = source
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  const data = new Set<string>()
  const labels = new Set<string>()
  for (const m of code.matchAll(/\[data-([a-z][a-z0-9-]*)/g)) data.add('data-' + m[1])
  for (const m of code.matchAll(/getAttribute\(['"]data-([a-z][a-z0-9-]*)['"]\)/g)) data.add('data-' + m[1])
  for (const m of code.matchAll(/\[aria-label\^?=["']([^"'$`]+)["']\]/g)) labels.add(m[1])
  for (const m of code.matchAll(/getByLabel\(['"]([^'"$`]+)['"]\)/g)) labels.add(m[1])
  return { data, labels }
}

const driverFiles = readdirSync(DRIVER_DIR).filter((f) => f.endsWith('.mjs'))
const drivers = driverFiles.map((f) => ({ file: f, ...hooksOf(readFileSync(join(DRIVER_DIR, f), 'utf8')) }))

describe('this file can still read the registry it checks against', () => {
  // Without these, a registry rewrite would empty the id sets and every label check
  // below would pass vacuously — the exact failure mode this whole file exists to
  // catch, reproduced inside the catcher.
  it('found the instruments, the presets and the relation types', () => {
    expect(EDGE_TYPES.length, `EdgeType did not parse: ${JSON.stringify(EDGE_TYPES)}`).toBeGreaterThanOrEqual(3)
    expect(PRESET_IDS.size, `PRESETS did not parse: ${[...PRESET_IDS].join(', ')}`).toBeGreaterThanOrEqual(2)
    expect(INSTRUMENT_IDS.size, `the instrument registry did not parse`).toBeGreaterThanOrEqual(12)
  })

  it('and the ids it read are the ones the app actually has', () => {
    // named anchors, so a parse that returns SOMETHING but the wrong thing still fails
    for (const id of ['map', 'document', 'connections', 'lens-depends_on'])
      expect(INSTRUMENT_IDS.has(id), `instrument "${id}" missing from the parsed registry`).toBe(true)
    for (const id of ['present', 'explore', 'plan'])
      expect(PRESET_IDS.has(id), `preset "${id}" missing from the parsed registry`).toBe(true)
    expect(INSTRUMENT_IDS.has('present'), 'a preset id leaked into the instrument set — the file slice is wrong').toBe(false)
  })
})

describe('the browser-test folder', () => {
  it('holds nothing that is neither run nor written down as not running', () => {
    const undeclared = driverFiles.filter((f) => !isCollected(f) && !(f in NOT_IN_THE_RUN))
    expect(
      undeclared,
      `these files are in the browser-test folder but the runner does not collect them:\n` +
        `  ${undeclared.join('\n  ')}\n` +
        `Either rename one into the run (browsertest-*) or add it to NOT_IN_THE_RUN with the reason. ` +
        `A file that neither runs nor says why is how #294 happened.`,
    ).toEqual([])
  })

  it('does not list a file that has since been renamed or deleted', () => {
    const stale = Object.keys(NOT_IN_THE_RUN).filter((f) => !driverFiles.includes(f))
    expect(stale, `NOT_IN_THE_RUN names files that are no longer there: ${stale.join(', ')}`).toEqual([])
  })
})

// ── the path a driver drives ────────────────────────────────────────────────
// A browser test's OTHER string-shaped link to its subject: WHICH CHECKOUT it
// serves. Every driver used to spell this one out (`const REPO = 'D:/…'`) and
// spawn vite with it, so a run from a worktree or a second clone silently served
// and tested the FIRST checkout's app — found for real when this checkout was
// moved to another branch mid-task (#362). The sweep that fixed it is a sweep:
// the 48th file is not a mistake anyone made, it is a file written in parallel,
// against the convention that was true when it was written. That is the normal
// state of this repo, so it is checked here rather than swept again.

/** The repo folder's NAME, matched inside a string literal. Any spelled-out
 *  checkout contains it — `D:/…/KnowledgeNetworkThesisDemo`, a backslash
 *  spelling, another drive, a `-worktree1` clone — while a path DERIVED from the
 *  file's own location never does, so there is nothing legitimate to exclude. */
const NAMES_A_CHECKOUT = /['"`][^'"`]*KnowledgeNetworkThesisDemo/

/** Every script under tools/ that could name a checkout — `.mjs`, `.js`, `.cjs`,
 *  `.ts`, `.tsx`, `.py` — RECURSIVELY, not just the driver folder. Seven of the
 *  files #362 rewrote live in five other spike folders, so a studio-spike-only
 *  check would pass while five folders stayed broken; the wider net is that same
 *  reasoning one step out. */
const toolScripts = (() => {
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'out' || e.name === 'shots') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(mjs|js|cjs|ts|tsx|py)$/.test(e.name)) files.push(p)
    }
  }
  walk(join(REPO, 'tools'))
  return files
})()

/** Files allowed to name a checkout, each with the reason. Empty on purpose: the
 *  derivation IS the fix, not an exception. If one is ever needed it goes here as
 *  a name → reason pair, the way NOT_IN_THE_RUN above does it, so "this one is
 *  allowed" stays a decision somebody made rather than a silent hole. */
const MAY_NAME_A_CHECKOUT: Record<string, string> = {}

describe('no tool spells a checkout it does not live in', () => {
  it('walked a believable number of files', () => {
    // "nothing found" and "nothing wrong" look the same, so the walk keeps a floor
    // the way the registry checks above do.
    expect(toolScripts.length, 'the tools walk found suspiciously few files').toBeGreaterThanOrEqual(50)
  })

  it('names every offending file AND line in one failure', () => {
    const offenders: string[] = []
    for (const f of toolScripts) {
      const rel = f.slice(REPO.length).replace(/\\/g, '/')
      if (rel in MAY_NAME_A_CHECKOUT) continue
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          // a comment about a checkout is prose, not a reach — the same reason
          // hooksOf skips them (`#` is the Python scripts' comment leader)
          if (/^\s*(\/\/|\*|\/\*|#)/.test(line)) return
          if (NAMES_A_CHECKOUT.test(line)) offenders.push(`${rel}:${i + 1}`)
        })
    }
    expect(
      offenders,
      `these files name a checkout instead of deriving their own root:\n  ` +
        offenders.join('\n  ') +
        `\nA driver that names one checkout serves and tests THAT checkout's app wherever it is ` +
        `run — a worktree, a second clone — and nothing about the run says so. ` +
        `Derive the root from the file's own location: ` +
        `join(dirname(fileURLToPath(import.meta.url)), '..', '..').`,
    ).toEqual([])
  })
})

describe('every hook a browser test reaches for still exists', () => {
  // The whole set at once rather than one test per driver: a rename usually breaks
  // several files, and the useful output is the whole list, not the first casualty.
  it('data-* attributes', () => {
    const dead: string[] = []
    for (const d of drivers) for (const h of d.data) if (!sourceText.includes(h)) dead.push(`${d.file} → ${h}`)
    expect(
      dead,
      `these drivers select on a data-* attribute that no longer appears anywhere in src/ or tools/:\n  ` +
        dead.join('\n  ') +
        `\nA selector that matches nothing does not fail — it waits, or it silently reports zero, ` +
        `which is how an assertion ends up passing for the wrong reason.`,
    ).toEqual([])
  })

  it('aria-labels the app composes — a pane, an instrument switch, a preset button', () => {
    // These are built from the registry at render time (`studio-inst-${inst.id}`), so
    // they never appear literally in src and cannot be checked by searching for them.
    // Ask the registry instead, which is the thing that would have changed.
    const dead: string[] = []
    for (const d of drivers)
      for (const l of d.labels) {
        const m = l.match(/^studio-(pane|inst|preset|stack)-(.+)$/)
        if (!m) continue
        const [, kind, rest] = m
        if (kind === 'stack') continue // a stack is named after its members, joined
        const known = kind === 'preset' ? PRESET_IDS.has(rest) : INSTRUMENT_IDS.has(rest)
        if (!known) dead.push(`${d.file} → ${l} (no such ${kind === 'preset' ? 'preset' : 'instrument'} "${rest}")`)
      }
    expect(dead, `these drivers name something the registry no longer has:\n  ` + dead.join('\n  ')).toEqual([])
  })

  it('every other literal aria-label', () => {
    const dead: string[] = []
    for (const d of drivers)
      for (const l of d.labels) {
        if (/^studio-(pane|inst|preset|stack)-/.test(l)) continue
        if (!sourceText.includes(l)) dead.push(`${d.file} → aria-label="${l}"`)
      }
    expect(
      dead,
      `these drivers wait for an aria-label that appears nowhere in src/ or tools/:\n  ` + dead.join('\n  '),
    ).toEqual([])
  })
})
