// The Studio bus — the session state every instrument shares, as a DECLARED
// contract rather than a pile of hand-wired props.
//
// It used to be six useStates and eight closures inside StudioView, reaching
// each instrument through props that every pane spelled differently: "the
// focused node" was currentId, focus, or treeRootId depending on who you asked,
// and "focus this" was onSelect / onSelectChild / onFocus / onOpen / onJump /
// onSelectTrailEntry. Adding one channel (hover, 2026-07-14) therefore touched
// four files and copy-pasted the same guarded enter/leave three times.
//
// With the bus, a new channel is ONE field below plus its writer. An instrument
// that ignores it does not change. That is the whole point, and it is the thing
// that makes the next feature cheap instead of frightening.
//
// It lives in state/ because it is what every screen shares and no screen owns
// it: a pane that reads the bus must not be importing the shell that composes
// it, and studio/ is a reader like any other.

import { useCallback, useMemo, useState } from 'react'

import { byId } from '../corpus/graph'
import { walkById } from '../model/walkstore'
import { curriculum } from '../model/lens'
import { HISTORY_EMPTY, mark, step, visit } from '../model/nav'
import { routeLeafIds, routeOfIds } from '../model/route'
import type { RouteStep } from '../model/route'
import type { ActiveWalkState, History, TrailEntry, TrailVia } from '../model/nav'

export type { ActiveWalkState, History, TrailEntry, TrailVia }
export type { RouteStep }

/** the "no search running" value — one shared instance so a cleared channel is
 * referentially stable and never churns a memo that depends on it */
const NO_MATCHES: ReadonlySet<string> = new Set()

// ── What instruments may READ ───────────────────────────────────────────────
export interface BusState {
  /** the selected node — null only before the first click anywhere */
  focus: string | null
  /** TRANSIENT, display-only. An instrument may recolour on it and nothing
   * else: no trail entry, no re-root, no camera move.
   *
   * It carries NO source tag, unlike focus, and that is not an oversight. A
   * hover write is idempotent — an instrument that receives back the id it just
   * published lights up exactly the thing under its own cursor, which is what it
   * wanted anyway. There is no echo to suppress, so one id is the whole bus. */
  hover: string | null
  /** THE WALK STOP ANOTHER PANE IS POINTING AT, by index into `route` (DS OB-189). The walk
   *  editor publishes it from a pill's hover; the map's dock draws a halo on that stop and pans
   *  its row to it if it is off-screen. TRANSIENT and display-only like `hover`, and it is a
   *  STOP, not a node: a node can be on the walk twice, and the editor knows which visit its
   *  pill is. Never read as the current stop — a hover here seeks nothing. */
  hoverStep: number | null
  /** A LOOK — the one channel that MAY move a camera. Hover answers "recolour
   * what I'm pointing at"; a look asks "take me to WHERE this lives" — the map
   * flies to the node's territory at its tier and keeps it highlighted, with
   * the selection unchanged. Published by CLICKS in the Connections pane
   * (SelfNotes: hover must never pan the map), so there is no fly-home: a look
   * holds until the next look, a focus change, or the user grabbing the camera.
   * `seq` makes re-looking at the same id a fresh command — after panning away,
   * clicking the same row again must still fly. */
  peek: { id: string; seq: number } | null
  /** The current SEARCH result set — the ids a supply pane is showing right now
   * (#25). TRANSIENT and display-only, like hover: the map lights each match on
   * the territory (deep ones rolled up to their visible ancestor with a count),
   * and nothing else reads it. Deliberately a SET OF IDS, not a query string —
   * the map must not know how matching works, so a second search surface (a Tree
   * filter, say) can publish the very same channel. Empty when no query is live. */
  matches: ReadonlySet<string>
  /** history steps available behind/ahead of the cursor — see back()/forward() */
  canBack: boolean
  canForward: boolean
  /** an ordered path — a built walk, or a generated curriculum — WITH ITS GROUPS
   * (#228, DS OB-114): a step either lands on a node or holds steps of its own.
   * The desk publishes its resolved tree here; the saved-walk and curriculum
   * writers publish flat lists. A group counts as ONE step and numbers its own
   * contents underneath itself — `model/route.ts` carries the numbering. */
  routeSteps: RouteStep[]
  /** the same route flat — every node the walk lands on, in order. DERIVED from
   * `routeSteps` (`routeLeafIds`), never written on its own: every reader that
   * never cared about groups keeps reading this, unchanged. */
  route: string[]
  /** the unified history engine's value (model/nav.ts) — ALL navigation-order
   * state in one dataset: the append-only log and the browsable stack+cursor
   * that back/forward walk. One writer (the bus), any number of readers. */
  history: History
  /** the log, by its familiar name — history.log, nothing more. The trail
   * strip and `visited` read provenance and don't care about the cursor. */
  trail: TrailEntry[]
  /** DERIVED from the trail (topics only, matching the grain the header counts).
   * Never written — a channel with two writers is a channel with a bug. */
  visited: ReadonlySet<string>
  activeWalk: ActiveWalkState | null
  /** the cursor into the DRAFT road (the walk currently open on the desk),
   * as opposed to activeWalk's cursor into a SAVED walk. Walk·Viewer reads
   * whichever of the two applies; the map's pins fall back to this one when
   * no saved walk is active, so the draft gets the same done/current/ahead
   * treatment a saved walk does. */
  draftCursor: number
}

