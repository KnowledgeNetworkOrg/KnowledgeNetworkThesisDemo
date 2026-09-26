import React, { useState, useRef, useMemo } from 'react'
import { NodeArrow } from './NodeArrow'
import type { NodeArrowProps } from './NodeArrow'
import { chipBorder } from './NodeChip'

/** A chain of nodes and groups — the sequence, its arrows, and its owner of order.
 *  Port of DS components/graph/NodeChain.jsx.
 *
 *  Reordering lives here rather than in the nodes: a chip that dragged itself would
 *  need to know its siblings, their sizes and their order to know where it landed,
 *  and the chain knows all three. Motion is constrained to the chain's axis. */

export interface NodeChainProps {
  /** the nodes, in order — NodeChips, VersionedGroups, or both */
  children?: React.ReactNode
  /** 'down' (default) or 'right' */
  direction?: 'down' | 'right'
  /** extra space between slots, on top of the arrow. Default 0 */
  gap?: number
  /** draw a NodeArrow in every gap. Default true */
  arrow?: boolean
  /** props forwarded to each arrow — tone, length, dashed */
  arrowProps?: Partial<NodeArrowProps>
  /** drag to reorder. Default true */
  reorderable?: boolean
  /** hand each child its position as `index` — the chain renumbers on reorder */
  number?: boolean
  /** the parent's own number, so a nested chain numbers 2.1., 2.2. under "2." — "2" and "2."
   *  number the same; every step ends in the dot (OB-245) */
  prefix?: string
  /** positions, not ids: the slot the node came from and the slot it landed on.
   *  Pass this and the caller owns the order; omit it and the chain keeps its own */
  onReorder?: (from: number, to: number) => void
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice()
  const [held] = next.splice(from, 1)
  next.splice(to, 0, held)
  return next
}

