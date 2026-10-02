// THE WALK'S NUMBERED PINS (#324 seam 2) — the `data-routepins` group, moved out
// of MapView whole. One pin per resolved stop (a contiguous run of stops on one
// cell is ONE pin, `model/walkpins.ts`), drawn on the shared `StepDot` (OB-069),
// each reading the recency band (OB-132) and carrying its own hover and click
// (#246).
//
// IT IS THE LAST CHILD OF THE SCENE (OB-221), and that is a rule about MapView's
// paint order, not about this file: the comment at its call site in MapView says
// why, and says that any later insertion goes ABOVE the group. The group itself
// is unchanged from where it always drew — same `data-receded`, same opacity and
// 120ms transition, same per-pin `foreignObject`, same coordinates.
//
// ONE CONVENTION, COUNTED FROM 0 (#326). A pin stands for stops `step`..`stepEnd`,
// 0-BASED like the DS's `WalkMark`, `walkProgress`, `walkLeadStop` and the player's
// `position`, so the memo below builds the mark with no arithmetic at all. That used
// to be a 1-based pin model converted by hand at every meeting — the seam the DS's
// own `walkMarkLabel` got wrong (receipt 0ac3465). The one number counted from 1 is
// what a person READS: `data-step` and `data-step-end` on each pin, which the drivers'
// expected tables and three past receipts are written against, so the `+ 1` lives
// there, at the attribute, and nowhere else.

import { useMemo } from 'react'

import { previewAnchor, StepDot, walkAddresses, walkMarkLabel, walkProgress } from '@/ds'
import type { WalkMark } from '@/ds'

import { walkPinBands } from '../../model/walkdraw'
import type { WalkPin } from '../../model/walkpins'
import { wallPinState } from '../../model/walkwall'
import type { WallView } from '../../model/walkwall'
import type { Playback } from '../../state/walk/playback'

/** a pin's own hover — index into `play.steps`, the viewport anchor the DS's
 *  `WalkPreview` hangs its card from, and, for a MERGED pin, the mark it stands
 *  for (OB-184 clause 3), which `renderStopPreview` turns into a card naming
 *  every stop of the run */
export interface PinHover {
  i: number
  x: number
  top: number
  mark?: WalkMark
}

export interface WalkPinsProps {
  pins: readonly WalkPin[]
  /** the walk's position, in PIN units; null when the route is not the walk being played (OB-132) */
  pinPos: number | null
  play: Playback
  f: number
  viewS: number
  /** the wall's still picture (#267, DS OB-139 rule 4): no band, a stop's state read from the wall */
  wall?: WallView
  visible: boolean
  /** OB-117, widened by OB-122: a node's relationships are on screen, so the walk steps back */
  receded: boolean
  /** a pin is only a control while the docked walk is on the map (`routeIsWalk`) */
  dockShown: boolean
  dragging: boolean
  onPinHover: (hover: PinHover | null) => void
  onRegionClick: (id: string) => void
}

export function WalkPins({ pins, pinPos, play, f, viewS, wall, visible, receded, dockShown, dragging, onPinHover, onRegionClick }: WalkPinsProps) {
  /* ONE MARK PER PIN, built ONCE. THE ADDRESS EVERY PIN PRINTS (DS OB-188) is
     `walkAddresses` over the same steps the dock reads, capped at two numbers,
     en-dashed across a merged run — so the two surfaces cannot disagree. */
  const marks = useMemo(() => {
    const addresses = walkAddresses(play.steps)
    return new Map(pins.map((s) => {
      const from = s.step, to = s.stepEnd
      /* `label` is optional on the DS's mark; a map pin always prints one */
      const mark: WalkMark & { label: string } = { from, to, label: walkMarkLabel(play.steps, { from, to }), steps: play.steps.slice(from, to + 1), addresses: addresses.slice(from, to + 1) }
      return [s.key, mark] as const
    }))
  }, [pins, play.steps])

  if (!visible || pins.length === 0) return null

  return (
    <g data-routepins data-receded={receded ? 1 : 0} opacity={receded ? 0.6 : 1} style={{ transition: 'opacity 120ms' }}>
      {walkPinBands(pins, pinPos).map(({ pin: s, index: k, band: b }) => {
        const mark = marks.get(s.key)!
        /* OB-132 — EVERY PIN IS A READING OF THE BAND: its opacity is `pinOpacity`
           and its scale `pinScale` (the pop, 1.36× as the walk arrives), both from
           the record above. Its FACE is direction plus arrival — `state` says which
           side of the position it is on and `arrival` how far it is into looking
           current, so fill, ring and number cross continuously with no jump at the
           stop boundary. Never a rounded 'current': at the stop `arrival` is 1 and
           both directions reach the identical look, so the flip is invisible
           (StepDot's own docblock). */
        return (
          /* #246: A PIN'S OWN HOVER AND CLICK. The pins' wrapper is pointer-transparent
             so the cells under the walk keep their hover; each pin opts back in. Hover
             shows the same preview card the dock and the strip show, anchored on the
             pin's box (DS OB-131's bare-`<g>` recipe: bind enter/leave on the `<g>` and
             render `WalkPreview` from `previewAnchor(getBoundingClientRect())`), never
             during a drag. Entering a pin leaves the cell under it, so the cell's
             MapTooltip goes as this card comes — one card at a time. A click falls
             through to the cell the pin stands on, so a pin is still a way to select
             its region. `s.step` indexes `play.steps`, the walk `bus.route` is a
             prefix of. `data-pin` is the pin's index in walk order — what an arrow's
             `data-routearrow` joins. `data-step` and `data-step-end` are what a person
             reads on screen, counted from 1 — the model's 0-based number plus one. */
          <g
            key={s.key}
            data-routestop={s.visId}
            data-step={s.step + 1}
            data-step-end={s.stepEnd + 1}
            data-pin={k}
            opacity={b.pinOpacity}
            transform={`translate(${s.c.x} ${s.c.y}) scale(${(f / viewS) * b.pinScale})`}
            pointerEvents={dockShown ? 'all' : 'none'}
            style={dockShown ? { cursor: 'pointer' } : undefined}
            onPointerEnter={(e) => {
              if (dragging || !dockShown) return
              /* THE MARK IS THE HOST'S TO BUILD (OB-184) — the one built above; the
                 card names ONE of its stops plus a count (OB-186), by its numbering */
              onPinHover({ i: mark.from, mark, ...previewAnchor(e.currentTarget.getBoundingClientRect()) })
            }}
            onPointerLeave={() => onPinHover(null)}
            onClick={() => onRegionClick(s.visId)}
          >
            <foreignObject x={-s.size / 2} y={-s.size / 2} width={s.size} height={s.size} style={{ overflow: 'visible' }}>
              {/* the wash (OB-187 clause 3): how much of this pin's run is behind the walk,
                  `walkProgress` on the same mark the card reads — a merged pin washes a stop
                  at a time as the class works through it. The wall is a still picture.
                  `optional` (DS OB-214 clauses 3-4) dashes the ring and slants the numeral
                  for a pin whose every stop may be skipped — never special-cased for the lit
                  pin: the dash rides with the current look, and mid-crossing it neither
                  thickens nor fades, because StepDot keys geometry on the discrete state. */}
              <StepDot n={mark.label} state={wall ? wallPinState(s, wall) : b.behind ? 'done' : 'ahead'} arrival={wall ? undefined : b.active} progress={wall ? undefined : walkProgress(mark, play.position)} variant="pin" size={s.size} optional={s.optional} />
            </foreignObject>
          </g>
        )
      })}
    </g>
  )
}
