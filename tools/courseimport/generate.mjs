// Turn the reviewed course records into the three corpus modules the app reads.
//
//   node tools/courseimport/generate.mjs
//
// Input  tools/courseimport/courses.json  — hand-reviewed, the file to edit
// Output src/corpus/coursedata.ts         — the tree, the deep layers, the edges
//        src/corpus/coursedocs.ts         — one document body per node
//        src/corpus/coursewalks.ts        — the authored routes
//
// The outputs are COMMITTED. Nothing in the app reads a PDF, a spreadsheet or
// this script at build time: the extraction ran once, a person reviewed it, and
// what ships is the reviewed result. Re-run this only after editing the JSON.
//
// The one rule this script enforces on itself: it invents no content. Every
// title, description and topic comes from `courses.json`, which in turn cites
// the outline it came from. The only strings composed here are the connective
// sentences for nodes that have no published prose of their own — the areas,
// the modules, and the stub courses — and each of those says plainly what it is.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', '..', 'src', 'corpus')
const data = JSON.parse(readFileSync(join(HERE, 'courses.json'), 'utf8'))

const idOf = (code) => code.toLowerCase().replace(/[^a-z0-9]+/g, '')
const spaced = (code) => code.replace(/^([A-Z]+)(\d)/, '$1 $2')
const q = (s) => JSON.stringify(s)

// ── Which courses are in play, and who points at whom ────────────────────────
const placed = new Set()
for (const area of data.areas) for (const m of area.modules) for (const c of m.courses) placed.add(c)

for (const code of Object.keys(data.courses)) {
  if (!placed.has(code)) throw new Error(`${code} has a record but is in no area module`)
}
for (const code of placed) {
  if (!data.courses[code]) throw new Error(`${code} is placed in an area but has no record`)
}

/** who names this course as a prerequisite — used to explain why a stub is here */
const namedBy = {}
for (const [code, c] of Object.entries(data.courses)) {
  for (const p of c.prerequisites ?? []) (namedBy[p] ??= []).push(code)
}

// ── Tree ─────────────────────────────────────────────────────────────────────
const nodes = [{ id: data.program.id, kind: 'container', parentId: null, title: data.program.title }]
for (const area of data.areas) {
  nodes.push({ id: area.id, kind: 'container', parentId: data.program.id, title: area.title, hue: area.hue })
  for (const m of area.modules) {
    nodes.push({ id: m.id, kind: 'container', parentId: area.id, title: m.title })
    for (const code of m.courses) {
      const c = data.courses[code]
      nodes.push({ id: idOf(code), kind: 'leaf', parentId: m.id, title: `${spaced(code)} ${c.title}`, topic: true })
    }
  }
}

// ── Deep layers: a course's published topic breakdown, verbatim ──────────────
const deep = {}
for (const [code, c] of Object.entries(data.courses)) {
  if (c.topics && Object.keys(c.topics).length) deep[idOf(code)] = c.topics
}

// ── Edges: the published prerequisites, and only those ───────────────────────
// A prerequisite stated as a choice ("CPS 305 or COE 428") becomes one edge per
// named course. The graph has no way to say "or", and dropping the alternatives
// would misreport the calendar — so both are drawn and the exact wording is kept
// in the course's document body, where a reader can see what was actually said.
const edges = []
for (const [code, c] of Object.entries(data.courses)) {
  for (const p of c.prerequisites ?? []) {
    if (!data.courses[p]) throw new Error(`${code} names an unknown prerequisite: ${p}`)
    edges.push({ source: idOf(code), target: idOf(p), type: 'depends_on' })
  }
}

// ── Document bodies ──────────────────────────────────────────────────────────
const doc = {}
doc[data.program.id] =
  `${data.program.title} — the published undergraduate program, as its own course outlines describe it. ` +
  `Seven subject areas hold ${placed.size} courses; the arrows between them are the prerequisites the ` +
  `university publishes, not connections anyone drew by hand. ` +
  `${Object.values(data.courses).filter((c) => c.outline).length} of the courses had a full outline to read, ` +
  `and those are the ones that open into a topic breakdown.`

for (const area of data.areas) {
  const n = area.modules.reduce((a, m) => a + m.courses.length, 0)
  doc[area.id] =
    `${area.title} — ${n} of the program's courses, grouped by subject. ` +
    `This grouping is the ONE piece of structure here that the university does not publish: ` +
    `the calendar lists courses by requirement, not by field, so the seven areas are a reading of the ` +
    `catalogue rather than a quotation from it.`
  for (const m of area.modules) {
    const withOutline = m.courses.filter((c) => data.courses[c].outline).length
    doc[m.id] =
      m.title === 'Other departments'
        ? `Courses from outside Computer Science that CS courses name as prerequisites. They carry no ` +
          `detail here beyond the code the outline used, because no Computer Science document describes them.`
        : `${m.title} — ${m.courses.length} course${m.courses.length === 1 ? '' : 's'} in ${area.title}, ` +
          `${withOutline === 0 ? 'none of which' : withOutline === m.courses.length ? 'all of which' : `${withOutline} of which`} ` +
          `had an outline available to read. The Required/Elective split is the program table's own.`
  }
}

