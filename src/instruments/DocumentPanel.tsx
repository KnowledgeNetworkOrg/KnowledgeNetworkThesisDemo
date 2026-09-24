// Document — the current node's document (named KnowledgePanel.tsx until
// 2026-08-20). Reading happens here;
// the other instruments are for moving. The one navigation aid left is "Walks
// through here" — walks-as-content, made visible instead of staying implicit
// history. The radial neighborhood diagram that used to sit above the lists is
// now its own Studio instrument (NeighborhoodPanel) — compose them side by side.
//
// NAVIGATION LISTS ARE NOT HERE (2026-07-14). "Roads from here" (typed
// relations) left first, then "Contained" (the child list) followed it; both
// duplicated the Connections pane row for row. Relationships AND containment now
// have exactly ONE home — Connections — where a graph reading (star / wheel) and
// a list reading sit together and hover binds them. The document pane reads; it
// does not also index the graph or the tree.
//
// Walks only resolve for topics: a Walk's stops are always topic ids (see
// walks.ts) — nodes above the topic level (domains, modules) and below it
// (deep layers) just show the document, which is honest: that IS all they have.

import { useSyncExternalStore } from 'react'

import { DocHeader, LEGEND_INSET, SectionLabel, WalkCard } from '@/ds'

import { byId, pathTo, ROOT_ID, topicHueOf } from '../corpus/graph'
import { DOC_BODY } from '../corpus/docs'
import { listWalks, subscribeWalks } from '../model/walkstore'
import type { Bus } from '../state/bus'

export default function DocumentPanel({ bus }: { bus: Bus }) {
  const currentId = bus.focus ?? ROOT_ID
  const onActivateWalkAtStop = bus.activateWalk

  const n = byId.get(currentId)!
  const ancestry = pathTo(currentId)
    .map((id) => byId.get(id)!.title)
    .join(' / ')
  // #16: authored walks count as walks through here too — that is the whole
  // point of a desk that can save one.
  const walks = useSyncExternalStore(subscribeWalks, listWalks)
  const throughWalks = walks.flatMap((w) => {
    const idx = w.stops.findIndex((s) => s.id === currentId)
    return idx >= 0 ? [{ walk: w, idx }] : []
  })

  return (
    <div aria-label="document-panel">
      <DocHeader kind={n.topic ? 'topic' : n.kind} title={n.title} domain={topicHueOf(currentId) ?? ''} ancestry={ancestry} />

      {/* OB-143: the body's text starts under the legend's first letter — LEFT only, by the
          constant. The right padding is the scrollbar's and stays. DocHeader above pads its
          own --space-5 (20) and is not touched: it is a DS component, and 20 against 21 is
          inside the clause's ±1px. */}
      <div className="pr-4 py-3 text-[12px] leading-relaxed text-slate-700 border-b border-slate-100" style={{ paddingLeft: LEGEND_INSET }}>{DOC_BODY[currentId]}</div>

      <div className="pr-4 py-3" style={{ paddingLeft: LEGEND_INSET }}>
        <SectionLabel count={throughWalks.length}>walks through here</SectionLabel>
        {throughWalks.length === 0 ? (
          <div className="text-[11px] text-slate-400">no authored walk stops here</div>
        ) : (
          <div className="flex flex-col gap-1">
            {throughWalks.map(({ walk, idx }) => (
              <WalkCard
                key={walk.id}
                title={walk.title}
                meta={`stop ${idx + 1} of ${walk.stops.length} — ${walk.stops[idx].note}`}
                onClick={() => onActivateWalkAtStop(walk.id, idx)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
