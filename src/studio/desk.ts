// The desk's width arithmetic — the half of OB-170 that is pure, so the drag,
// the keyboard and the reset all read the same numbers. The DS owns the clamp
// itself (`clampDesk` / `deskBounds`). The widths are drawn by CSS in
// StudioView, as fractions of the row; this file supplies the room a handle's
// bounds are read against, the fractions a composition opens with, and the
// sizes-to-fractions step a drag ends in.

import { PANE_DIVIDER_METRICS, clampDesk, paneFit } from '@/ds'
import type { PaneFit } from '@/ds'

import type { Instrument, InstrumentId } from './instruments'

/** A column of the desk: one pane, or a stack that shares one column. */
export interface DeskColumn {
  key: string
  members: readonly Instrument[]
}

/** The gap between the desk's children — the row's own `gap-3`. */
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

/** The width a column fixes for itself, or null when it shares the row's fractions.
 *  Read from the leading member, the same place a preset's weight is read. */
export function fixedWidth(column: DeskColumn): number | null {
  const flex = column.members[0].flex
  return flex && typeof flex === 'object' && Number.isFinite(flex.fixed) && flex.fixed > 0
    ? Math.max(0, flex.fixed)
    : null
}

/** A stack's fit is the strongest of its members': the same column holds them all,
 *  so it must not be narrower than any one of them can work at. */
export function stackFit(members: readonly Instrument[]): Pick<Required<PaneFit>, 'floor'> {
  let floor = 0
  for (const m of members) floor = Math.max(floor, paneFit(m.fit).floor)
  return { floor }
}

export const deskFits = (columns: readonly DeskColumn[]): Pick<Required<PaneFit>, 'floor'>[] =>
  columns.map((c) => stackFit(c.members))

/** The fractions a composition opens with, from the preset's weights and each
 *  leading pane's own `flex`. Only flexible columns are passed: a fixed column
 *  keeps its pixel width and takes no share of the row. */
export function initialFractions(
  columns: readonly DeskColumn[],
  weights: Partial<Record<InstrumentId, number>> = {},
): number[] {
  const n = columns.length
  if (!n) return []
  const raw = columns.map((c) => {
    const lead = c.members[0]
    const weight = weights[lead.id as InstrumentId]
    if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) return weight
    if (typeof lead.flex === 'number' && lead.flex > 0) return lead.flex
    return 1
  })
  const total = raw.reduce((s, v) => s + v, 0)
  return raw.map((v) => (total > 0 ? v / total : 1 / n))
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
 *  all stop at the same place — and it runs on the widths actually drawn, so a
 *  pane under its floor gives nothing away instead of being re-fitted first. */
export function dragDesk({
  sizes,
  fits,
  index,
  delta,
}: {
  sizes: readonly number[]
  fits: readonly (PaneFit | null | undefined)[]
  index: number
  delta: number
}): { sizes: number[]; fractions: number[] } {
  const next = clampDesk({ sizes: [...sizes], index, delta, fits: [...fits] })
  return { sizes: next, fractions: fractionsOf(next) }
}
