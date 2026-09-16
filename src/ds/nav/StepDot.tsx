import { Fragment, useId } from 'react'

import { wrapTip } from '../chrome/IconButton'

/** A numbered stop on the active walk: done (behind the cursor), current (the
 *  cursor), or ahead (not yet reached). Two variants of the same three states —
 *  `rail` (default) is the strip's own dense fill-and-wash reading; `pin` is for
 *  the SAME dot pinned over a map, where the territory under it already carries
 *  colour: paper-white face, the state's colour on the ring and the number
 *  instead of on a fill, and a lighter number weight so the mark reads as a
 *  small label rather than a filled badge competing with the map's own ink.
 *  Typed port of the DS StepDot.jsx (contract: StepDot.d.ts) — RE-PORTED WHOLE
 *  2026-09-16 against the 2026-09-15 source (DS OB-187): `progress` and its
 *  `useId` clip path, and the rail's `current` face gate on the wash.
 *
 *  THE WHOLE FACE IS ONE SVG (ported 2026-08-26, DS OB-088). Fill, ring and the
 *  optional dash all live in the same coordinate system and the same rendering
 *  pipeline. The previous shape here — a CSS `border-radius` circle with an SVG
 *  dash laid over it — asked two SEPARATE renderers to agree on an identical
 *  curve's edge to the sub-pixel, and on real displays they do not: the dash
 *  showed a faint halo, and pulling it inward for margin then read as a second,
 *  thicker ring. Neither is fixable by tuning a number, because the disagreement
 *  is BETWEEN renderers. One SVG has no second renderer to disagree with. */
