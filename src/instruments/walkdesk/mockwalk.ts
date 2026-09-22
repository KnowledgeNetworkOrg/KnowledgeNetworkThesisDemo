// Mock data for the Walk·Desk — a TIERED walk over the teaching corpus, now on
// ONE stop type (#19). A stop optionally lands on a corpus node (a LEAF) and
// optionally holds child-lists (VARIANTS). Its meaning is read from its shape,
// never from a stored tag:
//
//   variants.length === 0   a leaf — the walk stops on a real corpus node
//                    === 1   a plain group — a named box, one list of steps
//                    >=  2   a fork — the road can go one of several ways
//
// "Container" = anything with variants; a fork is just a container with more
// than one. THROWAWAY spike data: nothing here touches the bus. The corpus is
// unchanged — tiers and branches are pure overlay over the same nodes.
//
// The dataset packs four tiers of depth (one more than the altitude window), a
// sub-walk BY REFERENCE (a group built from an authored walks.ts walk), a
// REVISIT (stk-tcp-udp stopped on twice), and mixed grain (a plain leaf between
// groups at tier 0).

import type { RouteStep } from '../../model/route'
import { byId, CORPUS_NAME } from '../../corpus/graph'
import { WALKS } from '../../corpus/walks'

/** one child-list of a container — its label is what picks it at a fork */
export interface Variant {
  /** stable id assigned at creation; survives reorder/delete so VersionedGroup
   * can track activeId across structural edits (#92). */
  id: string
  label: string
  steps: Stop[]
}

/** THE stop. A leaf binds `node` and has no variants; a container has variants
 * (and a `key`/`title`) and binds no node. The two are kept exclusive by how
 * the ops build them, not by the type — see #19. */
export interface Stop {
  /** the corpus topic a LEAF lands on ('' only while an unset placeholder) */
  node?: string
  note?: string
  /** an optional stop: on the road by default, but the road can bypass it */
  optional?: boolean
  /** a placeholder leaf with no node bound yet — shows a "pick a node" chip and
   * is DROPPED from the projection, so downstream never sees a hole */
  unset?: boolean
  /** a CONTAINER's stable id — choice, collapse and rename state hang off it */
  key?: string
  title?: string
  /** a free-text description shown under the title of any OPEN container — the
   * node subtitle (#15), left-indented so it reads as "under" the title. What
   * the node IS. (A separate fork "question" field was removed in the V2-NEAT
   * pass — the per-version v1/v2/v3 titles carry version naming instead.) */
  description?: string
  /** []  = leaf · 1 = plain group · 2+ = fork */
  variants: Variant[]
}

/** a leaf: no variants. Narrows `node` to a definite string for consumers. */
export const isLeaf = (s: Stop): s is Stop & { node: string } => s.variants.length === 0
/** a container: one or more variants. Narrows `key`/`title` to definite. */
export const isBox = (s: Stop): s is Stop & { key: string; title: string } => s.variants.length > 0
/** a fork: a container offering a choice (more than one variant) */
export const isFork = (s: Stop): boolean => s.variants.length > 1

/** which variant a container currently shows/takes. Looks up by the stored id
 * so the result is stable when variants before it are deleted (#92). Falls
 * back to 0 if the id is not found — the active version was deleted. */
export const chosenIdx = (s: Stop, choices: Record<string, string>): number => {
  const i = s.variants.findIndex((v) => v.id === choices[s.key ?? ''])
  return i >= 0 ? i : 0
}
/** the steps of the chosen variant */
export const chosenSteps = (s: Stop, choices: Record<string, string>): Stop[] =>
  s.variants[chosenIdx(s, choices)]?.steps ?? []

const v = (node: string, note?: string): Stop => ({ node, note, variants: [] })
/** a plain group: one unlabeled variant holding the steps */
const group = (key: string, title: string, steps: Stop[]): Stop => ({ key, title, variants: [{ id: key + '-v0', label: '', steps }] })

