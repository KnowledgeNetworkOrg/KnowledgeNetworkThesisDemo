import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { wrapTip, useRecede } from '../chrome/IconButton'
import { settleRead } from '../chrome/MeasureBox'

/* Typed port of the DS components/presenter/ProjectedMap.jsx (contract: ProjectedMap.d.ts),
   part 4/5 of the presenter-mode split — OB-139 / #267, on the 2026-09-03e source (the scrim,
   the ✕ for full screen alone, the foot's own words). */

/** The wall's own ✕ — same manners as every other hover-revealed control in the system
 *  (`useRecede`, the recede clock `FilmRoll`'s flag/expand corners already share): invisible
 *  at rest, fades in on activity over the wall, fades out again after the same grace period.
 *  Fixed-size regardless of the box (a scaled button would shrink to nothing on a 340px
 *  mirror), and a permanent light chip rather than the transparent-at-rest `IconButton` face,
 *  because it sits over a map that can be any colour, not a solid pane. */
function CloseButton({ onClick, revealed }: { onClick?: () => void; revealed: boolean }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" title={wrapTip('close the map · M')} aria-label="close the map"
      tabIndex={revealed ? 0 : -1}
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', right: 10, top: 10, zIndex: 3, width: 30, height: 30, borderRadius: 'var(--radius-pill)',
        display: 'grid', placeItems: 'center', background: hot ? 'var(--bark-800)' : 'rgba(255,255,255,.92)',
        border: '1px solid ' + (hot ? 'var(--bark-800)' : 'var(--border-rule)'),
        color: hot ? '#fff' : 'var(--text-1)', boxShadow: hot ? 'var(--lift-2)' : 'var(--lift-1)',
        cursor: 'pointer', fontSize: 13, lineHeight: 1,
        opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none',
        transition: 'var(--transition-wash), opacity var(--dur-fade) var(--ease-soft)',
      }}>{'✕'}</button>
  )
}

/** The wall's reference frame and the two insets the caption and the foot are drawn at. All CHOSEN,
 *  none derived: `refWidth`/`refHeight` are the slide's own 1120×630 (every slide, every mirror);
 *  `captionLeft` 62 is the slide's text inset so the map's caption and the slide's eyebrow sit on
 *  one vertical line when the wall flips between them; `captionTop` 44 clears the film roll's corner
 *  pill on the live card; `footHeight` 32 is the slide's foot, so the foot does not jump on the flip. */
export const PROJECTED_MAP_METRICS = { refWidth: 1120, refHeight: 630, captionLeft: 62, captionTop: 44, footHeight: 32 }

/** the box's width against the reference — read on the settle ladder (the DS reads once and once
 *  more on the next frame; `MeasureBox`'s ladder is the same idea carried through fonts and
 *  resize) and then observed for later changes */
function useRefScale(ref: { current: HTMLDivElement | null }): number {
  const [s, setS] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    /* LAYOUT width, not the bounding box: the wall mounts inside a `scale(0.3)` transform on its
       way up (`WallTransition`), and a bounding rect read then is a third of the truth — and a
       transform changing does not fire a ResizeObserver, so the early number would stick */
    const read = () => { if (ref.current) setS(ref.current.offsetWidth / PROJECTED_MAP_METRICS.refWidth) }
    const stop = settleRead(read)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stop(); if (ro) ro.disconnect() }
  }, [ref])
  return s
}

/** The map, projected: what the wall shows while the professor holds the map up — "the map, on
 *  request only": press M (or the quick action) and the room sees the map with the walk on it,
 *  the stop on the wall lit, until the next press brings the slide back. Nothing automatic.
 *
 *  THE HOST DRAWS THE MAP (`map`) — the app's own map, with the lecture's walk on it: every stop
 *  a pin, the covered stops and the stop on the wall joined by the walk line, that stop lit, and
 *  NO recency band (the room is looking at a still picture to see where it has been). This
 *  component is the wall's FRAME around it: the pond face, the caption ("where we are · stop N of
 *  M" over "Territory › Stop") on its own scrim, and a foot matching the slide's. It fills the
 *  slide's own 1120:630 box — the film roll's live card, the full-screen frame, the projector.
 *
 *  THE CHROME IS DRAWN AT THE REFERENCE AND SCALED; THE MAP GETS THE REAL BOX, so a canvas or
 *  SVG map stays crisp instead of being drawn small and blown up.
 *
 *  WHAT THE HOST MUST DO: show it on request only (M); a second press takes it down; it stays up
 *  across an advance or a roam (the lit pin and the caption move, the map does not); ending takes
 *  it down; it goes wherever the slide goes and nowhere else; `stop` is the stop the room is
 *  looking at, 1-based; the foot occupies the slide's own 32px band but should say something the
 *  slide's foot did not (" · the whole walk"); `onClose` is full screen's alone — a ✕ is exactly a
 *  second M, never a way out of full screen. */
