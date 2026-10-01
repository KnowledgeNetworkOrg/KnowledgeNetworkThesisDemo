import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { FlagMark } from '../chrome/FlagMark'
import { ExpandMark } from '../chrome/ExpandMark'
import { wrapTip, useRecede } from '../chrome/IconButton'
import { settleRead } from '../chrome/MeasureBox'

/* Typed port of the DS components/presenter/FilmRoll.jsx (contract: FilmRoll.d.ts), part 2
   of the presenter-mode split — OB-136 / #267. */

const ASPECT = 630 / 1120 // every slide, whole neighbours included, is this shape

/** THE FLAG BUTTON, published (2026-09-04) so the notes pane can wear the SAME control on the
 *  prepared column's head — one drawing of "flag this stop", not two. Filled acorn when set, an
 *  outline at reduced opacity when not; `size` is the hit box (24 on a slide card, 20 beside a
 *  20px pencil in a pane head), `glyphSize` the mark. It does NOT decide when it is visible —
 *  the card and the pane each reveal it by their own hover rule — so wrap it in the reveal. */
export interface FlagButtonProps {
  /** filled acorn and full opacity when set; an outline at reduced opacity when not */
  flagged?: boolean
  /** on a dimmed neighbour card: lower rest and hover opacities */
  dim?: boolean
  /** the mark, px. Default 12 */
  glyphSize?: number
  /** the hit box, px. Default 24 (a slide corner); 20 beside a 20px pencil in a pane head */
  size?: number
  /** px the mark is lifted inside the button. Default 0. BESIDE THE PENCIL pass `EDIT_MARK_LIFT`
   *  (from `EditMark`) or the pair reads misaligned — the pencil lifts itself by that much. */
  lift?: number
  /** flip the flag */
  onClick?: () => void
  /** default "flag this slide" / "unflag this slide" */
  title?: string
}

export function FlagButton({ flagged, dim, glyphSize = 12, size = 24, lift = 0, onClick, title }: FlagButtonProps) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" title={wrapTip(title || (flagged ? 'unflag this slide' : 'flag this slide'))} aria-label={flagged ? 'unflag this slide' : 'flag this slide'}
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        display: 'grid', placeItems: 'center', width: size, height: size, borderRadius: 'var(--radius-pill)', padding: 0,
        border: 'none', cursor: onClick ? 'pointer' : 'default',
        background: hot ? (flagged ? 'var(--accent-walk-wash)' : 'var(--surface-hover)') : 'transparent',
        transition: 'var(--transition-wash)',
        opacity: flagged ? 1 : (hot ? (dim ? 0.7 : 0.85) : (dim ? 0.4 : 0.5)),
        color: flagged ? 'var(--acorn-600)' : (hot ? 'var(--text-1)' : 'var(--text-2)'),
      }}>
      <FlagMark size={glyphSize} filled={!!flagged} style={lift ? { transform: 'translateY(-' + lift + 'px)' } : undefined} />
    </button>
  )
}

function ExpandButton({ onClick, revealed }: { onClick?: () => void; revealed: boolean }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" title={wrapTip('full screen')} aria-label="full screen"
      onClick={(e) => { e.stopPropagation(); if (onClick) onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', right: 9, bottom: 9, zIndex: 3, width: 26, height: 26, borderRadius: 7,
        display: 'grid', placeItems: 'center', background: hot ? 'var(--bark-800)' : 'rgba(255,255,255,.92)',
        border: '1px solid ' + (hot ? 'var(--bark-800)' : 'var(--border-rule)'),
        color: hot ? '#fff' : 'var(--text-1)', boxShadow: hot ? 'var(--lift-2)' : 'var(--lift-1)',
        opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none',
        cursor: 'pointer', transition: 'var(--transition-wash), opacity var(--dur-fade) var(--ease-soft)',
      }}>
      <ExpandMark size={13} />
    </button>
  )
}

interface MirrorProps {
  width: number
  content: ReactNode
  cornerLabel?: string
  live?: boolean
  projecting?: boolean
  dim?: boolean
  flagged?: boolean
  elapsed?: string
  onToggleFlag?: () => void
  onExpand?: () => void
  onNavigate?: () => void
}