export interface StepDotProps {
  /** the stop's ADDRESS — two numbers, `"1.4"` (`WalkParts.walkAddresses`) — or a plain stop
   *  number on a surface that has no group structure to address, OR a contiguous range label
   *  (`"1.1–1.3"`, and the older flat-index `"1-3"`) when one map pin stands for several
   *  adjacent walk steps that share a node/territory. A range's `state` is the caller's to
   *  derive from its member steps (done if all are behind the cursor, current if the cursor is
   *  inside it, else ahead) — StepDot only draws the label it's given. A range draws as an
   *  auto-width PILL rather than a circle, the plain CSS way; see the `isRange` branch.
   *
   *  A RANGE IS A STRING OVER ONE CHARACTER. A NUMBER IS NEVER A RANGE: 10, 25 and 60
   *  are circles exactly like 1–9. Until the DS fixed it (2026-09-01) the test read
   *  `String(n).length > 1`, and this port carried it faithfully — so every stop from
   *  ten on took the auto-width pill branch and drew flattened (DS OB-129).
   *
   *  A MAP PIN AND A DOCK DOT CARRY THE TWO-NUMBER ADDRESS (`"1.4"`), OR A RANGE OF TWO OF THEM
   *  (`"1.1–1.3"`) — owner, 2026-09-15, DS OB-188, REVERSING OB-114's "the top-level step
   *  number, never a dotted path". What OB-114 actually barred is still barred: a FULL path
   *  grows with every level and does not fit a mark (measured 111px on the widest map mark
   *  three levels deep, against 58px for the capped address), so `"1.2.3.2"` stays out of
   *  every mark except the walk editor's, which draws the nesting. COMPOSE IT WITH
   *  `walkAddresses(steps)` / `walkMarkLabel(steps, mark)`, NEVER BY HAND: the second number is
   *  the stop's ordinal within its top-level step counted across subgroup boundaries in walk
   *  order, and every natural shortcut yields a plausible label that is wrong on exactly the
   *  nested stops. SEVERAL PINS MAY STILL SHARE ONE LABEL where a step's stops sit in different
   *  cells, so a pin's label is STILL NOT AN ID — do not key anything on it. */
  n: number | string
  /** done = behind the cursor, current = the cursor, ahead = not yet reached */
  state?: 'done' | 'current' | 'ahead'
  /** 0…1 — HOW FAR THIS DOT IS INTO ARRIVING AT `current`, for a walk played on a
   *  FRACTIONAL cursor. Undefined or 0 draws exactly what this component always drew, so
   *  no existing caller moves.
   *
   *  AN ANIMATED CALLER PASSES DIRECTION ONLY — `state={behind ? 'done' : 'ahead'}`,
   *  never `'current'`. That is continuous by construction: at the stop itself `arrival`
   *  is 1, so both directions blend to the identical current look and the done/ahead flip
   *  is invisible; either side of it the blend falls off symmetrically. Passing a ROUNDED
   *  `'current'` while animating is the one way to get this wrong — it holds that dot at
   *  the full current look while its neighbour blends, and both jump half a blend as the
   *  rounding flips, at the midpoint of the crossing. `'current'` stays legal and is
   *  simply inert alongside `arrival`, since its own base IS the current look; it is what
   *  a RESTING caller passes, as before.
   *
   *  WHY IT IS A PROP AND NOT THE HOST'S JOB: a host can only reach the OUTSIDE of this
   *  component — opacity and transform. Without it the fill, the ring and the number snap
   *  at the halfway point of a crossing, which is the exact instant a pin is at its
   *  largest and the eye is on it: a pop with a jump inside it. Only the three colours
   *  cross, in oklab, so the mix stays on the walk's own ramp instead of travelling
   *  through grey; GEOMETRY DOES NOT BLEND (the optional dash, the shrunk fill and the
   *  ring weights all stay keyed on the discrete `state`).
   *
   *  ONE CALLER: MapView's walk pins (DS OB-132, 2026-09-05), which pass direction and
   *  `walkBand().active`. */
  arrival?: number
  /** 0…1 — HOW MUCH OF THIS STOP IS BEHIND YOU, washed left to right across the face. A walk
   *  stop can be a node holding several stops (a merged map pin, `"2.1–2.5"`); this says how far
   *  through it the walk has got. A DIFFERENT FACT from `state`/`arrival`, which say where the
   *  cursor is relative to the stop. Pass `walkProgress(mark, position)` (`WalkParts`).
   *
   *  EVERY STOP TAKES IT, a single-node one included (0 until arrival, then 1). Reserving the
   *  wash for grouped stops was proposed and rejected by the owner (2026-09-09): a grouped stop
   *  would then be the only mark with a fourth thing happening on it, and the walk would gain
   *  an emphasis nobody authored. A RANGE IS CONTIGUOUS: a caller must not draw a range over a
   *  gap.
   *
   *  IT DOES NOT PAINT ON THE RAIL'S `current` FACE, AND A CALLER STILL PASSES IT THERE (DS
   *  OB-187 clause 4, 2026-09-15). The reasoning "the face was free to carry it" is the PIN's,
   *  which draws `--surface-paper` in every state. The rail's `current` is the one dark face in
   *  the system — a solid `--accent-walk` fill under `--text-inverse` ink — and an opaque
   *  `--acorn-100` wash over it left the number unreadable on every current dot of the dock's
   *  open row (the dock passes `walkProgress({ from: i, to: i }, pos)`, which is 1 from the
   *  moment the cursor arrives, so it was always, not sometimes). The component suppresses the
   *  wash there — and while `arrival` is blending toward that fill — rather than asking anyone
   *  to gate the prop: a rail dot at `current` is already filled edge to edge with the walk
   *  accent, which is the same fact, so nothing is lost. Do not "fix" this by re-colouring the
   *  wash so it survives a dark fill — see the axis rule below.
   *
   *  THE AXIS IS LOAD-BEARING AND IT DECIDED THE COLOUR — do not darken a wash that looks faint.
   *  Bottom-to-top, one step of five is a 3.9px sliver on a 22px pin. Left to right along a
   *  56.9px range pill it is 10.8px, 2.8× the travel, which is why the lightest tint
   *  (`--acorn-100`) separates every step. A darker one passes under the number and dims the
   *  label the mark exists to show. */
  progress?: number
  /** rail (default) = filled dot for the walk strip; pin = paper-white face with the
   *  state's colour on the ring and number only, for the same dot pinned over a map,
   *  where the territory underneath already carries colour */
  variant?: 'rail' | 'pin'
  /** px, both dimensions. Default 24 (the rail's size); a map pin usually wants larger. A
   *  range `n` keeps this as its HEIGHT and MINIMUM width only — it grows wider as needed. */
  size?: number
  /** dashes the ring — never a different colour — for a step the walk may skip. Same
   *  rule as `NodeChip`'s own `optional`: state and hue are separate channels. Drawn as
   *  an SVG `stroke-dasharray` on the same circle that draws the ring, since a browser's
   *  dashed rendering on a circle this small reads as barely-there. Never passed
   *  together with a range `n` — a range is a pill and has no dash. */
  optional?: boolean
  /** the stop's authored note */
  title?: string
  onClick?: () => void
}

