// The one drill-path → columns computation, shared by BOTH presentation
// views (WalkColumns and the isometric LayerStack) so they can never
// disagree about which tiers are open. Kept out of the component files —
// react-refresh wants those to export only components.

import { isBox } from '../../state/walk/mockwalk'
import type { Stop } from '../../state/walk/mockwalk'

export interface Column {
  source: string
  stops: Stop[]
  /** position of the container box (column index, row index) this column came from */
  from?: { col: number; row: number }
}

export function columnsFor(stops: Stop[], path: string[]): Column[] {
  const cols: Column[] = [{ source: 'the plan', stops }]
  let cur = stops
  let colIdx = 0
  for (const key of path) {
    const row = cur.findIndex((x) => isBox(x) && x.key === key)
    if (row < 0) break
    const s = cur[row]
    if (!isBox(s)) break
    // presentation reads the RESOLVED road — every container has one variant
    const steps = s.variants[0].steps
    cols.push({ source: s.title, stops: steps, from: { col: colIdx, row } })
    cur = steps
    colIdx++
  }
  return cols
}
