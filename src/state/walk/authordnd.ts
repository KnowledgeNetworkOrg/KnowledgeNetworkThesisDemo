// The one drag-and-drop contract every authoring view shares (round 4 —
// three views author the SAME draft, so a drop must mean the same thing in
// all of them). Payloads: `pal:<nodeId>` from the palette, `blk:<pathKey>`
// for an existing block, `var:<forkPathKey>~<idx>` for a fork's variant tab
// (dragging a route out extracts it as its own group). A drop resolves to an
// insertion Path and goes through the same AuthorState ops regardless of which
// view caught it.
//
// Since OB-219 a drop can also be REFUSED: the same node may not sit twice in a
// row. The rule is the design system's (`neighboursOf`, published so no host
// retypes it); what lives here is the host's half — which ids the landing list
// holds, which node a payload carries, and the record a real drag needs so the
// road can judge a gap before the drop rather than after it.

import type { DragEvent as ReactDragEvent } from 'react'

import { neighboursOf } from '@/ds'
import type { AuthorState, Path } from './authordraft'
import { parsePath, stopAt } from './authordraft'
import { chosenIdx, chosenSteps, isBox, isLeaf } from './mockwalk'
import type { Stop } from './mockwalk'

export const DT = 'text/plain'

export type Band = 'before' | 'after' | 'inside'

/** the visual twin of gapFor — which band the pointer is in, for drop marks */
export function bandFor(e: ReactDragEvent, stop: Stop): Band {
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / r.height
  if (isBox(stop) && y > 0.3 && y < 0.7) return 'inside'
  return y < 0.5 ? 'before' : 'after'
}

/** where a drag over a block row should insert: before, after, or (containers,
 * middle band) inside the chosen variant at the end — shared by dragover
 * (caret) and drop. A container's inside-drop lands in the variant on show. */
export function gapFor(e: ReactDragEvent, path: Path, stop: Stop, choices: Record<string, string>): Path {
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / r.height
  const i = path[path.length - 1]
  const parent = path.slice(0, -1)
  if (isBox(stop) && y > 0.3 && y < 0.7) return [...path, chosenIdx(stop, choices), chosenSteps(stop, choices).length]
  return y < 0.5 ? [...parent, i] : [...parent, i + 1]
}

// ── The drag in flight (OB-219) ─────────────────────────────────────────────
// A REAL browser drag hides its payload until the drop: during dragover,
// `dataTransfer.getData` answers '' (the HTML spec's protected mode). A road that
// has to strike a gap WHILE the pointer moves cannot learn what is being dragged
// from the event, so every source that starts a drag records it here too. The map
// is the exception that needs nothing: it dispatches its own events carrying a
// payload that stays readable, so the event is asked first and this record second.

interface InFlight {
  payload: string
  /** where the pointer held the dragged element, and that element's size. The browser
   *  draws its drag image at this same offset under the pointer, which is how a host
   *  knows where the held node is while it moves. */
  dx: number
  dy: number
  w: number
  h: number
}
let inFlight: InFlight | null = null

/** start a drag: write the payload and record it — with where the element was
 *  held — for the dragovers that cannot read it */
export function beginDrag(e: ReactDragEvent, payload: string): void {
  e.dataTransfer.setData(DT, payload)
  const r = e.currentTarget.getBoundingClientRect()
  inFlight = { payload, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height }
}

/** the drag is over — dropped, refused or cancelled. A source calls this from its
 *  dragend; handleDrop calls it too, since a block that moved has no dragend left
 *  to hear (its element is gone). */
export function endDrag(): void {
  inFlight = null
}

/** what is being dragged: the event's own payload when it is readable (a drop,
 *  or the map's dispatched events), else the in-flight record */
export function dragPayload(e: ReactDragEvent): string {
  return e.dataTransfer.getData(DT) || inFlight?.payload || ''
}

/** where the held node is drawn right now, in viewport px — or null when this drag
 *  recorded no grip (the map dispatches its own events and draws its own ghost,
 *  centred on the pointer) */
