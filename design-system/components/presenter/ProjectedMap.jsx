import React from 'react'
import { wrapTip, useRecede } from '../chrome/IconButton.jsx'
import { CloseMark } from '../chrome/CloseMark.jsx'

/** The wall's own ✕ — same manners as every other hover-revealed control in the system
 *  (`useRecede`, the recede clock `FilmRoll`'s flag/expand corners already share): invisible
 *  at rest, fades in on activity over the wall, fades out again after the same grace period.
 *  Fixed-size regardless of the box (a scaled button would shrink to nothing on a 340px
 *  mirror), and a permanent light chip rather than the transparent-at-rest `IconButton` face,
 *  because it sits over a map that can be any colour, not a solid pane. */
function CloseButton({ onClick, revealed }) {
  const [hot, setHot] = React.useState(false)
  return (
    <button type="button" title={wrapTip('close the map · M')} aria-label="close the map"
      tabIndex={revealed ? 0 : -1}
      onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', right: 10, top: 10, zIndex: 3, width: 30, height: 30, borderRadius: 'var(--radius-pill)',
        display: 'grid', placeItems: 'center', background: hot ? 'var(--bark-800)' : 'color-mix(in srgb, var(--surface-raised) 92%, transparent)',
        border: '1px solid ' + (hot ? 'var(--bark-800)' : 'var(--border-rule)'),
        color: hot ? 'var(--text-inverse)' : 'var(--text-1)', boxShadow: hot ? 'var(--lift-2)' : 'var(--lift-1)',
        cursor: 'pointer', lineHeight: 1, padding: 0,
        opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none',
        transition: 'var(--transition-wash), opacity var(--dur-fade) var(--ease-soft)',
        /* THE MARK IS DRAWN, NOT TYPED (OB-201, and this button was the one place left: the app's
           own port converted its copy on 2026-09-17 and reported ours back as a divergence). The
           typed ✕ cannot be centred in a round button at any font size — which is why `CloseMark`
           exists — and `fontSize` went with it, since nothing here is text now. `size` 11 is the
           30px chip's share of `CloseMark`'s default 10 on a 24px `IconButton`. */
      }}><CloseMark size={11} /></button>
  )
}

/** The wall's reference frame and the two insets the caption and the foot are drawn at. All CHOSEN,
 *  none derived: `refWidth`/`refHeight` are the slide's own 1120×630 (every slide, every mirror);
 *  `captionLeft` 62 is the slide's text inset so the map's caption and the slide's eyebrow sit on
 *  one vertical line when the wall flips between them; `captionTop` 44 clears the film roll's corner
 *  pill on the live card; `footHeight` 32 is the slide's foot, so the foot does not jump on the flip. */
export const PROJECTED_MAP_METRICS = { refWidth: 1120, refHeight: 630, captionLeft: 62, captionTop: 44, footHeight: 32 }

/** the box's width against the reference, read once on layout and again on every resize */
function useRefScale(ref) {
  const [s, setS] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = (w) => setS(w / PROJECTED_MAP_METRICS.refWidth)
    read(el.getBoundingClientRect().width)
    // a backstop for a first read landing before layout has settled (0 forever otherwise,
    // since a stuck-at-0 box never triggers the ResizeObserver below on its own)
    const raf = requestAnimationFrame(() => read(el.getBoundingClientRect().width))
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(raf)
    const ro = new ResizeObserver((e) => read(e[0].contentRect.width))
    ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return s
}

/** The map, projected: what the wall shows while the professor holds the map up. Part 4 of the
 *  presenter-mode split (`guidelines/presenter-component-split-plan.md`) — "the map, on request
 *  only": press M (or the quick action) and the room sees the map with the walk on it, the stop
 *  on the wall lit, until the next press brings the slide back. Nothing automatic.
 *
 *  THE HOST DRAWS THE MAP (`map`) — the app's own map, the same one its map pane draws, with the
 *  lecture's walk on it. This component is the wall's FRAME around it: the pond face, the caption
 *  ("where we are · stop N of M" over "Territory › Stop"), and a foot matching the slide's. It fills
 *  whatever box it is given and expects that box to be the slide's own 1120:630 — the film roll's
 *  live card, the full-screen frame, the projector — so it goes wherever the slide goes.
 *
 *  THE CHROME IS DRAWN AT THE REFERENCE AND SCALED; THE MAP GETS THE REAL BOX. Caption and foot are
 *  laid out at 1120 wide and `transform: scale()`d to the measured width, so they read at projector
 *  proportions in a 340px mirror and on a 1920px wall alike. The map slot is NOT scaled — it is
 *  handed the real pixel box — so a canvas or tile map stays crisp instead of being drawn small and
 *  blown up.
 *
 *  THE CAPTION IS THE WALK'S. The eyebrow wears acorn, the hue of movement through the corpus, the
 *  same ink the slide's own "stop N of M" would carry if it were about the walk rather than the
 *  territory; the title is `--text-1` with the › in `--text-3` regular so the two names read as a
 *  path, not one long title. Nothing in the caption takes the territory's hue: the map under it is
 *  already every hue at once.
 *
 *  THE CAPTION SITS ON A SCRIM, NOT DIRECTLY ON THE MAP. The map underneath is drawn by the host
 *  and can be any colour at any point — a territory wash, a pin, a line — right where the caption
 *  falls, so the words get their own soft pond-toned fade behind them (full opacity at the top,
 *  gone by the caption's own bottom edge) rather than trusting whatever the host happened to draw
 *  there to stay out of the way.
 *
 *  `onClose` IS OPTIONAL, and drawn only when passed: a ✕ at the wall's top right that hands the
 *  act back to the host (the host owns the show/hide rule — see the `.d.ts`) rather than this
 *  component closing anything itself; it is ALWAYS the same act as M, never a bigger one — a
 *  professor in full screen who presses it stays in full screen, looking at the slide, same as a
 *  second M would leave them. It sits outside the scaled chrome, a fixed real size regardless of
 *  the box (same reasoning as `FilmRoll`'s own corner controls), on a permanent light chip so it
 *  stays legible over any map colour — but it is not permanently ON SCREEN: it fades in on
 *  activity over the wall and recedes after the system's own grace period, the same manners as
 *  every other hover-revealed control (`useRecede`), rather than sitting there always. */
export function ProjectedMap({ stop, count, territory, title, map, footer, eyebrow = 'where we are', onClose }) {
  const ref = React.useRef(null)
  const s = useRefScale(ref)
  const M = PROJECTED_MAP_METRICS
  const foot = footer != null
  const [revealed, showReveal, hideReveal] = useRecede()
  return (
    <div ref={ref} onMouseEnter={showReveal} onMouseMove={showReveal} onMouseLeave={hideReveal}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--pond-50)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0 }}>{map}</div>
        {/* the caption: read-only words over the map, so the pointer reaches the map through it.
           Smaller than a slide's own eyebrow/title — the caption rides ON TOP of the host's map,
           not beside it on a clear ground, so it stays a label, not a second slide's worth of type
           fighting the drawing underneath. */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: M.refWidth, transform: 'scale(' + s + ')', transformOrigin: '0 0', pointerEvents: 'none', visibility: s ? 'visible' : 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: M.refWidth, height: M.captionTop + 96, background: 'linear-gradient(180deg, var(--pond-50) 0%, color-mix(in oklab, var(--pond-50) 55%, transparent) 62%, transparent 100%)' }} />
          <div style={{ position: 'absolute', left: M.captionLeft, top: M.captionTop, width: M.refWidth - M.captionLeft * 2 }}>
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
