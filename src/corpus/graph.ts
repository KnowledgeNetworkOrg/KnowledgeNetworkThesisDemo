// Hand-authored CS teaching corpus for the disclosure experiments:
// 53 edge-bearing TOPICS in a 6-domain / 16-module tree, each topic opening
// into hand-authored deep layers (deep.ts) — subtopics, concepts, details —
// with one flagship spine per domain reaching level 8 (root = level 1).
// Typed edges are authored one by one between topics ONLY — every edge is a
// claim a CS teacher would defend, none are generated; below the topic level
// the structure is pure containment. The corpus doubles as content: the same
// graph a map draws is a curriculum a person could actually follow.

import { DEEP } from './deep'
import type { DeepSpec } from './deep'

export type EdgeType = 'depends_on' | 'uses' | 'see_also' | 'implemented_with'

export interface GNode {
  id: string
  /** tree role, DERIVED from the authored structure: has children or not */
  kind: 'container' | 'leaf'
  parentId: string | null // null only for root
  title: string
  /** the edge-bearing level: one of the 53 teaching topics */
  topic?: true
  /** the ring hue this TOP-LEVEL topic was handed when it was created — stored with the
   *  topic, never derived from its name or its position (DS OB-153). A rename keeps it, a
   *  delete frees it; `src/model/topichue.ts` is the mechanism, this field is the storage.
   *  Only the depth-1 nodes carry one; everything beneath inherits it (`topicHueOf`). */
  hue?: string
}

export interface GEdge {
  id: string
  source: string // always a topic
  target: string // always a topic
  type: EdgeType
}

export const ROOT_ID = 'root'

// ── Palette ──────────────────────────────────────────────────────────────────
// THERE IS NO DOMAIN COLOUR TABLE (DS OB-153, 2026-09-14). Six authored hexes
// lived here until then. The owner's ruling: the topics are not fixed — this is a
// general graphing tool and a topic is whatever the user makes — so a six-entry
// table was the wrong shape whatever its values. A top-level topic is handed a
// RING HUE NAME by creation order (`src/model/topichue.ts`), the name is stored on
// the node (`GNode.hue`, below on each domain's declaration), and every drawing
// resolves it through `topicPaint()` / `topicPaintValues()`. The demo graph ships
// with its six slots already saved — one graph's stored state, the same kind a
// user's graph carries — chosen to sit near the old look: leaf, violet, iris,
// river, amber, fern. Delete this corpus and no topic-colour logic is left behind.
//
// Edge types take three hues + neutral gray, kept hue-disjoint from the ring's
// first eight topics by the walk (`TOPIC_WALK`): an edge colour can never be
// misread as a topic colour. `depends_on` is the most common type, so it gets the
// gray: the prerequisite backbone recedes, rarer semantic links pop.

// THE NATURALISED COLUMN, NOT THE RAW ONE (OB-123). Until 2026-09-03 these were
// full-saturation orange, red and hot pink drawn over paper pastels, while every
// fill, label and walk hairline around them had already been naturalised — so the
// relation arrows looked like they belonged to a different drawing, because they
// did. `tokens/colors.css` states the rule they were breaching: a view converts its
// swatches and its strokes together or not at all. Every legend swatch in the app
// reads this same table, so they move together.
//
// The five values mirror `--edge-*` in `src/tokens/colors.css` exactly, and
// `edgecolor.test.ts` reads that file and asserts they still agree. That test is the
// point: a hand-kept mirror going stale unnoticed is precisely how
// `--color-edge-mixed` sat a generation behind in `tokens/kn-theme.css`.
//
// WHY NOT `var(--edge-uses)` DIRECTLY: these strings are handed to SVG `stroke` and
// `fill` PRESENTATION ATTRIBUTES, where a `var()` does not resolve — it is not a
// parse error, the attribute is simply dropped and the shape renders black. Same
// constraint that makes `src/model/color.ts` compute its own oklch values rather
// than reading the tokens.
export const EDGE_COLOR: Record<EdgeType, string> = {
  // --edge-depends-on. Deliberately NOT a ring hue: the prerequisite backbone is the
  // common case, and the common case recedes.
  depends_on: '#ada291',
  uses: 'oklch(0.6 0.14 42)', // --edge-uses, via --hue-clay-stroke
  see_also: 'oklch(0.6 0.14 322)', // --edge-see-also, via --hue-mallow-stroke
  implemented_with: 'oklch(0.6 0.14 20)', // --edge-implemented-with, via --hue-brick-stroke
}
// --edge-mixed: an aggregate of several types, deliberately not a 17th ring hue.
export const MIXED_EDGE_COLOR = 'oklch(0.52 0.035 255)'

