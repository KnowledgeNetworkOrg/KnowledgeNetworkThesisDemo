import { Fragment, useState } from 'react'

/** one step of a breadcrumb — the node itself, nothing about how it draws */
export interface CrumbNode {
  id: string
  title: string
  /** this node's OWN topic, when it differs from the path's. The case that matters is the
   *  first crumb: a full ancestry starts at the corpus root, which has no topic — pass
   *  `null` there. Omit on every other crumb and the path's `domain` is used. */
  domain?: string | null
}

/** A PATH THROUGH THE CORPUS, current node last and highlighted. Unlike `TrailChip`'s trail,
 *  which is temporal and append-only (everywhere you have BEEN), a breadcrumb is POSITIONAL
 *  (where you ARE): it always reflects the selected node's ancestry, so navigating replaces the
 *  whole row rather than appending to it. Ancestors are plain and clickable when `onSelect` is
 *  given; the current node draws as a filled pill and never answers a click, since clicking your
 *  own location is a no-op only a disabled-looking control would need.
 *
 *  HOVER IS INK, NOT A WASH, AND IT CARRIES THE UNDERLINE (upstream 2026-09-05). The ancestors
 *  used to be underlined at rest, which spent the loudest channel inline text has on furniture
 *  and left hover with nothing to say. Now: at rest plain `--text-2` with no rule under it;
 *  hovered or keyboard-focused, ink to `--text-1` and the underline arrives. The system's own
 *  hover recipe (`data-kn-hover` — a face one step up plus a reserved border) is deliberately
 *  NOT used here: these are 11px words in a wrapping row 6px apart, so washed boxes would touch
 *  each other and the current node's pill, and the row would read as a strip of buttons rather
 *  than as a location. Neither channel reflows, so nothing twitches under the pointer, which is
 *  the rule that recipe exists to keep.
 *
 *  Clickable ancestors are real `<button>`s, so hover has a keyboard twin — the same ink and
 *  underline on `:focus-visible`, plus the global focus ring. A control reachable only by
 *  pointer is not reachable, and hover held in React state is the only way to beat an inline
 *  style object, so the stylesheet cannot do this for us.
 *
 *  ITS VERTICAL ROOM IS A DOCUMENT HEAD'S, AND A PANE'S HEADER ROW NEEDS `dense` (DS OB-243,
 *  #340). The default reserves 40px of height and 10px under the words — room for a wrapped
 *  second line and separation from the title beneath, which is what a document head is. In a
 *  single row beside a 24px button all of that reservation sits BELOW the text, so the words
 *  ride high and the button reads as dropped. `dense` drops both: the row becomes as tall as
 *  its own text and centres against whatever is next to it. Nothing else changes — same ink,
 *  same hover, same wrap.
 *
 *  Extracted upstream 2026-08-28 from `ConnectionsSplitPane`'s private `Breadcrumb`.
 *  Typed port of the DS components/nav/Breadcrumb.jsx, OB-101 / #253 (the `dense` prop added
 *  with OB-243, #340). */
export interface BreadcrumbProps {
  /** the ancestry, root first and the current node LAST. An empty path draws an empty row */
  path?: readonly CrumbNode[]
  /** ONE topic for the whole path, not one per node — a node's ancestry shares a topic in this
   *  corpus today. Passed back out through `onSelect` so the host need not re-derive it; a
   *  future host spanning topics widens this component rather than replacing it */
  domain?: string
  /** navigate to an ancestor. Omit and the whole row is static text — the current node is
   *  never clickable either way. Reports `{ id, title, domain }`, where `domain` is that
   *  NODE's own when it has one (including `null` for the root) and the path's otherwise —
   *  so a root crumb reports `null` rather than the hue its descendants happen to share. */
  onSelect?: (node: { id: string; title: string; domain?: string | null }) => void
  /** DROP THE DOCUMENT-HEAD SPACING for a pane's own header row. By default the row reserves
   *  40px of height and 10px under the words — room for a wrapped second line and separation
   *  from a title beneath it, which is what a document head needs. Beside a 24px button in a
   *  single row, all of that sits BELOW the text: the words ride high and the button reads as
   *  dropped (owner-reported 2026-09-20 on the map's header row). `dense` makes the row as tall
   *  as its own text so it centres against whatever is next to it. Same ink, hover and wrap */
  dense?: boolean
}

export function Breadcrumb({ path, domain, onSelect, dense }: BreadcrumbProps) {
  /* which crumb the pointer or the keyboard is on. State rather than CSS because the ink and
     the underline are set inline, and an inline style object wins against any stylesheet rule
     a `:hover` selector could carry. */
  const [hot, setHot] = useState<number | null>(null)
  const items = path || []
  return (
    <div style={{
      display: 'flex', alignItems: 'center', columnGap: 6, rowGap: 1, fontSize: 11,
      color: 'var(--text-2)', padding: dense ? 0 : '0 0 10px', flexWrap: 'wrap', lineHeight: 1.3,
      minHeight: dense ? 0 : 40, flexShrink: 0,
    }}>
      {items.map((n, i) => {
        const last = i === items.length - 1
        const live = !!onSelect && !last
        const lit = live && hot === i
        return (
          <Fragment key={n.id}>
            {i > 0 ? <span style={{ color: 'var(--text-3)' }}>{'›'}</span> : null}
            {last ? (
              <span style={{
                color: 'var(--accent-primary-ink)', fontWeight: 'var(--fw-bold)',
                background: 'var(--accent-primary-wash)', padding: '1px 7px', borderRadius: 'var(--radius-sm)',
              }}>{n.title}</span>
            ) : live ? (
              <button
                type="button" data-crumb={n.id}
                onClick={() => onSelect!({ id: n.id, title: n.title, domain: n.domain !== undefined ? n.domain : domain })}
                onMouseEnter={() => setHot(i)}
                onMouseLeave={() => setHot((h) => (h === i ? null : h))}
                /* only a KEYBOARD focus lights it — a click focuses the button too, and a crumb
                   left underlined after the pointer has gone says the row is still active. */
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) setHot(i) }}
                onBlur={() => setHot((h) => (h === i ? null : h))}
                style={{
                  padding: 0, border: 0, background: 'none', font: 'inherit', cursor: 'pointer',
                  transition: 'var(--transition-wash)',
                  color: lit ? 'var(--text-1)' : 'var(--text-2)',
                  textDecoration: lit ? 'underline' : 'none', textUnderlineOffset: 2,
                }}
              >{n.title}</button>
            ) : (
              <span style={{ color: 'var(--text-2)' }}>{n.title}</span>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