for (const [code, c] of Object.entries(data.courses)) {
  const id = idOf(code)
  if (!c.outline) {
    const askers = (namedBy[code] ?? []).map(spaced)
    const why = askers.length
      ? `It appears on this map because ${askers.length === 1 ? 'one course names' : `${askers.length} courses name`} ` +
        `it as a prerequisite: ${askers.join(', ')}.`
      : 'It appears on this map as part of the published program table.'
    doc[id] =
      `${spaced(code)} ${c.title}. NO COURSE OUTLINE WAS COLLECTED for this course, so there is nothing ` +
      `to open underneath it and nothing here beyond its title. ${why}` +
      (c.note ? ` ${c.note}` : '')
    continue
  }
  const pre = c.prerequisites?.length
    ? `Prerequisite, as published: ${c.prerequisiteText}.`
    : `The outline states no prerequisite${c.prerequisiteText ? ` — "${c.prerequisiteText}"` : ''}, so nothing points into this course on the map.`
  const layers =
    c.topics && Object.keys(c.topics).length
      ? `The topics below come from the outline's ${c.topicSource}.`
      : `This outline publishes no topic breakdown, so the course does not open — a fact about the document, not about the course.`
  doc[id] =
    `${c.description} ${pre} ${layers} Source: ${c.outline}${c.term ? `, ${c.term}` : ''}.` +
    (c.note ? ` ${c.note}` : '')
}

// ── Emit ─────────────────────────────────────────────────────────────────────
const banner = (what) => `// GENERATED FILE — DO NOT EDIT BY HAND.
// ${what}
//
// Written by \`node tools/courseimport/generate.mjs\` from
// \`tools/courseimport/courses.json\`, which is the file to change. The JSON is a
// hand-reviewed reading of Toronto Metropolitan University's published Computer
// Science course outlines; \`tools/courseimport/README.md\` records where every
// field came from and which judgments are the author's rather than the
// university's.
`

const lit = (v, indent = 0) => {
  const pad = '  '.repeat(indent)
  if (Array.isArray(v)) return `[\n${v.map((x) => `${pad}  ${lit(x, indent + 1)},`).join('\n')}\n${pad}]`
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined)
    return `{\n${entries.map(([k, x]) => `${pad}  ${/^[A-Za-z_$][\w$]*$/.test(k) ? k : q(k)}: ${lit(x, indent + 1)},`).join('\n')}\n${pad}}`
  }
  return q(v)
}

writeFileSync(
  join(OUT, 'coursedata.ts'),
  `${banner(`The course corpus: ${placed.size} courses in ${data.areas.length} subject areas, ${edges.length} published prerequisites.`)}
import type { CorpusSpec, DeepSpec, GNode } from './graphshape'

/** the tree: program, subject areas, required/elective modules, then the courses
 *  themselves as the edge-bearing level — a COURSE is this corpus's "topic" */
const nodes: GNode[] = ${lit(nodes)}

/** each course's published topic breakdown, exactly as its outline gives it */
const deep: Record<string, Record<string, DeepSpec>> = ${lit(deep)}

/** the university's own prerequisites. \`depends_on\` only: the other three
 *  relations this app draws have no counterpart in a course calendar, and an
 *  empty relation is the honest report of that. */
const edges: CorpusSpec['edges'] = ${lit(edges)}

export const COURSES: CorpusSpec = { nodes, deep, edges }
`,
  'utf8',
)

writeFileSync(
  join(OUT, 'coursedocs.ts'),
  `${banner('One document body per node of the course corpus.')}
export const COURSE_DOC: Record<string, string> = ${lit(doc)}
`,
  'utf8',
)

writeFileSync(
  join(OUT, 'coursewalks.ts'),
  `${banner('Authored routes through the course corpus — every step a published prerequisite.')}
import type { Walk } from './walks'

export const COURSE_WALKS: Walk[] = ${lit(data.walks)}
`,
  'utf8',
)

console.log(
  `wrote src/corpus/coursedata.ts, coursedocs.ts, coursewalks.ts\n` +
    `  ${placed.size} courses (${Object.values(data.courses).filter((c) => c.outline).length} with an outline, ` +
    `${Object.values(data.courses).filter((c) => !c.outline).length} stubs)\n` +
    `  ${nodes.length} tree nodes before deep layers, ${edges.length} prerequisite edges\n` +
    `  ${Object.keys(deep).length} courses open into a topic breakdown\n` +
    `  ${data.walks.length} walks`,
)