export const EDGE_LABEL: Record<EdgeType, string> = {
  depends_on: 'builds on',
  uses: 'uses',
  see_also: 'see also',
  implemented_with: 'implemented with',
}

// ── Tree ────────────────────────────────────────────────────────────────────
const N: GNode[] = [{ id: ROOT_ID, kind: 'container', parentId: null, title: 'Computer Science' }]

function container(id: string, parentId: string, title: string, hue?: string): string {
  N.push(hue ? { id, kind: 'container', parentId, title, hue } : { id, kind: 'container', parentId, title })
  return id
}
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-')
function topics(parentId: string, prefix: string, titles: string[]) {
  for (const t of titles) {
    N.push({
      id: `${prefix}-${slug(t)}`,
      kind: 'leaf', // provisional — kind is derived after the deep layers attach
      parentId,
      title: t,
      topic: true,
    })
  }
}

// level 2: domains, level 3: modules, level 4 (5 in the tooling branch): topics…
const sys = container('sys', ROOT_ID, 'Computer Systems', 'leaf')
topics(container('dig', sys, 'Digital Logic'), 'dig', [
  'Binary & Data Representation',
  'Transistors & Logic Gates',
  'Combinational Circuits',
  'Sequential Logic & Memory',
])
topics(container('arc', sys, 'Machine Organization'), 'arc', ['Instruction Set Architecture', 'Memory Hierarchy & Caches'])
topics(container('os', sys, 'Operating Systems'), 'os', [
  'Processes & Threads',
  'CPU Scheduling',
  'Virtual Memory',
  'File Systems',
  'Concurrency & Synchronization',
])

const math = container('math', ROOT_ID, 'Mathematical Foundations', 'violet')
topics(container('dm', math, 'Discrete Mathematics'), 'dm', [
  'Propositional Logic',
  'Set Theory & Functions',
  'Graph Theory',
  'Combinatorics & Counting',
  'Induction & Recursion',
])
topics(container('am', math, 'Applied Mathematics'), 'am', ['Probability & Statistics', 'Linear Algebra', 'Modular Arithmetic'])

const cs = container('cs', ROOT_ID, 'Core Computer Science', 'iris')
topics(container('ds', cs, 'Data Structures'), 'ds', ['Arrays & Lists', 'Hash Tables', 'Trees & Heaps', 'Graph Representations'])
topics(container('alg', cs, 'Algorithms'), 'alg', ['Complexity & Big-O', 'Sorting & Searching', 'Graph Traversal', 'Dynamic Programming'])
topics(container('pl', cs, 'Languages & Compilers'), 'pl', [
  'Regular Expressions & Automata',
  'Grammars & Parsing',
  'Type Systems',
  'Compilers & Interpreters',
])

const net = container('net', ROOT_ID, 'Networking', 'river')
topics(container('stk', net, 'Protocol Stack'), 'stk', ['Link Layer & Ethernet', 'IP & Routing', 'TCP & UDP', 'DNS & Naming'])
topics(container('web', net, 'Web & Services'), 'web', ['HTTP & REST', 'Sockets & APIs'])

const sec = container('sec', ROOT_ID, 'Security', 'amber')
topics(container('cry', sec, 'Cryptography'), 'cry', [
  'Symmetric Encryption',
  'Public-Key Cryptography',
  'Cryptographic Hashing',
  'TLS & Certificates',
])
topics(container('app', sec, 'Applied Security'), 'app', ['Authentication & Authorization', 'Common Vulnerabilities'])

