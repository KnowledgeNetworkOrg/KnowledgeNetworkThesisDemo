// The walk lists are flat rows sized for three walks; a corpus that publishes
// categories has sixty. Order is the data's: a category takes the place where
// it first appears, and a saved walk has none, so it goes last under our own
// heading rather than inventing a program category for it.

import type { Walk } from '../corpus/walks'

/** the author's walks, which the program publishes no category for */
export const SAVED_WALKS_HEADING = 'Saved walks'

export interface WalkGroup {
  /** the program's category, `Saved walks`, or null when the list is flat */
  heading: string | null
  walks: readonly Walk[]
}

export function groupWalks(walks: readonly Walk[]): WalkGroup[] {
  const byCategory = new Map<string, Walk[]>()
  const uncategorised: Walk[] = []
  for (const w of walks) {
    if (!w.category) {
      uncategorised.push(w)
      continue
    }
    const group = byCategory.get(w.category)
    if (group) group.push(w)
    else byCategory.set(w.category, [w])
  }
  if (byCategory.size === 0) return [{ heading: null, walks: [...walks] }]
  const groups: WalkGroup[] = [...byCategory].map(([heading, grouped]) => ({ heading, walks: grouped }))
  if (uncategorised.length > 0) groups.push({ heading: SAVED_WALKS_HEADING, walks: uncategorised })
  return groups
}