/** a group built FROM an authored walk — sub-walk by reference. The stop "is"
 * the whole walk; expanding it plays the walk's stops as its steps. */
function groupFromWalk(key: string, walkId: string): Stop {
  const w = WALKS.find((x) => x.id === walkId)
  if (!w) throw new Error(`walk mock references unknown walk: ${walkId}`)
  return group(
    key,
    w.title,
    w.stops.map((s) => v(s.id, s.note)),
  )
}

export interface Plan {
  title: string
  stops: Stop[]
}

// A FUNCTION, not a constant: it names ids of the teaching corpus, so evaluating
// it under any other corpus would throw on import.
const teachingPlan = (): Plan => ({
  title: 'Ship a page the world can load — a plan',
  stops: [
    groupFromWalk('machine', 'transistor-to-program'),
    group('serve', 'Serve it on the network', [
      v('stk-dns-naming', 'a typed name must become an address before anything moves'),
      v('stk-ip-routing', 'packets hop toward that address with no promises'),
      v('stk-tcp-udp', 'a reliable stream is built out of the unreliable hops'),
      group('secure', 'Secure the channel', [
        v('cry-public-key-cryptography', 'the trapdoor that lets strangers agree on a secret'),
        v('cry-tls-certificates', 'the handshake that proves a name and seals the stream'),
        group('primitives', 'The primitives underneath', [
          v('cry-symmetric-encryption', 'once the key is agreed, the bulk cipher does the work'),
          v('cry-cryptographic-hashing', 'integrity: the fingerprint every record carries'),
        ]),
      ]),
    ]),
    group('speak', 'Speak the application protocol', [
      v('web-http-rest', 'over the secured stream, the browser finally talks'),
      v('web-sockets-apis', 'on both ends the conversation is just sockets'),
      v('stk-tcp-udp', 'the same stream again — a revisit, on purpose'),
    ]),
    v('app-authentication-authorization', 'the closing leaf: the page knows who it is for'),
  ],
})

// ── A seed for any other corpus ──────────────────────────────────────────────
// The plan above names eleven ids of the hand-authored teaching corpus, so it
// cannot seed a different one. This builds the same SHAPES — a sub-walk by
// reference, nested groups, a deliberate revisit, a bare leaf at the end — out
// of whatever walks the loaded corpus actually has, naming nothing. It is a
// fixture, not a curriculum: the Walk Desk needs something on the road to open
// with, and this is the least opinionated thing that can be there.
function planFromWalks(): Plan {
  const [first, ...rest] = WALKS
  if (!first) return { title: 'An empty plan', stops: [] }
  const stops: Stop[] = [groupFromWalk('opening', first.id)]
  for (const w of rest) {
    const half = Math.max(1, Math.ceil(w.stops.length / 2))
    const head = w.stops.slice(0, half).map((s) => v(s.id, s.note))
    const tail = w.stops.slice(half).map((s) => v(s.id, s.note))
    stops.push(group(w.id, w.title, tail.length ? [...head, group(`${w.id}-rest`, 'And onward', tail)] : head))
  }
  // a revisit, on purpose: the last walk's first stop, seen once more
  const revisit = rest[rest.length - 1]?.stops[0] ?? first.stops[0]
  if (revisit) stops.push(v(revisit.id, 'the same stop again — a revisit, on purpose'))
  const closing = first.stops[first.stops.length - 1]
  if (closing) stops.push(v(closing.id, 'the closing leaf'))
  return { title: `${first.title} — a plan`, stops }
}

/** the Walk Desk's opening road: the authored plan on the teaching corpus, a
 *  shape-equivalent one built from the corpus's own walks on any other */
export const PLAN: Plan = CORPUS_NAME === 'teaching' ? teachingPlan() : planFromWalks()

// ── Projection ──────────────────────────────────────────────────────────────
// Turning a resolved stop tree into the flat route the bus would read.

