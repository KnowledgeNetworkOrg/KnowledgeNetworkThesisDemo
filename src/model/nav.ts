// Pure helpers + shared types for the cockpit, split out from CockpitView so
// that component stays focused on wiring — mirrors the repo's existing split
// between derive.ts/flat.ts (pure) and the views that render them. Not in
// the handoff's file list verbatim (it says "optionally layout.ts"); adding
// this one small file for the same reason logged as a deviation in RESULTS.

import { byId, childrenOf, EDGE_LABEL, ROOT_ID } from '../corpus/graph'
import type { EdgeType } from '../corpus/graph'

/** How a visit was made — the provenance stamped on a trail entry.
 *
 *  `'tree'` OUTLIVED THE TREE PANEL IT WAS NAMED FOR (#265, 2026-09-07). It never meant
 *  "the Tree instrument"; it means the selection came from an OUTLINE-SHAPED LIST, which
 *  is still exactly what its two remaining writers are — the connections pane's contains
 *  column and the neighborhood panel. Kept rather than renamed for that reason, and
 *  because a stored trail written before the rename would carry a `via` the type no
 *  longer admits (#170: persisted payloads have no version field). */
export type TrailVia = 'map' | 'tree' | 'link' | 'trail' | 'walk' | 'graph' | 'nav' | 'desk'

/** Fixed edge-type order, derived once from graph.ts's own declaration order
 * so the plex's rings and the knowledge panel's grouped list always agree. */
export const EDGE_TYPES = Object.keys(EDGE_LABEL) as EdgeType[]

export interface TrailEntry {
  id: string
  via: TrailVia
  jump: boolean
}

export interface ActiveWalkState {
  walkId: string
  cursor: number
}

// ── The unified history engine (2026-07-16 audit) ───────────────────────────
// ONE dataset holds every navigation-order fact. It used to be two structures
// with two owners — the trail (append-only provenance) and a separate
// browser-style stack for back/forward — updated side by side and only true
// together by discipline. Now the LOG is the single source: every navigation
// event lands on it forever, and the browsable STACK+CURSOR is threaded
// through the same value (a fresh visit burns the forward branch — browser
// rules; the log never loses anything). Whatever wants "all navigation order
// state" — the trail strip, back/forward, future replay or analysis — reads
// this one value.

export interface History {
  /** append-only: every navigation event, in order, via-tagged. The trail. */
  log: TrailEntry[]
  /** the browsable line through the log — what back/forward walk */
  stack: string[]
  /** index of the CURRENT place in `stack`, -1 while nothing has been focused */
  cursor: number
}

export const HISTORY_EMPTY: History = { log: [], stack: [], cursor: -1 }

/** Provenance WITHOUT navigation: log the event, leave the stack alone — a
 * route tip, an Unfold placement, back()'s restore after a deselect. Dropped
 * when identical to the log tip: one gesture fans out to several bus writers,
 * and none of them may spam the trail with duplicate chips. */
export function mark(h: History, id: string, via: TrailVia, jump = false): History {
  const tip = h.log[h.log.length - 1]
  if (tip && tip.id === id) return h
  return { ...h, log: [...h.log, { id, via, jump }] }
}

/** A fresh navigation: mark it on the log, drop everything ahead of the
 * cursor, append, stand on it. Re-visiting the place already under the cursor
 * never re-pushes — no writer may burn the forward branch by re-reporting
 * where we already stand. The two dedups are independent on purpose: the log
 * dedups at its tip, the stack at its cursor. */
export function visit(h: History, id: string, via: TrailVia, jump = false): History {
  const m = mark(h, id, via, jump)
  if (h.cursor >= 0 && h.stack[h.cursor] === id) return m
  const stack = [...h.stack.slice(0, h.cursor + 1), id]
  return { ...m, stack, cursor: stack.length - 1 }
}

/** Step the cursor back (-1) or forward (+1); null when there is nothing that
 * way. The landing is a real event — it goes on the log, tagged 'nav' — but
 * the stack itself never mutates: only a visit does that. */
export function step(h: History, dir: -1 | 1): { hist: History; id: string } | null {
  const c = h.cursor + dir
  if (c < 0 || c >= h.stack.length) return null
  const id = h.stack[c]
  return { hist: { ...mark(h, id, 'nav'), cursor: c }, id }
}

/** Containment parent, falling back to ROOT_ID itself — root stays root. */
export function parentOf(id: string): string {
  return byId.get(id)?.parentId ?? ROOT_ID
}

/** How many nodes `id` contains, at every depth — for a hover readout that
 * wants "this container holds N nodes" (OB-096) without a caller re-walking
 * `childrenOf` by hand. 0 for a leaf. */
export function descendantCount(id: string): number {
  let n = 0
  for (const k of childrenOf.get(id) ?? []) n += 1 + descendantCount(k.id)
  return n
}
