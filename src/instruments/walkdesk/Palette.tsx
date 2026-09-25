// The supply pane (#28) — a ranked SEARCH over the whole corpus, whose empty
// state is your recent searches. It used to be a chip cloud of the 53 flagged
// topics (7% of the graph, hand-picked); now every one of the 753 nodes is
// reachable by typing, and `n.topic` is a ranking BOOST, not a gate.
//
// Putting a stop on the road is ALWAYS an explicit gesture: drag a hit onto the
// walk editor (the `pal:<nodeId>` feed the road and the map already speak), or hit
// the row's + to append it to the end. A plain click never drops a stop — it
// SELECTS the hit on the map instead: the camera flies to its territory and
// lights it as the selection, so search and map stay in sync (#28). Acting on a
// hit — select, +, or a landed drag — clears the box, collapsing the list back
// to recents.
//
// The keyboard drives it like google-maps' search: ↓/↑ walk the hit list, Enter
// is a click on the highlighted row (select on the map), Esc cancels back to
// recents. The list is never off the keyboard's reach — the box keeps focus and
// the highlighted row is the one Enter acts on.
//
// Recents hold the TITLE of the node a search resolved to, not the raw keystrokes
// — you searched "encrpytion", you meant "Symmetric Encryption", so that clean
// term is what comes back (and re-runs cleanly, since a title prefix-matches its
// own node). A recent is also a DRAG SOURCE: it resolves its title back to that
// node and feeds the road the same `pal:<id>`, so a search you already ran is one
// drag from the road. In-memory for now; persistence rides on #16.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { DomainDot, IconButton, PaneScroller, wrapTip } from '@/ds'
import { byId, nodes, pathTo } from '../../corpus/graph'
import { topicHueOf } from '../../corpus/graph'
import type { AuthorState } from '../../state/walk/authordraft'
import { DT } from '../../state/walk/authordnd'
import type { HoverBinding } from '../../state/bus'

// ── Recent searches — a module-level ring so it survives a remount within the
// session (the pane can unmount when the preset changes). Last ~8, most recent
// first, case-insensitively de-duplicated (a repeat moves to the front).
const MAX_RECENTS = 8
let recents: string[] = []
const recentSubs = new Set<() => void>()
function pushRecent(raw: string) {
  const s = raw.trim()
  if (!s) return
  recents = [s, ...recents.filter((r) => r.toLowerCase() !== s.toLowerCase())].slice(0, MAX_RECENTS)
  for (const fn of recentSubs) fn()
}
// Forget one recent — the chip's ✕. Case-insensitive so it drops the entry no
// matter how it was cased when saved.
function removeRecent(term: string) {
  const t = term.toLowerCase()
  recents = recents.filter((r) => r.toLowerCase() !== t)
  for (const fn of recentSubs) fn()
}
function useRecents(): string[] {
  return useSyncExternalStore(
    (fn) => (recentSubs.add(fn), () => recentSubs.delete(fn)),
    () => recents,
  )
}

// ── Breadcrumb — the containment path to a node, minus the root and the node
// itself, as a "Domain › Module › Topic" trail. Cached: pathTo is cheap but we
// touch it for every candidate on every keystroke.
const crumbCache = new Map<string, string>()
function breadcrumb(id: string): string {
  let s = crumbCache.get(id)
  if (s === undefined) {
    s = pathTo(id)
      .slice(1, -1)
      .map((pid) => byId.get(pid)!.title)
      .join(' › ')
    crumbCache.set(id, s)
  }
  return s
}

// ── Ranking — title-prefix beats title-substring beats breadcrumb-substring;
// a topic gets a boost within its tier; shallower nodes win ties. Non-matches
// score -1 and drop out.
function score(id: string, ql: string): number {
  const n = byId.get(id)!
  const t = n.title.toLowerCase()
  let base: number
  if (t.startsWith(ql)) base = 3
  else if (t.includes(ql)) base = 2
  else if (breadcrumb(id).toLowerCase().includes(ql)) base = 1
  else return -1
  return base + (n.topic ? 0.5 : 0)
}

