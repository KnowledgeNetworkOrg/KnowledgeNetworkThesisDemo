// THE ROUTE THE BUS PUBLISHES, WITH ITS GROUPS INTACT (#228, DS OB-114).
//
// The walk desk holds a walk as a TREE — steps, and containers holding steps —
// and a resolved container stays a named group rather than being spliced inline
// (#19). Until this file, the bus flattened that tree to `leafIds()` before any
// instrument saw it, so every group boundary was destroyed one layer below the
// map: a group at step 3 holding three nodes numbered its nodes 3, 4, 5 and the
// step after the group came out 6, while the desk's own chain read 3.1, 3.2, 3.3
// and 4. Two views of one walk disagreed about how many steps it had.
//
// THE CHANNEL SHAPE, decided 2026-09-03 (issue #228, the DS's stated preference):
// the bus publishes the resolved TREE, and the flat route every current reader
// wants stays as a DERIVED projection of it (`routeLeafIds`), so no reader
// changes. A parallel `routeGroups` array would be the same information held at
// a distance from the thing it describes, which is the shape that goes stale
// silently; a derived numbering channel would encode one consumer's question
// into the transport. The bus owns this small type rather than the desk's `Stop`
// (whose own header calls it throwaway spike data): a step either lands on a
// node or holds steps of its own, read from its shape the way the desk reads
// leaf-vs-container.
//
// WHAT THE MAP DRAWS FOR A GROUP, ruled by the owner 2026-09-03 (DS OB-114): one
// pin PER NODE, each numbered with the group's TOP-LEVEL step. Never one averaged
// pin (a pin where the walk never goes is a lie), never "3.1" on a pin (it takes
// StepDot's pill branch and reads as a range; a nested path fits no circle). The
// full path is the HOVER's — the preview card names the stop "3.1 · <name>" — and
// the chain's, where there is room. Consequences, all deliberate: several map
// pins may share a number, and a pin's number is NOT an id — nothing keys on it.

/** one step of a published route: a node the walk lands on, OR a group holding
 *  steps of its own. Exactly one of `node` / `steps` is set. */
export interface RouteStep {
  /** the corpus node a LEAF step lands on */
  node?: string
  /** a GROUP's steps, in order. A group counts as ONE step of the walk and
   *  numbers its own contents underneath itself (3 → 3.1, 3.2, 3.3). */
  steps?: RouteStep[]
  /** the group's authored name, for anything that names it */
  title?: string
  /** a LEAF step the walk may skip (DS OB-214 clause 2). Only a leaf carries it — a group has no
   *  optionality of its own (DS OB-215) — and it is present only when true. It survives the
   *  flattening where a group's numbering does not, because it is a fact about one leaf: read it
   *  flat, aligned with `routeLeafIds`, through `routeOptionals`. */
  optional?: boolean
}

export const routeStepIsGroup = (s: RouteStep): s is RouteStep & { steps: RouteStep[] } => Array.isArray(s.steps)

/** the flat route — every node the walk lands on, in walk order. What `bus.route`
 *  is, derived; what every reader that never cared about groups keeps reading. */
export function routeLeafIds(steps: readonly RouteStep[]): string[] {
  const out: string[] = []
  for (const s of steps) {
    if (routeStepIsGroup(s)) out.push(...routeLeafIds(s.steps))
    else if (s.node) out.push(s.node)
  }
  return out
}

/** which landed-on nodes the walk may skip — one boolean per entry of `routeLeafIds`, in the
 *  same order, so `routeOptionals(s)[i]` is the flag of `routeLeafIds(s)[i]`. A PARALLEL LIST
 *  rather than objects on `bus.route` (DS OB-214 clause 2 left the shape to us): every reader of
 *  the flat route keeps its `string[]`, and the one reader that needs the flag — the map's pin
 *  layout — takes the two side by side. Walks the tree exactly as `routeLeafIds` does. */
export function routeOptionals(steps: readonly RouteStep[]): boolean[] {
  const out: boolean[] = []
  for (const s of steps) {
    if (routeStepIsGroup(s)) out.push(...routeOptionals(s.steps))
    else if (s.node) out.push(s.optional === true)
  }
  return out
}

/** a flat list of ids as a route — the saved-walk and curriculum writers, which
 *  have no groups to publish */
export const routeOfIds = (ids: readonly string[]): RouteStep[] => ids.map((node) => ({ node }))

/** how one landed-on node is numbered, in walk order */
export interface RouteNumber {
  id: string
  /** the TOP-LEVEL step this node belongs to, 1-based — the group's number when
   *  the node sits inside one, its own otherwise. What a map pin prints. */
  step: number
  /** the full dotted path — "3", "3.1", "1.1.1.2" — the group's own local
   *  numbering all the way down. What the hover card and the chain print. */
  path: string
  /** true when the node sits inside a group at any depth */
  grouped: boolean
}

/** every landed-on node with its top-level step and full path, in walk order —
 *  one entry per entry of `routeLeafIds`, in the same order. A group takes one
 *  number whether or not it holds any node, exactly as it takes one slot in the
 *  desk's chain. */
export function routeNumbers(steps: readonly RouteStep[]): RouteNumber[] {
  const out: RouteNumber[] = []
  const walk = (list: readonly RouteStep[], prefix: string, top: number | null) => {
    list.forEach((s, i) => {
      const n = i + 1
      const path = prefix ? `${prefix}.${n}` : String(n)
      const step = top ?? n
      if (routeStepIsGroup(s)) walk(s.steps, path, step)
      else if (s.node) out.push({ id: s.node, step, path, grouped: top !== null })
    })
  }
  walk(steps, '', null)
  return out
}