/** The panes the bus itself reveals — where the next-stop controls live, where a curriculum is shown.
 *  A fact about the session, not a copy of the registry: the shell's typed `reveal` is what proves
 *  each of these is a real pane (StudioView passes `ensureActive`, whose parameter is InstrumentId,
 *  so a rename in the registry fails to compile HERE rather than at runtime). */
export type BusRevealTarget = 'walkviewer' | 'walk' | 'map'

// ── What instruments may WRITE ──────────────────────────────────────────────
export interface BusActions<Id extends string = string> {
  /** focus + a trail entry tagged with where the click came from. `via` is
   * provenance, not routing: it colours the trail chip and nothing else. */
  setFocus(id: string, via: TrailVia, jump?: boolean): void
  /** clear the selection — WHERE you are, not where you have been. No trail
   * entry, and the nav history keeps its place, so back() restores exactly the
   * node you deselected. The map's water-click/Esc is the caller. */
  clearFocus(): void
  /** step the focus through the navigation history (model/nav.ts). A step IS a
   * focus write — it lands on the trail, tagged 'nav' — but unlike setFocus it
   * moves the history cursor instead of pushing. back() from a cleared focus
   * first restores the entry under the cursor. */
  back(): void
  forward(): void
  setHover(id: string | null): void
  /** the cursor LEFT this id. Guarded on purpose — moving between two elements
   * that carry the same id (a reciprocal pair lists one counterpart twice) fires
   * leave(X) then enter(X), and an unguarded leave would blank the id the enter
   * just set. Every hover participant needs this, so the bus owns it. */
  endHover(id: string): void
  setHoverStep(index: number | null): void
  /** the cursor LEFT this stop — guarded like `endHover`, for the same reason */
  endHoverStep(index: number): void
  /** publish a look at `id` — see BusState.peek. A click gesture, not a hover:
   * there is no end/leave counterpart. */
  peekAt(id: string): void
  /** publish the current search hit set — see BusState.matches. One writer at a
   * time (whichever supply pane is live); an empty set clears the map. */
  setMatches(ids: ReadonlySet<string>): void
  /** publish a FLAT route — every step a node, no groups (a saved walk's played
   * prefix, a curriculum) */
  setRoute(r: string[]): void
  /** publish a route with its groups intact — the desk's resolved road */
  setRouteSteps(steps: RouteStep[]): void
  clearRoute(): void
  /** a trail entry with NO focus change — Unfold·Graph places a node on its own
   * canvas without dragging the rest of the Studio there */
  visit(id: string, via: TrailVia): void
  activateWalk(walkId: string, stopIndex: number): void
  deactivateWalk(): void
  /** move the DRAFT cursor (see BusState.draftCursor) — Walk·Viewer's seek bar
   * calls this while no saved walk is active. Clamped at >= 0; the top end is
   * the caller's job, same as activateWalk leaves stopIndex's upper bound to
   * its own guard. */
  setDraftCursor(i: number): void
  /** generate a prerequisite curriculum over the focused topic and walk it */
  teach(): void
  /** clear WHERE you are, not WHAT you have on screen */
  reset(): void
  /** reveal a pane without disturbing an already-active composition */
  reveal(inst: Id): void
}

