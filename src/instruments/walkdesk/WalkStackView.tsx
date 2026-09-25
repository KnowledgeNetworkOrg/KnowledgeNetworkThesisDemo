// Walk·Stack as its own instrument (#20) — the isometric layer stack lifted out
// of the Walk·Desk. One rotated plane per open tier, so the drill path reads as
// DEPTH rather than as a row of columns. Picking a diamond drills; picking a
// visit dot folds back.
//
// It owns only its drill path. The road it reads comes from presented.ts, which
// resolves the SAME draft the walk editor writes.

import { PaneScroller } from '@/ds'
import LayerStack from './LayerStack'
import { useDrill, usePresentedRoad } from '../../state/walk/presented'
import { useHover } from '../../state/bus'
import type { Bus } from '../../state/bus'

export default function WalkStackView({ bus }: { bus: Bus }) {
  const sync = useHover(bus)
  const { path, pick } = useDrill()
  const road = usePresentedRoad()

  return (
    <div data-walkstack className="h-full flex flex-col">
      <PaneScroller>
        <LayerStack stops={road} path={path} pick={pick} sync={sync} />
      </PaneScroller>
    </div>
  )
}
