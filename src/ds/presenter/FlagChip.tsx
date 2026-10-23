import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

import { CloseMark } from '../chrome/CloseMark'
import { wrapTip } from '../chrome/IconButton'
import { portalInto } from '../chrome/portal'
import { NOTE_CATEGORIES, TagGlyph } from './LectureNotes'

/* Typed port of the DS components/presenter/FlagChip.jsx (contract: FlagChip.d.ts), the flags-v4
   flag button (owner, 6 Oct): one chip, tap or hold, on the film roll's current frame and the recap's
   shown slide. */

/** one type on the ring — the same shape as `LectureNotes`' `NoteCategory` */
export interface FlagType {
  key: string
  glyph: string
  label: string
  /** the ring's and the tooltip's word ("fix" for "fix this slide"). Falls back to `label` */
  short?: string
  wash: string
}

/** THE FLAG CHIP'S NUMBERS.
 *  - `hold` (300ms) CHOSEN: long enough that a tap never opens the ring by accident, short enough
 *    that a deliberate hold does not feel like waiting; the chip fills edge-to-centre over it.
 *  - `chip` (22) IS the type tag: a circle in the type's wash, nothing around it — no border, no
 *    paper bezel (owner, 6 Oct, twice). Under the pointer it lifts (`--lift-1` → `--lift-2`) AND
 *    darkens a step: a `--surface-press` veil over its own wash (owner, 15 Oct: the lift alone did
 *    not read as hover). The veil is ON the chip's fill, so it shows over any slide.
 *  - THE WHEEL, COMPACT (owner, 6 Oct: the bigger one looked awkward): `ring` (40) centre to petal,
 *    `petal` (26) a type's own circle, no bezel, `centre` (32) the ✕ that cancels, `label` (14) a
 *    word's line. All CHOSEN on the render.
 *  - NO PLATE BEHIND THE WHEEL. A disc small enough to suit the compact wheel could not hold its
 *    words (they straddled its rim — verifier, 6 Oct), and one big enough was the old size again.
 *    Each piece carries its own paper instead: the petals are lifted circles, the ✕ a lifted paper
 *    circle, each word a lifted paper pill — legible over any slide, nothing to overhang.
 *  - `slop` (10) CHOSEN: how far past a petal's circle a release still lands on it.
 *  - `tag` (18) a type tag elsewhere at chip scale; `layer` (1000) the portal's z-index. */
export const FLAG_CHIP_METRICS = { hold: 300, chip: 22, tag: 18, ring: 40, petal: 26, centre: 32, label: 14, slop: 10, layer: 1000 }
const M = FLAG_CHIP_METRICS

/* the three-petal ring's angles (used when the usual type is not among the three), in degrees:
   top, bottom-left, bottom-right — the order of the three types
   passed in, so the default set puts "unclear" on top, "fix" bottom-left, "follow up" bottom-right */
const ANGLES = [-90, 150, 30]
/* the ring's angles once the usual type is left out: up-left and up-right, so both words sit above
   their petals and well apart (CHOSEN) */
const OTHER_ANGLES = [-150, -30]
/* THE WHEEL IS COMPACT (owner, 6 Oct: "smaller"): petals at `ring` 40, 26px circles, a 32px ✕.
   EACH WORD SITS ON THE OUTSIDE OF ITS PETAL — above the top one, below the two lower ones — so no
   word ever reaches the centre (the top word, hung underneath, had cropped the ✕'s selection ring). */
const radiusOf = () => M.ring

/* Every glyph on the chip and the ring is drawn through `TagGlyph`, which moves its ink onto the
   circle's centre (`GLYPH_DROP`, owner 21 Oct: the "!" sat high in the chip). The circles are ROUND
   (owner, 6 Oct: "circle shaped instead of square"); the notes pane's row tags stay square, since
   they sit in a column of text, where a box reads as a label. */

/** a type's short word for the ring and the tooltip — `short` when the category carries one,
 *  otherwise its label */
const shortOf = (c?: FlagType | null) => (c ? c.short || c.label : '')