export type Bus<Id extends string = string> = BusState & BusActions<Id>

export function useStudioBus<Id extends string>(reveal: (inst: Id | BusRevealTarget) => void): Bus<Id> {
  const [focus, setFocusState] = useState<string | null>(null)
  const [hover, setHoverState] = useState<string | null>(null)
  const [hoverStep, setHoverStepState] = useState<number | null>(null)
  const [peek, setPeekState] = useState<{ id: string; seq: number } | null>(null)
  const [matches, setMatchesState] = useState<ReadonlySet<string>>(NO_MATCHES)
  const [routeSteps, setRouteStepsState] = useState<RouteStep[]>([])
  // the flat projection, memoised on the tree so its identity moves only when
  // the route does — the map's pin layout keys its memo on it
  const route = useMemo(() => routeLeafIds(routeSteps), [routeSteps])
  // the unified history engine (model/nav.ts): the trail AND the back/forward
  // line are two readings of this one value
  const [hist, setHist] = useState(HISTORY_EMPTY)
  const [activeWalk, setActiveWalk] = useState<ActiveWalkState | null>(null)
  const [draftCursor, setDraftCursorState] = useState(0)

  const visited = useMemo(() => new Set(hist.log.filter((t) => byId.get(t.id)?.topic).map((t) => t.id)), [hist.log])

  /** provenance-only history write (the engine's mark), corpus-guarded */
  const markTrail = (id: string | null, via: TrailVia, jump = false) => {
    if (!id || !byId.get(id)) return
    setHist((h) => mark(h, id, via, jump))
  }

  const setFocus = (id: string, via: TrailVia, jump = false) => {
    setFocusState(id)
    setPeekState(null) // a selection supersedes any lingering look
    setHist((h) => visit(h, id, via, jump))
  }

  /** land on a place the history already decided: everything setFocus does
   * EXCEPT writing history — the engine's step (or the deselect-restore's
   * mark) has done that */
  const land = (id: string) => {
    setFocusState(id)
  }

  const back = () => {
    // a cleared focus (water-click, Esc) steps back onto the entry under the
    // cursor first — back restores what you deselected before going further
    if (focus === null && hist.cursor >= 0) {
      const id = hist.stack[hist.cursor]
      markTrail(id, 'nav')
      land(id)
      return
    }
    const s = step(hist, -1)
    if (!s) return
    setHist(s.hist)
    land(s.id)
  }

  const forward = () => {
    const s = step(hist, 1)
    if (!s) return
    setHist(s.hist)
    land(s.id)
  }

  const setRouteSteps = (steps: RouteStep[]) => {
    setRouteStepsState(steps)
    const ids = routeLeafIds(steps)
    if (ids.length > 0) markTrail(ids[ids.length - 1], 'walk')
  }
  const setRoute = (r: string[]) => setRouteSteps(routeOfIds(r))

  const setDraftCursor = (i: number) => setDraftCursorState(Math.max(0, i))

  const activateWalk = (walkId: string, stopIndex: number) => {
    const w = walkById(walkId)
    if (!w || stopIndex < 0 || stopIndex >= w.stops.length) return
    setActiveWalk({ walkId, cursor: stopIndex })
    reveal('walkviewer') // the next-stop controls live there
    setRoute(w.stops.slice(0, stopIndex + 1).map((s) => s.id))
  }

  // the hover/peek writers are the only ones that must be REFERENTIALLY STABLE:
  // useHover memoizes its binding on them, and an unstable setter would rebuild
  // every element's handlers on every render. clearFocus joins them so the
  // map's Esc listener (deps-bound) never re-subscribes.
  const setHover = useCallback((id: string | null) => setHoverState(id), [])
  const endHover = useCallback((id: string) => setHoverState((h) => (h === id ? null : h)), [])
  const setHoverStep = useCallback((i: number | null) => setHoverStepState(i), [])
  const endHoverStep = useCallback((i: number) => setHoverStepState((h) => (h === i ? null : h)), [])
  const peekAt = useCallback((id: string) => setPeekState((p) => ({ id, seq: (p?.seq ?? 0) + 1 })), [])
  // stable like the hover writers: the palette re-publishes on every keystroke,
  // and an unstable setter would rebuild that effect's binding each render
  const setMatches = useCallback((ids: ReadonlySet<string>) => setMatchesState(ids.size ? ids : NO_MATCHES), [])
  const clearFocus = useCallback(() => {
    setFocusState(null)
    setPeekState(null) // "stand nowhere" drops the look-highlight too
  }, [])

  return {
    focus,
    hover,
    hoverStep,
    peek,
    matches,
    routeSteps,
    route,
    history: hist,
    trail: hist.log,
    visited,
    activeWalk,
    draftCursor,
    canBack: hist.cursor > 0 || (focus === null && hist.cursor >= 0),
    canForward: hist.cursor < hist.stack.length - 1,

    setFocus,
    clearFocus,
    back,
    forward,
    setHover,
    endHover,
    setHoverStep,
    endHoverStep,
    peekAt,
    setMatches,
    setRoute,
    setRouteSteps,
    setDraftCursor,
    reveal,
    visit: markTrail,
    activateWalk,
    // advanceWalk was here, unreachable since it was written, and deleted in
    // #195 rather than finally given a caller. Stepping a walk lives in
    // state/walk/playback.ts now, and this was the wrong primitive for it three
    // ways: it cannot write bus.focus (see activateWalk above — it never has,
    // so the document did not follow), it knows only the SAVED source while a
    // deck is routinely the draft road, and it answers no question about where
    // the end is. `seek(i)` answers all three.
    deactivateWalk: () => setActiveWalk(null),
    clearRoute: () => {
      setRouteStepsState([])
      setActiveWalk(null)
      setDraftCursorState(0)
    },
    teach: () => {
      if (!focus) return
      const c = curriculum(focus, 'depends_on', 3)
      setRoute(c.order)
      reveal('walk')
      reveal('map')
    },
    reset: () => {
      // deliberately does NOT touch the unfold canvas or the composition —
      // "reset session" clears WHERE you are, not WHAT you have on screen
      setFocusState(null)
      setHoverState(null)
      setPeekState(null)
      setMatchesState(NO_MATCHES)
      setRouteStepsState([])
      setHist(HISTORY_EMPTY)
      setActiveWalk(null)
      setDraftCursorState(0)
    },
  }
}

// ── The hover binding ───────────────────────────────────────────────────────
export interface HoverBinding {
  lit(id: string): boolean
  /** Spread onto any element to join the hover channel.
   *
   * The `data-lit` attribute comes free, and that is deliberate: the screenshot
   * driver asserts on `[data-lit="1"]`, so an instrument that joins the channel
   * is covered by the assertion that already exists, without anyone remembering
   * to hand-write the test hook. Hooks should be structural, not remembered. */
  bind(id: string): {
    onPointerEnter: () => void
    onPointerLeave: () => void
    'data-lit': 0 | 1
  }
}

export function useHover(bus: Bus): HoverBinding {
  const { hover, setHover, endHover } = bus
  return useMemo(
    () => ({
      lit: (id: string) => hover === id,
      bind: (id: string) => ({
        onPointerEnter: () => setHover(id),
        onPointerLeave: () => endHover(id),
        'data-lit': (hover === id ? 1 : 0) as 0 | 1,
      }),
    }),
    [hover, setHover, endHover],
  )
}
