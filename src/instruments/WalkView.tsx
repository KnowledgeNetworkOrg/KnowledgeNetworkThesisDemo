// The Walk — rebuilt from the old Combined screen's path-builder, the one
// piece of that screen worth keeping: a downstream, step-by-step walk along
// REAL directed edges. One column per step: the step's node on top, its
// outgoing links below. Clicking a choice extends the route; clicking a
// choice in an EARLIER column forks the walk there; clicking a step card
// backtracks to it. The route is a bus channel: every stop lands on the shared
// focus, so the other instruments follow. (It is not drawn on a map — the flat
// MapView painted the route amber and was deleted 2026-07-14; the nested atlas
// has never drawn it. See model/atlas.ts if that comes back.)
//
// The corpus is one giant SCC on purpose, so walks WILL revisit nodes;
// revisits are marked instead of forbidden.

import { useEffect, useRef } from 'react'

import { DomainDot, LEGEND_INSET, PaneScroller, topicPaint, wrapTip } from '@/ds'
import { byId, domainIds, edges, EDGE_COLOR, EDGE_LABEL, topicHueOf, topicsUnder } from '../corpus/graph'
import type { Bus } from '../state/bus'
import type { EdgeType } from '../corpus/graph'
import { degreeOf, HUB_IDS } from '../model/flat'

interface Choice {
  target: string
  types: [EdgeType, number][]
}

// outgoing links per leaf, aggregated per target (a pair can carry several types)
const outgoing = new Map<string, Choice[]>()
for (const e of edges) {
  if (!outgoing.has(e.source)) outgoing.set(e.source, [])
}
{
  const per = new Map<string, Map<string, Map<EdgeType, number>>>()
  for (const e of edges) {
    if (!per.has(e.source)) per.set(e.source, new Map())
    const m = per.get(e.source)!
    if (!m.has(e.target)) m.set(e.target, new Map())
    const t = m.get(e.target)!
    t.set(e.type, (t.get(e.type) ?? 0) + 1)
  }
  for (const [source, m] of per) {
    outgoing.set(
      source,
      [...m]
        .map(([target, types]) => ({ target, types: [...types] as [EdgeType, number][] }))
        .sort((a, b) => byId.get(a.target)!.title.localeCompare(byId.get(b.target)!.title)),
    )
  }
}

const typeChips = (types: [EdgeType, number][]) => (
  <span className="flex items-center gap-0.5 shrink-0">
    {types.map(([t, n]) => (
      <span key={t} title={wrapTip(EDGE_LABEL[t])} className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: EDGE_COLOR[t] }}>
        {n > 1 && <span className="sr-only">×{n}</span>}
      </span>
    ))}
  </span>
)

