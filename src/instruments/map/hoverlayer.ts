// THE MAP'S HOVER LAYER (#399 cut 3) — the deciding half of the hover,
// spotlight and tooltip drawing, moved out of MapView whole: which cell the
// cursor's dashed preselect outlines, which cell another pane's hover lights
// (and the look's), whether the cursor's position is worth tracking, and the
// hovered node's own relation counts for the card. The drawing is
// `MapHover.tsx` and `MapTooltipCard.tsx`; the one decision is
// `model/maphover.ts`.
//
// It is called where `hoverOutline` sat in MapView, so the memo inside keeps
// its place in the hook order.

import { useMemo } from 'react'

import { endpointAtTier, outlineOf, roadsFor } from '../../model/atlas'
import type { Bundle } from '../../model/atlas'
import { hoverMarks } from '../../model/maphover'
import type { PinHover } from './WalkPins'

export function useMapHover({ hover, sel, hoverId, peek, hoverEdge, pinHover, dragging, walkDroveFocus }: {
  hover: string | null
  sel: string | null
  hoverId: string | null
  peek: { id: string } | null
  hoverEdge: Bundle | null
  pinHover: PinHover | null
  dragging: boolean
  walkDroveFocus: boolean
}) {
  const hoverOutline = hover && hover !== sel && !dragging ? outlineOf(hover) : undefined

  // SPOTLIGHT — a hover published by ANOTHER instrument: "the thing your cursor
  // is on over there lives HERE". Suppressed when it is just our own preselected
  // cell echoing back (that already has the dashed outline). Any node can be
  // spotlit, at any level: a deep concept lights its own small cell inside its
  // topic, which is exactly the "where does this sit?" answer. Display only —
  // the camera never moves, so a hover can never steal the view.
  //
  // The spotlight also carries the LOOK: the last clicked Connections node
  // stays lit — lifted to its owning topic when it has no cell of its own —
  // until the look is superseded (next look, any focus change). "Highlight" is
  // half of what the click asked for; the flight above is the other half.
  const lookId = peek ? (outlineOf(peek.id) ? peek.id : endpointAtTier(peek.id, 2)) : null

  // item 2: WHICH HOVER GETS WHAT. The spotlight described above and the card
  // described below are one decision with two different answers, so they are
  // decided together, in `src/model/maphover.ts` rather than inline here — that
  // file's header carries the reasoning. The short version is OB-127 (#251): a
  // hover published by another pane lights a cell and stops there. It used to
  // also raise a card, at whatever point over this pane the cursor last occupied,
  // which was routinely nowhere near the cell being reported.
  const marks = hoverMarks({
    cursorCell: hover,
    selectedCell: sel,
    publishedCell: hoverId,
    lookedAtCell: lookId,
    walkStopCell: walkDroveFocus ? sel : null,
    onRelation: hoverEdge !== null,
    walkPinHovered: pinHover !== null,
  })
  const spotId = marks.spotlightId
  const spotOutline = spotId ? outlineOf(spotId) : undefined

  // THE CELL THE CARD IS ABOUT — our own cursor's, and now only ever our own. It
  // feeds MapTooltip's immediate title readout rather than the native <title>,
  // which lags ~half a second and is OS-styled; this reads the moment the pointer
  // lands. Called `hoverChip` until 2026-08-28 (#221) after the fixed top-left
  // chip it used to feed (OB-095 deleted that surface at 1e530af, OB-096 put the
  // cursor-anchored card in its place), then `hoverNode` until OB-127 took the
  // published hover out of it. Named for the card now, since the name has already
  // outlived two surfaces.
  const cardNode = marks.card?.kind === 'node' ? marks.card.id : null

  // ── #238: WHEN THE CURSOR'S POSITION IS WORTH KNOWING ─────────────────────
  // `pointerPos` is read for exactly one thing — placing MapTooltip beside the
  // cursor (OB-096) — and the tooltip only mounts when there is something to
  // report. So the position is only worth tracking while `tipLive` holds, and
  // this is the single expression that decides both, so the gate and the render
  // condition below cannot drift apart.
  //
  // Ungated it cost, per second of cursor movement over water at L2: 430ms of
  // scripting, a forced layout per move, and ZERO style recalculations — a full
  // re-render of ~500 SVG elements to move a card that was not on screen, against
  // a 4ms idle floor. Measured by tools/studio-spike/probe-maplag.mjs.
  //
  // What this does NOT fix, and #238 stays open for: while the tooltip IS up the
  // gate is open and the per-move re-render is back at full price (~420ms on the
  // same measure). Removing that too means not putting the position in state at
  // all — writing it to the card's own style through a ref. That was held back
  // pending the Design System's answer on whether MapTooltip anchors to the hovered
  // ELEMENT instead, which would have deleted this class of work rather than
  // optimised it. OB-127 answered: the cursor, unqualified. So the ref rewrite is
  // now all that is left of #238, and it waits on nobody.
  const tipLive = marks.card !== null

  // REMOVED at OB-127, recorded so it is not rebuilt: a `useLayoutEffect` keyed on
  // `spotId` that called `placeTipAtCursor()` whenever another pane published a
  // hover, placing the card before paint so it did not visibly jump. Careful work
  // on a problem that stopped existing — that case draws no card at all now.

  // OB-096 — the hovered node's OWN roads, for MapTooltip's relations row. A
  // fresh call rather than reusing the selection's `bundles`/`arrows` above:
  // the hovered node is rarely the selected one, and roadsFor is cheap
  // enough at this corpus's scale (memoised on the id, so cursor movement
  // that stays inside one cell recomputes nothing).
  const { arrows: hoverArrows } = useMemo(() => roadsFor(cardNode), [cardNode])
  const hoverRelIn = cardNode ? hoverArrows.filter((a) => a.tgt === cardNode).reduce((s, a) => s + a.n, 0) : 0
  const hoverRelOut = cardNode ? hoverArrows.filter((a) => a.src === cardNode).reduce((s, a) => s + a.n, 0) : 0

  return { hoverOutline, spotId, spotOutline, cardNode, tipLive, hoverRelIn, hoverRelOut }
}
