// THE MAP'S HOVER AND SPOTLIGHT OUTLINES (#399 cut 3) — the two groups above
// the selection overlay, moved out of MapView whole: the cell a click would
// pick, and the cell another pane's hover lives on. The deciding half is
// `useMapHover` (hoverlayer.ts); their tints stay in MapView's `data-washes`
// group (OB-223), from the same outlines.

import { colorOf } from '../../model/color'

export interface MapHoverProps {
  hoverOutline: string | undefined
  hover: string | null
  spotOutline: string | undefined
  spotId: string | null
  /** real screen px -> world units — MapView's own `px` */
  px: (v: number) => number
}

export function MapHover({ hoverOutline, hover, spotOutline, spotId, px }: MapHoverProps) {
  return (
    <>
      {/* ── HOVER PRESELECTION: the cell a click would pick — kills the "which
          region am I over?" guess. Its OUTLINE is here, above the labels and the
          walk; its light TINT is the `data-washes` group below the label layer
          (OB-223), the same outline path. ────────────────────────────── */}
      {hoverOutline && (
        <g data-hover={hover} pointerEvents="none">
          <path d={hoverOutline} fill="none" stroke="#ffffff" strokeWidth={px(3)} strokeOpacity={0.9} />
          <path d={hoverOutline} fill="none" stroke={colorOf(hover!)} strokeWidth={px(1.5)} strokeOpacity={0.9} strokeDasharray={`${px(5)} ${px(3)}`} />
        </g>
      )}

      {/* ── SPOTLIGHT: something hovered in ANOTHER pane lives here. Outline
          here; its tint is in `data-washes` (OB-223). ─────────────────── */}
      {spotOutline && (
        <g data-spot={spotId} pointerEvents="none">
          <path d={spotOutline} fill="none" stroke="#ffffff" strokeWidth={px(4.5)} strokeOpacity={0.95} />
          <path d={spotOutline} fill="none" stroke={colorOf(spotId!)} strokeWidth={px(2.4)} strokeOpacity={0.95} />
        </g>
      )}
    </>
  )
}
