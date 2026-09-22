// THE HAND-AUTHORED CS TEACHING CORPUS — 53 edge-bearing TOPICS in a
// 6-domain / 16-module tree, each topic opening into hand-authored deep layers
// (deep.ts) — subtopics, concepts, details — with one flagship spine per domain
// reaching level 8 (root = level 1). Typed edges are authored one by one
// between topics ONLY — every edge is a claim a CS teacher would defend, none
// are generated; below the topic level the structure is pure containment. The
// corpus doubles as content: the same graph a map draws is a curriculum a
// person could actually follow.
//
// This is the demo's DEFAULT corpus and the one every pinned test measures. It
// moved out of graph.ts unchanged when the repo gained a second corpus; graph.ts
// now only chooses between them. Its document bodies are `teachingdocs.ts` and
// its walks `teachingwalks.ts`, split out at the same time and for the reason.

import type { CorpusSpec, EdgeType, GNode } from './graphshape'
import { ROOT_ID, slug } from './graphshape'
import { DEEP } from './deep'

// ── Tree ────────────────────────────────────────────────────────────────────
const N: GNode[] = [{ id: ROOT_ID, kind: 'container', parentId: null, title: 'Computer Science' }]

function container(id: string, parentId: string, title: string, hue?: string): string {
  N.push(hue ? { id, kind: 'container', parentId, title, hue } : { id, kind: 'container', parentId, title })
  return id
}
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

const E: { source: string; target: string; type: EdgeType }[] = []
const addEdge = (source: string, target: string, type: EdgeType) => E.push({ source, target, type })
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

export const TEACHING: CorpusSpec = { nodes: N, deep: DEEP, edges: E }
