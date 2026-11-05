// Turn the thesis's CS2023 map file into the three corpus modules the app reads.
//
//   node tools/cs2023import/generate.mjs
//
// Input  tools/cs2023import/cs2023_map.json  — a PINNED COPY of the thesis file
//                                               (README.md names its commit); never edit it here
// Output src/corpus/cs2023data.ts            — the tree and the see_also edges
//        src/corpus/cs2023docs.ts            — one document body per node
//        src/corpus/cs2023walks.ts           — the routes (none yet: a later card)
//
// The outputs are COMMITTED, as with `tools/courseimport/`. Re-run this only after
// replacing the JSON with a newer copy from the thesis repository.
//
// The rule this script enforces on itself: it invents no content. Every title is a
// CS2023 label, verbatim; every edge is one of CS2023's printed "See also" notes.
// The only strings composed here are the connective sentences of the document
// bodies, and each says plainly what it is and where its facts came from.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', '..', 'src', 'corpus')
const data = JSON.parse(readFileSync(join(HERE, 'cs2023_map.json'), 'utf8'))

const q = (s) => JSON.stringify(s)
const ROOT = 'root'

// ── Hues ─────────────────────────────────────────────────────────────────────
// A copy of `HUE_RING` and `TOPIC_WALK` in `src/ds/graph/hueslots.ts` (this script
// is plain node and cannot import TypeScript); `cs2023corpus.test.ts` asserts the
// generated hues still agree with `topicHue(n)`. Areas take the ring in area order.
// CS2023 has 17 areas, so 17 domains on 16 hues: the 17th wraps onto the 1st's
// hue, the ring's own documented rule (`topicHue`). CS2023 publishes no grouping of areas, so none is invented to
// decide who shares. A PROPOSAL, for the author to decide.
const HUE_RING = ['rose', 'brick', 'clay', 'amber', 'honey', 'olive', 'lime', 'leaf', 'fern', 'jade', 'teal', 'river', 'cobalt', 'iris', 'violet', 'mallow']
const TOPIC_WALK = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
const hueOf = (n) => HUE_RING[TOPIC_WALK[n % 16]]

// ── Tree ─────────────────────────────────────────────────────────────────────
// area → domain, unit → topic (default D1), and below a unit only the CS2023
// places some course stops at (default D3, already applied in the JSON). Deep nodes
// keep CS2023's own ids: the title-slug rule of `spec.deep` would collide on real
// data ("Deep learning" twice under AI-ML, "Paradigms" twice under AL-Strategies).
const tree = data.tree
const byId = new Map(tree.map((t) => [t.id, t]))
for (const t of tree) {
  if (t.parent !== null && !byId.has(t.parent)) throw new Error(`${t.id} has an unknown parent: ${t.parent}`)
  if (t.level === 'unit' && byId.get(t.parent)?.level !== 'area') throw new Error(`unit ${t.id} is not directly under an area`)
}
// SCIENCE IS LEFT OUT FOR NOW. It is the thesis author's exception group for the
// program's biology, chemistry and physics courses, outside CS2023, and it holds no
// unit: only course stops sit on it, and routes are a later card. A domain with no
// topic has no place to draw (the map's region and label arithmetic needs at least
// one), so it joins when its stops do, and that card decides how it is drawn.
const science = tree.filter((t) => t.level === 'area' && t.kind === 'exception')
if (tree.some((t) => science.some((s) => t.parent === s.id))) throw new Error('Science now has children: bring it in')
const areas = tree.filter((t) => t.level === 'area' && t.kind !== 'exception')
const units = tree.filter((t) => t.level === 'unit')
const deepNodes = tree.filter((t) => !['area', 'unit'].includes(t.level))

const nodes = [{ id: ROOT, kind: 'container', parentId: null, title: 'CS2023 knowledge map' }]
areas.forEach((a, i) => nodes.push({ id: a.id, kind: 'container', parentId: ROOT, title: a.label, hue: hueOf(i) }))
for (const u of units) nodes.push({ id: u.id, kind: 'container', parentId: u.parent, title: u.label, topic: true })
for (const d of deepNodes) nodes.push({ id: d.id, kind: 'leaf', parentId: d.parent, title: d.label })

// ── Edges: CS2023's own "See also" notes, unit to unit, as printed ───────────
const edges = data.edges.map((e) => {
  if (e.type !== 'see_also') throw new Error(`unexpected edge type: ${e.type}`)
  if (byId.get(e.from)?.level !== 'unit' || byId.get(e.to)?.level !== 'unit') throw new Error(`edge ${e.from} > ${e.to} does not join two units`)
  return { source: e.from, target: e.to, type: 'see_also' }
})

