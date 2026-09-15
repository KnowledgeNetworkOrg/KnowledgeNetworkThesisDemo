import { NodeChip } from './NodeChip'
import { shaftFor } from './NodeArrow'
import { relationPaint } from './EdgeLegend'

/** THE SHAFT IS DRAWN AT THE BORDER WEIGHT OF WHAT IT CONNECTS, NEVER ABOVE IT — 1.25,
 *  against the 1px border of the `NodeChip mark="border-2"` ends this component renders.
 *  The nodes are the objects; a line between them is a statement ABOUT them, so it does not
 *  get to be the heaviest mark in the row. The chip form at the ends is what fixes the
 *  number: `mark="border"` is a `--stroke-rule` border and takes the sequence arrow's 1.5
 *  (`NodeArrow.SHAFT_STROKE`); `border-2` is 1px and takes this.
 *
 *  MATCHING THE NUMBER IS NOT MATCHING THE MARK, which is why this is 1.25 and not a flat 1:
 *  a 1px CSS border takes the browser's own rounding while a 1px `crispEdges` rect snaps to
 *  the device grid, and at dpr 1.5 the available steps are about 0.67 / 1.33 / 2.0 css px. A
 *  flat 1 drops the shaft a step BELOW the border it should match — it reads as a divider,
 *  and it fades `depends_on`, the quietest of the four hues, out from under
 *  `implemented_with`.
 *
 *  IT WAS 3px HERE UNTIL THIS PORT — triple the border at its ends and off the stroke ladder
 *  entirely (`--stroke-hair` 1 · `--stroke-rule` 1.5 · `--stroke-node` 2). Run length does
 *  not set the weight; it sets how badly a mismatch reads, and over a 110px column that is
 *  eight times the ink of the same error in a 14px gap. It survived because it was only ever
 *  judged in bulk: down a list of five, shafts calibrate each other and read as a column of
 *  rules. It took a pane holding a SINGLE relation to see it.
 *
 *  DERIVED, not typed: `shaftFor('border-2')` is the rule applied to the form this component
 *  renders at both ends, so the chip form and the shaft cannot drift apart. Still exported,
 *  because it was retyped once already and a port needs something to import. */
export const EDGE_SHAFT_STROKE = shaftFor('border-2')

interface EntryNodeProps {
  title: string
  domain: string
  anchor?: boolean
  within?: string
  onClick?: () => void
}

/* AN ENTRY'S ENDS ARE `NodeChip mark="border-2"` — the chip's second rank, a mention rather
   than an object: 1px of domain hue, transparent face, no lift, caption type at --text-2,
   --radius-md, centred. Until this port THIS FILE DREW THEM ITSELF, which was one recipe in
   two places and the reason the form was promoted to a chip mark at all. All that is left
   here is the EMPHASIS, which is entry-specific and belongs to the SENTENCE rather than to
   the chip — which is also why `NodeChip.title` widened to a ReactNode. */
/* A path deeper than one step is ELIDED, not wrapped: the node column is a third of
   a pane at best, and "Networking / Protocol Stack / TCP & UDP" set inline there hits
   break-word and comes apart mid-word — five stacked fragments in a pill five times
   the height of the connector beside it. The segment that earns its place is the
   FIRST: it is the focus node, the same bold name every row in the list opens on. The
   middle is what the reader already knows from having navigated there, so it goes to
   an ellipsis, and the whole path stays in the tooltip. */
function EntryNode({ title, domain, anchor, within, onClick }: EntryNodeProps) {
  const segs = within ? String(within).split(' / ') : []
  const lead = segs.length > 1 ? segs[0] + ' / …' : within
  /* Whichever way the end was reached, the ANCHOR is what carries the emphasis:
     direct, that is the node itself; through a descendant, it is the ancestry prefix, in
     the system's slash grammar (DocHeader), with the child that actually holds the link
     set beside it at ordinary weight. So every entry in a list opens on the same bold
     name — the one at the head of the rail — and the eye reads down the column instead
     of re-parsing each row.

     THE DIRECT CASE IS `NodeChip focus`, NOT A STYLED TITLE. It used to pass a
     pre-styled span with --fw-bold/--text-1 written in — the same statement `focus` now
     makes on the chip's own behalf, so there is one implementation of "this is the
     subject of the pane" instead of two agreeing by coincidence.

     THE `within` CASE KEEPS ITS OWN MARKUP. Its emphasis falls on PART of the string —
     the ancestry prefix, not the child name after it — and `focus` is a statement about
     a whole chip; bolding the entire title there would erase the distinction the
     elision exists to draw. */
  const label = within ? (
    <>
      <span style={{ fontWeight: anchor ? 'var(--fw-bold)' : 'var(--fw-medium)', color: anchor ? 'var(--text-1)' : 'var(--text-3)' }}>{lead}{' / '}</span>{title}
    </>
  ) : title
  /* `note` carries the full path because `title` is now an ELEMENT, and the native tooltip
     is a string attribute — the chip falls back to `undefined` rather than stringifying a
     node, so an entry that did not pass this would simply lose its tooltip. */
  return (
    <NodeChip mark="border-2" wrap domain={domain} title={label} focus={!!anchor && !within} onClick={onClick}
      note={segs.length ? segs.join(' / ') + ' / ' + title : title} />
  )
}

