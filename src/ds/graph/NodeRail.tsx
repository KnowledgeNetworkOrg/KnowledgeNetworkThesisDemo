import { useState } from 'react'
import type { ReactNode } from 'react'
import { NodeChip } from './NodeChip'
import { CaretStack } from '../nav/TreeRow'
import { IconButton, wrapTip } from '../chrome/IconButton'

/** THE RAIL'S GEOMETRY, published rather than described — the group's and the chip's own
 *  pattern. A host that has to align anything to the rail (a marker in the gutter, a
 *  ruler, a second column) reads these instead of re-typing them, and the RENDERER below
 *  reads them too, so a change lands in the drawing and in any caller's arithmetic
 *  together or not at all.
 *
 *  `rung` is where the stub crosses to the chip, measured from the top of the stop, and
 *  it is deliberately NOT recomputed for a wrapped chip — the rung meets the chip's FIRST
 *  line, which is the line the name starts on at any length. `spineLeft` is shared by the
 *  head's own leader stub, which is why the two line up without either knowing about the
 *  other.
 *
 *  Port of DS components/graph/NodeRail.jsx. THIS PORT HAS NO HOST YET: the Connections
 *  pane (src/studio/instruments.tsx) has no railroad form — that is the remaining half of
 *  #97 — so NodeRail stays un-rendered until it lands (tracked in src/ds/barrel.test.ts,
 *  same wait EdgeEntry is already in). */
export const RAIL_METRICS = {
  railX: 26,
  spine: 2,
  rung: 22,
  spineLeft: 8,
  /** the acts' box — 20, CHOSEN rather than derived: `IconButton`'s own default is 18, and
   *  the pair above the head takes 20 so two stacked 6px marks and their 1px gap sit in it
   *  without crowding the button's edge. This said "the same 20px IconButton uses" until
   *  now, which was simply false (OB-052). Both call sites below pass it explicitly, which
   *  is what makes it a choice rather than an inheritance. Stops no longer draw a caret of
   *  their own: the chip carries the disclosure mark. */
  caretSlot: 20,
  pairGap: 4,
  countMin: 16,
  rowGap: 10,
}

export interface RailStopProps {
  /** the neighbour's name. It WRAPS — a stop has to fit the pane it is in */
  title: string
  /** optional on this contract, matching the DS's own — `NodeChip`'s own fallback swatch
   *  covers an absent domain the same way the DS's untyped JS does */
  domain?: string
  /** how many relationships run between this neighbour and the focus. The one number the
   *  closed row offers, so it sits in a fixed 16px column with --tnum: a 1 and a 12 must
   *  not move the caret beside them */
  count: number
  /** the well is showing. Lights BOTH things the row offers — see `RailStop`'s docblock.
   *  Every stop heads a disclosure unconditionally, so this is only the position */
  open?: boolean
  /** the row is the control, not the chip: a click anywhere on it toggles */
  onToggle?: () => void
  /** the last stop's spine ends at its own rung instead of running to the bottom of the
   *  stop — on an open stop that bottom is half a well away, so without this the rail
   *  runs down past the end of itself */
  last?: boolean
  /** what the opened well holds. The CALLER's, always: which edges exist and how they
   *  read is corpus knowledge, not drawing */
  children?: ReactNode
  /** tooltip on the chip; the row already titles itself with the count and the act */
  note?: string
  /** the chip's form. 'border' by default */
  mark?: 'dot' | 'border' | 'border-2' | 'none'
  /** cross-pane correspondence, passed through to the chip */
  lit?: boolean
  /** off the resolved path, passed through to the chip */
  dim?: boolean
}

/** ONE STOP ON THE RAIL: a neighbour hanging off the line, with the two things a closed
 *  row offers — how many relationships run to it, and a way to open them.
 *
 *  OPENING LIGHTS EVERYTHING THE ROW OFFERS, each in the channel that has room. The
 *  caret rests at --text-3, a hint, so INK carries it (`NodeChip open`). The count rests
 *  at --text-2 — one step inside the body range is a change you can measure and cannot
 *  see, so WEIGHT carries it instead: --fw-regular → --fw-medium. Never --fw-semibold on
 *  the numeral — `fonts.css` loads JetBrains Mono at 400 and 500 only, so 600 renders at
 *  500 anyway, and weight PLUS ink would be two steps, the count shouting over the caret
 *  beside it. A row that lights half its pair reads as one that has not finished
 *  rendering. THE COUNT'S COLUMN IS FIXED (`--tnum`, a reserved 16px), so nothing in the
 *  row moves when the number changes.
 *
 *  THE OPEN STATE IS `NodeChip.open`, NOT A THICKENED BORDER AND NOT ELEVATION. A 1px →
 *  1.5px border on open is a bet this system has already lost — a chip's border WEIGHT
 *  is read back by `NodeChain`/`NodeArrow` through `chipBorder`, so thickening it here
 *  would re-weight any chain drawn through an open stop. Three more attempts drew the
 *  state in elevation and all three were invisible — `elevation.css`'s shadows are
 *  deliberately soft and low-contrast, and no rung of that ladder shows on a 28px pill.
 *  The mark is the state. */