// ── Document bodies ──────────────────────────────────────────────────────────
const DRAFT =
  'This map is thesis data in draft, under the author\'s review; its "See also" links were extracted by an AI agent and are not yet reviewed.'
const where = (t) =>
  [t.tier ? `CS2023 tier: ${t.tier}.` : '', t.source_page ? `Computer Science Curricula 2023, Body of Knowledge, p. ${t.source_page}.` : '']
    .filter(Boolean)
    .join(' ')

const out = {}, inn = {}
for (const e of edges) {
  out[e.source] = (out[e.source] ?? 0) + 1
  inn[e.target] = (inn[e.target] ?? 0) + 1
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const doc = {}
doc[ROOT] =
  `The knowledge areas and knowledge units of Computer Science Curricula 2023 (ACM/IEEE-CS/AAAI), the published ` +
  `curriculum standard: ${areas.length} areas and ${units.length} units; the ` +
  `${edges.length} links are CS2023's own printed "See also" notes, drawn unit to unit. Below a unit, only the ` +
  `places some Toronto Metropolitan University course stops at are shown. ${DRAFT}`

for (const a of areas) {
  const n = units.filter((u) => u.parent === a.id).length
  doc[a.id] = `${a.label} — a CS2023 knowledge area, holding ${plural(n, 'knowledge unit')}. ${where(a)}`
}
for (const u of units) {
  const links =
    out[u.id] || inn[u.id]
      ? `It prints ${plural(out[u.id] ?? 0, '"See also" link')} to other units, and ${plural(inn[u.id] ?? 0, 'unit')} print${(inn[u.id] ?? 0) === 1 ? 's' : ''} one to it.`
      : 'No "See also" note joins it to another unit.'
  doc[u.id] =
    `${u.label} — a CS2023 knowledge unit. CS2023 lists ${plural(u.cs2023_topics_in_unit, 'topic')} in it; only those ` +
    `some course stops at are shown below it. ${links} ${where(u)}`
}
for (const d of deepNodes) doc[d.id] = `${d.label} — a CS2023 ${d.level === 'subsubtopic' ? 'sub-subtopic' : d.level}. ${where(d)}`

// ── Emit ─────────────────────────────────────────────────────────────────────
const banner = (what) => `// GENERATED FILE — DO NOT EDIT BY HAND.
// ${what}
//
// Written by \`node tools/cs2023import/generate.mjs\` from
// \`tools/cs2023import/cs2023_map.json\`, a pinned copy of the thesis repository's
// map file (\`tools/cs2023import/README.md\` names its commit). The labels are
// CS2023's own, verbatim; the edges are CS2023's printed "See also" notes.
`

const lit = (v, indent = 0) => {
  const pad = '  '.repeat(indent)
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `${pad}  ${lit(x, indent + 1)},`).join('\n')}\n${pad}]` : '[]'
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined)
    return `{\n${entries.map(([k, x]) => `${pad}  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k)}: ${lit(x, indent + 1)},`).join('\n')}\n${pad}}`
  }
  return q(v)
}

writeFileSync(
  join(OUT, 'cs2023data.ts'),
  `${banner(`The CS2023 corpus: ${areas.length} areas, ${units.length} knowledge units, ${edges.length} "See also" edges.`)}
import type { CorpusSpec, GNode } from './graphshape'

/** the tree: CS2023 areas, then knowledge units as the edge-bearing level — a UNIT is
 *  this corpus's "topic" — then the CS2023 topics and subtopics some course stops at,
 *  under their CS2023 ids */
const nodes: GNode[] = ${lit(nodes)}

/** CS2023's printed "See also" notes, unit to unit, in the printed direction. The
 *  other three relations are empty: CS2023 publishes nothing that maps onto them. */
const edges: CorpusSpec['edges'] = ${lit(edges)}

export const CS2023: CorpusSpec = { nodes, deep: {}, edges }
`,
  'utf8',
)

writeFileSync(
  join(OUT, 'cs2023docs.ts'),
  `${banner('One document body per node of the CS2023 corpus.')}
export const CS2023_DOC: Record<string, string> = ${lit(doc)}
`,
  'utf8',
)

writeFileSync(
  join(OUT, 'cs2023walks.ts'),
  `${banner('The TMU courses as routes over the CS2023 map — none yet; they come in a later card.')}
import type { Walk } from './walks'

export const CS2023_WALKS: Walk[] = []
`,
  'utf8',
)

console.log(
  `wrote src/corpus/cs2023data.ts, cs2023docs.ts, cs2023walks.ts\n` +
    `  ${areas.length} areas (${science.length} exception group left out), ${units.length} units, ${deepNodes.length} deeper places, ${edges.length} see_also edges`,
)
