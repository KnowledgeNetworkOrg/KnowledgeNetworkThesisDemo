// THE WALK'S ARROWS (#324 seam 2) — the `data-routepath` group of the map, moved
// out of MapView whole. One `NodeArrow` per adjacent pair of pins, each reading
// the band (OB-132) and bowed where the walk doubles back (OB-107).
//
// IT STAYS WHERE IT WAS. #393 (OB-221) moved the PINS out to paint last, so a
// focus border cannot bury the only copy of a stop's address; the arrows
// deliberately stayed behind, because a line passing under a boundary reads as
// passing behind it, which is true and loses nothing. This component's call site
// in MapView is the spot the group has always occupied; `WalkPins` is the group
// at the end of the scene.
//
// WHY THE ARITHMETIC IS ELSEWHERE. Every number in a drawing of this group — the
// one head for the whole set (OB-126), the bow signs, each arrow's distance,
// angle, tail anchor and length — is `model/walkdraw.ts`, tested there. What is
// left here is the drawing: the DS components, the transforms and the guard.
//
// `NodeArrow` is built assuming 1 unit is 1 real screen px — true for the road's
// authoring board, false here, where `viewS` is a live pan/zoom the rest of this
// map counter-scales away per-element via `px()`. The component takes no
// pre-scaled prop for that, so the correction moves to the wrapping transform
// instead: `scale(f / viewS)` cancels the ambient `scale(viewS)` this whole
// layer sits inside (see the outer <g> in MapView), leaving raw numbers inside
// behave exactly like real CSS px — which is what the component already assumes.

import { useMemo } from 'react'

import { ARROW_METRICS, headForSet, NodeArrow, PIN_RING_WIDTH, shaftTailOffset } from '@/ds'

import { walkArrowDraws, walkHeadLengths } from '../../model/walkdraw'
import type { WalkPin } from '../../model/walkpins'
import { wallArrowShown } from '../../model/walkwall'
import type { WallView } from '../../model/walkwall'
import type { Bus } from '../../state/bus'

/** the slice of the bus the arrows read — its one member is `data-step-count` */
export type WalkArrowsBus = Pick<Bus, 'route'>

export interface WalkArrowsProps {
  bus: WalkArrowsBus
  pins: readonly WalkPin[]
  /** the walk's position, in PIN units; null when the route is not the walk being played (OB-132) */
  pinPos: number | null
  f: number
  viewS: number
  /** real screen px -> world units — MapView's own `px`; the tail anchor is a px clearance */
  px: (v: number) => number
  /** the wall's still picture (#267, DS OB-139 rule 4): joins only the covered stops and the lit one */
  wall?: WallView
  visible: boolean
  /** OB-117, widened by OB-122: a node's relationships are on screen, so the walk steps back */
  receded: boolean
}

export function WalkArrows({ bus, pins, pinPos, f, viewS, px, wall, visible, receded }: WalkArrowsProps) {
  // ── OB-126: ONE HEAD FOR THE WHOLE WALK, NOT ONE PER ARROW ──────────────────
  // `headFor`'s length cap is written for a LONE line — it stops one long shaft
  // growing a spearhead. Applied per-arrow across a SET it makes head size a
  // function of length, which the line already draws, and a reader takes a bigger
  // head as EMPHASIS: hops under ~267px would take the published 8px head and hops
  // over ~427px the full 12.8px, 2.5× the triangle's area, on arrows that mean the
  // same thing. So every hop is measured first and the set is asked ONCE for the
  // smallest head all of them can carry. The provisional lengths and why one pass
  // is exact wherever it matters: `walkHeadLengths`.
  const head = useMemo(
    () => headForSet({ joins: PIN_RING_WIDTH, lengths: walkHeadLengths(pins, viewS, f, ARROW_METRICS.head) }),
    [pins, viewS, f],
  )
  const draws = useMemo(
    () => walkArrowDraws({ pins, pinPos, head: head.head, viewS, f, px }),
    [pins, pinPos, head, viewS, f, px],
  )

  if (!visible || pins.length === 0) return null

  return (
    <g data-routepath data-step-count={bus.route.length} pointerEvents="none">
      {/* OB-117, WIDENED BY OB-122 — the whole walk recedes now, arrows AND pins.
          OB-117 scoped it to the shaft and the head, because that is what its `done
          when` named and the DS's side-by-side mock
          (guidelines/map-walk-relations-declutter-options.html) drew lines with no
          step marks at all. That left the pins as the loudest thing on the map once
          the arrows dimmed — the owner's call, answering
          receipts/3107899.md question (a).

          One wrapper per layer rather than one around both: they recede together but
          they are not one drawing, and `data-routearrows` is already the handle the
          OB-117 driver reads. Tone alone leaves the mark at full strength, which is
          why the arrows carry opacity too. */}
      <g data-routearrows data-receded={receded ? 1 : 0} opacity={receded ? 0.6 : 1} style={{ transition: 'opacity 120ms' }}>
        {draws.map((d) => {
          const to = pins[d.i + 1]
          // THE WALL'S LINE joins the covered stops and the lit one, and nothing else
          if (wall && !wallArrowShown(pins[d.i], to, wall)) return null
          // THE DRAWING'S ORIGIN IS NOT THE SHAFT'S TAIL. NodeArrow puts the shaft
          // at `across / 2` down its own box, and `casing`'s pad and `bow`'s sign
          // move it again — so placing the <svg> at the pin leaves the LINE beside
          // the two pins it joins. Cancelling the offset here is what makes bowing
          // +b and -b symmetric about the real pin-to-pin line, which the
          // alternating sign depends on.
          const tail = shaftTailOffset({ joins: PIN_RING_WIDTH, bow: d.bow, casing: true, headSize: head })
          return (
            <g
              key={`ra-${to.key}`}
              data-routearrow={d.i}
              data-bow={d.bow.toFixed(2)}
              opacity={wall ? 1 : d.reading.opacity}
              transform={`translate(${d.tailX} ${d.tailY}) rotate(${d.angle}) scale(${f / viewS})`}
            >
              <g transform={`translate(${-tail.along} ${-tail.across})`}>
                {/* OB-116 — `casing` on EVERY walk arrow, long and short, quiet and
                    current: a halo behind shaft and head so the line reads over a
                    territory fill instead of competing with it. Not a bigger head —
                    that does not scale to a map with many arrows, which is the map
                    this is. */}
                <NodeArrow
                  direction="right"
                  length={d.length}
                  joins={PIN_RING_WIDTH}
                  headSize={head}
                  bow={d.bow}
                  casing
                  tone={receded ? 'hint' : 'quiet'}
                  /* AN ARROW THE WALK HAS NOT ENTERED PASSES NO `walked` AT ALL (DS
                     OB-159). `walkArrow` returns `walked: 0` for every arrow ahead of
                     the walk AND at rest, but 0 does not mean "unwalked" to
                     `NodeArrow`: it means the walk is standing at this arrow's TAIL,
                     so the head is drawn down at the tail in acorn. Passing it
                     straight through put an acorn head on the tail of every arrow the
                     walk had not reached yet. `headAcorn` is the recipe's OWN
                     published test for "has the walk entered this arrow"
                     (`walked > 0`), so it is the gate rather than a comparison
                     retyped here. */
                  walked={wall ? 1 : d.reading.headAcorn ? d.reading.walked : undefined}
                  walkedTone={receded ? 'hint' : 'walk'}
                  aheadOpacity={wall ? 1 : d.reading.opacity > 0 ? d.reading.aheadOpacity / d.reading.opacity : 1}
                />
              </g>
            </g>
          )
        })}
      </g>
    </g>
  )
}
