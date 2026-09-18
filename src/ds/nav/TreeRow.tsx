import { useState } from 'react'
import type { CSSProperties } from 'react'

import { DomainDot } from '../graph/DomainDot'
import { useClipped } from '../chrome/IconButton'

/** THE MARK'S INK OFFSET, exported because a second file needs it (OB-052): `NodeRail`'s
 *  `UP` points the same mark at a third rotation and must cancel the same offset there too
 *  — see the derivation in `caretStyle` below. One number, one home: a caller overriding the
 *  transform reads it from here rather than retyping it. A hand-typed `1` in `NodeRail`'s
 *  inline copy of this once silently reintroduced the pre-baseline drift this constant was
 *  created to remove. */
export const CARET_INK = 0.964

/** The disclosure mark, drawn rather than set: two 1.5px strokes meeting at a
 *  right angle, rotated −45° closed and +45° open. Font chevrons and triangles
 *  both failed here — a fill out-inks the labels, and every hollow or angle-quote
 *  glyph is too small and too oddly proportioned at 15px to read as a shape.
 *  Exported because the instrument palette (InstrumentGroup) is a containment
 *  list too and reuses this exact mark — the system draws nesting one way.
 *
 *  IF YOU REPEAT THE RECIPE, REPEAT THE LONGHANDS. This sets `borderRight` and
 *  `borderBottom` and nothing else. Writing it as `border` plus `borderTop: 'none'`
 *  looks equivalent and is not: React diffs style objects key by key, so a re-render
 *  that changes only the shorthand's colour re-sets `border` and never re-sets the two
 *  sides that were switched off — the mark fills in and the caret becomes a diamond the
 *  first time it is hovered. (DS 2026-08-17, contracted at last.)
 *
 *  THE TRANSLATE IS THE SAME IN BOTH STATES, AND THAT IS THE WHOLE POINT OF IT. The mark
 *  is an L of two 1.5px strips on a 6px box, so its ink sits at an offset of (+0.964,
 *  +0.964) from the box centre. Translating by exactly the negative of that (`CARET_INK`
 *  above), IN THE ELEMENT'S OWN ROTATED FRAME, cancels it under any rotation — the ink
 *  lands on the box centre whichever way the mark points, with one number and no per-state
 *  arithmetic. It used to be `(-1, -1)` open and `(-1, +1)` closed — two hand-tuned pairs
 *  whose sign flip on y put the two states 1.465px apart vertically, so the mark visibly
 *  jumped on toggle. Do not re-tune these per state: a mark that needs to sit lower next to
 *  text wants the CALLER's inset (`CARET_FIRST_LINE_INSET` below), not the glyph's own
 *  centring. */
function caretStyle(open?: boolean): CSSProperties {
  return {
    width: 6,
    height: 6,
    boxSizing: 'border-box',
    borderRight: '1.5px solid currentColor',
    borderBottom: '1.5px solid currentColor',
    borderRadius: 1,
    transform: `rotate(${open ? 45 : -45}deg) translate(-${CARET_INK}px, -${CARET_INK}px)`,
    transition: 'transform var(--dur-hover) var(--ease-soft)',
  }
}

/** The disclosure mark itself, drawn — never a style object handed to a caller. A
 *  spread of `caretStyle()` invites the border-longhand trap (see above); a
 *  component that always renders both sides does not. `style` is a POSITION/
 *  TRANSFORM override only (e.g. the rail's stacked up-arrow), applied after the
 *  drawn geometry — never a second way to draw the mark itself. */
export function Caret({ open, style }: { open?: boolean; style?: CSSProperties }) {
  return <span style={style ? { ...caretStyle(open), ...style } : caretStyle(open)} />
}

/** THE NESTING PAIR — the act that opens or closes a whole LEVEL: the same disclosure
 *  mark, said twice, one level up from a single row's caret. Two pointing down for
 *  "expand all" (`<CaretStack />`), two up for "collapse all" (`<CaretStack up />`).
 *  Said twice rather than drawn differently, so the pair cannot read as a new icon —
 *  the drawn set stays closed. The up-mark is a third ROTATION, not a third state, so
 *  it overrides the transform wholesale rather than asking `Caret` for a position a
 *  disclosure does not have; the translate stays `CARET_INK`, the same ink centring in
 *  the mark's own rotated frame, which is what keeps up and down on one line.
 *
 *  AN ELEMENT BECAUSE A HAND COPY OF THE RECIPE DRIFTED (OB-063): `NodeRail`'s acts used
 *  to stack two `<Caret>`s against their own inline `UP` override, which is exactly the
 *  shape that let `CARET_INK` (see above) get reintroduced as a hand-typed `1` the first
 *  time. Nothing to copy, nothing to get wrong. */
const UP: CSSProperties = { transform: `rotate(225deg) translate(-${CARET_INK}px, -${CARET_INK}px)` }
export function CaretStack({ up }: { up?: boolean }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Caret open style={up ? UP : undefined} />
      <Caret open style={up ? UP : undefined} />
    </span>
  )
}

