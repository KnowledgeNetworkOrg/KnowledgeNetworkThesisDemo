// layering.test.ts — which folder may import which, written down once and checked
// on every run.
//
// WHY THIS EXISTS. #338. The source tree is laid out as layers, and its names promise a
// direction: data at the bottom, pure arithmetic above it, the design system beside that,
// then the panes, then the shell that composes them. Nothing wrote that direction down,
// nothing checked it, and three dependencies already ran against it. Nothing is broken;
// the cost is that a change in one folder can force a change in a folder that should not
// know it exists, and that the model layer's purity is a habit rather than a fact. This
// file turns the intention into a test, with every current violation listed below as an
// exception carrying its reason and the step of #338 that retires it. Green on day one.
//
// A TYPE-ONLY IMPORT IS STILL AN IMPORT: it couples the folders even when the bundler
// drops it.
//
// THE TARGET SHAPE, same folders plus one new one:
//
//   folder        holds                                                  may import
//   corpus/       the data                                               corpus
//   platform/     host capabilities, capability-shaped (#211)            platform
//   ds/           design-system ports, plus ds/values.ts, a pure entry   ds, ds-values
//   model/        pure arithmetic: no React, no DOM, no state, no storage  corpus, model, ds-values
//   state/       React-bearing or stateful things shared across screens  corpus, model, platform, ds, state
//   instruments/  panes: rendering only                                  corpus, model, platform, ds, state, instruments
//   present/      presenter and projector screens (they compose the map) corpus, model, platform, ds, state, instruments, present
//   studio/       composition root: registry, shell, presets             every layer
//   ui/           a draggable panel nothing mounts (#144)                ds, ui
//   App.tsx,      the entry                                              every layer
//   main.tsx
//
// The layer of a file is its first path segment under src/; files directly under src/ are
// `root`, and src/ds/values.ts is its own layer, `ds-values`. A folder that does not exist
// yet (`ds/values.ts`) must not make this test fail or warn — the table is the
// target, the tree catches up.
//
// MODELED ON unreachedmodule.test.ts (a node program that reads source text and keeps its
// exceptions beside the check) and studio/browsertestguard.test.ts (self-checks its own
// parse so an empty result cannot pass vacuously).
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, posix, relative, sep } from 'node:path'

const SRC = fileURLToPath(new URL('.', import.meta.url))

// ── the rule ────────────────────────────────────────────────────────────────

type Layer =
  | 'root'
  | 'studio'
  | 'present'
  | 'instruments'
  | 'state'
  | 'model'
  | 'ds-values'
  | 'ds'
  | 'ui'
  | 'platform'
  | 'corpus'

const EVERY_LAYER: readonly Layer[] = [
  'root',
  'studio',
  'present',
  'instruments',
  'state',
  'model',
  'ds-values',
  'ds',
  'ui',
  'platform',
  'corpus',
]

const MAY_IMPORT: Record<Layer, readonly Layer[]> = {
  root: EVERY_LAYER,
  studio: EVERY_LAYER,
  present: ['corpus', 'model', 'platform', 'ds', 'state', 'instruments', 'present'],
  instruments: ['corpus', 'model', 'platform', 'ds', 'state', 'instruments'],
  state: ['corpus', 'model', 'platform', 'ds', 'state'],
  model: ['corpus', 'model', 'ds-values'],
  'ds-values': ['ds', 'ds-values'],
  ds: ['ds', 'ds-values'],
  ui: ['ds', 'ui'],
  platform: ['platform'],
  corpus: ['corpus'],
}

const layerOf = (rel: string): Layer => {
  if (rel === 'ds/values.ts') return 'ds-values'
  const top = rel.split('/')[0]
  if (
    top === 'corpus' ||
    top === 'platform' ||
    top === 'ds' ||
    top === 'model' ||
    top === 'state' ||
    top === 'instruments' ||
    top === 'present' ||
    top === 'studio' ||
    top === 'ui'
  )
    return top
  return 'root'
}

// ── the tree, as text ───────────────────────────────────────────────────────

const isTest = (name: string) => /\.test\.tsx?$/.test(name)
const isSource = (name: string) => /\.tsx?$/.test(name) && !isTest(name)

const moduleFiles: string[] = []
const walk = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (isSource(e.name)) moduleFiles.push(p)
  }
}
walk(SRC)

const relOf = (abs: string) => relative(SRC, abs).split(sep).join('/')

/** Comments that mention a path are prose, not a reach — a header explaining where
 *  something moved would otherwise count as an import of it. Full-line comments only,
 *  following browsertestguard.test.ts. */
const codeOnly = (text: string) =>
  text
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

const STATIC_FROM = /\bfrom\s+['"]([^'"\n]+)['"]/g
const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g

const specifiersIn = (text: string): string[] => {
  const code = codeOnly(text)
  return [
    ...[...code.matchAll(STATIC_FROM)].map((m) => m[1]),
    ...[...code.matchAll(DYNAMIC_IMPORT)].map((m) => m[1]),
  ]
}

/** `./`, `../` and `@/` (the alias for src/) resolve by trying `<path>.ts`,
 *  `<path>.tsx`, `<path>/index.ts`, `<path>` in that order; bare package names and
 *  `.css`/`.js` imports are not this rule's business. */
