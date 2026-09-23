import type { CSSProperties, MouseEvent } from 'react'

import { IconButton } from './IconButton'

/** THE ONE AFFORDANCE THAT BOTH HIDES A COLUMN AND BRINGS IT BACK — same button, same spot,
 *  flipped glyph, so there is never a second place to look for "show it again". A plain
 *  directional chevron reads faster than an icon standing in for the panel it toggles.
 *
 *  Built on `IconButton` rather than a private `<button>`: extracted upstream 2026-08-28 out of
 *  `ConnectionsSplitPane`'s local `CollapseToggle`, which had reimplemented `IconButton`'s hover
 *  ramp, reserved border and disabled handling by hand. Any host collapsing a column, a sidebar
 *  or a rail gets the system's own button manners for free.
 *
 *  WHICH WAY IT POINTS IS NOT `collapsed` ALONE — IT IS `collapsed` AGAINST THE EDGE THE COLUMN
 *  SITS ON (`side`, DS OB-237, #340). The chevron points the way the column WILL GO, and a rail
 *  on the right of its pane goes the other way. Until this prop existed the component could only
 *  express the left-hand case, so the second rail in a two-rail pane had to draw its own glyph —
 *  which is how a raw `›` character ends up beside a drawn one, at a different size and weight,
 *  in the same product.
 *
 *  Typed port of the DS components/chrome/CollapseChevron.jsx, OB-101 / #253 (the `side` prop
 *  added with OB-237, #340). */
export interface CollapseChevronProps {
  /** which way the chevron points, and therefore what pressing it will do: collapsed shows
   *  `›` and reopens, open shows `‹` and hides */
  collapsed?: boolean
  /** the press. The host owns what collapsing MEANS — this only reports the click */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  /** the tooltip and the accessible name, both. Defaults to `Show` / `Hide` by `collapsed` */
  title?: string
  /** WHICH EDGE OF THE PANE THE COLUMN SITS ON. The chevron points the way the column will GO,
   *  so direction is `collapsed` against this, not `collapsed` alone: a right-hand rail closes
   *  RIGHTWARDS. Default `'left'`, which is the behaviour every existing caller already has.
   *  A two-rail pane must pass it on the right-hand rail — otherwise that rail needs a glyph of
   *  its own, and a hand-typed › beside this drawn one is two chevrons at two weights in one
   *  product */
  side?: 'left' | 'right'
  /** placement in the host's own box — this component takes no position of its own */
  style?: CSSProperties
}

export function CollapseChevron({ collapsed, onClick, title, style, side = 'left' }: CollapseChevronProps) {
  const label = title || (collapsed ? 'Show' : 'Hide')
  const pointsRight = side === 'left' ? collapsed : !collapsed
  return (
    <IconButton tone="chrome" size={14} glyphSize={10} title={label} label={label} onClick={onClick} style={style}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path
          d={pointsRight ? 'M4 1.5 L9 6 L4 10.5' : 'M8 1.5 L3 6 L8 10.5'}
          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      </svg>
    </IconButton>
  )
}
