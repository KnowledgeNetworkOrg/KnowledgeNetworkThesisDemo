// HOW A WALK IS PLAYED — one definition of "what are the steps, where is the
// cursor, and what happens when it moves", shared by every surface that walks a
// walk. `WalkViewer`'s strip and the presentation frame's keyboard are two
// gestures over this one model, not two models that happen to agree.
//
// It lives in `state/walk/` because every surface that plays a walk reads it,
// and no one instrument owns it: the desk is now one of its readers. Not in
// `src/model/`, whose rule is "pure and synchronous, no React"; not in
// `src/present/`, which would make a plain instrument depend on the
// presentation shell and invert the seam.
//
// TWO SOURCES, ONE CURSOR. A saved walk (`bus.activeWalk`, started from Trail or
// the document panel) wins when one is playing; otherwise this plays the draft
// currently open on the walk desk, live. That branch was written twice before —
// once here and once in the keyboard player — which is exactly how a strip and a
// deck end up disagreeing about which stop is stop 4.
//
// THE FOCUS WRITE IS NEW, AND IT IS A FIX. `bus.activateWalk` sets `activeWalk`
// and the walked route prefix and NOTHING ELSE — it has never written
// `bus.focus` (bus.ts: activateWalk -> setRoute, neither touches focus). So
// until now, playing a SAVED walk moved the strip and the map pins but left the
// document sitting on whatever was last clicked. A navigator that does not
// navigate is the bug; `seek` writes the focus for both sources, once.
//
// ONE CURSOR, TWO READINGS (#247, DS OB-132). `cursor` is the INTEGER stop the
// bus holds — what the strip, the document and the presenter read. `position`
// is the FRACTIONAL place the walk is while it plays: the same number while it
// rests, and between two stops while the clock carries it from one to the next.
// The map's pins and arrows and the dock's knob read `position`, because on
// those drawings the animation is not drawn on top of the position, it IS the
// position — an integer cursor lands and nothing moves.
//
// THE BUS WRITE IS TIMED OFF THE ARRIVAL, NOT OFF THE LOOP'S BOOKKEEPING (DS
// OB-181, owner-seen 2026-09-14: "the highlight is after the pin and arrow
// animation"). `walkAdvance` returns TWO cursors and they are not the same
// instant: `position` reaches the next stop at phase `travel` (0.7 of the step),
// and the pop, the fill and the band all complete there; `step` increments
// only when the phase WRAPS, at the end of the dwell that follows. The ticker
// wrote the cursor and the focus when `step` changed — so the node highlight
// (which follows the focus) landed `walkArrivalLag()` = 270ms after the
// animation had finished, and read as a second event. Candidate A of the item.
// It now writes when `walkArrival(position)` changes: the same frame the pop
// peaks. `step` stays the loop's own; nothing drawn reads it.

import { useEffect, useRef, useSyncExternalStore } from 'react'

import { walkAdvance, walkArrival } from '@/ds'
import type { WalkStep } from '@/ds'

import { byId } from '../../corpus/graph'
import { walkById } from '../../model/walkstore'
import type { Walk } from '../../model/walkstore'
import { leafStops, routeStepsOf } from './mockwalk'
import { routeNumbers } from '../../model/route'
import type { Stop } from './mockwalk'
import { usePresentedRoad } from './presented'
import type { Bus } from '../bus'

/** ONE STEP of a walk being played. Extends the DS's own `WalkStep` — id, title,
 *  note, optional — so the player and the strip it feeds cannot drift apart
 *  about what a step is.
 *
 *  `stop` IS THE FORK DOOR (#195). It carries the resolved `Stop` this step came
 *  from rather than discarding it. Today that is only provenance: `resolveRoad`
 *  has already collapsed every fork at authoring time, so each one is a leaf.
 *  It is kept because of what it costs to add back later — a player handed a
 *  flat `string[]` has nothing to read when a fork should raise a chooser, and
 *  would need a second structure running in parallel with `steps`. With the stop
 *  carried, a present-time chooser is a local change: resolve the road lazily up
 *  to the first unresolved container, and the shell reads `variants.length > 1`
 *  on the step ahead of the cursor and offers the lanes instead of advancing.
 *  `steps`, `cursor` and `seek` keep their shapes; `WalkViewer` needs no edit. */
export interface PlayStep extends WalkStep {
  stop?: Stop
  /* `path` is `WalkStep.path` (DS OB-188): the step's position in the group structure,
     outermost first, 1-based — `[2, 1]` for "2.1". Undefined for a top-level step and for
     every step of a saved walk (saved walks are flat). The hover card prints it whole; a map
     pin and a dock dot print the two-number address `walkAddresses` derives from it. */
}

/** which of the two sources is playing. Exposed so a caller can preserve a
 *  source-dependent behaviour of its own (WalkViewer opts out of publishing the
 *  route while a saved walk owns it) without re-deriving the branch. */
export type PlaySource = 'saved' | 'draft'