const resolve = (fromRel: string, spec: string): string | null => {
  if (/\.(css|js)$/.test(spec)) return null
  let base: string
  if (spec.startsWith('@/')) base = spec.slice(2)
  else if (spec.startsWith('./') || spec.startsWith('../'))
    base = posix.normalize(posix.join(posix.dirname(fromRel), spec))
  else return null
  for (const suffix of ['.ts', '.tsx', '/index.ts', '']) {
    const candidate = base + suffix
    const abs = join(SRC, ...candidate.split('/'))
    if (existsSync(abs) && statSync(abs).isFile()) return candidate
  }
  return null
}

type Edge = { from: string; to: string; fromLayer: Layer; toLayer: Layer }

const texts = new Map<string, string>()
for (const abs of moduleFiles) texts.set(relOf(abs), readFileSync(abs, 'utf8'))

const edges: Edge[] = []
for (const [from, text] of texts) {
  for (const spec of specifiersIn(text)) {
    const to = resolve(from, spec)
    if (to) edges.push({ from, to, fromLayer: layerOf(from), toLayer: layerOf(to) })
  }
}
const edgeKeys = edges.map((e) => `${e.from} -> ${e.to}`)

// ── what is knowingly wrong today ───────────────────────────────────────────

const MODEL_DS_REASON = 'the model reaches arithmetic through the component barrel; step 4 opens ds/values.ts'

const ALLOWED_FOR_NOW: Record<string, string> = {
  'model/color.ts -> ds/index.ts': MODEL_DS_REASON,
  'model/flat.ts -> ds/index.ts': MODEL_DS_REASON,
  'model/labelfit.ts -> ds/index.ts': MODEL_DS_REASON,
  'model/topichue.ts -> ds/index.ts': MODEL_DS_REASON,
  'model/walkarrow.ts -> ds/index.ts': MODEL_DS_REASON,
}

const STORAGE_REASON = 'step 5 puts storage under the platform seam'
const STORAGE_WRITERS_FOR_NOW: Record<string, string> = {
  'model/walkstore.ts': STORAGE_REASON,
  'model/storeddata.ts': STORAGE_REASON,
  'present/lecturenotes.ts': STORAGE_REASON,
  'instruments/walkdesk/draftpersist.ts': STORAGE_REASON,
  'ui/floatingPanelRect.ts': STORAGE_REASON,
}

// ── the checks ──────────────────────────────────────────────────────────────

describe('the scan can still see the app', () => {
  // Without these, a walk that stops matching would empty the edge list and every
  // check below would pass vacuously — the failure mode this file exists to catch,
  // reproduced inside the catcher. browsertestguard.test.ts is the precedent.
  it('found the modules, the edges and the anchors', () => {
    expect(moduleFiles.length, 'the scan found suspiciously few modules').toBeGreaterThanOrEqual(120)
    expect(edges.length, 'the scan resolved suspiciously few imports').toBeGreaterThanOrEqual(400)
    for (const anchor of [
      'instruments/MapView.tsx -> corpus/graph.ts',
      'model/color.ts -> corpus/graph.ts',
      'studio/StudioView.tsx -> studio/instruments.tsx',
    ])
      expect(edgeKeys, `anchor edge "${anchor}" was not found`).toContain(anchor)
  })
})

describe('the folder import rule', () => {
  it('every import respects the layered table, or is written down as an exception', () => {
    const offenders = edges
      .filter((e) => !MAY_IMPORT[e.fromLayer].includes(e.toLayer))
      .filter((e) => !(`${e.from} -> ${e.to}` in ALLOWED_FOR_NOW))
      .map((e) => `${e.from} -> ${e.to}`)
    expect(
      offenders,
      `these imports run against the layered table in this file:\n  ${offenders.join('\n  ')}\n` +
        `Add the import to ALLOWED_FOR_NOW with a reason, or move the code to the layer that may import it.`,
    ).toEqual([])
  })

  it('does not carry an exception that has gone stale', () => {
    const stale = Object.keys(ALLOWED_FOR_NOW).filter((k) => !edgeKeys.includes(k))
    expect(stale, `ALLOWED_FOR_NOW names imports that no longer happen:\n  ${stale.join('\n  ')}`).toEqual([])
  })

  it('browser storage is written in one place', () => {
    const writers = [...texts]
      .filter(([rel]) => rel !== 'platform/web.ts' && !rel.startsWith('ds/'))
      .filter(([, text]) => {
        const code = codeOnly(text)
        return code.includes('localStorage') || code.includes('sessionStorage')
      })
      .map(([rel]) => rel)
      .sort()
    expect(
      writers,
      `these files write localStorage/sessionStorage outside the platform seam:\n  ${writers.join('\n  ')}\n` +
        `Ask platform.storage instead; step 5 of #338 puts it there.`,
    ).toEqual(Object.keys(STORAGE_WRITERS_FOR_NOW).sort())
    const stale = Object.keys(STORAGE_WRITERS_FOR_NOW).filter((k) => !writers.includes(k))
    expect(stale, `STORAGE_WRITERS_FOR_NOW names files that no longer write storage:\n  ${stale.join('\n  ')}`).toEqual([])
  })

  it('the pure door stays pure', () => {
    // Inactive until step 4 creates src/ds/values.ts. From then on, a model module —
    // a node program in most tests — must not reach through the door into a .tsx.
    const text = texts.get('ds/values.ts')
    if (!text) return
    const through = specifiersIn(text)
      .map((s) => resolve('ds/values.ts', s))
      .filter((to): to is string => to !== null && !to.endsWith('.ts'))
    expect(
      through,
      `ds/values.ts must import only .ts files, so a model test never compiles a .tsx:\n  ${through.join('\n  ')}`,
    ).toEqual([])
  })
})