/** One mirror card. Every card gets the same flag corner (top right) and the same label
 *  corner (top left) — the rule that only became possible once neighbours stopped bleeding
 *  off the roll's edge and were drawn WHOLE, at their own smaller size, instead of cropped.
 *  The ghost flag and the expand button both reveal on THIS card's own hover, not the
 *  roll's — a professor flags whichever slide is under the pointer, live or not.
 *
 *  A NEIGHBOUR IS THE CLICK TARGET FOR ITS OWN DIRECTION — not its corner tag alone
 *  (a tag reading "← stop 19" invites clicking exactly that tag, and nothing else on
 *  the card, if only the tag answers). `onNavigate` makes the whole card clickable, and
 *  hovering it lightens the dim wash to say so; the flag and (on the live card) the
 *  expand button stop that click from reaching the card underneath them. */
function Mirror({ width, content, cornerLabel, live, projecting = true, dim, flagged, elapsed, onToggleFlag, onExpand, onNavigate }: MirrorProps) {
  const [hot, setHot] = useState(false)
  /* the ghost flag and the expand button both wait out the app's own recede clock
     (`useRecede`, `chrome/IconButton`) before they disappear — the same grace period
     as a pane's close button, so a hover-revealed control doesn't vanish under the
     cursor's heels the instant it drifts off the card. */
  const [revealed, showReveal, hideReveal] = useRecede()
  const height = Math.round(width * ASPECT)
  const glyphSize = dim ? 13 : 16
  const clickable = !!onNavigate
  const enter = () => { setHot(true); showReveal() }
  const leave = () => { setHot(false); hideReveal() }
  return (
    <div data-filmroll-card={live ? 'live' : 'neighbour'} onMouseEnter={enter} onMouseLeave={leave} onClick={onNavigate} style={{
      position: 'relative', flexShrink: 0, width, height, overflow: 'hidden', cursor: clickable ? 'pointer' : 'default',
      background: 'var(--bark-50)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
      boxShadow: live ? 'var(--lift-3)' : 'none', boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>{content}</div>
      {dim ? <div style={{ position: 'absolute', inset: 0, background: 'var(--bark-200)', opacity: clickable && hot ? 0.32 : 0.58, transition: 'var(--transition-wash)' }} /> : null}
      {cornerLabel ? (
        <div data-filmroll-label style={{
          position: 'absolute', left: 0, top: 0, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', background: 'var(--bark-800)', color: 'var(--bark-100)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)',
          letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase',
          /* the tag hangs from the card's own top-left corner: only its free corner rounds. Spelled
             as the four-value shorthand rather than the DS's `borderBottomRightRadius` — the same
             drawing, and the house rule against bottom-only rounding can read it as deliberate */
          borderRadius: '0 0 var(--radius-xs) 0',
          opacity: dim ? (clickable && hot ? 0.85 : 0.7) : 1, transition: 'var(--transition-wash)',
        }}>
          {/* the live mark: a filled moss dot while projecting; the same hollow bark ring the header
             bar's preview chip wears when nothing is on the projector */}
          {live ? (projecting ? <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--moss-300)', flexShrink: 0 }} /> : <span style={{ width: 7, height: 7, borderRadius: 'var(--radius-pill)', border: '1px solid var(--bark-400)', boxSizing: 'border-box', flexShrink: 0 }} />) : null}
          {cornerLabel}
          {/* the running clock on this stop, folded into the same pill — always on while
             live, never tied to the flag; a professor cares how long they've lingered
             whether or not it's flagged. A thin divider keeps it legible as a second
             fact, not a continuation of the label's words. */}
          {live && elapsed ? (
            <>
              <span style={{ width: 1, height: 10, background: 'var(--bark-600)', flexShrink: 0 }} />
              <span data-filmroll-elapsed style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-regular)', letterSpacing: 0, textTransform: 'none', color: 'var(--bark-300)' }}>{elapsed}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {/* the flag corner: filled and always shown once set; an outline only while this
         card (or its expand/flag control) is recently hovered — never a solid flag for a
         state that isn't true. */}
      {onToggleFlag ? (
        <span style={{ position: 'absolute', right: 6, top: 5, zIndex: 3, opacity: flagged ? (dim ? (hot ? 0.85 : 0.7) : 1) : (revealed ? 1 : 0), pointerEvents: flagged || revealed ? 'auto' : 'none', transition: 'opacity var(--dur-fade) var(--ease-soft)' }}>
          <FlagButton flagged={flagged} dim={dim} glyphSize={glyphSize} onClick={onToggleFlag} />
        </span>
      ) : flagged ? (
        <span style={{ position: 'absolute', right: 6, top: 5, zIndex: 3, opacity: dim ? 0.7 : 1, transition: 'var(--transition-wash)' }}>
          <FlagButton flagged dim={dim} glyphSize={glyphSize} />
        </span>
      ) : null}
      {live && onExpand ? (
        <ExpandButton onClick={onExpand} revealed={revealed} />
      ) : null}
    </div>
  )
}

/** A big chevron over the roll's outer edge, ADDITIONAL to a neighbour's whole-card
 *  click — it puts an obvious "you can advance" affordance where the pointer already
 *  is for a professor scanning the roll left to right, without waiting to notice the
 *  dimmed card itself is clickable. Both point at the same `onNavigate` a neighbour
 *  card already carries, so there is exactly one way each direction actually moves. */
function EdgeChevron({ dir, onClick, roomHot, traveling }: { dir: -1 | 1; onClick: () => void; roomHot: boolean; traveling: boolean }) {
  const [hot, setHot] = useState(false)
  const side: CSSProperties = dir < 0 ? { left: 6 } : { right: 6 }
  return (
    <button type="button" title={wrapTip(dir < 0 ? 'previous stop' : 'next stop')} aria-label={dir < 0 ? 'previous stop' : 'next stop'}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', ...side, top: '50%',
        /* the nudge is the chevron's half of the travel (OB-203): while the roll slides, the
           chevron for THAT direction goes full weight and leans 3px the way it is sending you, so
           the direction is readable from the control you actually pressed as well as from the
           cards. The chevrons are the roll's fixed furniture and never move with the row. */
        transform: 'translateY(-50%) translateX(' + (traveling ? dir * 3 : 0) + 'px)',
        width: 30, height: 60, zIndex: 4, border: 'none', background: 'transparent', color: 'var(--bark-500)',
        opacity: traveling ? 1 : (hot ? 0.85 : (roomHot ? 0.6 : 0.4)), cursor: 'pointer', display: 'grid', placeItems: 'center',
        transition: 'var(--transition-wash), opacity var(--dur-hover) var(--ease-soft), transform var(--dur-move) var(--ease-settle)',
      }}>
      <svg width="20" height="40" viewBox="0 0 30 60" aria-hidden="true">
        <path d={dir < 0 ? 'M22 6 L8 30 L22 54' : 'M8 6 L22 30 L8 54'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/** a neighbour card — the previous or next slide */
export interface FilmRollNeighbour {
  /** the host's slide for that stop */
  content: ReactNode
  /** the corner tag's words, e.g. "stop 19" — the arrow is the roll's */
  stopLabel: string
  /** the flag corner's state */
  flagged?: boolean
  /** the whole card is the click target for its direction; omit for a plain preview */
  onNavigate?: () => void
}

/** the live card */
export interface FilmRollLive {
  /** the host's slide for the live stop */
  content: ReactNode
  /** the flag corner's state */
  flagged?: boolean
  /** a running duration on this stop ("00:19"), folded into the live label's pill after a thin
   *  divider, shown ALWAYS while present — independent of `flagged`. The HOST owns resetting it
   *  to zero when the live stop changes — this component just displays whatever string it's given */
  elapsed?: string
  /** THE LIVE STOP'S POSITION in the walk (0-based or 1-based, either, as long as it is consistent)
   *  — the roll reads only the SIGN of its change, to decide which way the travel frame slides.
   *  WHAT THE HOST MUST DO FOR THE CUE TO BE COMPLETE: pass it, and pass the stop actually on the
   *  wall (a roam included). With it the direction is read from the number, so EVERY route into a
   *  new stop animates — keyboard arrows, the strip, the finder, a jump of several stops — and the
   *  roll's own click-driven path switches OFF, so a chevron click never plays the slide twice.
   *  Without it the roll sees only its own two clicks (a chevron or a neighbour card) and a
   *  keyboard advance plays nothing: a partial cue, not a break. */
  stopIndex?: number
}

/** The presenter film roll: the live slide with its two whole neighbours.
 *
 *  WHOLE NEIGHBOURS, ONE FLAG CORNER. Neighbours used to bleed off the roll's edge, which meant
 *  no single corner was reliable for the flag. Drawing both neighbours whole, at their own
 *  smaller size, is what makes "the flag is top right, on every card, no exceptions" true.
 *
 *  THE HOST SUPPLIES SLIDE CONTENT — this component places three cards, sizes them, dims the
 *  neighbours, and carries the flag/expand affordances; it never renders a slide itself.
 *
 *  THE ROLL FILLS ITS CONTAINER. `height`/`liveWidth`/`neighborWidth` are reference sizes at
 *  scale 1 — the wrapper's width scales all three together so the three cards' combined width
 *  always matches whatever width it's given, clamped to `minScale`/`maxScale`. The scale is
 *  READ on a settle ladder and then observed (an observer's first callback arrives before layout
 *  is final, and a box that settles once gets no second one — DS, 2026-09-04).
 *
 *  THE TRAVEL FRAME (owner, 2026-09-16, OB-203). Advancing used to be a cut: the three cards
 *  swapped their contents between two frames and nothing said which way you had gone. Now every
 *  stop CHANGE plays one short slide — the row of cards starts one step displaced (half the live
 *  card + half a neighbour + the gap, the real distance the live card travels) on the side it came
 *  FROM, at 0.5 opacity, and settles to rest over `--dur-move`, so forward reads as content moving
 *  left and back as content moving right. It is a CUE, not a filmstrip: the cards already carry
 *  their new contents when the slide starts. `--dur-move` collapses to 1ms under
 *  `prefers-reduced-motion`, which turns this back into the cut it was, deliberately.
 *
 *  THE MOVE IS ONE `Element.animate()` CALL AND NOTHING ELSE HOLDS A POSITION — never a CSS
 *  transition. The first build committed a displaced frame with `transition: none` and re-rendered
 *  to rest WITH a transition, and the transition arrived after the element was already home: a
 *  frozen half-opacity hold, then a snap (0-210ms displaced, 245ms home, nothing interpolated). It
 *  also raced a `requestAnimationFrame` return against a `setTimeout` reset, and rAF is exactly
 *  what stops in a backgrounded window. Web Animations has one clock and the row's own style stays
 *  STATIC. WHAT THAT GUARANTEES IS NARROWER THAN "IT CAN NEVER PARK" (measured, 2026-09-16): a
 *  pending or frame-starved animation applies its FIRST KEYFRAME, so a window getting no frames
 *  does hold the row at the displacement until frames resume. What is guaranteed is that no REACT
 *  STATE holds the displacement — a remount, a cancel, or an environment with no `animate()` rests
 *  — and that no second clock can strip the move halfway. Do not write "it can never park" here.
 *
 *  PASS `current.stopIndex` AND THE CUE COVERS EVERY WAY A STOP CHANGES — see that field.
 *
 *  PROJECTING OR NOT (owner, 2026-09-03). `projecting={false}` is a PREVIEW of the presenter
 *  layout with nothing on the projector. The live card's label defaults to "Not on the projector",
 *  its moss dot becomes the hollow bark ring `PresenterHeaderBar`'s preview chip wears, and
 *  `current.elapsed` is not drawn. WHAT THE HOST MUST DO: pass the same flag here and to the
 *  header bar, so the two never disagree about whether the room is watching. */
export interface FilmRollProps {
  /** the roll's reference height in px at scale 1; card widths below stay in the same 1120:630
   *  aspect as every slide, whole neighbours included. Default 286 */
  height?: number
  /** the live card's reference width at scale 1. Default 470 */
  liveWidth?: number
  /** a neighbour card's reference width at scale 1. Default 336 */
  neighborWidth?: number
  /** how far the fill scale may shrink the reference sizes. Default 0.55 */
  minScale?: number
  /** how far the fill scale may grow them. Default 1.6 */
  maxScale?: number
  /** the live card's corner label. Default "On the projector now", or "Not on the projector"
   *  when `projecting` is false; pass a string to override either */
  liveLabel?: string
  /** is the live slide actually on the projector. Default true. False = preview: negated label,
   *  hollow ring instead of the moss dot, `current.elapsed` hidden */
  projecting?: boolean
  /** the previous slide, or `null`/`undefined` at the first stop — no card renders there,
   *  its width stays reserved so the live card doesn't recentre */
  prev?: FilmRollNeighbour | null
  /** the live slide. `content` is required in practice; typed optional only so a host
   *  mid-load can pass `current={null}` without a crash */
  current?: FilmRollLive | null
  /** the next slide, or `null`/`undefined` at the last stop */
  next?: FilmRollNeighbour | null
  /** flip a flag on any of the three cards. Omit to hide every flag corner (a read-only roll) */
  onToggleFlag?: (which: 'prev' | 'current' | 'next') => void
  /** full screen, live card only, revealed on that card's own hover. Omit to hide the button */
  onExpand?: () => void
}

export function FilmRoll({
  height = 286, liveWidth = 470, neighborWidth = 336, liveLabel, projecting = true,
  prev, current, next, onToggleFlag, onExpand, minScale = 0.55, maxScale = 1.6,
}: FilmRollProps) {
  const label = liveLabel != null ? liveLabel : projecting ? 'On the projector now' : 'Not on the projector'
  /* TRAVEL (OB-203). The only STATE is which chevron leans — the row's movement lives entirely in a
     Web Animations animation on the row itself, so React never holds a displaced position and a
     dropped frame cannot leave one on screen. */
  const [travelDir, setTravelDir] = useState<-1 | 0 | 1>(0)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const anim = useRef<Animation | null>(null)
  const stopIndex = current && typeof current.stopIndex === 'number' ? current.stopIndex : null
  const lastIndex = useRef<number | null>(stopIndex)
  useEffect(() => () => { if (anim.current) anim.current.cancel() }, [])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  // brightens the edge chevrons a step above their resting dim the moment the pointer is
  // anywhere in the roll's own grey pane — a lighter cue than the chevron's OWN hover,
  // which still goes brighter still on direct contact
  const [roomHot, setRoomHot] = useState(false)
  const gap = 8
  // reserved, unscaled margin either side so the edge chevrons sit in open space next
  // to a neighbour card, not layered flush against its edge
  const chevronPad = 16
  /* READ ON A SETTLE LADDER, THEN OBSERVE (OB-136 clause 4): an observer's first callback
     arrives at observe time, before layout is final, and a box that settles once and never
     moves gets no second one — so an observer-only read kept that early number and the roll
     drew at its INITIAL scale forever. The ladder reads; the observer follows later changes. */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const refWidth = neighborWidth * 2 + liveWidth + gap * 2
    const read = () => {
      const box = wrapRef.current
      if (!box) return
      const w = box.getBoundingClientRect().width - chevronPad * 2
      if (!w) return
      setScale(Math.max(minScale, Math.min(maxScale, w / refWidth)))
    }
    const stop = settleRead(read)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stop(); if (ro) ro.disconnect() }
  }, [liveWidth, neighborWidth, minScale, maxScale])
  const sLive = Math.round(liveWidth * scale)
  /* the distance the live card actually moves when the roll advances one stop: half of it, the
     gap, and half of the neighbour it trades places with. DERIVED, NOT CHOSEN — do not re-tune it,
     and do not give the two directions different values. */
  const step = Math.round(((liveWidth + neighborWidth) / 2 + gap) * scale)
  const play = useCallback((dir: -1 | 1) => {
    const row = rowRef.current
    if (!row || typeof row.animate !== 'function') return
    if (anim.current) anim.current.cancel()
    /* READ THE DURATION AND THE CURVE OFF THE COMPUTED STYLE, never a literal: `--dur-move` is 1ms
       under `prefers-reduced-motion`, so honouring the setting is free and a hard-coded duration
       would drop it silently (the lesson `--dur-flight`'s comment in tokens/motion.css records).
       A token that does not resolve reads as 0 and plays as the 1ms cut below — never a guess. */
    const cs = getComputedStyle(row)
    const raw = (cs.getPropertyValue('--dur-move') || '').trim()
    const duration = raw.slice(-2) === 'ms' ? parseFloat(raw) : raw.slice(-1) === 's' ? parseFloat(raw) * 1000 : 0
    const easing = (cs.getPropertyValue('--ease-settle') || '').trim() || 'ease-out'
    setTravelDir(dir)
    const a = row.animate(
      [{ transform: 'translateX(' + dir * step + 'px)', opacity: 0.5 }, { transform: 'translateX(0px)', opacity: 1 }],
      { duration: duration || 1, easing, fill: 'none' },
    )
    anim.current = a
    /* the chevron's lean is released by the ANIMATION's own end, not by a second clock — the two
       timers in the first build could land in either order, and when the timer won it snapped the
       row home and stripped its transition. `finished` rejects on cancel; swallow that. */
    const done = () => { if (anim.current === a) { anim.current = null; setTravelDir(0) } }
    if (a.finished && typeof a.finished.then === 'function') a.finished.then(done, () => {})
    else a.onfinish = done
  }, [step])
  /* THE NUMBER IS THE AUTHORITY when the host passes one; our own clicks are the fallback for a host
     that does not, and are SUPPRESSED when it does so a click never plays the cue twice. The effect
     re-runs when `play` changes (a resize changes the step) and returns at once then, because
     `lastIndex` already holds the current index — only a real change of stop reaches `play`. */
  /* the DS's own effect: `play` sets the leaning chevron's state, and the one thing that starts a
     slide is a stop having changed — one reaction to one prop change, never a cascade per render */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const from = lastIndex.current
    lastIndex.current = stopIndex
    if (stopIndex == null || from == null || stopIndex === from) return
    play(stopIndex > from ? 1 : -1)
  }, [stopIndex, play])
  /* eslint-enable react-hooks/set-state-in-effect */
  const navigate = (dir: -1 | 1, fn: () => void) => () => { if (stopIndex == null) play(dir); fn() }
  const sNeighbor = Math.round(neighborWidth * scale)
  const sHeight = Math.round(height * scale)
  const sGap = Math.round(gap * scale)
  return (
    <div ref={wrapRef} data-filmroll onMouseEnter={() => setRoomHot(true)} onMouseLeave={() => setRoomHot(false)} style={{
      position: 'relative', height: sHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: sGap,
      background: 'var(--bark-100)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', boxSizing: 'border-box', padding: '0 ' + chevronPad + 'px', userSelect: 'none',
    }}>
      {/* THE CARDS TRAVEL AS ONE ROW, the chevrons do not — they are the fixed furniture of the roll
         and stay put while what they point at moves. The row's own style is STATIC: the movement is
         an animation on this element, so a frame that never runs leaves it at rest rather than
         parked at the displacement, and nothing here may carry a transform or an opacity of its own
         (kill the animation and the cards are at rest). `data-filmroll-row` is a test hook only. */}
      <div ref={rowRef} data-filmroll-row style={{ display: 'flex', alignItems: 'center', gap: sGap, willChange: 'transform' }}>
        {prev ? (
          <Mirror width={sNeighbor} content={prev.content} cornerLabel={'← ' + prev.stopLabel} dim
            flagged={prev.flagged} onToggleFlag={onToggleFlag && (() => onToggleFlag('prev'))}
            onNavigate={prev.onNavigate && navigate(-1, prev.onNavigate)} />
        ) : <div style={{ width: sNeighbor, flexShrink: 0 }} />}
        <Mirror width={sLive} content={current && current.content} cornerLabel={label} live projecting={projecting}
          flagged={current ? current.flagged : undefined} elapsed={projecting ? (current ? current.elapsed : undefined) : undefined}
          onToggleFlag={onToggleFlag && (() => onToggleFlag('current'))} onExpand={onExpand} />
        {next ? (
          <Mirror width={sNeighbor} content={next.content} cornerLabel={next.stopLabel + ' →'} dim
            flagged={next.flagged} onToggleFlag={onToggleFlag && (() => onToggleFlag('next'))}
            onNavigate={next.onNavigate && navigate(1, next.onNavigate)} />
        ) : <div style={{ width: sNeighbor, flexShrink: 0 }} />}
      </div>
      {prev && prev.onNavigate ? <EdgeChevron dir={-1} onClick={navigate(-1, prev.onNavigate)} roomHot={roomHot} traveling={travelDir === -1} /> : null}
      {next && next.onNavigate ? <EdgeChevron dir={1} onClick={navigate(1, next.onNavigate)} roomHot={roomHot} traveling={travelDir === 1} /> : null}
    </div>
  )
}