export default function WalkView({ bus }: { bus: Bus }) {
  const { route, setRoute } = bus
  const scroller = useRef<HTMLDivElement>(null)

  // keep the newest column in view as the walk grows
  useEffect(() => {
    scroller.current?.scrollTo({ left: scroller.current.scrollWidth, behavior: 'smooth' })
  }, [route.length])

  if (route.length === 0) {
    return (
      <PaneScroller style={{ padding: 24 }}>
        <div className="max-w-[900px] mx-auto">
          <div className="text-[13px] font-bold text-slate-800">Start a walk</div>
          <div className="text-[11px] text-slate-500 mt-0.5 mb-4">
            pick a node, then follow its outgoing links one step at a time — every stop lands on the shared focus, so the other instruments follow
          </div>

          <div className="text-[11px] text-slate-400 font-semibold mb-1.5">the busiest topics (computed hubs — good starting points)</div>
          <div className="flex gap-2 flex-wrap mb-5">
            {HUB_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setRoute([id])}
                className="px-2.5 py-1 rounded-lg border-2 text-[12px] font-semibold bg-white hover:bg-amber-50"
                style={{ borderColor: topicPaint(topicHueOf(id)).mark, color: topicPaint(topicHueOf(id)).mark }}
              >
                {byId.get(id)!.title}
                <span className="text-slate-400 font-normal ml-1.5">{degreeOf.get(id)} links</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-6 gap-4">
            {domainIds.map((d) => (
              <div key={d}>
                <div className="text-[11px] font-bold mb-1.5" style={{ color: topicPaint(topicHueOf(d)).mark }}>
                  {byId.get(d)!.title}
                </div>
                <div className="flex flex-col gap-1">
                  {topicsUnder(d).map((id) => (
                    <button
                      key={id}
                      onClick={() => setRoute([id])}
                      className="px-2 py-1 rounded border border-slate-200 bg-white text-left text-[11px] text-slate-600 hover:border-slate-400 hover:bg-slate-100"
                    >
                      {byId.get(id)!.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PaneScroller>
    )
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* OB-143: the row's first letter sits under the legend's — left only, by the constant */}
      <div className="shrink-0 pr-4 pt-3 pb-2 flex items-center gap-3 text-[11px] text-slate-600" style={{ paddingLeft: LEGEND_INSET }}>
        <span className="font-bold text-slate-800 text-[12px]">Walk — step-by-step downstream</span>
        <span className="text-slate-400">
          click a link to extend · click a link in an earlier column to fork there · click a step card to backtrack · ↺ marks a revisit
        </span>
        <span className="flex-1" />
        <span className="text-amber-700 font-medium">{route.length} steps</span>
        <button onClick={() => setRoute([])} className="px-2 py-0.5 rounded border border-slate-300 hover:bg-slate-100">
          ✕ clear walk
        </button>
      </div>

      <PaneScroller axis="x" forwardRef={scroller}>
        <div className="flex gap-3 px-4 pb-4 h-full items-stretch">
          {route.map((stepId, i) => {
            const choices = outgoing.get(stepId) ?? []
            const chosen = route[i + 1]
            return (
              <div key={`${i}-${stepId}`} className="w-[240px] shrink-0 flex flex-col min-h-0">
                {/* the step card — part of the amber route */}
                <button
                  onClick={() => setRoute(route.slice(0, i + 1))}
                  title={wrapTip(i < route.length - 1 ? 'backtrack to this step' : 'current tip')}
                  className={[
                    'shrink-0 rounded-lg border-2 border-amber-400 bg-amber-50 px-3 py-2 text-left',
                    i < route.length - 1 ? 'hover:bg-amber-100' : 'cursor-default',
                  ].join(' ')}
                >
                  <div className="text-[10px] font-bold text-amber-600">step {i + 1}</div>
                  {/* #97: the dot is the DS DomainDot now. Its ink moves with it —
                      a muted dot beside a saturated title reads as a bug, not as
                      two decisions. Both are topicPaint's mark. */}
                  <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: topicPaint(topicHueOf(stepId)).mark }}>
                    <DomainDot topic={topicHueOf(stepId)} size={8} />
                    {byId.get(stepId)!.title}
                  </div>
                </button>

                <div className="text-[10px] text-slate-400 mt-2 mb-1 shrink-0">
                  {choices.length === 0 ? 'no outgoing links — dead end' : `${choices.length} outgoing`}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
                  {choices.map((c) => {
                    const revisitAt = route.indexOf(c.target)
                    const isChosen = c.target === chosen
                    return (
                      <button
                        key={c.target}
                        onClick={() => setRoute([...route.slice(0, i + 1), c.target])}
                        className={[
                          'px-2 py-1.5 rounded border text-left text-[11px] flex items-center gap-1.5',
                          isChosen
                            ? 'border-amber-400 bg-amber-50 font-semibold'
                            : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        {typeChips(c.types)}
                        <span className="truncate" style={{ color: topicPaint(topicHueOf(c.target)).mark }}>
                          {byId.get(c.target)!.title}
                        </span>
                        <span className="flex-1" />
                        {revisitAt >= 0 && revisitAt <= i && (
                          <span className="text-slate-400 shrink-0" title={wrapTip(`already step ${revisitAt + 1} — topics interlink, walks can circle back`)}>
                            ↺ {revisitAt + 1}
                          </span>
                        )}
                        {isChosen && <span className="text-amber-600 shrink-0">→</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </PaneScroller>
    </div>
  )
}