/**
 * THE FLAG BUTTON — one chip, two gestures (owner, v4, 6 Oct). It sits on the presenter's current
 * film-roll frame (`FilmRoll onFlag`) and on the recap's shown slide (`LectureRecap onFlag`).
 *
 *  - TAP: one flag of the usual type, at once. Nothing else happens — no message, no pin on the
 *    slide; the new row in the notes pane's Flags list is the confirmation.
 *  - HOLD for `FLAG_CHIP_METRICS.hold` (300ms) or RIGHT-CLICK: a ring of the OTHER types opens
 *    around the chip with a CANCEL mark (✕) in its middle — the usual type is the tap, so it is not
 *    offered again (owner, 15 Oct); with three types that is two petals, up-left and up-right.
 *    HELD: slide onto a petal and let go;
 *    let go in the middle, or outside the ring, and nothing is made. A TYPE CHOSEN ON THE RING
 *    BECOMES THE USUAL ONE (owner, 15 Oct): the flag is made, and the chip now shows and taps that
 *    type. RIGHT-CLICKED (or
 *    opened from the keyboard): the ring stays open for a click; Esc or a click outside closes it.
 *  - KEYBOARD, on a focused chip: Enter/Space is the tap; ↑ or the context-menu key opens the ring.
 *    THERE IS NO GLOBAL KEY (owner, 6 Oct — the old F key went): a flag can never be made by typing.
 *
 * WHAT THE HOST MUST DO:
 *  1. `onFlag(key)` ADDS A BARE FLAG to the slide the chip is on — `{ stop, category: key, text: '',
 *     when, at: Date.now() }`, the same entry the notes pane's composer writes, in the same list. A
 *     flag is a note with a type and no words yet; there is no second store. Pressing the same type
 *     twice makes two rows.
 *  2. Pass the USER's type list's first three as `types` (or omit for the defaults). Only the first
 *     three ever appear on the ring; a type the professor added appears in the composer's menu only.
 *  3. HOLD AND STORE `usual`, and pass `onUsualChange` (owner, 15 Oct, REVERSING the 6 Oct Q2 "a
 *     fixed setting, never the last used"): a type picked on the ring becomes the usual one and
 *     must SURVIVE A RELOAD — store it against the user, like the type list. Pass the same key to
 *     every chip (`FilmRoll usualFlag`, `LectureRecap usualFlag`) and to `LectureNotes usualFlag`,
 *     so the roll, the recap and the composer agree. Without `onUsualChange` the chip remembers
 *     a ring pick only while mounted, and a change to the `usual` prop still takes over.
 *
 * THE RING IS PAINTED ON `document.body`, fixed at the chip's centre, so an `overflow: hidden`
 * parent (a film-roll frame) cannot clip it; it may cover the neighbouring frames while open.
 */
export interface FlagChipProps {
  /** the ring types' source, in order. Default the first three of `NOTE_CATEGORIES` (unclear, fix,
   *  follow up). Only the first three are read; the usual one is left off the ring */
  types?: FlagType[]
  /** the key a TAP makes, and the type the chip shows at rest. Default 'fix'. Host-held: see 3 */
  usual?: string
  /** a type was picked ON THE RING that is not the usual one: it is the usual one now. Store it */
  onUsualChange?: (key: string) => void
  /** a type was chosen — by tap, by release on the ring, or by click on it */
  onFlag?: (key: string) => void
  /** the spoken name. Default "flag this slide" */
  title?: string
  /** show "tap to flag · hold to change flag" as the tooltip. Default true. The v4 sheet shows it only until
   *  the ring has been opened twice; that count is the host's (`onRingOpen`) */
  hint?: boolean
  /** fired each time the ring opens — for a host counting toward switching `hint` off */
  onRingOpen?: () => void
  /** draws the ring open from mount, IN PLACE around the chip (not portalled, so nothing to measure
   *  and nothing to detach on scroll), blocking nothing around it — FOR SPECIMEN CARDS, so the ring
   *  can be drawn without a hand on it. A host never passes it. Default false */
  openOnMount?: boolean
  /** merged over the chip's own face, last */
  style?: CSSProperties
}

type Ring = { x: number; y: number; mode: 'hold' | 'click' | 'pin' }
type Petal = { cat: FlagType; dx: number; dy: number }

