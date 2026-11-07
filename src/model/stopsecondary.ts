// WHICH SECONDARY LIST A DOCUMENT SHOWS, as arithmetic. A secondary list
// belongs to a STOP POSITION, not a node: MTH 110 stops on MSF-Discrete.T1
// three times and only its third stop carries one, so the node alone cannot
// decide — the active walk's cursor has to agree with it.

import type { WalkStop } from '../corpus/walks'

/** the active stop's secondary tags, only while its stop is the node being read */
export function secondaryTagsAt(
  walk: { stops: readonly { id: string; secondary?: WalkStop['secondary'] }[] } | null | undefined,
  cursor: number | undefined,
  nodeId: string,
): WalkStop['secondary'] {
  if (!walk || cursor === undefined) return undefined
  const stop = walk.stops[cursor]
  return stop && stop.id === nodeId ? stop.secondary : undefined
}