export interface Playback {
  source: PlaySource
  /** what to call this walk on screen — the saved walk's title, or a stand-in
   *  line for the draft, which has no name until it is saved (#16). */
  title: string
  steps: PlayStep[]
  /** always within [0, steps.length - 1]; 0 for an empty walk */
  cursor: number
  /** WHERE THE WALK IS, fractionally: `cursor` at rest, and while playing the
   *  DS's `walkAdvance` position — `cursor + eased fraction of the way to the
   *  next stop`, the stop itself for the dwell. Every drawing that moves reads
   *  this (the map's band, the dock's knob); everything that names a stop reads
   *  `cursor`. Never past `steps.length - 1`. */
  position: number
  atStart: boolean
  atEnd: boolean
  /** THE ONLY MUTATOR. next/prev/first/last are defined in terms of it, so a
   *  future chooser that must interpose a decision between i and i+1 changes one
   *  function rather than five call sites. Out of range is a silent no-op — the
   *  end of a walk is a fact, not an error, and a presenter pressing → once more
   *  than there are slides should get nothing, not a crash. */
  seek(i: number): void
  next(): void
  /** THE CLOCK (#246, fractional since #247). True while the walk advances on
   *  its own: one stop per `WALK_PLAYBACK_DEFAULTS.step` milliseconds (the DS's
   *  900), moving for the first `travel` of each and dwelling for the rest,
   *  stopping by itself at the last stop. ONE clock for every surface: the
   *  viewer's strip, the map's dock and the presenter all read the same flag and
   *  any of them may toggle it, so pressing play on the map and pause on the
   *  strip is one gesture on one walk, not two players disagreeing. */
  playing: boolean
  toggle(): void
  prev(): void
  first(): void
  last(): void
}

// ── pure core ───────────────────────────────────────────────────────────────
// Split out because vitest here runs `environment: 'node'` with no DOM — hooks
// cannot be tested, but the arithmetic and the projection can, and they are the
// parts that would break silently.

/** the played steps, from whichever source is live. Saved walks are already flat
 *  ({id, note} — no containers, no optionals, no variants); a draft road is a
 *  resolved tree that still has to be walked down to its leaves. */
export function playSteps(saved: Walk | null, road: Stop[]): PlayStep[] {
  if (saved) return saved.stops.map((s) => ({ id: s.id, title: byId.get(s.id)!.title, note: s.note }))
  // one entry per leaf, in the same order — route.ts and leafStops walk the tree alike
  const numbers = routeNumbers(routeStepsOf(road))
  return leafStops(road).map((s, i) => ({
    id: s.node, title: byId.get(s.node)!.title, note: s.note, optional: s.optional, stop: s,
    /* EVERY step carries its path, top-level ones included (`[3]`): `walkAddresses` numbers a
       step WITHOUT a path by its flat index, which is right only when no step has one — on a walk
       whose step 2 is a group, the top-level stop after it is the 4th stop and step 3 (DS OB-188). */
    path: numbers[i] ? numbers[i].path.split('.').map(Number) : undefined,
  }))
}

/** a cursor that is always a valid index, or 0 when there is nothing to index.
 *  The raw value outlives the list it points into — deleting stops in the editor
 *  leaves `draftCursor` past the end, and it must not be allowed to reach a
 *  consumer that way. */
export function clampCursor(raw: number, len: number): number {
  if (len <= 0) return 0
  return Math.min(Math.max(raw, 0), len - 1)
}

/** whether the route the map draws IS the walk being played — the dock's mount
 *  condition (#246). `bus.route` has three writers: `activateWalk` publishes the
 *  played PREFIX of a saved walk, `presented.ts` publishes the desk draft's leaf
 *  ids whole, and `bus.teach` publishes a curriculum that is no walk at all. The
 *  first two are a prefix of the played steps (the whole list counts as a
 *  prefix); the third is not, and an empty route is nothing to dock onto. */
export function routeIsWalk(route: readonly string[], steps: readonly { id: string }[]): boolean {
  return route.length > 0 && route.length <= steps.length && route.every((id, i) => steps[i].id === id)
}

// ── the clock ───────────────────────────────────────────────────────────────
// Module-level on purpose: `playing` and the position are facts about THE walk,
// not about any one pane, and three panes mount this hook. Each mounted
// instance registers its own ticker; each frame runs the FIRST one only, and
// since every instance derives the same steps and cursor from the same bus,
// which one advances the walk does not matter. When the last instance unmounts
// the next frame finds no ticker and stops the clock.
//
// THE ARITHMETIC IS THE DS'S. `walkAdvance` (src/ds/map/WalkDock.tsx, DS
// OB-130/132) takes the integer step, the phase inside it and the milliseconds
// since the last frame, and returns the next step, phase and FRACTIONAL
// position — eased travel for `WALK_PLAYBACK_DEFAULTS.travel` of each step, a
// dwell for the rest. It clamps its own dt (a hidden tab's stalled frame spends
// at most one step; a negative dt spends none), so nothing here guards dt
// again — two guards on one input is what the DS warns against. This loop owns
// only the timer, the frame delta and the bus write when the integer step
// changes.

