// One walk list, flat where the corpus publishes no category and grouped where
// it does. Every route stays a button in the DOM at once: the browser drivers
// find the lists by their buttons, so headings are plain text and nothing is
// collapsed or lazily mounted.

import type { ReactNode } from 'react'

import type { Walk } from '../corpus/walks'
import { groupWalks } from './walkgroups'

export type WalkListVariant = 'trail' | 'picker'

/** The Trail is Tailwind slate; the Walk Editor's picker is DS tokens. */
const ROW: Record<WalkListVariant, string> = {
  trail: 'flex flex-wrap gap-1.5',
  picker: 'flex flex-wrap gap-1',
}
const STACK: Record<WalkListVariant, string> = {
  trail: 'flex flex-col gap-1.5',
  picker: 'flex flex-col gap-1',
}
const HEADING: Record<WalkListVariant, string> = {
  trail: 'mb-1 text-[10px] font-bold text-slate-500',
  picker: 'mb-0.5 text-[var(--fs-caption)] px-1',
}

export default function WalkList({
  walks,
  variant,
  renderWalk,
}: {
  walks: readonly Walk[]
  variant: WalkListVariant
  renderWalk: (walk: Walk) => ReactNode
}) {
  const groups = groupWalks(walks)
  if (groups.length === 1 && groups[0].heading === null) {
    return <div className={ROW[variant]}>{groups[0].walks.map(renderWalk)}</div>
  }
  return (
    <div className={STACK[variant]}>
      {groups.map((g) => (
        <div key={g.heading} data-walk-group={g.heading ?? ''}>
          {g.heading !== null && (
            <div
              data-walk-heading
              className={HEADING[variant]}
              style={variant === 'picker' ? { color: 'var(--text-3)' } : undefined}
            >
              {g.heading}
            </div>
          )}
          <div className={ROW[variant]}>{g.walks.map(renderWalk)}</div>
        </div>
      ))}
    </div>
  )
}
