import type { CSSProperties } from 'react'

import { wrapTip } from '../chrome/IconButton'

/** THE PARTS `WalkStrip` AND `WalkDock` DRAW THE SAME WAY, WRITTEN ONCE (owner, 2026-09-01). The
 *  strip is a pane and the dock is an overlay — two components, deliberately — but a stop's title
 *  under its dot, the "(optional)" suffix on it, the ink a stop's state earns and the play/pause
 *  button were drawn twice, once in each file, and the two copies had already disagreed: the
 *  dock's open row showed no "(optional)" at all while the strip's did. Two drawings of one rule
 *  drift the day one is edited; here the rule exists in one place and both hosts read it. Sizes
 *  stay the host's (the strip's 26px transport and `--fs-micro` titles, the dock's 20px and 10px)
 *  because those are the host's density decisions, not the rule.
 *
 *  Typed port of the DS WalkParts.jsx (contract: WalkParts.d.ts), OB-133 + OB-140. */

export type StopState = 'done' | 'current' | 'ahead'

/** the transport glyphs, on a 14×16 viewBox; both hosts draw these two paths and no others */
export const PLAY_PATH = 'M2 1.5 L12.5 8 L2 14.5 Z'
export const PAUSE_PATH = 'M2 1.5 H5.4 V14.5 H2 Z M8.6 1.5 H12 V14.5 H8.6 Z'

/** A STOP'S STATE FROM ITS INDEX AND THE CURSOR — behind is `done`, on is `current`, past is
 *  `ahead`. `StepDot`'s three states, derived one way for every surface. */
export function stopState(index: number, cursor: number): StopState {
  return index < cursor ? 'done' : index === cursor ? 'current' : 'ahead'
}

/** THE INK A STOP'S TITLE TAKES FOR ITS STATE: acorn on the cursor (`--text-walk`, movement),
 *  `--text-2` behind it (a fact — where you have been), `--text-3` ahead (furniture until you get
 *  there). Same ladder on the strip and in the dock's open row. */
export function stopInk(state: StopState): string {
  return state === 'current' ? 'var(--text-walk)' : state === 'done' ? 'var(--text-2)' : 'var(--text-3)'
}

/** A MARK ON THE WALK, as `walkProgress` reads it — `from`/`to` are STEP indices (feed them to
 *  `walkBandSpan` too). On the dock and the strip a mark IS a step, so `from === to`.
 *
 *  A MARK SPANNING SEVERAL STOPS IS THE HOST'S, and only the map has one: its pins merge a
 *  contiguous run of stops that resolve to one CELL at the level being drawn, labelled `"2-3"`.
 *  Ruled 2026-09-14 (owner): THE DOCK AND THE STRIP DRAW NO RANGES — a stop is a stop on a control
 *  that lists the walk. The by-NODE grouping the DS shipped on 2026-09-09 (`walkRanges` /
 *  `walkMarkAt`, marks numbered `2.1–2.3`) is REMOVED with that ruling: it made a mark mean "one
 *  node, several visits" there and "several nodes, one cell" on the map, so the two pills were two
 *  different claims wearing one shape. This port never took that grouping (OB-185 clause 1);
 *  nothing here derives a mark. */
export interface WalkMark {
  from: number
  to: number
  /** what the HOST prints on a merged pin, e.g. `"2-3"`. Never minted here. */
  label?: string
  /** the steps the mark covers, for a host card that lists them */
  steps?: unknown[]
}

/** HOW MUCH OF A MARK THE WALK HAS PASSED, 0…1 — what `StepDot`'s `progress` wants for the wash.
 *  A one-step mark is 0 until the cursor reaches it and 1 after; the fractional case is a HOST's
 *  merged mark (a map pin covering a run of stops), which washes a step at a time as the class
 *  works through it. Published rather than left to callers because it is an off-by-one waiting to
 *  happen: a mark is complete when the cursor has PASSED its last step, not when it arrives at it. */