export function NodeChain({
  children, direction = 'down', gap = 0, arrow = true, arrowProps,
  reorderable = true, number: numberSteps = false, prefix = '', onReorder,
}: NodeChainProps) {
  const kids = React.Children.toArray(children).filter(React.isValidElement) as React.ReactElement<Record<string, unknown>>[]
  const down = direction !== 'right'
  const [own, setOwn] = useState<string[] | null>(null)
  const [drag, setDrag] = useState<{ at: number; d: number; to: number; size: number } | null>(null)
  const slots = useRef<(HTMLDivElement | null)[]>([])
  const arrowRef = useRef<HTMLSpanElement | null>(null)

  /* THE CHAIN TELLS EACH ARROW WHAT IT JOINS, so the connector-weight rule is not something
     anyone has to remember here. A connector is drawn at the border weight of what it
     connects and never above it; the chain places both chips, so it can read the `mark` off
     them — the same look at a child's props it already does for `index` — and settle the
     weight itself. An explicit `arrowProps.joins` wins: a caller who knows better than the
     inference is rare but real (a chain of wrappers around chips).
     TWO SIGNALS, IN ORDER OF HOW SPECIFIC THEY ARE. `props.mark` is the exact form this child
     renders, so it wins. `type.joinBorder` is the component's own declaration of what its
     edge weighs, which is how a child that is NOT one of our chips answers at all — a
     `VersionedGroup` card, or anything else that declares one. A chip with no explicit `mark`
     has no useful prop and falls through to `NodeChip.joinBorder` for the default form's
     weight. Neither present: undefined, and the arrow keeps its own default. */
  const joinWeightOf = (kid: React.ReactElement<Record<string, unknown>> | undefined) => {
    if (!kid) return undefined
    if (kid.props && typeof kid.props.mark === 'string') return chipBorder(kid.props.mark)
    const t = kid.type as { joinBorder?: number }
    if (t && typeof t.joinBorder === 'number') return t.joinBorder
    return undefined
  }

  /* ONE WEIGHT FOR THE WHOLE CHAIN — the LIGHTEST member's edge, not each gap's own pair.
     The arrows are the chain's fixed scaffolding (they do not travel with a dragged node),
     so they read as one line interrupted by nodes; a mixed column computed per gap gives
     1.5 · 1.25 · 1.5 down a single axis, which reads as a rendering fault rather than as
     three considered weights. The same reason the chain owns one arrow LENGTH. Lightest,
     because "never above what it connects" has to hold for every arrow in the column, and
     only the lightest member satisfies all of them at once.
     NOT AN AVERAGE — the obvious improvement, and wrong three times over. (1) A mean matches
     nothing on screen: 1px and two 2px members give ~1.7, and there is no 1.7 border in the
     picture, so the line stops matching anything the eye can check. (2) Too light is a small
     harm and too heavy is the fault being avoided — with the minimum, arrows beside the
     heavier members are thinner than they could be and still read as connectors; with a mean
     the two arrows touching the LIGHT member outweigh it, which is the original defect
     localised to one gap. (3) A mean is unstable under editing, and this chain is editable:
     delete one node and every arrow's weight changes with no cause a user can see, where the
     minimum only moves when the lightest member itself leaves. */
  const chainJoins = (() => {
    if (arrowProps && arrowProps.joins !== undefined) return arrowProps.joins
    let min: number | undefined
    kids.forEach((kid) => {
      const w = joinWeightOf(kid)
      if (w !== undefined && (min === undefined || w < min)) min = w
    })
    return min
  })()

  const keys = kids.map((kid, i) => (kid.key != null ? String(kid.key) : 'i' + i))

  const view = useMemo(() => {
    if (!own) return kids.map((_, i) => i)
    const kept = own.filter((key) => keys.indexOf(key) !== -1)
    keys.forEach((key, i) => { if (kept.indexOf(key) === -1) kept.splice(Math.min(i, kept.length), 0, key) })
    return kept.map((key) => keys.indexOf(key))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, keys.join('\x00')])

  /* A STEP NUMBER ALWAYS ENDS IN A DOT, whatever the prefix was spelt like (DS OB-245,
     2026-09-21). The dot used to be inherited from the prefix — `prefix="2."` gave `2.1.`,
     `prefix="2"` gave `2.1` — which put the caller's typing in charge of a notation the reader
     compares across a whole card: a `VersionedGroup` head reading `2` over chips reading `2.1.`
     is one level in two schemes, the fault the local-numbering default exists to remove. Both
     spellings now draw `2.1.`. */
  const base = prefix ? String(prefix).trim().replace(/\.$/, '') + '.' : ''
  const stepOf = (i: number) => base + (i + 1) + '.'

  const startDrag = (at: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!reorderable || e.button !== 0) return
    const target = e.target as HTMLElement
    // a press on a control is that control's, never the chain's. [contenteditable="true"]
    // added under OB-081: a select-drag inside an editing VersionedGroup title,
    // description or version name was read as the start of a reorder instead.
    if (target.closest && target.closest('button, input, textarea, select, a, [role="listbox"], [contenteditable="true"]')) return
    const boxes = slots.current.map((el) => el && el.getBoundingClientRect())
    if (!boxes[at]) return
    const centers = boxes.map((b) => (b ? (down ? b.top + b.height / 2 : b.left + b.width / 2) : 0))
    const arrowBox = arrowRef.current && arrowRef.current.getBoundingClientRect()
    const arrowSize = arrow ? (arrowBox ? (down ? arrowBox.height : arrowBox.width) : 22) : 0
    const box = boxes[at]!
    const size = (down ? box.height : box.width) + arrowSize + gap
    const start = down ? e.clientY : e.clientX
    let state = { at, d: 0, to: at, size }
    setDrag(state)
    /* NO POINTER CAPTURE — capturing on pointerdown retargets the ensuing click to the
       capturing element, so a click on a chip inside a chain never reached the chip; the
       press read as a zero-distance drag instead, and nothing errored to say so. Window
       listeners give what capture was for (the drag survives leaving the slot) and leave
       the click alone. Fixed under OB-084. */
    const move = (ev: PointerEvent) => {
      const d = (down ? ev.clientY : ev.clientX) - start
      const mid = centers[at] + d
      let to = at
      let best = Infinity
      centers.forEach((c, i) => { const gapTo = Math.abs(c - mid); if (gapTo < best) { best = gapTo; to = i } })
      state = { at, d, to, size }
      setDrag(state)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (state.to !== state.at) {
        if (onReorder) onReorder(state.at, state.to)
        else setOwn(reorder(view.map((n) => keys[n]), state.at, state.to))
      }
      setDrag(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const shiftOf = (i: number) => {
    if (!drag || i === drag.at) return 0
    if (drag.at < drag.to && i > drag.at && i <= drag.to) return -drag.size
    if (drag.to < drag.at && i >= drag.to && i < drag.at) return drag.size
    return 0
  }

  return (
    <div style={{
      display: 'flex', flexDirection: down ? 'column' : 'row',
      alignItems: 'center', gap,
    }}>
      {view.map((k, i) => {
        const kid = kids[k]
        const held = drag && drag.at === i
        const off = held ? drag.d : shiftOf(i)
        const numbered = numberSteps && kid && typeof kid.type === 'function' && kid.props.index === undefined
          ? React.cloneElement(kid, { index: stepOf(i) })
          : kid
        return (
          <React.Fragment key={kid.key || k}>
            {arrow && i > 0 ? (
              <span ref={i === 1 ? arrowRef : undefined}
                style={{ display: 'flex', justifyContent: 'center', pointerEvents: 'none', flexShrink: 0 }}>
                {/* THE ARROW INTO AN OPTIONAL STEP DASHES, and the chain decides it so no call
                    site has to remember. Read off the member this gap leads INTO — dashed
                    means conditional, and what is conditional is the step being ARRIVED AT,
                    not the line as a whole. That is why this is per gap while the WEIGHT is
                    one number for the whole chain: the weight is a fact about the line (one
                    interrupted line, one thickness), the dash is a fact about a destination.
                    Reading it off the member also means a REORDER re-dashes the right gaps by
                    itself. An explicit `arrowProps.dashed` still wins, since the spread comes
                    after — but a call site should not pass it for an optional STEP: that prop
                    dashes every gap, which is right for a whole conditional sequence and
                    wrong for one step inside a solid one. */}
                <NodeArrow direction={down ? 'down' : 'right'} joins={chainJoins}
                  dashed={!!(kid && kid.props && kid.props.optional)} {...arrowProps} />
              </span>
            ) : null}
            <div
              ref={(el) => { slots.current[i] = el }}
              onPointerDown={startDrag(i)}
              style={{
                display: 'flex', flexDirection: down ? 'column' : 'row',
                alignItems: 'center',
                cursor: reorderable ? 'move' : undefined,
                transform: (down ? 'translateY(' : 'translateX(') + off + 'px)',
                transition: held ? 'none' : 'transform var(--dur-move) var(--ease-settle)',
                zIndex: held ? 30 : 1, position: 'relative',
                touchAction: reorderable ? 'none' : undefined,
              }}>
              {numbered}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