const se = container('se', ROOT_ID, 'Software Engineering', 'fern')
topics(container('prc', se, 'Practices'), 'prc', ['Version Control', 'Code Review', 'Design Patterns'])
topics(container('tst', se, 'Testing'), 'tst', ['Unit Testing', 'Integration Testing', 'Property-Based Testing'])
const tool = container('tool', se, 'Tooling')
topics(tool, 'tool', ['Shell & Scripting', 'Debuggers & Profilers'])
// …and ONE module nested a level deeper — its topics sit at level 5, so the
// container strata themselves are already ragged before the deep layers start.
topics(container('auto', tool, 'Automation'), 'auto', ['Continuous Integration', 'Deployment & Monitoring'])

// ── Deep layers ─────────────────────────────────────────────────────────────
// deep.ts authors the strata below each topic; ids chain downward from the
// topic id, one slug per level. Every deep node's one-line blurb is collected
// into DEEP_DOC for docs.ts to merge — structure and content authored in one
// place, in one pass.
export const DEEP_DOC: Record<string, string> = {}
function attach(parentId: string, children: Record<string, DeepSpec>) {
  for (const [title, spec] of Object.entries(children)) {
    const id = `${parentId}-${slug(title)}`
    N.push({ id, kind: 'leaf', parentId, title })
    DEEP_DOC[id] = spec.d
    if (spec.c) attach(id, spec.c)
  }
}
for (const [topicId, children] of Object.entries(DEEP)) {
  const t = N.find((n) => n.id === topicId)
  if (!t?.topic) throw new Error(`deep.ts keys a non-topic id: ${topicId}`)
  attach(topicId, children)
}

// kind is DERIVED, not trusted: a node with children is a container no matter
// what the authoring helpers guessed — "leaf with children" cannot exist here.
{
  const hasKids = new Set(N.filter((n) => n.parentId !== null).map((n) => n.parentId!))
  for (const n of N) n.kind = hasKids.has(n.id) ? 'container' : 'leaf'
}

export const nodes: GNode[] = N

// ── Derived indexes ─────────────────────────────────────────────────────────
export const byId = new Map(nodes.map((n) => [n.id, n]))
export const childrenOf = new Map<string, GNode[]>()
for (const n of nodes) {
  if (n.parentId === null) continue
  const list = childrenOf.get(n.parentId) ?? []
  list.push(n)
  childrenOf.set(n.parentId, list)
}

export const allContainerIds = nodes.filter((n) => n.kind === 'container' && n.id !== ROOT_ID).map((n) => n.id)
/** the 53 edge-bearing topics, in authoring order (the graph views' node set) */
export const topicIds = nodes.filter((n) => n.topic).map((n) => n.id)
export const isTopic = (id: string) => byId.get(id)?.topic === true

/** [root, …, node] — the containment path down to (and including) the node. */
export function pathTo(id: string): string[] {
  const path: string[] = []
  let cur = byId.get(id)
  while (cur) {
    path.unshift(cur.id)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return path
}

/** The depth-1 ancestor (domain) a node belongs to; the id itself if it IS a domain. */
export function domainOf(id: string): string {
  const path = pathTo(id)
  return path[1] ?? id
}

export const domainIds = (childrenOf.get(ROOT_ID) ?? []).map((d) => d.id)

/** the ring hue NAME stored on the top-level topic `id` descends from — the one fact every
 *  drawing of a node's colour starts from. `undefined` for the root and for a domain with
 *  no stored hue, which every reader resolves to the anchor fallback rather than to nothing. */
export function topicHueOf(id: string): string | undefined {
  return byId.get(domainOf(id))?.hue
}

/** Topic ids inside the subtree rooted at `id` — the id itself if it IS a
 * topic, every topic below it for containers above the topic level, and []
 * for deep nodes (typed edges never reach below topics). */
export function topicsUnder(id: string): string[] {
  const out: string[] = []
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    if (byId.get(cur)!.topic) out.push(cur)
    else for (const c of childrenOf.get(cur) ?? []) stack.push(c.id)
  }
  return out
}

/** containment level, root = 1 */
export const depthOf = (id: string) => pathTo(id).length
export const MAX_DEPTH = Math.max(...nodes.map((n) => depthOf(n.id)))