/** WHERE A CARET'S TOP GOES when it is pinned to the FIRST LINE of a name rather than
 *  centred on a single line — a wrapped `NodeChip`, `NodeRail`'s head pill.
 *
 *  DO NOT REUSE THE DOT'S 4.83 (`NodeChip`'s `DOT_FIRST_LINE_INSET`): that was measured
 *  for a 7px disc, and this mark is a 6px box rotated 45° to an 8.49px bounding box —
 *  borrowing the disc's number leaves the caret 1.46px high on a three-line chip.
 *
 *  AND DO NOT CORRECT A CENTRED CARET AT ALL. Measuring its bounding box against a
 *  line's x-height band reads 1.92px of "error" that is not there: `caretStyle`'s
 *  translate runs AFTER the rotation, so on screen it lifts the box 1.414px, and the
 *  mark's own ink centroid sits 1.364px below the box centre once rotated — the
 *  translate cancels that to within 0.05px, an optical centring of the glyph in its own
 *  box rather than a misalignment. "Fixing" the 1.92 would push the mark 1.4px low. */
export const CARET_FIRST_LINE_INSET = 6.29

/** The system's one nesting number: a caret slot this wide, an indent this deep per
 *  level. `TreeRow` is the REFERENCE — anywhere else that nests (the instrument
 *  palette's `InstrumentGroup`) matches this constant rather than picking its own
 *  step, so the system does not invent a second way to nest things. */
export const NESTING = 16

/** One indented row of the containment tree — the literal list reading of the
 *  corpus. Single click selects, double click re-roots; a container draws the
 *  ▾/▸ disclosure. Presentation only: the consumer owns the bus wiring, the
 *  single/double-click disambiguation, and any drag source. Typed port of the
 *  DS TreeRow.jsx. */
export interface TreeRowProps {
  title: string
  /** a ring hue name (`'teal'`) — what the corpus stores on a topic (`topicHueOf`); resolved by
   *  `domainToken()`. **Typed `string`**, as the DS's own contract has been since 2026-08-21j: a
   *  closed six-code union was compiled into the adherence lint, and a general corpus passing a
   *  ring hue was reported as an invalid prop (OB-153 retired the union here). The NAME is still
   *  wrong — this is a topic, not a domain — and OB-061 decides the rename on both sides at once. */
  domain: string
  /** indentation level; NESTING px per step — see NESTING's own docblock.
   *  DEPTH 0 IS THE CORPUS ROOT, NOT A TOP-LEVEL TOPIC (owner, 2026-09-15). A full corpus
   *  tree starts at the one node above everything, so a territory is `depth={1}`, a module
   *  2, a topic 3. A pane deliberately showing a subtree (re-rooted by a double click) starts
   *  its own root at 0 — depth is measured from whatever this pane calls the root. */
  depth?: number
  /** has children — draws the disclosure caret (`Caret`, rotated when open)
   *  and answers to double-click. Never a typed ▾/▸, never an SVG chevron */
  container?: boolean
  expanded?: boolean
  /** this row is the bus's focus */
  current?: boolean
  /** typed links touching this node; nonzero only at the topic level */
  linkCount?: number
  /** this row is the corpus ROOT — its mark draws colourless (hollow ring) because it has no
   *  topic of its own. Everything else about the row is unchanged: it selects, it discloses,
   *  it re-roots. The owner's ruling (2026-09-15) is that the root is a node like any other
   *  and a ROW rather than a pane heading, so there is no second component for it and nothing
   *  here suppresses the caret or the click. See `DomainDot`'s `root` for why the mark is
   *  hollow rather than grey. */
  root?: boolean
  onSelect?: () => void
  onToggle?: () => void
  onZoom?: () => void
}

export function TreeRow({
  title,
  domain,
  depth = 0,
  container,
  expanded,
  current,
  linkCount,
  root,
  onSelect,
  onToggle,
  onZoom,
}: TreeRowProps) {
  const [hot, setHot] = useState(false)
  /* a tree row's title is clipped by depth: the deeper the row, the less width is
     left for it, so the same title clips in one place and not in another */
  const titleClip = useClipped<HTMLSpanElement>(title)
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onZoom}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        minHeight: 'var(--hit-min)',
        padding: '4px 10px 4px ' + (10 + depth * NESTING) + 'px',
        marginInline: 6,
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: current ? 'var(--accent-primary-wash)' : hot ? 'var(--surface-hover)' : 'transparent',
        transition: 'var(--transition-wash)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--fs-body)',
      }}
    >
      {container ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.()
          }}
          style={{
            width: NESTING,
            height: NESTING,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-3)',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          <Caret open={expanded} />
        </button>
      ) : (
        <span style={{ width: NESTING, flexShrink: 0 }} />
      )}
      <DomainDot domain={domain} root={root} size={8} />
      <span
        {...titleClip}
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: current ? 'var(--fw-bold)' : 'var(--fw-medium)',
          color: current ? 'var(--accent-primary-ink)' : 'var(--text-1)',
        }}
      >
        {title}
      </span>
      {linkCount ? (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 'var(--fs-micro)',
            color: 'var(--text-3)',
            fontVariantNumeric: 'var(--tnum)',
          }}
        >
          {'⤳'} {linkCount}
        </span>
      ) : null}
    </div>
  )
}