/** One relationship, drawn: two nodes and the typed edge between them. The RELATION
 *  is what gets the emphasis — body weight over a hairline in the edge's own colour, and
 *  the arrowhead that says which way it runs — while the two nodes recede to the chip's
 *  second rank: caption weight, a domain border, no fill and no lift.
 *  An entry is a sentence, and both ends are usually already known from whatever it
 *  sits inside; the relation is the only new word.
 *
 *  Typed port of the DS EdgeEntry.jsx (contract: EdgeEntry.d.ts). */
export interface EdgeEntryProps {
  from: string
  fromDomain: string
  /** this end is the view's focus node, so it carries the entry's emphasis. Never
   *  mark both ends: an entry with two anchors has no subject */
  fromAnchor?: boolean
  /** the ancestry prefix in the slash grammar DocHeader uses, when the link is held
   *  by a descendant rather than by the focus itself. With a prefix present the bold
   *  weight goes to the PREFIX, not to the node beside it */
  fromWithin?: string
  to: string
  toDomain: string
  toAnchor?: boolean
  toWithin?: string
  /** the relation kind — supplies both the colour and the label, resolved through
   *  `relationPaint()`: one of the shipped example's keys, a ring hue name, or a ring
   *  slot number. A kind's LABEL comes with the example only; a corpus's own wording
   *  goes through `relation`. */
  type?: string | number
  /** override the corpus wording for this relation */
  relation?: string
  /** override the edge's colour */
  color?: string
  /** which end receives the arrowhead. 'both' is a symmetric relation */
  direction?: 'out' | 'in' | 'both'
  onFrom?: () => void
  onTo?: () => void
  /** the connector column's preferred width; it takes its room before the nodes do.
   *  Default 96 */
  connectorWidth?: number
}

export function EdgeEntry({
  from, fromDomain, fromAnchor, fromWithin, to, toDomain, toAnchor, toWithin,
  type, relation, color, direction = 'out', onFrom, onTo, connectorWidth = 96,
}: EdgeEntryProps) {
  const paint = type !== undefined ? relationPaint(type) : null
  const hue = color || (paint ? paint.stroke : 'var(--border-rule)')
  const label = relation !== undefined ? relation : paint && paint.label !== null ? paint.label : undefined
  return (
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, padding: '14px 0 10px' }}>
      <span style={{ minWidth: 0, flex: '1 1 0', display: 'flex', justifyContent: 'flex-end' }}><EntryNode title={from} domain={fromDomain} anchor={fromAnchor} within={fromWithin} onClick={onFrom} /></span>
      {/* The connector takes its room FIRST — it carries the string the entry
          exists for — and the two nodes share what is left. The line is this
          column's only in-flow child, so it lands on the row's centre line
          whatever height the names wrap to; the label floats above it, closer to
          its own line than to the entry above, so a wrapped name is never
          orphaned between two connectors. Clearance is MARGIN, not padding:
          padding lives inside the box, so a label wider than its column still
          ran over the node beside it. */}
      <span style={{ position: 'relative', flex: '0 1 ' + connectorWidth + 'px', minWidth: 64, marginInline: 3, alignSelf: 'center', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, paddingBottom: 1, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', textAlign: 'center', lineHeight: 'var(--lh-snug)', overflowWrap: 'break-word' }}>{label}</span>
        {/* the head goes on the end that RECEIVES */}
        <span style={{ width: '100%', display: 'flex', alignItems: 'center', color: hue, lineHeight: 0.7 }}>
          {/* the head keeps a step of emphasis over the thinner shaft: it is the only part
              that says which way the relation runs. 7px, not the 9px this drew until
              2026-08-28 — full-size read as competing with the pill text beside it rather
              than just marking direction (owner-reported). */}
          {direction !== 'out' ? <span style={{ fontSize: 7, flex: 'none' }}>{'◀'}</span> : null}
          {/* THE SHAFT IS `EDGE_SHAFT_STROKE` — see its docblock: 1.25, matching the 1px
              border of the chips at its ends, because a connector never outweighs what it
              connects.
              SVG with crispEdges rather than a CSS box — EdgeDash's rule. Down a list the
              line boxes above each entry are fractional, so a CSS bar lands on a different
              subpixel offset in every row and some antialias across an extra device row,
              reading visibly thicker than their neighbours. crispEdges snaps every shaft to
              the same device-pixel height. */}
          <svg height="2" preserveAspectRatio="none" shapeRendering="crispEdges" style={{ flex: 1, minWidth: 0, display: 'block' }} aria-hidden="true"><rect width="100%" y="0.25" height={EDGE_SHAFT_STROKE} fill={hue} /></svg>
          {direction !== 'in' ? <span style={{ fontSize: 7, flex: 'none' }}>{'▶'}</span> : null}
        </span>
      </span>
      <span style={{ minWidth: 0, flex: '1 1 0', display: 'flex', justifyContent: 'flex-start' }}><EntryNode title={to} domain={toDomain} anchor={toAnchor} within={toWithin} onClick={onTo} /></span>
    </div>
  )
}