// ── Authored edges ──────────────────────────────────────────────────────────
// Four relations, each with one teaching meaning:
//   on(X, Y)   X builds on Y — pedagogical prerequisite: learn Y before X.
//              This subgraph is a DAG by construction (guard below), so a
//              generated curriculum is always a clean foundations-first order.
//   uses(X, Y) X uses Y — applies Y's machinery in practice (TLS uses
//              public-key crypto). Application, not prerequisite.
//   impl(X, Y) X is implemented with Y — X's realization rests on Y's
//              structure (file systems are built out of trees).
//   also(A, B) see also — related reading. The ONLY relation allowed to be
//              reciprocal; a few deliberate A⇄B pairs keep revisit/cycle
//              mechanics in the views exercisable.
// addEdge is strict: unknown ids, non-topic ids (containers above, deep nodes
// below), self-loops and duplicate same-direction pairs all throw at module
// load — an authoring typo cannot ship silently.

const E: GEdge[] = []
const seen = new Set<string>()
function addEdge(source: string, target: string, type: EdgeType) {
  for (const id of [source, target]) {
    const n = byId.get(id)
    if (!n) throw new Error(`edge references unknown id: ${id}`)
    if (!n.topic) throw new Error(`edge endpoint is not a topic: ${id}`)
  }
  if (source === target) throw new Error(`self-loop: ${source}`)
  const key = `${source}>${target}`
  if (seen.has(key)) throw new Error(`duplicate edge: ${key}`)
  seen.add(key)
  E.push({ id: `e${E.length}`, source, target, type })
}
const on = (x: string, y: string) => addEdge(x, y, 'depends_on')
const uses = (x: string, y: string) => addEdge(x, y, 'uses')
const impl = (x: string, y: string) => addEdge(x, y, 'implemented_with')
const also = (a: string, b: string) => addEdge(a, b, 'see_also')

// — The systems ladder: from physics to a running program —
on('dig-transistors-logic-gates', 'dm-propositional-logic') // a gate IS a proposition in silicon
on('dig-combinational-circuits', 'dig-transistors-logic-gates')
on('dig-combinational-circuits', 'dig-binary-data-representation') // adders add binary numbers
on('dig-sequential-logic-memory', 'dig-combinational-circuits') // feedback turns logic into state
on('arc-instruction-set-architecture', 'dig-sequential-logic-memory') // registers hold the machine's state
on('arc-instruction-set-architecture', 'dig-binary-data-representation') // instructions are bit encodings
on('arc-memory-hierarchy-caches', 'dig-sequential-logic-memory') // SRAM/DRAM are sequential circuits
on('os-processes-threads', 'arc-instruction-set-architecture') // a context is registers + a program counter
on('os-cpu-scheduling', 'os-processes-threads')
on('os-virtual-memory', 'arc-memory-hierarchy-caches')
on('os-virtual-memory', 'os-processes-threads') // one address space per process
on('os-file-systems', 'arc-memory-hierarchy-caches') // storage is the bottom of the hierarchy
on('os-concurrency-synchronization', 'os-processes-threads')

// — Math feeding everything: the discrete core and its applied wing —
on('dm-set-theory-functions', 'dm-propositional-logic') // proofs about sets need logic first
on('dm-graph-theory', 'dm-set-theory-functions')
on('dm-combinatorics-counting', 'dm-set-theory-functions')
on('dm-induction-recursion', 'dm-propositional-logic')
on('am-probability-statistics', 'dm-combinatorics-counting') // counting before probability
on('am-probability-statistics', 'dm-set-theory-functions') // events are sets
on('am-linear-algebra', 'dm-set-theory-functions') // vector spaces are structured sets
on('am-modular-arithmetic', 'dm-set-theory-functions') // congruence classes are equivalence classes

// — Data structures and algorithms —
on('ds-arrays-lists', 'dig-binary-data-representation') // contiguous memory is a bit-level idea
on('ds-hash-tables', 'ds-arrays-lists')
on('ds-trees-heaps', 'ds-arrays-lists')
on('ds-trees-heaps', 'dm-induction-recursion') // trees are the inductive structure
on('ds-graph-representations', 'dm-graph-theory')
on('ds-graph-representations', 'ds-arrays-lists')
on('alg-complexity-big-o', 'dm-combinatorics-counting') // analysis is counting steps
on('alg-complexity-big-o', 'dm-induction-recursion') // recurrences
on('alg-sorting-searching', 'alg-complexity-big-o')
on('alg-sorting-searching', 'ds-arrays-lists')
on('alg-graph-traversal', 'ds-graph-representations')
on('alg-graph-traversal', 'alg-complexity-big-o')
on('alg-dynamic-programming', 'dm-induction-recursion') // optimal substructure is induction
on('alg-dynamic-programming', 'alg-complexity-big-o')