export function FlagChip({ types, usual = 'fix', onUsualChange, onFlag, title, hint = true, onRingOpen, openOnMount = false, style }: FlagChipProps) {
  const list: FlagType[] = (types || NOTE_CATEGORIES).slice(0, 3)
  /* THE USUAL TYPE FOLLOWS THE LAST ONE CHOSEN ON THE RING (owner, 15 Oct: "if u select those other
     option, it will become the default one. and the default one saves"). With `onUsualChange` the
     host holds and STORES it; without, the chip remembers it for as long as it is mounted */
  const [ownUsual, setOwnUsual] = useState(usual)
  /* a host that changes `usual` without `onUsualChange` (a settings page, a stored value read late)
     still wins: the chip's own memory resyncs to the prop whenever the prop moves. Compared during
     render rather than from an effect, so the resync lands in the same paint */
  const [seenUsual, setSeenUsual] = useState(usual)
  if (seenUsual !== usual) { setSeenUsual(usual); setOwnUsual(usual) }
  const usualKey = onUsualChange ? usual : ownUsual
  const usualCat = list.filter((c) => c.key === usualKey)[0] || list[0]
  const btn = useRef<HTMLButtonElement | null>(null)
  const [ring, setRing] = useState<Ring | null>(null)
  const ringRef = useRef<Ring | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [hot, setHot] = useState(false)
  const [holding, setHolding] = useState(false)
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const fillAnim = useRef<Animation | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /* THE HOLD FILLS THE CHIP FROM ITS EDGE TO ITS CENTRE (owner, 6 Oct: "so we know how long to
     hold"). One `Element.animate()` on an inset shadow INSIDE the circle — a deeper shade of the
     type's own wash closing in, the glyph drawn on top — linear over exactly `hold` ms, the same
     clock the timer runs on, so it closes at the moment the ring opens. Released early (a tap), it
     is cancelled and leaves nothing behind. */
  useEffect(() => {
    const el = fillRef.current
    if (!holding || !el || typeof el.animate !== 'function') return undefined
    const r = Math.ceil(M.chip / 2)
    const shade = 'color-mix(in srgb, var(--text-1) 22%, transparent)'
    fillAnim.current = el.animate([{ boxShadow: 'inset 0 0 0 0px ' + shade }, { boxShadow: 'inset 0 0 0 ' + r + 'px ' + shade }], { duration: M.hold, easing: 'linear', fill: 'forwards' })
    return () => { if (fillAnim.current) { fillAnim.current.cancel(); fillAnim.current = null } }
  }, [holding])
  /* THE RING SHOWS ONLY THE OTHER TYPES (owner, 15 Oct): the usual one is the tap, so it is not
     offered again. Two petals sit up-left and up-right of the chip (`OTHER_ANGLES`) */
  const others = usualCat ? list.filter((c) => c.key !== usualCat.key) : list
  const angles = others.length === 2 ? OTHER_ANGLES : ANGLES
  const petals: Petal[] = others.map((cat, i) => {
    const a = (angles[i] * Math.PI) / 180
    return { cat, dx: Math.round(Math.cos(a) * radiusOf()), dy: Math.round(Math.sin(a) * radiusOf()) }
  })
  /* WHAT A RELEASE AT (x, y) MEANS: the nearest petal if the pointer is within its circle plus the
     slop; ANYWHERE ELSE — the centre included — nothing. THE CENTRE CANCELS (owner, 6 Oct: "when i
     hold and drag to the centre, it should cancel"). The usual type is the TAP; once the ring is
     open, every type is a petal and the way back out is the middle. */
  const pickAt = (x: number, y: number, r: Ring): string | null => {
    const dx = x - r.x
    const dy = y - r.y
    let best: Petal | null = null
    let bd = Infinity
    for (const p of petals) { const d = Math.hypot(dx - p.dx, dy - p.dy); if (d < bd) { bd = d; best = p } }
    if (best && bd <= M.petal / 2 + M.slop) return best.cat.key
    if (Math.hypot(dx, dy) <= M.centre / 2) return 'cancel'
    return null
  }
  const close = useCallback(() => { ringRef.current = null; setRing(null); setPick(null); setHolding(false) }, [])
  const fire = (k: string | null) => {
    if (!(ringRef.current && ringRef.current.mode === 'pin')) close()
    if (!k || k === 'cancel' || !onFlag || !usualCat) return
    const key = k === 'usual' ? usualCat.key : k
    onFlag(key)
    /* a type picked on the ring becomes the usual one */
    if (key !== usualCat.key) { if (onUsualChange) onUsualChange(key); else setOwnUsual(key) }
  }
  const open = (mode: Ring['mode']) => {
    const el = btn.current
    if (!el) return
    const b = el.getBoundingClientRect()
    /* a PINNED ring is drawn in place around the chip (below), so it needs no measurement — a
       one-time read on mount could land before layout and strand the ring at 0,0 (verifier, 6 Oct) */
    const r: Ring = { x: b.left + b.width / 2, y: b.top + b.height / 2, mode }
    ringRef.current = r
    setRing(r)
    setPick(mode === 'hold' ? 'cancel' : null)
    setHolding(false)
    if (onRingOpen) onRingOpen()
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  /* a SPECIMEN opens the ring once, in click mode, so a card can draw the ring without a hand on it.
     The dependency list stays empty on purpose: `open` is re-made every render, and re-running this
     would open the ring again */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => { if (openOnMount) { const id = setTimeout(() => open('pin'), 60); return () => clearTimeout(id) } return undefined }, [])
  /* eslint-enable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!ring) return undefined
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); if (btn.current) btn.current.focus() } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [ring, close])
  const down = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    clearTimeout(timer.current)
    setHolding(true)
    timer.current = setTimeout(() => open('hold'), M.hold)
    const move = (ev: PointerEvent) => { const r = ringRef.current; if (r && r.mode === 'hold') setPick(pickAt(ev.clientX, ev.clientY, r)) }
    const up = (ev: PointerEvent) => {
      clearTimeout(timer.current)
      setHolding(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      const r = ringRef.current
      if (!r) fire('usual')
      else if (r.mode === 'hold') fire(pickAt(ev.clientX, ev.clientY, r))
    }
    const cancel = () => {
      clearTimeout(timer.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      close()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }
  const name = title || 'flag this slide'
  const tip = hint && usualCat ? 'tap to flag · hold to change flag' : name
  /* 'click' (right-click / keyboard) waits for a click and closes on one outside; 'pin' (a specimen)
     stays open and blocks nothing around it */
  const clickMode = !!ring && (ring.mode === 'click' || ring.mode === 'pin')
  const blocking = !!ring && ring.mode === 'click'
  const ringBody = ring ? (<Fragment>
        <button type="button" role="menuitem" aria-label="cancel" title={wrapTip('cancel — no flag')}
          onMouseEnter={clickMode ? () => setPick('cancel') : undefined} onClick={clickMode ? () => fire('cancel') : undefined}
          style={{ position: 'absolute', left: -M.centre / 2, top: -M.centre / 2, width: M.centre, height: M.centre, padding: 0, boxSizing: 'border-box', pointerEvents: clickMode ? 'auto' : 'none', borderRadius: '50%', background: 'var(--surface-paper)', border: pick === 'cancel' ? '2px solid var(--border-strong)' : '1px solid var(--border-rule)', color: pick === 'cancel' ? 'var(--text-1)' : 'var(--text-2)', boxShadow: 'var(--lift-2)', display: 'grid', placeItems: 'center', cursor: clickMode ? 'pointer' : 'default' }}>
          <CloseMark size={11} />
        </button>
        {petals.map((p, i) => {
          const on = pick === p.cat.key
          return (
            <button key={p.cat.key} type="button" role="menuitem" autoFocus={blocking && i === 0}
              onMouseEnter={clickMode ? () => setPick(p.cat.key) : undefined} onFocus={clickMode ? () => setPick(p.cat.key) : undefined}
              onClick={clickMode ? () => fire(p.cat.key) : undefined}
              style={{ position: 'absolute', left: p.dx, top: p.dy, transform: p.dy < 0 ? 'translate(-50%, calc(-100% + ' + M.petal / 2 + 'px))' : 'translate(-50%, -' + M.petal / 2 + 'px)', display: 'flex', flexDirection: p.dy < 0 ? 'column-reverse' : 'column', alignItems: 'center', gap: 2, padding: 0, border: 'none', pointerEvents: clickMode ? 'auto' : 'none', background: 'transparent', cursor: clickMode ? 'pointer' : 'default', whiteSpace: 'nowrap', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: on ? 'var(--fw-semibold)' : 'var(--fw-regular)', color: on ? 'var(--text-1)' : 'var(--text-2)' }}>
              {/* A PETAL IS THE TYPE'S OWN CIRCLE, like the chip — no paper bezel round it (owner, 6 Oct). The
                 one under the hand lifts and takes a ring drawn INSIDE its edge (owner, 15 Oct: the old
                 outline sat 2px off the circle and the gap looked wrong). Inset, so nothing grows into
                 the word below it. INSTANT, no transition: the hand sweeps across the petals, so this
                 is a tracking highlight (--transition-wash-tracking) */}
              <span style={{ width: M.petal, height: M.petal, boxSizing: 'border-box', borderRadius: '50%', background: p.cat.wash, boxShadow: on ? 'inset 0 0 0 2px var(--border-strong), var(--lift-2)' : 'var(--lift-1)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}><TagGlyph glyph={p.cat.glyph} /></span>
              {/* THE WORD LIGHTS WITH ITS PETAL (owner, 15 Oct): the picked one's pill takes the type's own
                 wash and lifts, so the word and the circle read as one choice; the rest stay paper */}
              <span style={{ padding: '0 5px', borderRadius: 'var(--radius-pill)', background: on ? p.cat.wash : 'var(--surface-paper)', boxShadow: on ? 'var(--lift-2)' : 'var(--lift-1)', lineHeight: M.label + 'px', transition: 'var(--transition-wash-tracking)' }}>{shortOf(p.cat)}</span>
            </button>
          )
        })}
</Fragment>) : null
  const pinned = !!ring && ring.mode === 'pin'
  const layer = !ring || pinned || typeof document === 'undefined' ? null : portalInto(document.body, (
    <div role={clickMode ? 'menu' : undefined} aria-label="flag type"
      onMouseDown={blocking ? (e) => { if (e.target === e.currentTarget) close() } : undefined}
      onContextMenu={blocking ? (e) => { e.preventDefault(); close() } : undefined}
      style={{ position: 'fixed', inset: 0, zIndex: M.layer, pointerEvents: blocking ? 'auto' : 'none' }}>
      <div style={{ position: 'absolute', left: ring.x, top: ring.y, width: 0, height: 0 }}>{ringBody}</div>
    </div>
  ))
  return (
    <span style={{ position: 'relative', display: 'inline-grid' }}>
      {pinned ? <span role="menu" aria-label="flag type" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, zIndex: M.layer }}>{ringBody}</span> : null}
      <button ref={btn} type="button" aria-label={name} aria-haspopup="menu" aria-expanded={!!ring} title={ring ? undefined : wrapTip(tip)}
        onPointerDown={down}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); open('click') }}
        onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fire('usual') }
          else if (e.key === 'ArrowUp' || e.key === 'ContextMenu') { e.preventDefault(); e.stopPropagation(); open('click') }
        }}
        onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
        style={{ position: 'relative', display: 'grid', placeItems: 'center', width: M.chip, height: M.chip, padding: 0, boxSizing: 'border-box', borderRadius: '50%', border: 'none', overflow: 'hidden', background: usualCat ? usualCat.wash : 'var(--surface-paper)', /* THE CHIP IS THE TAG: no bezel. It answers the pointer by LIFTING — over a slide a wash change would vanish into whatever is drawn there, and a ring round it is the bezel the owner asked to lose */ boxShadow: hot || ring || holding ? 'var(--lift-2)' : 'var(--lift-1)', cursor: 'pointer', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', transition: 'var(--transition-wash)', ...style }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', background: hot && !holding && !ring ? 'var(--surface-press)' : 'transparent', transition: 'var(--transition-wash)' }} />
        <span ref={fillRef} aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', visibility: holding ? 'visible' : 'hidden' }} />
        <span aria-hidden="true" style={{ position: 'relative', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}>{usualCat ? <TagGlyph glyph={usualCat.glyph} /> : ''}</span>
      </button>
      {layer}
    </span>
  )
}

/** the same pick arithmetic under a reachable name, for cards and probes: `angles` and
 *  `petalAt(i)` (the offset of petal i from the chip's centre). The chip itself is the supported
 *  surface. */
export const FlagRing = {
  angles: ANGLES,
  otherAngles: OTHER_ANGLES,
  petalAt(i: number) { const a = (ANGLES[i] * Math.PI) / 180; return { dx: Math.round(Math.cos(a) * radiusOf()), dy: Math.round(Math.sin(a) * radiusOf()) } },
}