// Resolve a recent's TITLE back to the node it names, so a history chip can be
// dragged onto the road just like a live hit. Same ranking the list uses, so the
// chip drops the very node clicking-then-top would: a title prefix-matches its
// own node (score 3), and the shallower node wins a tie — the identical rule the
// hits sort applies. O(nodes), but only on dragstart.
function nodeForTerm(term: string): string | undefined {
  const ql = term.trim().toLowerCase()
  if (!ql) return undefined
  let best: string | undefined
  let bestScore = -1
  let bestDepth = Infinity
  for (const n of nodes) {
    const s = score(n.id, ql)
    if (s < 0) continue
    const depth = pathTo(n.id).length
    if (s > bestScore || (s === bestScore && depth < bestDepth)) {
      best = n.id
      bestScore = s
      bestDepth = depth
    }
  }
  return best
}

const MAX_HITS = 40

export default function Palette({
  state,
  sync,
  onSelect,
  onMatches,
}: {
  state: AuthorState
  sync: HoverBinding
  onSelect: (id: string) => void
  /** publish the current hit set to the map (#25). Empty set = no live query. */
  onMatches: (ids: ReadonlySet<string>) => void
}) {
  const [q, setQ] = useState('')
  // The keyboard-highlighted row — the one Enter acts on. Reset to the top hit
  // on every keystroke (onChange), clamped to the current list below so a
  // shrinking result set can never leave it pointing past the end.
  const [active, setActive] = useState(0)
  const recent = useRecents()
  const ql = q.trim().toLowerCase()

  const hits = useMemo(() => {
    if (!ql) return []
    return nodes
      .map((n) => ({ id: n.id, s: score(n.id, ql), depth: pathTo(n.id).length }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || a.depth - b.depth || byId.get(a.id)!.title.localeCompare(byId.get(b.id)!.title))
      .slice(0, MAX_HITS)
      .map((r) => r.id)
  }, [ql])

  const activeIdx = hits.length ? Math.min(active, hits.length - 1) : 0

  // Publish the hit set to the map (#25) — typing lights the matches on the
  // territory, an empty query (hits === []) clears them. hits is memoized per
  // query, so this fires once per query change, not per keystroke-render.
  useEffect(() => {
    onMatches(new Set(hits))
  }, [hits, onMatches])
  // and clear the map when this pane goes away — switching off the Plan
  // preset must not strand pins on a map that no longer has a search beside it.
  useEffect(() => () => onMatches(new Set()), [onMatches])

  // A search RESOLVED to a node: record its clean title (not the typo'd query)
  // and collapse the list back to recents. Used by every commit path.
  const noteResolved = (id: string) => {
    pushRecent(byId.get(id)!.title)
    setQ('')
  }
  // + appends the hit to the LAST position of the road, then resolves. Explicit,
  // and always the end — the pane never guesses a caret the way insertNode's
  // selection-relative default would.
  const appendToRoad = (id: string) => {
    state.insertNode(id, [state.stops.length])
    noteResolved(id)
  }
  // A plain row click SELECTS the hit on the map — WalkPaletteView wires onSelect to
  // focus + look, so the map flies to the node's territory and lights it as the
  // selection. Selecting resolves the search like the other commit paths (record
  // the clean title, collapse to recents). It never drops a stop on the road:
  // that stays the + button's and a drag's job, so an inspect is never an insert.
  const selectOnMap = (id: string) => {
    onSelect(id)
    noteResolved(id)
  }

  return (
    <div className="min-w-0 flex flex-col">
      <div className="shrink-0 px-2 py-1.5 border-b border-slate-100">
        <div className="text-[10px] font-bold text-slate-500 mb-1">search the corpus — drag a hit onto the road, or + to append</div>
        <input
          data-pal-search
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            // google-maps keys: ↓/↑ move the highlight (preventDefault so the
            // text caret doesn't jump instead), Enter clicks the highlighted row
            // — the exact selectOnMap a mouse click runs, so it flies the map and
            // resolves the search — and Esc cancels back to recents.
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, hits.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              if (hits.length) selectOnMap(hits[activeIdx])
            } else if (e.key === 'Escape') {
              setQ('')
              e.currentTarget.blur()
            }
          }}
          placeholder="search 753 nodes…"
          className="w-full text-[11px] px-1.5 py-0.5 rounded border border-slate-200 outline-none focus:border-sky-400"
        />
      </div>

      <PaneScroller style={{ padding: '4px 0', maxHeight: '42vh' }}>
        {!ql ? (
          <RecentsEmptyState recent={recent} onPick={setQ} onForget={removeRecent} />
        ) : hits.length === 0 ? (
          <div className="px-2 py-3 text-[11px] text-slate-400">no node matches “{q.trim()}”.</div>
        ) : (
          <div className="px-1.5">
            {hits.map((id, i) => {
              const n = byId.get(id)!
              const crumb = breadcrumb(id)
              const on = i === activeIdx
              return (
                // The row is a DRAG HANDLE that also selects on click — a plain
                // click flies the map to this hit and lights it (selectOnMap),
                // but never inserts a stop. Dragging feeds `pal:<id>` to the
                // road/map; a drop that landed (dropEffect set) resolves like +.
                // `on` is the keyboard highlight — the row Enter acts on — and it
                // scrolls itself into view as ↓/↑ walk past the fold.
                <div
                  key={id}
                  ref={on ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  {...sync.bind(id)}
                  data-pal={id}
                  data-pal-active={on ? '' : undefined}
                  draggable
                  onClick={() => selectOnMap(id)}
                  onDragStart={(e) => e.dataTransfer.setData(DT, 'pal:' + id)}
                  onDragEnd={(e) => {
                    if (e.dataTransfer.dropEffect !== 'none') noteResolved(id)
                  }}
                  className={[
                    'group w-full flex items-start gap-1.5 px-1.5 py-1 rounded cursor-grab',
                    on
                      ? 'bg-sky-100 ring-1 ring-sky-300'
                      : sync.lit(id)
                        ? 'ring-2 ring-sky-300 bg-white'
                        : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  {/* #97: the DS DomainDot. It sizes itself, so the wrapper keeps
                      only the optical nudge that lines the dot up with the first
                      line of a two-line hit. */}
                  <span className="mt-1 inline-flex shrink-0">
                    <DomainDot topic={topicHueOf(id)} size={6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] leading-tight text-slate-800 truncate">{n.title}</span>
                    {crumb && <span className="block text-[9px] leading-tight text-slate-400 truncate">{crumb}</span>}
                  </span>
                  <button
                    data-pal-add={id}
                    onClick={(e) => {
                      // + is a ROAD gesture, not a map one — keep it from
                      // bubbling into the row's select-on-map click.
                      e.stopPropagation()
                      appendToRoad(id)
                    }}
                    title={wrapTip('append to the end of the road')}
                    className="shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center rounded text-[13px] leading-none text-slate-300 hover:bg-sky-100 hover:text-sky-600"
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </PaneScroller>
    </div>
  )
}

// The empty state IS the value: your own path back to a search you just ran.
function RecentsEmptyState({
  recent,
  onPick,
  onForget,
}: {
  recent: string[]
  onPick: (q: string) => void
  onForget: (term: string) => void
}) {
  if (recent.length === 0) {
    return (
      <div className="px-2 py-3 text-[11px] text-slate-400 leading-relaxed">
        Type to search every node in the corpus. Your recent searches will collect here.
      </div>
    )
  }
  return (
    <div className="px-2 pt-1">
      <div className="text-[9.5px] uppercase tracking-wide font-semibold text-slate-400 py-0.5">
        recent searches — drag onto the road
      </div>
      <div className="flex flex-wrap gap-1 pt-0.5">
        {recent.map((r) => (
          // The chip is a container, not a button — the term re-runs the search,
          // the ✕ forgets it. Nesting a button in a button is invalid, so both
          // are siblings inside a bordered span that plays the chip's part. The
          // span is also the DRAG HANDLE: it resolves its title back to a node
          // (nodeForTerm) and feeds the road the same `pal:<id>` a hit row does,
          // so a search you already ran drags straight onto the road. If the
          // title no longer resolves, the drag is cancelled rather than empty.
          <span
            key={r}
            data-pal-recent={r}
            draggable
            onDragStart={(e) => {
              const id = nodeForTerm(r)
              if (!id) {
                e.preventDefault()
                return
              }
              e.dataTransfer.setData(DT, 'pal:' + id)
            }}
            onDragEnd={(e) => {
              // A landed drag freshens the recent — same "acting on it moves it
              // to the front" the commit paths get.
              if (e.dataTransfer.dropEffect !== 'none') pushRecent(r)
            }}
            className="group inline-flex items-center rounded border border-slate-200 bg-slate-50 text-[10.5px] text-slate-600 hover:bg-white cursor-grab"
          >
            <button
              data-pal-recent-run={r}
              onClick={() => onPick(r)}
              className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5"
            >
              <span className="text-slate-300">↻</span>
              {r}
            </button>
            <IconButton tone="danger" size={16} onClick={() => onForget(r)} title="forget this search" />
          </span>
        ))}
      </div>
    </div>
  )
}
