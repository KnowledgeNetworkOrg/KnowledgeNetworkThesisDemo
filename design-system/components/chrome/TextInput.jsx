import React from 'react'
import { IconButton, useClipped } from './IconButton.jsx'

/** THE SYSTEM'S TEXT BOX, one recipe: a raised face on a hairline, the primary ring on focus, the
 *  house `✕` (`IconButton`'s own glyph and hover) to clear. It lived only inside
 *  `ConnectionsSplitPane`'s filter until 2026-09-02, when `StopFinder` needed the same box — a
 *  second hand copy is how a recipe drifts, so it is an element now and the filter uses it too.
 *  `leading` is a mark drawn inside the box's left end (the finder's magnifier); it is decorative
 *  and inherits `--text-3`. Sized by `size`: `sm` is the filter's 12px / 5px box, `md` the body
 *  size. Selection is always allowed inside, whatever the pane around it says. */
/** THE LEADING MARK SITS 1px LOWER THAN CENTRED (owner 2026-10-05: the placeholder did not line up
 *  with the magnifier). DERIVED: the text's x-height centres exactly on the box (measured in Nunito
 *  at 12px), but `FindMark`'s ring is drawn at y 5 of its 12px box, 1px above the box's centre,
 *  because the handle takes the lower right. 1px down puts the ring on the text's centre. */
export const LEADING_DROP = 1

export function TextInput({ value, onChange, placeholder, leading, clearable = true, size = 'sm', autoFocus = false, inputRef, onKeyDown, ariaLabel, style }) {
  const [focused, setFocused] = React.useState(false)
  const own = React.useRef(null)
  const ref = inputRef || own
  React.useEffect(() => { if (autoFocus && ref.current) ref.current.focus() }, [])
  const padY = size === 'sm' ? 5 : 6
  const padL = leading ? 28 : 8
  const padR = clearable && value ? 26 : 8
  return (
    <div style={{ position: 'relative', ...style }}>
      {leading ? <span data-leading="" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(calc(-50% + ' + LEADING_DROP + 'px))', display: 'flex', color: 'var(--text-3)', pointerEvents: 'none' }}>{leading}</span> : null}
      <input ref={ref} type="text" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} aria-label={ariaLabel || placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: size === 'sm' ? 12 : 'var(--fs-body)', lineHeight: 'var(--lh-snug)',
          padding: padY + 'px ' + padR + 'px ' + padY + 'px ' + padL + 'px',
          border: '1px solid ' + (focused ? 'var(--accent-primary)' : 'var(--border-hair)'), borderRadius: 'var(--radius-md)',
          color: 'var(--text-1)', background: 'var(--surface-raised)', outline: 'none', boxShadow: 'none',
          /* selects only while you are in it: a drag across the page from outside never catches the box
             or its words (owner 2026-10-05); click in and every selection inside works as before */
          userSelect: focused ? 'text' : 'none', WebkitUserSelect: focused ? 'text' : 'none', transition: 'border-color var(--dur-hover) var(--ease-soft)',
        }} />
      {clearable && value ? (
        <span style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
          <IconButton tone="chrome" size={18} glyphSize={11} title="clear" label="clear" onClick={() => { onChange(''); if (ref.current) ref.current.focus() }} />
        </span>
      ) : null}
    </div>
  )
}

/** WHERE A FILTER'S TEXT FIRST OCCURS IN A TITLE — `{ i, n }`, or null. Case-insensitive, first
 *  occurrence only: one mark per title. The same test every filter in the system prunes by. */
export function matchParts(text, q) {
  if (!q || !text) return null
  const i = String(text).toLowerCase().indexOf(String(q).trim().toLowerCase())
  return i < 0 || !String(q).trim() ? null : { i, n: String(q).trim().length }
}
/** where a FRONT CUT starts: the start of the word holding the hit, unless that word begins more
 *  than 10 characters before it (then 4 before). CHOSEN, so the hit lands near the left of a
 *  narrow row with a little of its word for context. */
export function leadStart(text, i) { const w = text.lastIndexOf(' ', i - 1) + 1; return i - w > 10 ? Math.max(0, i - 4) : w }

/** A TITLE WITH A FILTER'S HIT MARKED — the one element every filtered list draws its names with
 *  (2026-10-01: the Explorer tree first, then `NodePicker`'s menu). Lives beside `TextInput`
 *  because it is the other half of the same act: the box takes the text, this shows where it
 *  landed.
 *
 *  THE MARK IS A HIGHLIGHTER: a `--bark-200` fill behind the matched letters, a 3px radius and a
 *  1px spread of the same colour, and NOTHING ELSE — weight, underline and ink are the row's own
 *  (owner's pick, option 3 on `guidelines/explorer-filter-hit-mark.html`). Not bold: root and
 *  selected rows are already bold, and a bold hit vanished on them. Not a hue: every hue already
 *  has one meaning (moss = yes, pond = selection and typing, acorn = movement, berry = refusal);
 *  bark is the neutral ramp, so the fill spends no meaning.
 *
 *  `cut` — the title END-truncates, and a hit past the ellipsis ("Multiplexers & Deco…" by "deco")
 *  would mark letters nobody sees. Measured after layout: if the mark's right edge passes the
 *  box's, the title re-renders as "…" + the text from `leadStart`, keyed on text + query so a new
 *  query measures afresh. `tip` — a clipped title carries the full text as its native tooltip
 *  (`useClipped`'s rule: measured overflow, never string length). Pass the clipping styles in
 *  `style`; this span IS the box that overflows. Extra props (a `data-*`) land on the span. */
export function MatchTitle({ text, match, cut = false, tip = false, style, ...rest }) {
  const parts = matchParts(text, match)
  const clip = useClipped(text)
  const key = text + '|' + (match || '')
  const [leadFor, setLeadFor] = React.useState(null)
  const lead = !!parts && cut && leadFor === key
  React.useLayoutEffect(() => {
    if (!parts || !cut || lead) return
    const sp = clip.ref.current, mk = sp && sp.querySelector('[data-match]')
    if (mk && mk.getBoundingClientRect().right > sp.getBoundingClientRect().right + 0.5) setLeadFor(key)
  })
  const from = lead ? leadStart(text, parts.i) : 0
  const body = parts ? [
    lead ? '…' : null,
    text.slice(from, parts.i),
    <span key="m" data-match="1" style={{ background: 'var(--bark-200)', borderRadius: 3, boxShadow: '0 0 0 1px var(--bark-200)' }}>{text.slice(parts.i, parts.i + parts.n)}</span>,
    text.slice(parts.i + parts.n),
  ] : text
  return <span ref={clip.ref} onPointerEnter={tip ? clip.onPointerEnter : undefined} title={lead ? text : (tip ? clip.title : undefined)} style={style} {...rest}>{body}</span>
}

/** the capitalised way in, for cards reading `window.<Namespace>`. Same function objects. */
export const MatchMath = { parts: matchParts, leadStart }
