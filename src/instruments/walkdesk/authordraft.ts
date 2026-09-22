// The authoring draft state — the walk tree ITSELF as mutable state, plus a
// block selection and an insertion caret. Since #19 there is ONE stop type, so
// the path grammar is UNIFORM: every container consumes exactly two segments,
// [stopIdx, variantIdx, stepIdx…]. A leaf is just a stop nobody descends into.
// The old "a stage consumes one segment, a fork consumes two" special case is
// gone — rebuildListAt knows one rule, and every structural op inherits it.
//
// Blocks are addressed by INDEX PATHS into the draft's stops. A path alternates
// stop-index / variant-index and always ends on a stop index, so [1, 0, 2] is
// "step 2 of variant 0 of stop 1". Every op is a pure rebuild; selection is
// cleared after any structural change so no stale path can dangle.

import { useSyncExternalStore } from 'react'

import { CORPUS_NAME, topicIds } from '../../corpus/graph'
import { mintId, saveWalk, walkById } from '../../model/walkstore'
import type { Walk } from '../../model/walkstore'
import { loadDraft, nextIds, saveDraft } from './draftpersist'
import { isBox, isFork, isLeaf, leafStops, resolveRoad } from './mockwalk'
import type { Stop, Variant } from './mockwalk'

export type Path = number[]

// ── One draft, shared (#21) ─────────────────────────────────────────────────
// The draft used to be component state inside WalkDeskView, which worked while
// the palette and the walk editor were two zones of one component. #21 split them
// into separate instruments, and a palette that inserts into a draft the
// walk editor cannot see is useless — so the draft moved into module-level stores
// both subscribe to.
//
// A SINGLETON, deliberately: there is one plan being written. Two Walk·Desk
// panes should be two views OF that plan, not two plans. The bus is not the
// right home either — it carries what every instrument shares, and a half-built
// draft is the authoring pair's private business. #16 has since bridged it in
// both directions without moving it: what leaves the desk is a finished WALK
// (saveDraftAsWalk, below), which every instrument already understood.

interface Store<T> {
  get(): T
  set(v: T): void
  subscribe(fn: () => void): () => void
}