let playing = false
/** the clock's own place in the walk: the DS's `{ step, phase }` plus the
 *  position it last published, and the integer step it last wrote to the bus
 *  (so a render that has not caught up with that write is not mistaken for a
 *  seek from elsewhere). */
const clock = { step: 0, phase: 0, position: 0, written: 0 }
let lastFrame: number | null = null
let raf: number | null = null
const watchers = new Set<() => void>()
const tickers = new Set<(dt: number) => void>()

function notify() {
  for (const w of watchers) w()
}

function frame(now: number) {
  if (!playing) return
  const dt = lastFrame === null ? 0 : now - lastFrame
  lastFrame = now
  const first = tickers.values().next().value
  if (first) first(dt)
  else setPlaying(false)
  if (playing) raf = requestAnimationFrame(frame)
}

function setPlaying(next: boolean) {
  if (next === playing) return
  playing = next
  if (playing) {
    lastFrame = null
    raf = requestAnimationFrame(frame)
  } else if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }
  notify()
}

/** put the clock ON a stop, phase 0 — every seek does this, so a seek while
 *  playing continues from the stop it landed on rather than from where the
 *  clock was. */
function jump(i: number) {
  clock.step = i
  clock.phase = 0
  clock.position = i
  clock.written = i
  notify()
}

const subscribe = (w: () => void) => { watchers.add(w); return () => { watchers.delete(w) } }
const playingNow = () => playing
const positionNow = () => clock.position

// ── the hook ────────────────────────────────────────────────────────────────

export function useWalkPlayback(bus: Bus): Playback {
  const road = usePresentedRoad()
  const saved = bus.activeWalk ? (walkById(bus.activeWalk.walkId) ?? null) : null

  // No useMemo: usePresentedRoad already memoizes the expensive half
  // (resolveRoad), and mapping a walk's worth of stops per render is nothing.
  // Adding a hand-written memo here is what react-hooks/preserve-manual-
  // memoization exists to reject.
  const steps = playSteps(saved, road)
  const cursor = clampCursor(saved ? bus.activeWalk!.cursor : bus.draftCursor, steps.length)

  /** the bus write for one stop — the cursor and, for both sources, the focus
   *  (see the header). 'walk' is the via-tag that colours the trail chip and
   *  tells every listening pane where the move came from. */
  const writeCursor = (i: number) => {
    const s = steps[i]
    if (!s) return
    if (saved) bus.activateWalk(saved.id, i)
    else bus.setDraftCursor(i)
    bus.setFocus(s.id, 'walk')
  }
  const seek = (i: number) => {
    if (!steps[i]) return
    writeCursor(i)
    jump(i)
  }

  const isPlaying = useSyncExternalStore(subscribe, playingNow)
  const clockPosition = useSyncExternalStore(subscribe, positionNow)
  // the ticker must read THIS render's step count and write through THIS
  // render's bus. They land in a ref from an effect after every render (a ref
  // written during render is what react-hooks/refs forbids; an effect keyed on
  // `writeCursor`, a fresh closure per render, is what exhaustive-deps warns
  // about), and the ticker itself is registered once and reads the ref when the
  // clock fires.
  const latest = useRef({ len: steps.length, writeCursor })
  useEffect(() => { latest.current = { len: steps.length, writeCursor } })
  useEffect(() => {
    const t = (dt: number) => {
      const now = latest.current
      const r = walkAdvance({ step: clock.step, phase: clock.phase, dt, count: now.len })
      clock.step = r.step
      clock.phase = r.phase
      clock.position = r.position
      const arrived = walkArrival(r.position, now.len)
      if (arrived !== clock.written) {
        clock.written = arrived
        now.writeCursor(arrived)
      }
      if (r.done) setPlaying(false)
      else notify()
    }
    tickers.add(t)
    return () => { tickers.delete(t) }
  }, [])

  const last = steps.length - 1
  return {
    source: saved ? 'saved' : 'draft',
    title: saved ? saved.title : 'the road you are authoring',
    steps,
    cursor,
    // at rest the position IS the cursor; playing, it is the clock's, never past
    // the last stop (the clock clamps there and stops itself)
    position: isPlaying ? Math.min(Math.max(0, last), clockPosition) : cursor,
    atStart: cursor <= 0,
    atEnd: cursor >= last,
    seek,
    next: () => seek(cursor + 1),
    prev: () => seek(cursor - 1),
    first: () => seek(0),
    last: () => seek(last),
    playing: isPlaying,
    // play at the end restarts from the first stop, the way every player does
    toggle: () => {
      if (isPlaying) { setPlaying(false); return }
      if (steps.length === 0) return
      const from = cursor >= last ? 0 : cursor
      if (from !== cursor) writeCursor(from)
      jump(from)
      setPlaying(true)
    },
  }
}