// — Languages: from regular to Turing-complete —
on('pl-regular-expressions-automata', 'dm-set-theory-functions') // a language is a set of strings
on('pl-grammars-parsing', 'pl-regular-expressions-automata') // one rung up the Chomsky ladder
on('pl-type-systems', 'dm-set-theory-functions') // types are sets of values
on('pl-type-systems', 'dm-propositional-logic') // propositions as types
on('pl-compilers-interpreters', 'pl-grammars-parsing')
on('pl-compilers-interpreters', 'arc-instruction-set-architecture') // codegen needs a target

// — The network stack, bottom up —
on('stk-link-layer-ethernet', 'dig-binary-data-representation') // a frame is a bit layout
on('stk-ip-routing', 'stk-link-layer-ethernet')
on('stk-ip-routing', 'dm-graph-theory') // the internet is a graph
on('stk-tcp-udp', 'stk-ip-routing')
on('stk-dns-naming', 'stk-tcp-udp') // resolution rides on UDP/TCP
on('web-http-rest', 'stk-tcp-udp')
on('web-http-rest', 'stk-dns-naming') // a URL means nothing without name resolution
on('web-sockets-apis', 'stk-tcp-udp')

// — Security: math made load-bearing —
on('cry-symmetric-encryption', 'dig-binary-data-representation') // XOR, blocks, padding
on('cry-symmetric-encryption', 'am-probability-statistics') // keyspaces and randomness
on('cry-public-key-cryptography', 'am-modular-arithmetic') // the whole trick is modular
on('cry-cryptographic-hashing', 'dig-binary-data-representation')
on('cry-tls-certificates', 'cry-public-key-cryptography')
on('cry-tls-certificates', 'cry-symmetric-encryption')
on('cry-tls-certificates', 'cry-cryptographic-hashing')
on('cry-tls-certificates', 'stk-tcp-udp') // the handshake rides on TCP
on('app-authentication-authorization', 'cry-cryptographic-hashing') // password storage
on('app-common-vulnerabilities', 'web-http-rest') // injection/XSS/CSRF live in the web
on('app-common-vulnerabilities', 'ds-arrays-lists') // buffer overflows live in memory layout

// — Software engineering: practices on top of everything below —
on('prc-code-review', 'prc-version-control')
on('prc-design-patterns', 'pl-type-systems')
on('tst-integration-testing', 'tst-unit-testing')
on('tst-property-based-testing', 'tst-unit-testing')
on('tool-shell-scripting', 'os-processes-threads') // a shell is process control made visible
on('tool-shell-scripting', 'os-file-systems')
on('tool-debuggers-profilers', 'arc-instruction-set-architecture') // breakpoints live at ISA level
on('tool-debuggers-profilers', 'os-processes-threads')
on('auto-continuous-integration', 'prc-version-control')
on('auto-continuous-integration', 'tst-unit-testing')
on('auto-deployment-monitoring', 'auto-continuous-integration')