function store<T>(initial: T): Store<T> {
  let value = initial
  const subs = new Set<() => void>()
  return {
    get: () => value,
    set: (v) => {
      if (Object.is(v, value)) return
      value = v
      for (const fn of subs) fn()
    },
    subscribe: (fn) => {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

/** the useState of a shared store — same shape, one value across all callers */
function useStore<T>(s: Store<T>): [T, (v: T) => void] {
  return [useSyncExternalStore(s.subscribe, s.get), s.set]
}

/** The draft starts SEEDED with a fork and an optional stop so branching is
 * visible at first paint; every id is a real corpus node — tiers and variants
 * alike stay pure overlay on an untouched corpus.
 *
 * A FUNCTION, not a constant, and only one of two: the ids below are the
 * hand-authored teaching corpus's, so evaluating this against any other corpus
 * would put nodes on the road that the corpus does not have — which surfaces as
 * a blank screen, not an error, because the players assert their lookups. */
const teachingSeed = (): Stop[] => [
  { node: 'stk-dns-naming', variants: [] },
  {
    key: 'seed-net',
    title: 'Reach the machine',
    variants: [{ id: 'seed-net-v0', label: '', steps: [{ node: 'stk-ip-routing', variants: [] }, { node: 'stk-tcp-udp', variants: [] }] }],
  },
  {
    key: 'seed-sec',
    title: 'Secure the channel',
    variants: [
      { id: 'seed-sec-v0', label: 'just the handshake', steps: [{ node: 'cry-tls-certificates', variants: [] }] },
      {
        id: 'seed-sec-v1',
        label: 'full crypto tour',
        steps: [
          { node: 'cry-public-key-cryptography', variants: [] },
          { node: 'cry-symmetric-encryption', variants: [] },
          { node: 'cry-cryptographic-hashing', variants: [] },
          { node: 'cry-tls-certificates', variants: [] },
        ],
      },
    ],
  },
  { node: 'web-http-rest', variants: [] },
  { node: 'web-sockets-apis', optional: true, variants: [] },
  { node: 'app-authentication-authorization', variants: [] },
]

/** The same SHAPE — a plain leaf, a group, a fork of two variants, an optional,
 *  a closing leaf — over whatever topics the loaded corpus actually has, named
 *  by position rather than by id. A fixture for the desk to open on, nothing more. */
function genericSeed(): Stop[] {
  const t = (i: number): Stop | null => (topicIds[i] ? { node: topicIds[i], variants: [] } : null)
  const some = (from: number, n: number): Stop[] => topicIds.slice(from, from + n).map((node) => ({ node, variants: [] }))
  const seed: Stop[] = []
  const first = t(0)
  if (first) seed.push(first)
  const groupSteps = some(1, 2)
  if (groupSteps.length) seed.push({ key: 'seed-group', title: 'A first leg', variants: [{ id: 'seed-group-v0', label: '', steps: groupSteps }] })
  const shortLane = some(3, 1)
  const longLane = some(3, 3)
  if (shortLane.length && longLane.length > 1) {
    seed.push({
      key: 'seed-fork',
      title: 'Two ways on',
      variants: [
        { id: 'seed-fork-v0', label: 'the short way', steps: shortLane },
        { id: 'seed-fork-v1', label: 'the long way', steps: longLane },
      ],
    })
  }
  const opt = topicIds[6]
  if (opt) seed.push({ node: opt, optional: true, variants: [] })
  const last = t(7)
  if (last) seed.push(last)
  return seed
}

const SEED: Stop[] = CORPUS_NAME === 'teaching' ? teachingSeed() : genericSeed()

// ── Restored, or seeded (#16) ───────────────────────────────────────────────
// The stores are module-level, which since #21 has made the draft SHARED. It did
// not make it DURABLE — a reload ate the plan. `loadDraft()` reads the one
// stored payload (see draftpersist.ts for what survives and what is repaired);
// null means nothing usable is there, and the seed stands in as before.
const restored = loadDraft()

const stopsStore = store<Stop[]>(restored?.stops ?? SEED)
const selectedStore = store<ReadonlySet<string>>(new Set())
const caretStore = store<Path | null>(null)
/** which variant each container takes, keyed by container key → variant id.
 * Storing the id rather than an index means deletions never silently retarget
 * the active version (#92). The walk editor writes it; the projection reads it. */
const choicesStore = store<Record<string, string>>(restored?.choices ?? {})
const optionalsStore = store(restored?.withOptionals ?? true)
/** the key of the group `groupSelection` made most recently and nobody has finished naming:
 * the road opens THAT card straight into edit mode (OB-110 clause 5) and clears this when the
 * edit closes. Session state, never persisted — a reload has no fresh group. */
const freshGroupStore = store<string | null>(null)
// resumed past whatever the restored tree already uses, so a group made after a
// reload cannot be handed a key the plan is already using (draftpersist.nextIds)
const seq = nextIds(stopsStore.get())
const nextVid = () => 'v' + (seq.vid++).toString(36)
/** the twin of nextVid for CONTAINER keys. A function rather than an inline
 * `seq.box++` at each site: the two counters read the same way, and the ops stay
 * free of the module mutation react-hooks/immutability objects to seeing inside
 * a hook's returned callbacks. */
const nextBoxKey = () => 'draft-' + seq.box++

// Persist on every change to the three durable stores. No debounce: a commit is
// one JSON.stringify of a tree with tens of stops in it, and the alternative —
// a trailing timer — buys nothing measurable while opening a window in which a
// reload loses the last keystroke. History is not written; see draftpersist.ts.
const persist = () =>
  saveDraft({ stops: stopsStore.get(), choices: choicesStore.get(), withOptionals: optionalsStore.get() })
stopsStore.subscribe(persist)
choicesStore.subscribe(persist)
optionalsStore.subscribe(persist)

// ── Undo / redo over the stops tree (#34) ────────────────────────────────────
// History lives UNDER the store interface: one historic setter records the
// previous tree, so every structural op becomes undoable without the op knowing
// history exists. Only `stops` is versioned — choices/optionals are the road's
// VIEW (not edits), and selection/caret are ephemeral, cleared on undo exactly
// as they are on commit. Snapshots are plain references (every op is a pure
// immutable rebuild), so the stacks are cheap; capped so a long session can't
// grow unbounded.
const pastStore = store<Stop[][]>([])
const futureStore = store<Stop[][]>([])
const HISTORY_CAP = 100
// The open text-edit session, if any. retitle/relabel fire per keystroke;
// commits sharing a session key collapse into ONE undo entry instead
// of one per character. Any structural op (no key) closes the session.
let editSession: string | null = null

/** the ONE write path for the stops tree: set the new value, recording the old
 * one for undo. `session` coalesces consecutive same-session commits (a text
 * edit) into a single history entry; pass null (default) for a discrete op. */
function commitStops(next: Stop[], session: string | null = null): void {
  const prev = stopsStore.get()
  if (Object.is(prev, next)) return
  const continuing = session !== null && session === editSession
  if (!continuing) pastStore.set([...pastStore.get(), prev].slice(-HISTORY_CAP))
  editSession = session
  if (futureStore.get().length) futureStore.set([]) // a fresh edit forks the timeline
  stopsStore.set(next)
}

/** move one step along history: pop `from`, push the current tree onto `to`.
 * undo = past→future, redo = future→past. Ephemeral state is reset, never
 * restored, so no revived path can dangle. */
function step(from: Store<Stop[][]>, to: Store<Stop[][]>): void {
  const stack = from.get()
  if (stack.length === 0) return
  const target = stack[stack.length - 1]
  from.set(stack.slice(0, -1))
  to.set([...to.get(), stopsStore.get()].slice(-HISTORY_CAP))
  editSession = null
  selectedStore.set(new Set())
  caretStore.set(null)
  stopsStore.set(target)
}
export const undoDraft = (): void => step(pastStore, futureStore)
export const redoDraft = (): void => step(futureStore, pastStore)

// ── The walks.ts bridge (#16) ───────────────────────────────────────────────
// The half of #16 that lets authored work LEAVE the desk. A `Walk` is flat by
// definition — `{ id, title, description, stops: [{ id, note }] }` — so this is
// a projection, not a save: the draft's tiers do not survive it, and neither do
// the roads not taken. What is stored is the road as currently resolved, which
// is exactly what the rest of the app already receives on bus.route.
//
// It reads the road stores directly rather than taking them as arguments. They
// are module-level singletons for the same reason the tree is, and threading
// them through a call that means "save what I am looking at" would only let a
// caller pass something other than what the user is looking at.

/** the draft, saved as a corpus walk under `title`. Null when the road resolves
 * to nothing — an empty plan, or one that is all unbound placeholders. */
export function saveDraftAsWalk(title: string): Walk | null {
  const resolved = resolveRoad(stopsStore.get(), choicesStore.get(), optionalsStore.get())
  const stops = leafStops(resolved).map((s) => ({ id: s.node, note: s.note ?? '' }))
  if (stops.length === 0) return null
  const name = title.trim() || 'untitled walk'
  return saveWalk({
    id: mintId(name),
    title: name,
    description: `${stops.length} stops, authored on the walk desk`,
    stops,
  })
}

// ── The resolved-walk preview (0005 D9) ─────────────────────────────────────
// Its OPEN button now lives in WalkUtilityBar (the actionBar-slot bar), while the
// slide-in panel it opens is drawn by WalkEditorView (the pane body) — two
// siblings under one Pane, neither the other's parent, so this is a module-level
// store for the same reason the draft itself is (see the note at the top of this
// file). Everything else that bar used to hold (naming/picking/receipt) stayed
// local to it once its drawers moved there too; this is the one flag that still
// has to cross the boundary.
const previewOpenStore = store(false)
export function usePreviewOpen() {
  return useStore(previewOpenStore)
}

/** the road's resolution knobs, shared by the walk editor and the projection */
/** the freshly-made group's key, and the way to say it has been named — see `freshGroupStore` */
export function useFreshGroup(): [string | null, (key: string | null) => void] {
  return useStore(freshGroupStore)
}

export function useRoad() {
  const [choices, setChoices] = useStore(choicesStore)
  const [withOptionals, setWithOptionals] = useStore(optionalsStore)
  return {
    choices,
    withOptionals,
    setWithOptionals,
    pickBranch: (key: string, id: string) => setChoices({ ...choices, [key]: id }),
  }
}

export const pathKey = (p: Path) => 'b.' + p.join('.')
export const parsePath = (key: string): Path =>
  key === 'b.' ? [] : key.slice(2).split('.').map(Number)

/** rebuild the sibling list a parent path addresses. A container is descended
 * through two segments — stop index, then variant index — uniformly, with no
 * per-kind branch. Every structural op goes through here. */
function rebuildListAt(stops: Stop[], parent: Path, f: (list: Stop[]) => Stop[]): Stop[] {
  if (parent.length === 0) return f(stops)
  const [i, vIdx, ...rest] = parent
  return stops.map((s, j) => {
    if (j !== i) return s
    return { ...s, variants: s.variants.map((vr, k) => (k === vIdx ? { ...vr, steps: rebuildListAt(vr.steps, rest, f) } : vr)) }
  })
}

/** the sibling list a parent path addresses (root list for []) */
function stopAtList(stops: Stop[], parent: Path): Stop[] | null {
  if (parent.length === 0) return stops
  const [i, vIdx, ...rest] = parent
  const s = stops[i]
  const vr = s?.variants[vIdx]
  return vr ? stopAtList(vr.steps, rest) : null
}

export function stopAt(stops: Stop[], path: Path): Stop | undefined {
  if (path.length === 0) return undefined
  return stopAtList(stops, path.slice(0, -1))?.[path[path.length - 1]]
}

function insertAt(stops: Stop[], path: Path, stop: Stop): Stop[] {
  const i = path[path.length - 1]
  return rebuildListAt(stops, path.slice(0, -1), (list) => [...list.slice(0, i), stop, ...list.slice(i)])
}

function removeAt(stops: Stop[], path: Path): { rest: Stop[]; removed?: Stop } {
  const i = path[path.length - 1]
  let removed: Stop | undefined
  const rest = rebuildListAt(stops, path.slice(0, -1), (list) => {
    removed = list[i]
    return list.filter((_, j) => j !== i)
  })
  return { rest, removed }
}

/** rebuild the single stop at `path` through `f` */
function mapStopAt(stops: Stop[], path: Path, f: (s: Stop) => Stop): Stop[] {
  const i = path[path.length - 1]
  return rebuildListAt(stops, path.slice(0, -1), (list) => list.map((s, j) => (j === i ? f(s) : s)))
}

/** rebuild the container carrying `key` through `f`, wherever it sits */
function mapBox(list: Stop[], key: string, f: (s: Stop) => Stop): Stop[] {
  return list.map((s) => {
    if (isLeaf(s)) return s
    if (s.key === key) return f(s)
    return { ...s, variants: s.variants.map((vr) => ({ ...vr, steps: mapBox(vr.steps, key, f) })) }
  })
}

/** removing `removed` shifts later siblings at its parent level down by one */
function adjustAfterRemoval(target: Path, removed: Path): Path {
  const d = removed.length - 1
  if (target.length > d && removed.slice(0, d).every((v, k) => v === target[k]) && target[d] > removed[d]) {
    const t = [...target]
    t[d]--
    return t
  }
  return target
}

/** the selection as SIBLINGS — every selected block under one parent — with their
 *  indices in chain order, or null when the selection spans parents (or is empty).
 *  Gaps are allowed (OB-115, #257): until then this demanded a contiguous run, so
 *  "Group" was disabled the moment the selection had a hole in it. What a gapped
 *  group does about the hole is `gatherIntoGroup`'s rule, below. A selection that
 *  reaches into two containers is still not groupable — a group is one list's
 *  business, and pulling a step out of one box into another is a move, not a group. */
export function siblingSelection(selected: ReadonlySet<string>): { parent: Path; indices: number[] } | null {
  if (selected.size === 0) return null
  const paths = [...selected].map(parsePath)
  const parent = paths[0].slice(0, -1)
  const pk = pathKey(parent)
  if (!paths.every((p) => pathKey(p.slice(0, -1)) === pk)) return null
  const indices = paths.map((p) => p[p.length - 1]).sort((a, b) => a - b)
  return { parent, indices }
}

/** THE GROUP RULE (OB-115, #257): the blocks at `indices` leave their slots and
 *  collapse into ONE container, built by `wrap` from those blocks IN CHAIN ORDER
 *  (not click order), standing at the FIRST selected block's slot. Whatever sat
 *  between them now sits after the group — that reorder is the ask, not a side
 *  effect: a group is a place in the chain, and its members are inside it, so they
 *  cannot also hold their old places. For a contiguous run nothing between exists
 *  and the result is exactly what grouping a run always was.
 *
 *      before  1 2 3 4 5 6      group 2 and 5
 *      after   1 [2 5] 3 4 6    → renumbered 1 2 3 4 5                            */
export function gatherIntoGroup(list: Stop[], indices: number[], wrap: (steps: Stop[]) => Stop): Stop[] {
  const chosen = new Set(indices)
  const first = Math.min(...indices)
  const members = list.filter((_, i) => chosen.has(i))
  return [...list.slice(0, first), wrap(members), ...list.slice(first + 1).filter((_, k) => !chosen.has(first + 1 + k))]
}

export interface AuthorState {
  stops: Stop[]
  selected: ReadonlySet<string>
  caret: Path | null
  setCaret(p: Path | null): void
  toggleSelect(p: Path): void
  /** replace the selection with exactly these blocks (a plain click selects one;
   * a marquee selects the boxed run), or ADD to it when additive (shift). */
  selectPaths(paths: Path[], additive?: boolean): void
  /** palette insert: at the caret if the drop set one, else after a single
   * selected block, else at the end of the plan */
  insertNode(node: string, at?: Path): void
  /** drop a whole walk in as ONE STAGE — a container titled after the walk,
   * holding its stops (#16). Lands where insertNode lands. It is a COPY, not the
   * reference mockwalk.groupFromWalk builds: that one is fixed mock data read at
   * module load, this one is about to be edited, and a live reference would mean
   * renaming a stop here rewrote the source walk. */
  insertWalkAsStage(walkId: string, at?: Path): void
  /** start over: replace the whole draft with one empty slot to bind. Undoable —
   * it goes through the same commit path as any edit, so Ctrl+Z brings the old
   * plan back. The toolbox "new walk" button (#54). */
  newWalk(): void
  /** insert a fresh unbound slot after the single selection (or at the end when
   * nothing is selected), for the user to bind next. The toolbox "selection
   * node" button (#54) — the keyboard-free twin of a palette drop. */
  addSelectionNode(): void
  /** move an existing block to a new position (drag) */
  moveBlock(from: Path, to: Path): void
  /** collapse the selected siblings into a plain group — one variant holding
   * them, at the first one's slot; a gapped selection pulls its members together
   * and what sat between moves after (OB-115, `gatherIntoGroup`). A fork is
   * reached from here: group, then grow a variant on the card (#19), so there is
   * no separate fork op. */
  groupSelection(): void
  /** delete exactly the block at `path` — the per-node close button (#15), which
   * acts on one node regardless of the current selection. */
  deleteAt(path: Path): void
  /** UNGROUP the container at `path`: replace it with `keep`'s steps, spliced in
   * place. The per-node ✕ on a container calls this with the active version, so
   * ungroup keeps the route you were looking at and drops the wrapper (and, for a
   * fork, the other versions). Undoable. A leaf has nothing to ungroup — no-op. */
  promote(path: Path, keep: number): void
  /** drop ONE variant from the container at `path`. Emptied → the container is
   * removed; one variant left → it stays a plain GROUP (a one-variant container
   * is a legal shape now, no longer dissolved). */
  dropVariant(path: Path, idx: number): void
  /** lift variant `idx` out of the fork at `forkPath` into its OWN group,
   * inserted at `to` — extract + relocate in one gesture (drag a tab out). The
   * fork keeps the rest (down to one → a plain group); the lifted version keeps
   * its label AS the new group's version, and the group inherits the fork's title. */
  extractVariant(forkPath: Path, idx: number, to: Path): void
  /** bind a corpus node to an unset placeholder leaf at `path` */
  bindNode(path: Path, node: string): void
  /** flip the optional flag on every selected leaf / plain group (not a fork) */
  toggleOptionalSelection(): void
  /** Tab — move the single selected block into the container right above it */
  indentSelection(): void
  retitle(key: string, title: string): void
  /** set the free-text description under the title of an open container (#86) */
  redesc(key: string, desc: string): void
  /** append a variant to the container — turns a plain group into a fork.
   * Returns the new variant's id so callers can immediately pickBranch to it. */
  addVariant(key: string): string
  relabelVariant(key: string, idx: number, label: string): void
  canGroup: boolean
  canOptional: boolean
  /** every selected block is ALREADY optional — the "make optional" toggle's
   * on-state, so the toolbox button reads as pressed when it would un-flip. */
  optionalActive: boolean
  canIndent: boolean
  /** step the stops tree back / forward through edit history (#34) */
  undo(): void
  redo(): void
  canUndo: boolean
  canRedo: boolean
}

export function useAuthorDraft(): AuthorState {
  const [stops] = useStore(stopsStore)
  const [selected, setSelected] = useStore(selectedStore)
  const [caret, setCaret] = useStore(caretStore)

  const [past] = useStore(pastStore)
  const [future] = useStore(futureStore)

  const commit = (next: Stop[]) => {
    commitStops(next)
    setSelected(new Set())
    setCaret(null)
  }

  const siblings = siblingSelection(selected)

  const selectedStops = [...selected].map((k) => stopAt(stops, parsePath(k)))

  const single = selected.size === 1 ? parsePath([...selected][0]) : null
  const prevSibling =
    single && single[single.length - 1] > 0
      ? stopAt(stops, [...single.slice(0, -1), single[single.length - 1] - 1])
      : undefined

  return {
    stops,
    selected,
    caret,
    setCaret,
    toggleSelect: (p) => {
      const key = pathKey(p)
      const next = new Set(selected)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setSelected(next)
    },
    selectPaths: (paths, additive) => {
      const next = additive ? new Set(selected) : new Set<string>()
      for (const p of paths) next.add(pathKey(p))
      setSelected(next)
      setCaret(null)
    },
    insertNode: (node, at) => {
      const stop: Stop = { node, variants: [] }
      const target = at ?? (single ? [...single.slice(0, -1), single[single.length - 1] + 1] : [stops.length])
      commit(insertAt(stops, target, stop))
    },
    insertWalkAsStage: (walkId, at) => {
      const w = walkById(walkId)
      if (!w) return
      const key = nextBoxKey()
      const stage: Stop = {
        key,
        title: w.title,
        description: w.description || undefined,
        variants: [{ id: nextVid(), label: '', steps: w.stops.map((s) => ({ node: s.id, note: s.note, variants: [] })) }],
      }
      const target = at ?? (single ? [...single.slice(0, -1), single[single.length - 1] + 1] : [stops.length])
      commit(insertAt(stops, target, stage))
    },
    newWalk: () => commit([{ node: '', unset: true, variants: [] }]),
    addSelectionNode: () => {
      const stop: Stop = { node: '', unset: true, variants: [] }
      const target = single ? [...single.slice(0, -1), single[single.length - 1] + 1] : [stops.length]
      commit(insertAt(stops, target, stop))
    },
    moveBlock: (from, to) => {
      // a block cannot move into its own subtree
      if (to.length >= from.length && from.every((v, k) => v === to[k])) return
      const { rest, removed } = removeAt(stops, from)
      if (!removed) return
      commit(insertAt(rest, adjustAfterRemoval(to, from), removed))
    },
    groupSelection: () => {
      if (!siblings) return
      const key = nextBoxKey()
      freshGroupStore.set(key)
      commit(
        rebuildListAt(stops, siblings.parent, (list) =>
          // empty title, not the literal "name this stage" (OB-081) — the card draws
          // that as titlePlaceholder now, an invitation rather than saved data an
          // unrenamed group would otherwise carry forever
          gatherIntoGroup(list, siblings.indices, (steps) => ({ key, title: '', variants: [{ id: nextVid(), label: '', steps }] })),
        ),
      )
    },
    deleteAt: (path) => commit(removeAt(stops, path).rest),
    promote: (path, keep) => {
      const s = stopAt(stops, path)
      if (!s || isLeaf(s)) return
      const steps = s.variants[keep]?.steps ?? s.variants[0]?.steps ?? []
      const i = path[path.length - 1]
      commit(rebuildListAt(stops, path.slice(0, -1), (list) => [...list.slice(0, i), ...steps, ...list.slice(i + 1)]))
    },
    dropVariant: (path, idx) => {
      const s = stopAt(stops, path)
      if (!s || isLeaf(s)) return
      const remaining = s.variants.filter((_, k) => k !== idx)
      if (remaining.length === 0) {
        commit(removeAt(stops, path).rest) // last variant gone — drop the container
        return
      }
      commit(mapStopAt(stops, path, (st) => (isLeaf(st) ? st : { ...st, variants: remaining })))
    },
    extractVariant: (forkPath, idx, to) => {
      const s = stopAt(stops, forkPath)
      if (!s || !isFork(s)) return
      // a route cannot be dropped inside its own fork's subtree
      if (to.length >= forkPath.length && forkPath.every((v, k) => v === to[k])) return
      const vr = s.variants[idx]
      if (!vr) return
      // Since #70 the open card shows the VERSION label, not the stage title, so
      // the lifted version keeps its name AS a version; the new group inherits the
      // fork's stage title. Two separate fields, carried through separately —
      // pre-#70 this folded the label into the title, which now reads as "v1".
      const lifted: Stop = { key: nextBoxKey(), title: s.title, variants: [{ ...vr }] }
      const remaining = s.variants.filter((_, k) => k !== idx)
      // the fork stays in place and only loses a variant, so every sibling index
      // before `to` is unchanged — no adjustAfterRemoval needed.
      const pruned = mapStopAt(stops, forkPath, (st) => (isLeaf(st) ? st : { ...st, variants: remaining }))
      commit(insertAt(pruned, to, lifted))
    },
    bindNode: (path, node) => {
      commitStops(mapStopAt(stops, path, (s) => (isLeaf(s) ? { ...s, node, unset: undefined } : s)))
    },
    toggleOptionalSelection: () => {
      if (selected.size === 0) return
      let next = stops
      for (const k of selected)
        next = mapStopAt(next, parsePath(k), (s) => (isFork(s) ? s : { ...s, optional: !s.optional }))
      commit(next)
    },
    indentSelection: () => {
      if (!single || !prevSibling || !isBox(prevSibling)) return
      const idx = single[single.length - 1]
      const { rest, removed } = removeAt(stops, single)
      if (!removed) return
      // land inside the container above, at the end of its first variant
      commit(insertAt(rest, [...single.slice(0, -1), idx - 1, 0, prevSibling.variants[0].steps.length], removed))
    },
    retitle: (key, title) => {
      commitStops(mapBox(stops, key, (s) => ({ ...s, title })), 'title:' + key)
    },
    redesc: (key, desc) => {
      commitStops(mapBox(stops, key, (s) => ({ ...s, description: desc })), 'desc:' + key)
    },
    addVariant: (key) => {
      // empty label → the version box shows the default vN name
      const id = nextVid()
      const variant: Variant = { id, label: '', steps: [{ node: '', unset: true, variants: [] }] }
      commitStops(mapBox(stops, key, (s) => ({ ...s, variants: [...s.variants, variant] })))
      return id
    },
    relabelVariant: (key, idx, label) => {
      commitStops(mapBox(stops, key, (s) => ({ ...s, variants: s.variants.map((vr, k) => (k === idx ? { ...vr, label } : vr)) })), 'label:' + key + ':' + idx)
    },
    canGroup: !!siblings,
    canOptional: selected.size > 0 && selectedStops.every((s) => s !== undefined && !isFork(s)),
    optionalActive: selected.size > 0 && selectedStops.every((s) => s !== undefined && s.optional === true),
    canIndent: !!prevSibling && isBox(prevSibling),
    undo: undoDraft,
    redo: redoDraft,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