/** the `pin` variant's own ring stroke width, published so a host drawing a connector
 *  to a pinned StepDot (`NodeArrow`'s `joins`) can measure the border it actually
 *  renders — the same rule `NodeChip`'s `chipBorder` and `VersionedGroup.joinBorder`
 *  already answer for their own forms. `rail` is never a `NodeArrow`'s neighbour, so
 *  it publishes nothing — nothing draws that today. LOCAL ADDITION, not in the DS
 *  `.jsx`, which inlines the same 1.5. */
export const PIN_RING_WIDTH = 1.5

export function StepDot({ n, state = 'ahead', variant = 'rail', size = 24, arrival, progress, optional, onClick, title }: StepDotProps) {
  /* A RANGE IS A STRING ("1-3", "1.1–1.3"), never a number — see `n`. `String(n).length > 1`
     made every two-digit stop NUMBER take the pill branch, so stops 10+ drew flattened. */
  const isRange = typeof n === 'string' && n.length > 1
  /* PROGRESS THROUGH THE STOP, washing LEFT TO RIGHT across the face (owner, 2026-09-09) — see
     the prop for the axis rule and the every-stop rule. */
  const prog = progress === undefined ? 0 : Math.max(0, Math.min(1, progress))
  /* a stable id per mount — two dots on one page must not share a clip path. Called HERE, above
     the range branch's early return, because a hook after a conditional return is a hook that
     runs on some renders and not others. */
  const washId = useId()
  const base = variant === 'pin'
    ? (state === 'current'
        ? { bg: 'var(--surface-paper)', bd: 'var(--accent-walk)', ink: 'var(--accent-walk)' }
        : state === 'done'
          ? { bg: 'var(--surface-paper)', bd: 'var(--acorn-400)', ink: 'var(--text-walk)' }
          : { bg: 'var(--surface-paper)', bd: 'var(--border-rule)', ink: 'var(--text-3)' })
    : (state === 'current'
        ? { bg: 'var(--accent-walk)', bd: 'var(--accent-walk)', ink: 'var(--text-inverse)' }
        : state === 'done'
          ? { bg: 'var(--acorn-100)', bd: 'var(--acorn-200)', ink: 'var(--text-walk)' }
          : { bg: 'var(--surface-raised)', bd: 'var(--border-rule)', ink: 'var(--text-3)' })
  /* ARRIVAL: THE SAME THREE STATES, CROSSED CONTINUOUSLY. `state` says which look this dot
     is blending FROM — `done` behind the cursor, `ahead` in front — and `arrival` says how
     far toward `current` it has got. See the prop's own docblock for why it is a prop and
     why only colour blends; the short version is that a host can reach only the outside of
     this component, so without it the face snaps at the midpoint of a crossing.
     `current` is inert here: its own base already IS the current look. */
  const a = arrival === undefined ? 0 : Math.max(0, Math.min(1, arrival))
  const cur =
    variant === 'pin'
      ? { bg: 'var(--surface-paper)', bd: 'var(--accent-walk)', ink: 'var(--accent-walk)' }
      : { bg: 'var(--accent-walk)', bd: 'var(--accent-walk)', ink: 'var(--text-inverse)' }
  const mix = (from: string, to: string) =>
    a <= 0 ? from : a >= 1 ? to : `color-mix(in oklab, ${to} ${Math.round(a * 100)}%, ${from})`
  const skin = a <= 0 ? base : { bg: mix(base.bg, cur.bg), bd: mix(base.bd, cur.bd), ink: mix(base.ink, cur.ink) }
  const ringW = variant === 'pin' ? PIN_RING_WIDTH : 1
  /* BOLDER ONLY FOR `current` — that is the one state whose fill and border share the
     same token (rail `current`: bg=bd=--accent-walk), so the dash needs real weight to
     read against the fill it sits on. `done`/`ahead` already contrast fine at the ring's
     own plain weight; boldening those too made an optional dot look heavier than its
     non-optional siblings at rest for no reason. */
  const dashW = state === 'current' ? ringW * 1.5 : ringW
  /* THE WASH NEEDS A LIGHT FACE, AND THE RAIL'S `current` FACE IS THE ONE DARK FACE IN THE SYSTEM
     (DS OB-187 clause 4). `progress`'s docblock reasoned from `variant="pin"`, which draws
     `--surface-paper` in every state — true of the pin, false of the rail, whose `current` is a
     solid `--accent-walk` fill with `--text-inverse` ink. An opaque `--acorn-100` rect over that
     lands the white number on a pale ground: measured on the DS's own rig at 1:1, the current dot
     of the dock's open row drew NO READABLE NUMBER at all, and the dock passes a progress that is
     1 the instant the cursor arrives — so this was every current stop, always.
     THE FIX IS TO NOT PAINT, NOT TO RE-TUNE THE COLOUR: a rail dot at `current` is already filled
     edge to edge with `--accent-walk`, which is the same fact the wash carries. `a > 0` is in the
     gate because `arrival` BLENDS toward that dark fill; rail callers do not animate, so in
     practice this is the resting `current` dot alone. WHAT THE GATE COSTS: a rail RANGE at
     `current` would lose a real fraction — no caller can build one (the only ranged mark is the
     map's pin). */
  const washable = prog > 0 && (variant === 'pin' || (state !== 'current' && a <= 0))

  /* A RANGE ("1-3") IS A PILL, drawn the plain CSS way (border-radius/border/background)
     — SVG can draw a circle but not this component's variable-width auto rounded pill
     without measuring text first, and no caller passes a range AND `optional` together,
     so the pill never needs the dash the rest of this file exists to get right. */
  if (isRange) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={wrapTip(title)}
        style={{
          position: 'relative',
          minWidth: size,
          width: 'auto',
          height: size,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          padding: `0 ${Math.max(4, size * 0.18)}px`,
          whiteSpace: 'nowrap',
          borderRadius: 'var(--radius-pill)',
          border: `${ringW}px solid ${skin.bd}`,
          background: skin.bg,
          color: skin.ink,
          boxShadow: variant === 'pin' ? 'var(--lift-1)' : 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--fs-micro)',
          fontWeight: variant === 'pin' ? 'var(--fw-regular)' : 'var(--fw-medium)',
          fontVariantNumeric: 'var(--tnum)',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'var(--transition-wash)',
          overflow: 'hidden',
        }}
      >
        {washable ? <span aria-hidden="true" data-stepdot-wash="" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${prog * 100}%`, background: 'var(--acorn-100)' }} /> : null}
        <span style={{ position: 'relative' }}>{n}</span>
      </button>
    )
  }

  const r = size / 2 - ringW / 2
  /* OPTIONAL + CURRENT SHRINKS THE FILL, NOT THE RING — the dash sits at the same radius
     the ring always has, so at rest an optional dot matches its siblings exactly. But
     `current`'s fill is the same colour as its own ring/dash, and a fill reaching all the
     way to the dash leaves no gap of bare background for the eye to read as "a ring", so
     the dash read as texture on a solid dot. Pulling the fill in leaves a visible band for
     the dash to sit on. ONLY when both conditions hold — a plain `current` dot with a
     smaller fill would just look mis-sized, with no `optional` to explain it. */
  const shrinkFill = optional && state === 'current'
  const fillR = shrinkFill ? r * 0.78 : r
  /* THAT BAND NEEDS ITS OWN FILL, AND THE DASH NEEDS A DIFFERENT STROKE COLOUR — a shrunk
     fill leaves the band between it and the ring with NO fill at all, so the page's own
     background shows through instead of a colour this component controls, and the dash —
     stroked in `ink`, white on `current` — is invisible against it. The band takes the
     same neutral surface a `done`/`ahead` dot rests on, and the dash on THIS band is
     stroked in `bd` instead of `ink`: dark enough to read against the light band, and the
     same colour as the small fill it now rings, so the two pieces still read as one
     "active" mark. `ink` stays correct for `done`/`ahead`, where the fill reaches the ring
     and needs a colour that contrasts THAT fill. */
  const bandFill = variant === 'pin' ? 'var(--surface-paper)' : 'var(--surface-raised)'
  const dashStroke = state === 'current' ? skin.bd : skin.ink

  return (
    <button
      type="button"
      onClick={onClick}
      title={wrapTip(title)}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        borderRadius: 'var(--radius-pill)',
        /* THE BUTTON DRAWS NOTHING OF ITS OWN — fill/ring/dash all live in the SVG below
           — but a native <button> still carries its OWN default chrome (`appearance:
           auto`: a 2px outset border, a grey background) unless explicitly reset, and
           nothing resets it once the old `border`/`background` CSS is gone. That native
           bevel shows as a dark crescent at one corner on EVERY dot, not just optional
           ones. */
        appearance: 'none',
        WebkitAppearance: 'none',
        border: 'none',
        background: 'none',
        boxShadow: variant === 'pin' ? 'var(--lift-1)' : 'none',
        color: skin.ink,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-micro)',
        fontWeight: variant === 'pin' ? 'var(--fw-regular)' : 'var(--fw-medium)',
        fontVariantNumeric: 'var(--tnum)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'var(--transition-wash)',
      }}
    >
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill={shrinkFill ? bandFill : skin.bg}
          stroke={optional ? 'none' : skin.bd}
          strokeWidth={ringW}
        />
        {shrinkFill ? <circle cx={size / 2} cy={size / 2} r={fillR} fill={skin.bg} /> : null}
        {/* the wash, clipped to the face so it never spills past the ring. Drawn AFTER the fill and
            BEFORE the dash and the number, so both stay legible over it. */}
        {washable ? (
          <Fragment>
            <clipPath id={washId}><circle cx={size / 2} cy={size / 2} r={shrinkFill ? fillR : r} /></clipPath>
            <rect data-stepdot-wash="" x={0} y={0} width={size * prog} height={size} fill="var(--acorn-100)" clipPath={`url(#${washId})`} />
          </Fragment>
        ) : null}
        {optional ? (
          /* DASHES THE RING, NEVER A DIFFERENT COLOUR — same rule `NodeChip`'s own
             `optional` follows. Drawn as `stroke-dasharray` rather than a CSS dashed
             border: a browser's dashed rendering on a circle this small (24-28px)
             computes illegibly short, faint dashes. SAME RADIUS `r` as the fill/ring
             circle above — no separate inset to get wrong, no margin to tune. */
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={dashStroke}
            strokeWidth={dashW}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(1.5, size * 0.1)} ${Math.max(1.5, size * 0.08)}`}
          />
        ) : null}
      </svg>
      <span style={{ position: 'relative' }}>{n}</span>
    </button>
  )
}