export interface ProjectedMapProps {
  /** the stop on the wall, 1-based — the same index the roll's live card shows */
  stop: number
  /** how many stops the lecture has */
  count: number
  /** the stop's territory (its domain's title) — the first half of "Territory › Stop" */
  territory: string
  /** the stop's title — the second half */
  title: string
  /** THE MAP — the app's own, drawn by the host into the real pixel box. Absolutely filled:
   *  render `position: absolute; inset: 0` or a block that fills its parent */
  map: ReactNode
  /** the foot's content, laid out at 1120×32 and scaled — the same SLOT the host's slide foot
   *  occupies, so the flip does not move anything at the bottom; the words may differ, and should.
   *  The band is selectable as `[data-projected-map-foot]` (rule 6b, DS 2026-09-14, on this app's
   *  offer): the equal-band guarantee is only worth having if a test can find the band it is
   *  about — locating it by structure (`> div:last-child`) rots the first time the tree changes,
   *  silently and in the test's favour. Part of the promise, not an implementation detail.
   *  Omit for no foot (the map takes the whole frame). */
  footer?: ReactNode
  /** the eyebrow's lead-in before " · stop N of M". Default "where we are" */
  eyebrow?: string
  /** draws a ✕ at the wall's top right when passed — FULL SCREEN'S ALONE; the roll's live card has
   *  its flag in that corner. Pressing it is always exactly a second M: the map comes down, the
   *  slide is back, and a room in full screen STAYS in full screen. Fades in on activity over the
   *  wall and recedes after the system's grace period. */
  onClose?: () => void
}

export function ProjectedMap({ stop, count, territory, title, map, footer, eyebrow = 'where we are', onClose }: ProjectedMapProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const s = useRefScale(ref)
  const M = PROJECTED_MAP_METRICS
  const foot = footer != null
  const [revealed, showReveal, hideReveal] = useRecede()
  return (
    <div ref={ref} data-projected-map={stop} onMouseEnter={showReveal} onMouseMove={showReveal} onMouseLeave={hideReveal}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--pond-50)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0 }}>{map}</div>
        {/* the caption: read-only words over the map, so the pointer reaches the map through it.
           Smaller than a slide's own eyebrow/title — the caption rides ON TOP of the host's map,
           not beside it on a clear ground, so it stays a label, not a second slide's worth of type
           fighting the drawing underneath. */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: M.refWidth, transform: 'scale(' + s + ')', transformOrigin: '0 0', pointerEvents: 'none', visibility: s ? 'visible' : 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: M.refWidth, height: M.captionTop + 96, background: 'linear-gradient(180deg, var(--pond-50) 0%, color-mix(in oklab, var(--pond-50) 55%, transparent) 62%, transparent 100%)' }} />
          <div data-projected-caption style={{ position: 'absolute', left: M.captionLeft, top: M.captionTop, width: M.refWidth - M.captionLeft * 2 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--acorn-600)' }}>{eyebrow} · stop {stop} of {count}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, lineHeight: 1.2, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', letterSpacing: 'var(--ls-display)', marginTop: 5, textWrap: 'pretty' }}>
              {territory}<span style={{ color: 'var(--text-3)', fontWeight: 'var(--fw-regular)' }}> › </span>{title}
            </div>
          </div>
        </div>
        {onClose ? <CloseButton onClick={onClose} revealed={revealed} /> : null}
      </div>
      {foot ? (
        <div data-projected-map-foot="" style={{ flex: 'none', position: 'relative', height: M.footHeight * s, borderTop: '1px solid var(--border-hair)', background: 'var(--bark-100)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: M.refWidth, height: M.footHeight, transform: 'scale(' + s + ')', transformOrigin: '0 0', display: 'flex', alignItems: 'center', padding: '0 26px', boxSizing: 'border-box' }}>{footer}</div>
        </div>
      ) : null}
    </div>
  )
}