/** flat ordered LEAF STOPS from a resolved stop tree. resolveRoad has already
 * collapsed fork choices and dropped skipped optionals, so every container here
 * has exactly one variant — no branching remains. Keeping the whole stop rather
 * than its id is what lets a note travel with it into a saved walk (#16). */
export function leafStops(stops: Stop[]): (Stop & { node: string })[] {
  const out: (Stop & { node: string })[] = []
  for (const s of stops) {
    if (isLeaf(s)) out.push(s)
    else out.push(...leafStops(s.variants[0]?.steps ?? []))
  }
  return out
}

/** the same leaves as ids alone — the flat route. Expressed through leafStops so
 * the two can never walk the tree differently. */
export const leafIds = (stops: Stop[]): string[] => leafStops(stops).map((s) => s.node)

/** the resolved road as the BUS's route type — groups kept (#228, DS OB-114): a
 * container becomes a group holding its chosen variant's steps, a leaf becomes a
 * node. Walks the tree exactly as leafStops does, so `routeLeafIds` of the
 * result is `leafIds` of the road (playback.test.ts pins that). The bus's type
 * rather than `Stop` itself: the bus must not depend on this file's spike data. */
export function routeStepsOf(stops: Stop[]): RouteStep[] {
  return stops.map((s) => (isLeaf(s)
    ? { node: s.node }
    : { title: s.title, steps: routeStepsOf(s.variants[0]?.steps ?? []) }))
}

// ── Road resolution ─────────────────────────────────────────────────────────
// A branching draft still projects to ONE linear walk: at every container pick
// the chosen variant (variant 0 is the default road) and drop skipped optionals.
// Unlike the old model, a resolved container STAYS a named group (its single
// surviving variant), rather than splicing its steps inline (#19) — everything
// downstream renders a container the same way whether it began as a group or a
// fork.

export function resolveRoad(stops: Stop[], choices: Record<string, string>, withOptionals: boolean): Stop[] {
  const out: Stop[] = []
  for (const s of stops) {
    if (isLeaf(s)) {
      if (s.unset) continue // placeholder slot — never reaches the presented road
      if (s.optional && !withOptionals) continue
      out.push(s)
    } else {
      if (s.optional && !withOptionals) continue
      const chosen = s.variants[chosenIdx(s, choices)]
      out.push({
        ...s,
        variants: [{ id: chosen?.id ?? '', label: chosen?.label ?? '', steps: resolveRoad(chosen?.steps ?? [], choices, withOptionals) }],
      })
    }
  }
  return out
}

// ── Shape helpers ───────────────────────────────────────────────────────────

/** Depth-first visit of every stop, descending into EVERY variant (both roads
 * of a fork, not just the chosen one). The one tree-walk the read-only
 * traversals share — validation, key collection. Projection (`resolveRoad`)
 * does NOT use it: it picks a single variant, so its branching is the point,
 * not boilerplate to factor out. */
export function forEachStop(stops: Stop[], visit: (s: Stop) => void): void {
  for (const s of stops) {
    visit(s)
    if (isBox(s)) for (const vr of s.variants) forEachStop(vr.steps, visit)
  }
}

/** leaf visits under a stop, all tiers — a fork counts its longest variant */
export function visitCount(s: Stop): number {
  if (isLeaf(s)) return s.unset ? 0 : 1
  return Math.max(0, ...s.variants.map((vr) => vr.steps.reduce((a, c) => a + visitCount(c), 0)))
}

// ── Module-load guard — the walks.ts idiom: throw at load, not at render ────
{
  forEachStop(PLAN.stops, (s) => {
    if (!isLeaf(s) || s.unset) return
    const n = byId.get(s.node)
    if (!n) throw new Error(`walk mock references unknown node id: ${s.node}`)
    if (!n.topic) throw new Error(`walk mock stop ${s.node} is not a topic`)
  })
  const keys: string[] = []
  forEachStop(PLAN.stops, (s) => {
    if (isBox(s)) keys.push(s.key)
  })
  if (new Set(keys).size !== keys.length) throw new Error('walk mock: duplicate container key')
}
