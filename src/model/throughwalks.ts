// "Walks through here" as arithmetic: every visit a walk makes to a place, one
// entry per STOP POSITION. A route may stop at the same place more than once, and
// then it is here more than once — a walk that returns to a place is a fact about
// the route, not a duplicate to collapse.

import type { Walk } from '../corpus/walks'

export interface WalkVisit {
  walk: Walk
  /** the stop's position in the route */
  idx: number
}

export function throughWalksAt(walks: readonly Walk[], id: string): WalkVisit[] {
  const out: WalkVisit[] = []
  for (const walk of walks) walk.stops.forEach((s, idx) => {
    if (s.id === id) out.push({ walk, idx })
  })
  return out
}