export function RailStop({
  title, domain, count, open = false, onToggle, last, children, note,
  mark = 'border', lit, dim,
}: RailStopProps) {
  const [hov, setHov] = useState(false)
  const M = RAIL_METRICS
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0 }}>
      {/* the spine is ONE LINE down the whole stop. The LAST stop's spine ends at its own
          rung rather than at a share of the stop's height — on an open stop that share is
          half a well's worth, so the rail would run down past the end of itself. */}
      <div style={{ width: M.railX, flex: 'none', position: 'relative' }}>
        <span style={{ position: 'absolute', left: M.spineLeft, top: 0, height: last ? M.rung + M.spine : '100%', width: M.spine, background: 'var(--border-rule)' }} />
        <span style={{ position: 'absolute', left: M.spineLeft, top: M.rung, width: M.railX - M.spineLeft, height: M.spine, background: 'var(--border-rule)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: open ? 'var(--space-2)' : 0 }}>
        <button type="button" onClick={onToggle}
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          onFocus={() => setHov(true)} onBlur={() => setHov(false)}
          aria-expanded={!!open}
          title={wrapTip((open ? 'click to collapse · ' : 'click to expand · ') + count + (count === 1 ? ' edge' : ' edges'))}
          style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: M.rowGap, padding: '5px 0 5px 2px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
          {/* `wrap` so a stop fits the pane it is in. No `onClick` on the chip — the whole
              ROW is the button, and a handler here too would fire once on the chip and
              again on the row it bubbles to. The wash comes from `hovered` instead, since
              the row is what the pointer is actually on. `disclosable` is unconditional:
              every stop on a rail heads a disclosure, and the open/closed position is the
              row's own state. */}
          <NodeChip title={title} domain={domain} mark={mark} wrap disclosable open={open} hovered={hov} lit={lit} dim={dim} note={note} />
          <span style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: M.pairGap }}>
            <span style={{ flex: 'none', minWidth: M.countMin, textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-body)', fontWeight: open ? 'var(--fw-medium)' : 'var(--fw-regular)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)', transition: 'font-weight var(--dur-move) var(--ease-soft)' }}>{count}</span>
          </span>
        </button>
        {/* the opened detail is CONTAINED — the system's grammar for a group, and the
            same recess the chip above it now takes. The chip heads the well; the well is
            what came out of it. */}
        {open ? (
          <div style={{ marginTop: 4, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', background: 'var(--surface-sunken)', boxShadow: 'var(--sink-1)', borderRadius: 'var(--radius-lg)', minWidth: 0 }}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export interface RailStopSpec {
  id: string
  title: string
  domain?: string
  count: number
  note?: string
  lit?: boolean
  dim?: boolean
  mark?: 'dot' | 'border' | 'border-2' | 'none'
  /** the well's contents for this stop, if not supplied by `renderBody` */
  body?: ReactNode
  /** EXTRA KEYS PASS THROUGH UNTOUCHED and arrive at `renderBody`, which is how a caller
   *  carries its own row object (its corpus node, its edge lists) without the rail
   *  knowing anything about it. The component reads only the keys above. */
  [key: string]: unknown
}

export interface NodeRailProps {
  /** the focus node's name — the head the whole rail hangs from. Drawn as a
   *  `NodeChip mark="border" focus`, inside a real <button>: the chip does the drawing,
   *  the button owns the click and the keyboard */
  title: string
  /** the focus node's domain */
  domain?: string
  /** the neighbours, in the order they should read. A FLAT LIST, laid out in flow:
   *  unlike a board of cards there is nothing here to place */
  stops?: RailStopSpec[]
  /** which stops are open, as a map keyed by id. A SET rather than one id, because
   *  comparing two neighbours means having both open at once — a rail that closed one
   *  stop to open another made you hold the first in your head */
  open?: Record<string, unknown>
  onToggleStop?: (id: string) => void
  /** the whole rail folds under its head */
  railOpen?: boolean
  onToggleRail?: () => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  /** the rail's own line, above the head: what it totals. A ReactNode, because what
   *  counts as a total is the caller's question — neighbours, edges, or both */
  totals?: ReactNode
  /** shown in place of the stops when there are none. Say what is absent and why, not
   *  "no results": a container with nothing linking out of it is a different fact from a
   *  topic with no typed links */
  emptyLabel?: ReactNode
  /** the well's contents, per stop. Use this rather than `spec.body` when the body is
   *  expensive to build — it is only called for stops that are open */
  renderBody?: (stop: RailStopSpec) => ReactNode
}

/** THE NEIGHBOURHOOD AS A RAILROAD: the focus at the head of a line, every neighbour
 *  hanging off it as a stop, and the rung carrying the one number that matters at rest —
 *  how many relationships run between the two.
 *
 *  IT SCALES IN THE ONLY DIRECTION A PANE CAN AFFORD TO GROW. A hundred neighbours is a
 *  longer rail, not a denser one: nothing shares a row, so nothing overlaps at any count.
 *  A caller does NOT position stops — unlike a board of cards there is nothing here to
 *  place, so the component takes a flat `stops` array and lays it out in flow.
 *
 *  WHAT THE CALLER KEEPS: which neighbours exist at all (an edge joins the rail when
 *  exactly one end is inside the focus's subtree — corpus logic, not drawing), the open
 *  SET, and what goes inside an opened well.
 *
 *  THE ACTS RESERVE THEIR SPACE, inside the component rather than asked of a host. They
 *  are `IconButton reveal`, which hides a control WITHOUT unmounting it: it keeps its
 *  box, so nothing reflows when it arrives. Rendered conditionally they made this row
 *  16.2px closed and 20px open, moving the head pill out from under a cursor that had
 *  just clicked it.
 *
 *  THE HEAD IS A `NodeChip focus`, in a real <button>: the chip draws, the button owns
 *  the click and the keyboard — a chip with its own `onClick` is a span, which answers a
 *  pointer and not the Enter key. Its caret comes from `open`, like every other
 *  disclosure in the app. */
export function NodeRail({
  title, domain, stops = [], open = {}, onToggleStop,
  railOpen = true, onToggleRail, onExpandAll, onCollapseAll,
  totals, emptyLabel = 'nothing links outside this', renderBody,
}: NodeRailProps) {
  const [headHot, setHeadHot] = useState(false)
  const M = RAIL_METRICS
  const acts = !!stops.length
  // OB-072: the two head acts stay full-strength once they have nothing left to do
  // ("expand all" fully lit with every stop already open) — disabled, not reveal,
  // since the act is still relevant here, just out of work.
  const allOpen = acts && stops.every((s) => open[s.id])
  const allClosed = acts && stops.every((s) => !open[s.id])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {totals ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)' }}>{totals}</span> : null}
          <span style={{ marginLeft: 'auto', flex: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* the house nesting pair: the SAME disclosure mark said twice, one level up
                from a single stop's caret — two pointing down for expand all, two up for
                collapse all, so the pair cannot read as a new icon */}
            <IconButton size={M.caretSlot} reveal={railOpen && acts} disabled={allOpen} title="expand all" onClick={onExpandAll}>
              <CaretStack />
            </IconButton>
            <IconButton size={M.caretSlot} reveal={railOpen && acts} disabled={allClosed} title="collapse all" onClick={onCollapseAll}>
              <CaretStack up />
            </IconButton>
          </span>
        </span>
        {/* THE HEAD IS A `NodeChip focus`, not a hand-drawn pill. The BUTTON stays: the
            same shape as `RailStop` — a real <button> owning the click and the keyboard,
            with the chip inside it drawing and taking the row's hover through `hovered`. */}
        <button type="button" onClick={onToggleRail}
          onMouseEnter={() => setHeadHot(true)} onMouseLeave={() => setHeadHot(false)}
          onFocus={() => setHeadHot(true)} onBlur={() => setHeadHot(false)}
          aria-expanded={!!railOpen}
          title={wrapTip(railOpen ? 'click to collapse the rail' : 'click to expand the rail')}
          style={{ alignSelf: 'flex-start', maxWidth: '100%', minWidth: 0, display: 'flex', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
          <NodeChip title={title} domain={domain} mark="border" wrap focus disclosable open={railOpen} hovered={headHot} />
        </button>
        {/* the rail LEAVES the head: without this stub the focus is just another chip in
            the stack. Structure says "everything below hangs off this" more quietly than
            any decoration on the chip would. */}
        {railOpen && acts ? <span style={{ flex: 'none', width: M.spine, height: 'var(--space-2)', marginLeft: M.spineLeft, marginTop: -6, background: 'var(--border-rule)' }} /> : null}
      </div>
      <div style={{ minWidth: 0 }}>
        {!acts ? (
          <div style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', paddingTop: 'var(--space-2)' }}>{emptyLabel}</div>
        ) : railOpen ? stops.map((s, i) => (
          <RailStop key={s.id} title={s.title} domain={s.domain} count={s.count} note={s.note}
            lit={s.lit} dim={s.dim} mark={s.mark}
            last={i === stops.length - 1} open={!!open[s.id]}
            onToggle={() => onToggleStop && onToggleStop(s.id)}>
            {renderBody ? renderBody(s) : s.body}
          </RailStop>
        )) : null}
      </div>
    </div>
  )
}
