// The desk's width arithmetic - the half of OB-170 that is pure, so the drag,
// the keyboard and the reset all read the same numbers. The DS owns the clamp
// itself (`clampDesk` / `deskBounds`); this file turns a row's measured width
// and a composition's fractions into the widths to draw, and back again.

import { PANE_DIVIDER_METRICS, clampDesk, paneFit } from '@/ds'
import type { PaneFit } from '@/ds'

import type { Instrument, InstrumentId } from './instruments'

/** A column of the desk: one pane, or a stack that shares one column. */
export interface DeskColumn {
  key: string
  members: readonly Instrument[]
}

/** The gap between the desk's children - the row's own `gap-3`. */
export const DESK_GUTTER = 12

/** The strip straddles that gutter rather than sitting beside it, so a seam costs
 *  the gutter the row already had and no more. */
export const DESK_DIVIDER_MARGIN = -(PANE_DIVIDER_METRICS.hit + DESK_GUTTER) / 2

/** The row width the panes may divide: the measured row less the gutters between
 *  them. The strip adds nothing, because it is drawn over a gutter. */
export function deskAvailable(rowWidth: number, columns: number): number {
  const seams = Math.max(0, columns - 1)
  return Math.max(0, rowWidth - seams * DESK_GUTTER)
}

/** A stack's fit is the strongest of its members': the same column holds them all,
 *  so it must not be narrower than any one of them can work at. */
export function stackFit(members: readonly Instrument[]): Required<PaneFit> {
  let narrowBelow = 0
  let floor = 0
  for (const m of members) {
    const f = paneFit(m.fit)
    narrowBelow = Math.max(narrowBelow, f.narrowBelow)
    floor = Math.max(floor, f.floor)
  }
  return { narrowBelow, floor }
}

export const deskFits = (columns: readonly DeskColumn[]): Required<PaneFit>[] =>
  columns.map((c) => stackFit(c.members))

/** The fractions a composition opens with, from the preset's weights and each
 *  leading pane's own `flex`. A fixed pane contributes its pixel target; the rest
 *  share what is left in their weight's proportion. */
export function initialFractions(
  columns: readonly DeskColumn[],
  weights: Partial<Record<InstrumentId, number>> = {},
  available = 0,
): number[] {
  const n = columns.length
  if (!n) return []
  const raw = columns.map((c) => {
    const lead = c.members[0]
    const weight = weights[lead.id as InstrumentId]
    if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) return { px: false, value: weight }
    if (typeof lead.flex === 'number' && lead.flex > 0) return { px: false, value: lead.flex }
    if (lead.flex && typeof lead.flex === 'object') return { px: true, value: Math.max(0, lead.flex.fixed) }
    return { px: false, value: 1 }
  })
  if (available <= 0) {
    const total = raw.reduce((s, r) => s + Math.max(0, r.value), 0)
    return raw.map((r) => (total > 0 ? Math.max(0, r.value) / total : 1 / n))
  }
  const fixed = raw.reduce((s, r) => s + (r.px ? r.value : 0), 0)
  const weightTotal = raw.reduce((s, r) => s + (r.px ? 0 : r.value), 0)
  const free = Math.max(0, available - fixed)
  const sizes = raw.map((r) => (r.px ? r.value : weightTotal > 0 ? (free * r.value) / weightTotal : 0))
  const total = sizes.reduce((s, v) => s + v, 0)
  return total > 0 ? sizes.map((v) => v / total) : raw.map(() => 1 / n)
}

/** Widths from fractions, with every floor respected while the row can hold them.
 *  A pane whose share is under its floor is pinned there and the rest share the
 *  room it leaves. When the floors together exceed the row the panes shrink in
 *  their fractions instead: a floor limits a drag, it does not make the row wider. */
export function fitSizes(
  fractions: readonly number[],
  available: number,
  fits: readonly (PaneFit | null | undefined)[],
): number[] {
  const n = fractions.length
  if (!n) return []
  if (fits.length !== n || !(available > 0)) return fractions.map((f) => f * Math.max(0, available))
  const floors = fits.map((f) => paneFit(f).floor)
  if (floors.reduce((s, v) => s + v, 0) > available) {
    const weightTotal = fractions.reduce((s, f) => s + Math.max(0, f), 0)
    return fractions.map((f) => (weightTotal > 0 ? (available * Math.max(0, f)) / weightTotal : available / n))
  }
  const pinned = new Set<number>()
  let pinnedSum = 0
  for (;;) {
    const free = [...Array(n).keys()].filter((i) => !pinned.has(i))
    if (!free.length) break
    const room = available - pinnedSum
    const weightTotal = free.reduce((s, i) => s + Math.max(0, fractions[i]), 0)
    const short = free.find((i) => {
      const share = weightTotal > 0 ? (room * Math.max(0, fractions[i])) / weightTotal : room / free.length
      return share < floors[i]
    })
    if (short === undefined) break
    pinned.add(short)
    pinnedSum += floors[short]
    if (pinnedSum > available) return floors
  }
  const free = [...Array(n).keys()].filter((i) => !pinned.has(i))
  const room = available - pinnedSum
  const weightTotal = free.reduce((s, i) => s + Math.max(0, fractions[i]), 0)
  return Array.from({ length: n }, (_, i) => {
    if (pinned.has(i)) return floors[i]
    if (!free.length) return floors[i]
    return weightTotal > 0 ? (room * Math.max(0, fractions[i])) / weightTotal : room / free.length
  })
}

/** Sizes back to fractions, normalised by their own total so a drag's total is
 *  preserved even in the narrow case where the floors already overflow. */
export function fractionsOf(sizes: readonly number[]): number[] {
  const total = sizes.reduce((s, v) => s + Math.max(0, v), 0)
  if (!(total > 0)) return sizes.map(() => (sizes.length ? 1 / sizes.length : 0))
  return sizes.map((v) => Math.max(0, v) / total)
}

/** One boundary moved: the widths it draws AND the fractions the composition
 *  stores. The clamp is the DS's, so the drag, a key nudge and the bounds readout
 *  all stop at the same place. */
export function dragDesk({
  fractions,
  available,
  fits,
  index,
  delta,
}: {
  fractions: readonly number[]
  available: number
  fits: readonly (PaneFit | null | undefined)[]
  index: number
  delta: number
}): { sizes: number[]; fractions: number[] } {
  const sizes = clampDesk({ sizes: fitSizes(fractions, available, fits), index, delta, fits: [...fits] })
  return { sizes, fractions: fractionsOf(sizes) }
}