// — uses: one topic applying another's machinery in practice —
uses('stk-ip-routing', 'alg-graph-traversal') // routing is shortest-path search, live
uses('web-http-rest', 'cry-tls-certificates') // HTTPS
uses('cry-tls-certificates', 'stk-dns-naming') // certificates vouch for hostnames
uses('app-authentication-authorization', 'web-http-rest') // sessions, cookies, tokens
uses('app-authentication-authorization', 'cry-public-key-cryptography') // signed tokens
uses('app-common-vulnerabilities', 'tool-debuggers-profilers') // analysis and exploit dev
uses('pl-compilers-interpreters', 'pl-type-systems') // the type-checking phase
uses('ds-graph-representations', 'am-linear-algebra') // adjacency matrices
uses('prc-version-control', 'os-file-systems') // the working tree is real files
uses('prc-code-review', 'prc-design-patterns') // reviewers speak pattern vocabulary
uses('tst-property-based-testing', 'am-probability-statistics') // random generation
uses('tst-integration-testing', 'web-http-rest') // API-level tests
uses('tool-shell-scripting', 'pl-regular-expressions-automata') // grep and sed all day
uses('tool-debuggers-profilers', 'arc-memory-hierarchy-caches') // profilers expose cache behavior
uses('web-sockets-apis', 'os-concurrency-synchronization') // async IO, thread-per-connection
uses('auto-continuous-integration', 'tool-shell-scripting') // pipelines are scripts
uses('auto-continuous-integration', 'tst-integration-testing')
uses('auto-deployment-monitoring', 'stk-dns-naming') // traffic switching
uses('auto-deployment-monitoring', 'web-http-rest') // health checks

// — implemented with: realizations resting on another topic's structure —
impl('os-file-systems', 'ds-trees-heaps') // directories and B-trees
impl('os-virtual-memory', 'ds-trees-heaps') // multi-level page tables
impl('os-cpu-scheduling', 'ds-trees-heaps') // priority queues
impl('pl-compilers-interpreters', 'ds-trees-heaps') // the AST
impl('pl-compilers-interpreters', 'ds-hash-tables') // symbol tables
impl('prc-version-control', 'cry-cryptographic-hashing') // content-addressed storage (git!)
impl('alg-sorting-searching', 'ds-trees-heaps') // heapsort
impl('alg-dynamic-programming', 'ds-arrays-lists') // memo tables
impl('stk-dns-naming', 'ds-trees-heaps') // the namespace is a tree

// — see also: related reading; reciprocal pairs are deliberate, and the pair
//   privilege goes to topics with NO stronger tie (a pair already bound by
//   builds-on doesn't get a see-also echo — one relation per direction) —
also('ds-hash-tables', 'cry-cryptographic-hashing') // ⇄ same idea, different guarantees
also('cry-cryptographic-hashing', 'ds-hash-tables')
also('tst-unit-testing', 'prc-code-review') // ⇄ the two everyday quality gates
also('prc-code-review', 'tst-unit-testing')
also('cry-symmetric-encryption', 'cry-public-key-cryptography') // ⇄ the classic compare-and-contrast
also('cry-public-key-cryptography', 'cry-symmetric-encryption')
also('dm-graph-theory', 'am-linear-algebra') // ⇄ the spectral view of a graph
also('am-linear-algebra', 'dm-graph-theory')
also('dig-sequential-logic-memory', 'pl-regular-expressions-automata') // both are state machines
also('dig-binary-data-representation', 'am-modular-arithmetic') // overflow wraps: arithmetic mod 2^n
also('am-modular-arithmetic', 'ds-hash-tables') // mod as bucket index
also('am-probability-statistics', 'ds-hash-tables') // collision odds, birthday bound
also('web-sockets-apis', 'web-http-rest') // two styles of talking to a server
also('app-common-vulnerabilities', 'app-authentication-authorization') // broken auth is a top class
also('tool-debuggers-profilers', 'tst-unit-testing') // two ways to corner a bug
also('auto-deployment-monitoring', 'tool-debuggers-profilers') // observing prod vs observing local
also('pl-compilers-interpreters', 'prc-design-patterns') // visitors walk the AST

export const edges: GEdge[] = E

// ── Module-load guards ──────────────────────────────────────────────────────
// The corpus is hand-authored, so the guards are structural, not numeric: they
// catch the mistakes a human editor can actually make.

