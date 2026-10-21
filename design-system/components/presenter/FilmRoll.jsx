import React from 'react'
import { FlagMark } from '../chrome/FlagMark.jsx'
import { ExpandMark } from '../chrome/ExpandMark.jsx'
import { wrapTip, useRecede } from '../chrome/IconButton.jsx'
import { settleRead } from '../chrome/MeasureBox.jsx'
import { FlagChip } from './FlagChip.jsx'

const ASPECT = 630 / 1120 // every slide, whole neighbours included, is this shape

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
function Mirror({ width, content, cornerLabel, live, projecting = true, dim, flagged, elapsed, onToggleFlag, onExpand, onNavigate, chip }) {
  const [hot, setHot] = React.useState(false)
  /* the ghost flag and the expand button both wait out the app's own recede clock
     (`useRecede`, `chrome/IconButton`) before they disappear — the same grace period
     as a pane's close button, so a hover-revealed control doesn't vanish under the
     cursor's heels the instant it drifts off the card. */
  const [hovered, showReveal, hideReveal] = useRecede()
  /* KEYBOARD FOCUS REVEALS THE CORNERS TOO (2026-10-02, answering `receipts/9b89dce.md`). Both
     corner controls stay in the tab order at rest; the moment one takes focus the card counts as
     revealed, the same as a hover, and it stays revealed until focus leaves the card. Before, the
     corners left the tab order while hidden, so "full screen" had no keyboard route at all. This is
     `PresetButton`'s keyboard reveal, applied to the whole card. */
  const [focusIn, setFocusIn] = React.useState(false)
  const revealed = hovered || focusIn
  const onFocus = () => setFocusIn(true)
  const onBlur = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusIn(false) }
  const height = Math.round(width * ASPECT)
  const glyphSize = dim ? 13 : 16
  const clickable = !!onNavigate
  const enter = () => { setHot(true); showReveal() }
  const leave = () => { setHot(false); hideReveal() }
  return (
    <div onMouseEnter={enter} onMouseLeave={leave} onFocus={onFocus} onBlur={onBlur} onClick={onNavigate} style={{
      position: 'relative', flexShrink: 0, width, height, overflow: 'hidden', cursor: clickable ? 'pointer' : 'default',
      background: 'var(--bark-50)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
      boxShadow: live ? 'var(--lift-3)' : 'none', boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', inset: 0 }}>{content}</div>
      {dim ? <div style={{ position: 'absolute', inset: 0, background: 'var(--bark-200)', opacity: clickable && hot ? 0.32 : 0.58, transition: 'var(--transition-wash)' }} /> : null}
      {cornerLabel ? (
        <div style={{
          position: 'absolute', left: 0, top: 0, zIndex: 3, display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 9px', background: 'var(--bark-800)', color: 'var(--bark-100)',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)',
          letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', borderBottomRightRadius: 'var(--radius-xs)',
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
            <React.Fragment>
              <span style={{ width: 1, height: 10, background: 'var(--bark-600)', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-regular)', letterSpacing: 0, textTransform: 'none', color: 'var(--bark-300)' }}>{elapsed}</span>
            </React.Fragment>
          ) : null}
        </div>
      ) : null}
      {/* the flag corner: filled and always shown once set; an outline only while this
         card (or its expand/flag control) is recently hovered — never a solid flag for a
         state that isn't true. */}
      {/* THE FLAG CHIP TAKES THE CORNER ON THE CURRENT FRAME (v4, owner 6 Oct): a flagged current
         slide shows the chip, not the mark — the notes pane beside it already lists its flags. */}
      {chip ? (
        <span style={{ position: 'absolute', right: 6, top: 5, zIndex: 3 }}>{chip}</span>
      ) : onToggleFlag ? (
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

/** THE FLAG BUTTON, published (2026-09-04) so the notes pane can wear the SAME control on the
 *  prepared column's head — one drawing of "flag this stop", not two. Filled acorn when set, an
 *  outline at reduced opacity when not; `size` is the hit box (24 on a slide card, 20 beside a
 *  20px pencil in a pane head), `glyphSize` the mark. */
export function FlagButton({ flagged, dim, glyphSize = 12, size = 24, lift = 0, onClick, title, tabIndex }) {
  const [hot, setHot] = React.useState(false)
  /* ONE FIXED NAME; `aria-pressed` CARRIES THE STATE (2026-10-02, answering `receipts/9b89dce.md`).
     The name used to flip to its negation while `aria-pressed` was also true, so a screen reader
     heard the state twice, in a name that contradicted it. */
  const name = title || 'flag this slide'
  return (
    <button type="button" title={wrapTip(name)} aria-label={name}
      aria-pressed={onClick ? !!flagged : undefined} tabIndex={tabIndex}
      onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
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

function ExpandButton({ onClick, revealed }) {
  const [hot, setHot] = React.useState(false)
  return (
    <button type="button" title={wrapTip('full screen')} aria-label="full screen"
      onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', right: 9, bottom: 9, zIndex: 3, width: 26, height: 26, borderRadius: 7,
        display: 'grid', placeItems: 'center', background: hot ? 'var(--bark-800)' : 'color-mix(in srgb, var(--surface-raised) 92%, transparent)',
        border: '1px solid ' + (hot ? 'var(--bark-800)' : 'var(--border-rule)'),
        color: hot ? 'var(--text-inverse)' : 'var(--text-1)', boxShadow: hot ? 'var(--lift-2)' : 'var(--lift-1)',
        opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none',
        cursor: 'pointer', transition: 'var(--transition-wash), opacity var(--dur-fade) var(--ease-soft)',
      }}>
      <ExpandMark size={13} />
    </button>
  )
}

/** A big chevron over the roll's outer edge, ADDITIONAL to a neighbour's whole-card
 *  click — it puts an obvious "you can advance" affordance where the pointer already
 *  is for a professor scanning the roll left to right, without waiting to notice the
 *  dimmed card itself is clickable. Both point at the same `onNavigate` a neighbour
 *  card already carries, so there is exactly one way each direction actually moves. */
function EdgeChevron({ dir, onClick, roomHot, traveling }) {
  const [hot, setHot] = React.useState(false)
  return (
    <button type="button" title={wrapTip(dir < 0 ? 'previous stop' : 'next stop')} aria-label={dir < 0 ? 'previous stop' : 'next stop'}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} style={{
        position: 'absolute', [dir < 0 ? 'left' : 'right']: 6, top: '50%',
        /* the nudge is the chevron's half of the travel: while the roll slides, the chevron for
           THAT direction goes full weight and leans 3px the way it is sending you, so the
           direction is readable from the control you actually pressed as well as from the cards */
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

/** The film roll: the live slide with its two whole neighbours, one flag corner rule on
 *  every card, full screen on the live card only. Part 2 of the presenter-mode split (see
 *  `guidelines/presenter-component-split-plan.md`) — settled, no open calls.
 *
 *  THE HOST SUPPLIES SLIDE CONTENT (`prev.content` / `current.content` / `next.content`);
 *  this component only places it, the same split `WalkPreview` already makes for a hover
 *  card. It never renders an actual slide itself.
 *
 *  A NEIGHBOUR NAVIGATES ON A CLICK OF THE WHOLE CARD, not its corner tag — pass
 *  `onNavigate` on `prev`/`next` and the whole dimmed card becomes the target, lightening
 *  on hover to say so. Omit it and the card is a plain preview, not a control.
 *
 *  THE ROLL FILLS ITS CONTAINER — it doesn't stretch a bordered frame around fixed-size
 *  cards (which left dead space either side on any container wider than the cards' own
 *  total). `height`/`liveWidth`/`neighborWidth` are the REFERENCE sizes at scale 1; a
 *  ResizeObserver on the wrapper scales all three together so the three cards' combined
 *  width always matches the container — bigger presenter screen, bigger cards, same
 *  proportions, never a gap. Clamped between `minScale` and `maxScale` so a narrow
 *  container doesn't crush the cards and a very wide one doesn't blow the type up past
 *  what the reference sizes were drawn for.
 *
 *  THE TRAVEL FRAME (owner, 2026-09-16). Advancing used to be a cut: the three cards swapped their
 *  contents between two frames and nothing said which way you had gone, so a professor pressing
 *  the wrong chevron could not tell from the roll. Now every stop CHANGE plays one short slide —
 *  the row of cards starts one step displaced (half the live card + half a neighbour + the gap, the
 *  real distance the live card travels) on the side it came FROM, at 0.5 opacity, and settles to
 *  rest over `--dur-move`, so forward reads as content moving left and back as content moving
 *  right. It is a CUE, not a filmstrip: the cards are already carrying their new contents when the
 *  slide starts, and one step is not the same distance for both directions' neighbours.
 *  `--dur-move` collapses to 1ms under `prefers-reduced-motion`, which turns this back into the
 *  cut it was, deliberately.
 *
 *  THE MOVE IS ONE `Element.animate()` CALL AND NOTHING ELSE HOLDS A POSITION. The first build
 *  committed a displaced frame with `transition: none`, then re-rendered to zero WITH a transition,
 *  and the transition arrived after the element had already reached rest — a frozen half-opacity
 *  hold followed by a snap, which is worse than the cut it replaced. Starting a transition in the
 *  commit that first introduces the `transition` property is fragile; worse, that build had a
 *  `requestAnimationFrame` return racing a `setTimeout` reset, and rAF is exactly what stops in a
 *  backgrounded window (`receipts/b546186.md`). Web Animations owns the whole move now: no
 *  displaced React state, no rAF pair, no settle timer and nothing to race.
 *  THE GUARANTEE IS NARROWER THAN "IT CAN NEVER PARK", AND THE NARROW VERSION IS THE TRUE ONE
 *  (measured 2026-09-16, verifier): a pending or frame-starved animation APPLIES ITS FIRST
 *  KEYFRAME, so in a window getting no frames the row does hold at the displacement, at 0.5
 *  opacity, until frames resume — `playState` "running", `currentTime` 0, held past 1.2s in a
 *  starved harness. What this shape guarantees is that no REACT STATE holds the displacement: the
 *  row's own style is static, so a remount, a cancel, or an environment without `animate()` rests.
 *  A backgrounded presenter window can still hold the frame, exactly as `receipts/b546186.md`
 *  would predict — it just cannot get STUCK there, because nothing but the animation is moving it.
 *
 *  PASS `current.stopIndex` AND THE CUE COVERS EVERY WAY A STOP CHANGES — keyboard arrows, the
 *  strip, the finder, a jump — because the direction is then read from the number, not from which
 *  control was pressed. Without it the roll can only see its OWN clicks (chevron and neighbour
 *  card), and a keyboard advance plays nothing; nothing breaks, the cue is just partial.
 *
 *  PROJECTING OR NOT (owner, 2026-09-03). `projecting={false}` is a PREVIEW of the layout with
 *  nothing on the projector: the live card's label defaults to "Not on the projector" (the direct
 *  negation of the live default, same words, so the eye compares), its moss dot becomes a hollow
 *  bark ring (the header bar's preview mark), and `current.elapsed` is not drawn — nothing is
 *  being timed. Pass `liveLabel` to override either default. */
export function FilmRoll({
  height = 286, liveWidth = 470, neighborWidth = 336, liveLabel, projecting = true,
  prev, current, next, onToggleFlag, onExpand, minScale = 0.55, maxScale = 1.6,
  onFlag, flagTypes, usualFlag, onUsualFlagChange, flagHint, onFlagRingOpen,
}) {
  /* v4 (owner, 6 Oct): THE ROLL IS FOR QUICK FLAGGING; THE NOTES PANE IS THE LOG. With `onFlag` the
     current frame wears `FlagChip` (tap = the usual type, hold = the ring) and every other frame
     wears the plain mark when `flagged` — no type, no count, not a control. `onToggleFlag` (the
     per-slide switch) is the old model and is ignored once `onFlag` is passed. */
  const toggle = onFlag ? undefined : onToggleFlag
  const chip = onFlag ? <FlagChip types={flagTypes} usual={usualFlag} onUsualChange={onUsualFlagChange} hint={flagHint} onFlag={onFlag} onRingOpen={onFlagRingOpen} /> : null
  const label = liveLabel != null ? liveLabel : projecting ? 'On the projector now' : 'Not on the projector'
  /* TRAVEL. The only STATE is which chevron leans — the row's movement lives entirely in a
     Web Animations animation on the row itself, so React never holds a displaced position and a
     dropped frame cannot leave one on screen. */
  const [travelDir, setTravelDir] = React.useState(0)
  const rowRef = React.useRef(null)
  const anim = React.useRef(null)
  const stopIndex = current && typeof current.stopIndex === 'number' ? current.stopIndex : null
  const lastIndex = React.useRef(stopIndex)
  React.useEffect(() => () => { if (anim.current) anim.current.cancel() }, [])
  const wrapRef = React.useRef(null)
  const [scale, setScale] = React.useState(1)
  // brightens the edge chevrons a step above their resting dim the moment the pointer is
  // anywhere in the roll's own grey pane — a lighter cue than the chevron's OWN hover,
  // which still goes brighter still on direct contact
  const [roomHot, setRoomHot] = React.useState(false)
  const gap = 8
  // reserved, unscaled margin either side so the edge chevrons sit in open space next
  // to a neighbour card, not layered flush against its edge
  const chevronPad = 16
  /* READ ONCE DIRECTLY, THEN OBSERVE. Observer-only, this reported nothing in a host where
     `ResizeObserver` never fires (the preview the cards are read in is one, found 2026-09-04) and
     the roll then drew at its INITIAL scale forever — a silent wrong size, which is the worst kind.
     The observer is the follow-up; the first read is the answer. */
  React.useEffect(() => {
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
    let ro = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stop(); if (ro) ro.disconnect() }
  }, [liveWidth, neighborWidth, minScale, maxScale])
  const sLive = Math.round(liveWidth * scale)
  /* the distance the live card actually moves when the roll advances one stop: half of it, the
     gap, and half of the neighbour it trades places with. Derived, not chosen. */
  const step = Math.round(((liveWidth + neighborWidth) / 2 + gap) * scale)
  const play = (dir) => {
    const row = rowRef.current
    if (!dir || !row || typeof row.animate !== 'function') return
    if (anim.current) anim.current.cancel()
    /* READ THE DURATION AND THE CURVE OFF THE COMPUTED STYLE, never a literal: `--dur-move` is
       1ms under `prefers-reduced-motion`, so honouring the setting is free and a hard-coded 200
       would drop it silently (the lesson `--dur-flight`'s comment in tokens/motion.css records). */
    const cs = getComputedStyle(row)
    const raw = (cs.getPropertyValue('--dur-move') || '').trim()
    const duration = raw.slice(-2) === 'ms' ? parseFloat(raw) : raw.slice(-1) === 's' ? parseFloat(raw) * 1000 : 200
    const easing = (cs.getPropertyValue('--ease-settle') || '').trim() || 'ease-out'
    setTravelDir(dir)
    const a = row.animate(
      [{ transform: 'translateX(' + dir * step + 'px)', opacity: 0.5 }, { transform: 'translateX(0px)', opacity: 1 }],
      { duration: duration || 1, easing: easing, fill: 'none' },
    )
    anim.current = a
    /* the chevron's lean is released by the ANIMATION's own end, not by a second clock — the two
       timers in the first build could land in either order, and when the timer won it snapped the
       row home and stripped its transition. `finished` rejects on cancel; swallow that. */
    const done = () => { if (anim.current === a) { anim.current = null; setTravelDir(0) } }
    if (a.finished && typeof a.finished.then === 'function') a.finished.then(done, () => {})
    else a.onfinish = done
  }
  /* the number is the authority when the host passes one; our own clicks are the fallback for a
     host that does not, and are SUPPRESSED when it does so a click never plays the cue twice. */
  React.useEffect(() => {
    const from = lastIndex.current
    lastIndex.current = stopIndex
    if (stopIndex == null || from == null || stopIndex === from) return
    play(stopIndex > from ? 1 : -1)
  }, [stopIndex])
  const navigate = (dir, fn) => () => { if (stopIndex == null) play(dir); fn() }
  const sNeighbor = Math.round(neighborWidth * scale)
  const sHeight = Math.round(height * scale)
  const sGap = Math.round(gap * scale)
  return (
    <div ref={wrapRef} onMouseEnter={() => setRoomHot(true)} onMouseLeave={() => setRoomHot(false)} style={{
      position: 'relative', height: sHeight, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: sGap,
      background: 'var(--bark-100)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)',
      overflow: 'hidden', boxSizing: 'border-box', padding: '0 ' + chevronPad + 'px', userSelect: 'none',
    }}>
      {/* THE CARDS TRAVEL AS ONE ROW, the chevrons do not — they are the fixed furniture of the
         roll and stay put while what they point at moves. The row's own style is STATIC: the
         movement is an animation on this element, so a frame that never runs leaves it at rest
         rather than parked at the displacement. */}
      <div ref={rowRef} style={{ display: 'flex', alignItems: 'center', gap: sGap, willChange: 'transform' }}>
        {prev ? (
          <Mirror width={sNeighbor} content={prev.content} cornerLabel={'\u2190 ' + prev.stopLabel} dim
            flagged={prev.flagged} onToggleFlag={toggle && (() => toggle('prev'))}
            onNavigate={prev.onNavigate && navigate(-1, prev.onNavigate)} />
        ) : <div style={{ width: sNeighbor, flexShrink: 0 }} />}
        <Mirror width={sLive} content={current && current.content} cornerLabel={label} live projecting={projecting}
          flagged={current && current.flagged} elapsed={projecting ? current && current.elapsed : undefined}
          onToggleFlag={toggle && (() => toggle('current'))} onExpand={onExpand} chip={chip} />
        {next ? (
          <Mirror width={sNeighbor} content={next.content} cornerLabel={next.stopLabel + ' \u2192'} dim
            flagged={next.flagged} onToggleFlag={toggle && (() => toggle('next'))}
            onNavigate={next.onNavigate && navigate(1, next.onNavigate)} />
        ) : <div style={{ width: sNeighbor, flexShrink: 0 }} />}
      </div>
      {prev && prev.onNavigate ? <EdgeChevron dir={-1} onClick={navigate(-1, prev.onNavigate)} roomHot={roomHot} traveling={travelDir === -1} /> : null}
      {next && next.onNavigate ? <EdgeChevron dir={1} onClick={navigate(1, next.onNavigate)} roomHot={roomHot} traveling={travelDir === 1} /> : null}
    </div>
  )
}