export function heldBox(e: ReactDragEvent): { left: number; top: number; width: number; height: number } | null {
  if (!inFlight) return null
  const own = e.dataTransfer.getData(DT)
  if (own && own !== inFlight.payload) return null // a stale record from some other drag
  return { left: e.clientX - inFlight.dx, top: e.clientY - inFlight.dy, width: inFlight.w, height: inFlight.h }
}

// ── The duplicate-neighbour rule, host side (OB-219, OB-220) ────────────────

/** a member's id AS THE RULE READS IT: a bound leaf's node, and `null` for an unset
 *  slot or any container — the DS's one convention that carries both exceptions
 *  (two pickers may sit together; nested nodes are never compared by contents) */
const idOf = (s: Stop | undefined): string | null => (s && isLeaf(s) && !s.unset && s.node ? s.node : null)

/** the sibling list a parent path addresses (the root list for []) */
function listAt(stops: Stop[], parent: Path): Stop[] {
  if (parent.length === 0) return stops
  return stopAt(stops, parent.slice(0, -1))?.variants[parent[parent.length - 1]]?.steps ?? []
}

/** the node a payload would put on the road, or null when the rule never compares
 *  what it carries — a group, an unset slot, a route pulled out of a fork */
export function draggedNode(stops: Stop[], payload: string): string | null {
  if (payload.startsWith('pal:')) return payload.slice(4) || null
  if (payload.startsWith('blk:')) return idOf(stopAt(stops, parsePath(payload.slice(4))))
  return null
}

/** WHICH NODES THE GAP AT `target` MAY NOT TAKE — whatever sits either side of it.
 *  Both surfaces of the rule read this, so the struck line and the greyed row can
 *  never disagree: a drag landing at `target`, and a picker filling the slot there.
 *
 *  `moving` is a block that LEAVES ITS OWN LIST FIRST — a road block being dragged,
 *  or the picker's own slot. Taken out before its neighbours are read, so a node
 *  dropped back where it already stands is not refused by itself, and a picker is
 *  judged by the two stops either side of it rather than by its own empty place.
 *  Only a move within the same list changes the list; one from any other list
 *  leaves this one's members exactly as they are. */
export function refusedAt(stops: Stop[], target: Path, moving?: Path): string[] {
  const parent = target.slice(0, -1)
  let at = target[target.length - 1]
  let members = listAt(stops, parent)
  if (moving && moving.length === target.length && moving.slice(0, -1).every((v, k) => v === parent[k])) {
    const i = moving[moving.length - 1]
    members = members.filter((_, j) => j !== i)
    if (i < at) at--
  }
  return neighboursOf(members.map(idOf), at)
}

/** THE DROP VERDICT — may `payload` land at `target`? Only the landing is judged:
 *  a move that leaves two twins touching behind it is not refused, the same as a
 *  delete or an ungroup that does. */
export function dropAllowed(stops: Stop[], payload: string, target: Path): boolean {
  const node = draggedNode(stops, payload)
  if (node === null) return true
  const moving = payload.startsWith('blk:') ? parsePath(payload.slice(4)) : undefined
  return !refusedAt(stops, target, moving).includes(node)
}

export function handleDrop(e: ReactDragEvent, target: Path, state: AuthorState) {
  e.preventDefault()
  e.stopPropagation()
  const data = e.dataTransfer.getData(DT)
  endDrag()
  // REFUSED: the node stays where it came from and NOTHING is reported (OB-219
  // clause 2) — no toast, no log line. A real drag never gets here, since the
  // refusing gap does not accept it; the map's dispatched drop does, which is why
  // the rule is asked again rather than trusted to the dragover.
  if (!dropAllowed(state.stops, data, target)) return
  if (data.startsWith('pal:')) state.insertNode(data.slice(4), target)
  else if (data.startsWith('blk:')) state.moveBlock(parsePath(data.slice(4)), target)
  else if (data.startsWith('var:')) {
    const [pk, idx] = data.slice(4).split('~')
    state.extractVariant(parsePath(pk), Number(idx), target)
  }
  state.setCaret(null)
}