// 0. Tree shape — ids unique; every topic opens into at least two deep
// children; every SUBTOPIC opens into at least two concepts (the depth floor:
// no branch ends at level 5); every topic's subtree reaches level 7 somewhere;
// the corpus is exactly 8 levels at its deepest, and EVERY domain has a
// flagship spine reaching level 8 (ragged tips everywhere else are fine).
{
  if (byId.size !== nodes.length) {
    const seenIds = new Set<string>()
    const dups = nodes.filter((n) => (seenIds.has(n.id) ? true : (seenIds.add(n.id), false))).map((n) => n.id)
    throw new Error(`duplicate node ids: ${dups.join(', ')}`)
  }
  const thin = topicIds.filter((t) => (childrenOf.get(t) ?? []).length < 2)
  if (thin.length) throw new Error(`topics with fewer than 2 deep children: ${thin.join(', ')}`)
  const thinSub = topicIds.flatMap((t) => (childrenOf.get(t) ?? []).filter((s) => (childrenOf.get(s.id) ?? []).length < 2))
  if (thinSub.length) throw new Error(`subtopics with fewer than 2 concepts: ${thinSub.map((s) => s.id).join(', ')}`)
  const deepestUnder = (id: string): number => {
    const kids = childrenOf.get(id) ?? []
    return kids.length ? Math.max(...kids.map((k) => deepestUnder(k.id))) : depthOf(id)
  }
  const shallow = topicIds.filter((t) => deepestUnder(t) < 7)
  if (shallow.length) throw new Error(`topics whose subtree never reaches level 7: ${shallow.join(', ')}`)
  if (MAX_DEPTH !== 8) throw new Error(`expected max containment depth 8, got ${MAX_DEPTH}`)
  for (const d of domainIds) {
    const deepest = Math.max(...nodes.filter((n) => pathTo(n.id)[1] === d).map((n) => depthOf(n.id)))
    if (deepest !== 8) throw new Error(`domain ${d} has no level-8 spine (deepest: ${deepest})`)
  }
}

// 1. "builds on" is a DAG — a curriculum must never be circular.
{
  const dep = edges.filter((e) => e.type === 'depends_on')
  const unmet = new Map<string, number>(topicIds.map((id) => [id, 0]))
  for (const e of dep) unmet.set(e.source, unmet.get(e.source)! + 1)
  const dependants = new Map<string, string[]>()
  for (const e of dep) {
    if (!dependants.has(e.target)) dependants.set(e.target, [])
    dependants.get(e.target)!.push(e.source)
  }
  const queue = topicIds.filter((id) => unmet.get(id) === 0)
  let emitted = 0
  while (queue.length) {
    const cur = queue.pop()!
    emitted++
    for (const d of dependants.get(cur) ?? []) {
      unmet.set(d, unmet.get(d)! - 1)
      if (unmet.get(d) === 0) queue.push(d)
    }
  }
  if (emitted !== topicIds.length) {
    const stuck = topicIds.filter((id) => unmet.get(id)! > 0)
    throw new Error(`"builds on" edges contain a cycle through: ${stuck.join(', ')}`)
  }
}

// 2. Connected + no orphans — flat.ts's spanning tree and the map embedding
// both assume every topic is reachable from every other, ignoring direction.
{
  const adj = new Map<string, string[]>(topicIds.map((id) => [id, []]))
  for (const e of edges) {
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  const orphans = topicIds.filter((id) => adj.get(id)!.length === 0)
  if (orphans.length) throw new Error(`topics with no edges at all: ${orphans.join(', ')}`)
  const visited = new Set<string>([topicIds[0]])
  const queue = [topicIds[0]]
  while (queue.length) for (const nb of adj.get(queue.pop()!)!) if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
  if (visited.size !== topicIds.length) {
    throw new Error(`corpus is disconnected — unreachable: ${topicIds.filter((id) => !visited.has(id)).join(', ')}`)
  }
}

// 3. Reciprocal pairs are a "see also" privilege — in any directed relation a
// reciprocal pair is either a mistake or a hidden cycle.
{
  const byType = new Map<EdgeType, Set<string>>()
  for (const e of edges) {
    if (!byType.has(e.type)) byType.set(e.type, new Set())
    byType.get(e.type)!.add(`${e.source}>${e.target}`)
  }
  let seeAlsoPairs = 0
  for (const [type, keys] of byType) {
    let pairs = 0
    for (const k of keys) {
      const [s, t] = k.split('>')
      if (s < t && keys.has(`${t}>${s}`)) pairs++
    }
    if (type === 'see_also') seeAlsoPairs = pairs
    else if (pairs > 0) throw new Error(`reciprocal pair in directed relation "${type}"`)
  }
  if (seeAlsoPairs < 3) throw new Error(`expected >= 3 deliberate see-also pairs, found ${seeAlsoPairs}`)
}