export function walkProgress(mark: WalkMark, position: number): number {
  if (position < mark.from) return 0
  if (position > mark.to) return 1
  const span = mark.to - mark.from + 1
  return Math.max(0, Math.min(1, (Math.floor(position + 1e-4) - mark.from + 1) / span))
}

/** THE ONE WORD FOR A STEP THE WALK MAY SKIP — fixed at " (optional)", italic at regular weight,
 *  `--text-3`, inline after the name with a single space (owner, 2026-08-23) — the same word and
 *  the same styling `NodeChip`'s own optional label uses. Never its own line, never a colour. */
export function OptionalSuffix({ style }: { style?: CSSProperties }) {
  return <span style={{ fontStyle: 'italic', fontWeight: 'var(--fw-regular)', color: 'var(--text-3)', ...style }}> (optional)</span>
}

export interface StopTitleProps {
  /** the step's name */
  title: string
  /** appends `OptionalSuffix` and gives the clamp one more line for it */
  optional?: boolean
  /** picks the weight (semibold only on `current`) and the ink (`stopInk`) */
  state?: StopState
  /** the clamp for a NON-optional title; an optional one gets `lines + 1`. Default 2. */
  lines?: number
  /** the host's density. Defaults: `var(--fs-micro)` / `var(--lh-snug)` (the strip's); the dock passes 10 / 1.25 */
  fontSize?: string | number
  /** the host's density — see `fontSize` */
  lineHeight?: string | number
  /** PLACEMENT ONLY — width, margin, padding. Never type, weight or colour: those are the rule. */
  style?: CSSProperties
}

/** A STOP'S NAME UNDER ITS DOT: centred, wrapped and clamped to `lines`, weighted semibold only
 *  on the cursor, inked by `stopInk(state)`, and carrying `OptionalSuffix` when the step is
 *  optional. THE CLAMP GAINS A LINE FOR AN OPTIONAL STEP — the suffix shares the clamped box with
 *  the name, and a title that already fills every clamped line swallows it (owner-reported on the
 *  strip, 2026-08-23: line-clamp cuts whatever overflows its OWN box, and the suffix is what
 *  overflows first). A host whose row height is derived from this budgets `lines + 1` lines.
 *  `fontSize`/`lineHeight` are the host's density; `style` places the box (width, margin,
 *  padding) and never restyles the type. */
export function StopTitle({ title, optional = false, state = 'ahead', lines = 2, fontSize = 'var(--fs-micro)', lineHeight = 'var(--lh-snug)', style }: StopTitleProps) {
  return (
    <span style={{
      overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: optional ? lines + 1 : lines,
      textAlign: 'center', textWrap: 'pretty', fontFamily: 'var(--font-ui)', fontSize, lineHeight,
      fontWeight: state === 'current' ? 'var(--fw-semibold)' : 'var(--fw-regular)', color: stopInk(state),
      ...style,
    } as CSSProperties}>{title}{optional ? <OptionalSuffix /> : null}</span>
  )
}

export interface PlayToggleProps {
  /** which glyph draws — display only; the host sets it from its own clock */
  playing?: boolean
  /** fires; the HOST plays. Does not fire any seek. */
  onToggle?: () => void
  /** the round button's side. The strip passes `WALK_METRICS.transport` (26), the dock `WALK_DOCK_METRICS.row` (20). */
  size?: number
  /** the glyph's [width, height] inside it; [11, 12] in the strip, [8, 10] in the dock */
  glyph?: [number, number]
  /** placement only */
  style?: CSSProperties
}

/** THE TRANSPORT: one round acorn button, a play or a pause glyph, at the host's `size` with the
 *  glyph at `glyph` = [width, height] (the strip draws 11×12 in a 26px button, the dock 8×10 in
 *  20px). Fires `onToggle`; the HOST runs the walk and holds the clock — this is display and a
 *  report, the same split both hosts already make. `playing` only picks the glyph. */
