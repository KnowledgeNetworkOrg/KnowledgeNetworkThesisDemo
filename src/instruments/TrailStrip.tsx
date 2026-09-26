// Trail (walked path) + walk controls — the bottom strip. The trail is the
// temporal history of every focus write, append-only — where the breadcrumb
// answers "where am I in the containment tree," the trail answers "how did I
// get here." The two diverge exactly when a JUMP happens — jump chips are
// visually accented so that divergence is legible in a screenshot, not just
// in the DOM text a verification script pulls out.

import { useEffect, useRef, useSyncExternalStore } from 'react'

import { IconButton, LEGEND_INSET, PaneScroller, TrailChip, wrapTip } from '@/ds'

import { byId, topicHueOf } from '../corpus/graph'
import { listWalks, subscribeWalks } from '../state/walkstore'
import type { TrailVia } from '../model/nav'
import type { Bus } from '../state/bus'

const VIA_TAG: Record<TrailVia, string> = {
  map: 'MAP',
  tree: 'TREE',
  link: 'LNK',
  trail: 'TRL',
  walk: 'WLK',
  graph: 'GPH',
  nav: 'NAV',
  desk: 'DSK',
}

export default function TrailStrip({ bus }: { bus: Bus }) {
  const { trail, activeWalk } = bus
  // #16: the built-ins PLUS whatever the desk has saved. Bound here rather than
  // imported as a const because the list grows while the app is running — save a
  // walk on the desk and its button must appear in this strip without a reload.
  const walks = useSyncExternalStore(subscribeWalks, listWalks)
  const onSelectTrailEntry = (id: string) => bus.setFocus(id, 'trail')
  const onActivateWalk = (walkId: string) => bus.activateWalk(walkId, 0)
  const onDeactivateWalk = bus.deactivateWalk

  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: 'smooth' })
  }, [trail.length])

  const walk = activeWalk ? walks.find((w) => w.id === activeWalk.walkId) ?? null : null
  const cursor = activeWalk?.cursor ?? 0

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white flex items-stretch h-[92px]" aria-label="trail-strip">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* OB-143: the label's first letter sits under the legend's — left only, by the constant */}
        <div className="pr-3 pt-1.5 text-[10px] font-bold text-slate-500 shrink-0" style={{ paddingLeft: LEGEND_INSET }}>
          Trail — {trail.length} visited (append-only; ⤳ marks a jump)
        </div>
        <PaneScroller axis="x" forwardRef={scroller} style={{ padding: '0 12px 8px' }}>
          <div className="flex items-center gap-1.5 h-full">
            {trail.map((t, i) => (
              <TrailChip
                key={`${i}-${t.id}`}
                title={byId.get(t.id)!.title}
                domain={topicHueOf(t.id) ?? ''}
                via={VIA_TAG[t.via]}
                jump={t.jump}
                onClick={() => onSelectTrailEntry(t.id)}
              />
            ))}
          </div>
        </PaneScroller>
      </div>

      <div className="w-px bg-slate-200 shrink-0" />

      <PaneScroller style={{ width: 420, flex: 'none', padding: '6px 12px' }}>
        <div className="text-[10px] font-bold text-slate-500 mb-1">Walks</div>
        {!walk ? (
          <div className="flex flex-wrap gap-1.5">
            {walks.map((w) => (
              <button
                key={w.id}
                onClick={() => onActivateWalk(w.id)}
                className="px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50 text-[11px] font-medium"
                title={wrapTip(w.description)}
              >
                ▶ {w.title}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-amber-700 truncate max-w-[140px]">{walk.title}</span>
            <span className="text-slate-400 shrink-0">
              stop {cursor + 1} of {walk.stops.length} · {walk.stops.length - 1 - cursor} remaining
            </span>
            <span className="flex-1" />
            <IconButton onClick={onDeactivateWalk} title="stop this walk" />
          </div>
        )}
      </PaneScroller>
    </div>
  )
}