export function PlayToggle({ playing = false, onToggle, size = 26, glyph = [11, 12], style }: PlayToggleProps) {
  return (
    <button type="button" onClick={onToggle} title={wrapTip(playing ? 'pause the walk' : 'play the walk')} aria-label={playing ? 'pause the walk' : 'play the walk'} style={{
      flex: 'none', width: size, height: size, padding: 0, appearance: 'none', WebkitAppearance: 'none', border: 'none',
      borderRadius: 'var(--radius-pill)', background: 'var(--accent-walk)', color: 'var(--text-inverse)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', ...style,
    }}>
      <svg width={glyph[0]} height={glyph[1]} viewBox="0 0 14 16" aria-hidden="true" style={{ display: 'block' }}>
        <path d={playing ? PAUSE_PATH : PLAY_PATH} fill="currentColor" />
      </svg>
    </button>
  )
}

/** HOW MUCH A STOP GROWS UNDER THE POINTER — 1.18, and it is a LOOK, not a derivation (owner,
 *  2026-09-04, OB-140). IT IS A SCALE AND NOT A FACE, a deliberate exception to the house hover
 *  rule ("the face changes; no scale, no translate"). That rule is about CHROME — buttons, rows,
 *  pills — where a growing control moves its neighbours and reads as a click already happening. A
 *  walk stop is not chrome: it is a mark on a line whose own vocabulary is already SIZE
 *  (`walkBand`'s `grow` scales dots by recency), it is absolutely positioned or sits in a fixed
 *  slot on every surface that draws it, so nothing reflows, and the pointer needs to say WHICH
 *  stop it is on when the ticks are 2px apart at the ends. Published here so the strip, the dock
 *  and the presenter strip grow by the same amount. */
export const WALK_HOVER_GROW = 1.18

/** AND HOW MUCH THE WHOLE ROW GROWS WHILE THE POINTER IS ANYWHERE ON IT — 1.08 (owner, 2026-09-04).
 *  Two factors, because they are two facts: the row says "you are on me", the hovered stop says
 *  "and this one". IT GROWS THE MARKS, NOT THE ROW'S BOX — scaling the row itself would push its
 *  ends outside the pane's frame; every mark scales in place instead, and the LINE thickens with
 *  them, which is what makes it read as the row growing rather than as a dozen dots twitching. */
export const WALK_ROW_HOVER_GROW = 1.08

/** THE WHOLE STYLE FRAGMENT FOR A HOVER SCALE — spread it, never restate it (owner, 2026-09-04:
 *  "the effect on the numbers in the node a bit jiggly").
 *
 *  WHY THE NUMBER JIGGLED: a stop's numeral is TEXT inside the box being scaled, and a browser
 *  re-rasterizes text on every frame of a scale transition to keep it crisp. At fractional scales
 *  the glyph's baseline lands between device pixels and the rounding differs frame to frame, so
 *  the digit walks up and down by a fraction of a pixel while the disc around it moves smoothly.
 *
 *  THE FIX IS TO RASTERIZE ONCE AND SCALE THE PICTURE: `translateZ(0)` (plus the hint and the
 *  backface flag) promotes the mark to its own composited layer. The cost is honest: at 1.18 the
 *  numeral is very slightly softer at the peak of the gesture. A FACTORY, not a documented recipe,
 *  because `translateZ(0)` looks like a no-op and is the entire fix, so anyone rewriting this by
 *  eye would drop it. Pass `prefix` when the same property must also carry a centring translate. */
export function walkHoverStyle(scale: number, prefix?: string): { transform: string; transition: string; willChange: string; backfaceVisibility: 'hidden' } {
  return {
    transform: (prefix ? prefix + ' ' : '') + 'scale(' + scale + ') translateZ(0)',
    transition: 'transform var(--dur-hover) var(--ease-soft)',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
  }
}

/** THE SAME PARTS AS ONE OBJECT, named for the file (the DS's bundler wants an export named
 *  `WalkParts`; a consumer that prefers one import gets it). The named exports above are the
 *  primary API. */
export const WalkParts = { StopTitle, PlayToggle, OptionalSuffix, stopState, stopInk, progress: walkProgress, PLAY_PATH, PAUSE_PATH, WALK_HOVER_GROW, WALK_ROW_HOVER_GROW, hoverStyle: walkHoverStyle }
