import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode, RefObject } from 'react'

import { IconButton, useClipped } from './IconButton'

/** THE SYSTEM'S TEXT BOX, one recipe: a raised face (`--surface-raised`) on a hairline
 *  (`--border-hair`), the primary ring (`--accent-primary`) on focus, `--radius-md`, and the
 *  house `✕` (`IconButton`'s own glyph and hover) to clear — never a typed × of another size.
 *  It lived only inside `ConnectionsSplitPane`'s filter until 2026-09-02, when `StopFinder`
 *  needed the same box — a second hand copy is how a recipe drifts, so it is an element now.
 *  Text inside is always selectable, whatever `user-select` the pane around it sets.
 *  Typed port of the DS TextInput.jsx (contract: TextInput.d.ts), OB-137/138 / #267. */
export interface TextInputProps {
  /** the box's value — controlled */
  value: string
  /** every keystroke, and the ✕ (with `''`) */
  onChange: (value: string) => void
  /** the placeholder, and the aria-label unless `ariaLabel` is given */
  placeholder?: string
  /** a mark drawn inside the left end (e.g. `<FindMark size={12} />`); decorative, `--text-3` */
  leading?: ReactNode
  /** show the ✕ while there is a value. Default `true` */
  clearable?: boolean
  /** `sm` — 12px text, the filter's box; `md` — body size. Default `sm` */
  size?: 'sm' | 'md'
  /** focus the input on mount */
  autoFocus?: boolean
  /** the input element, for a caller that focuses it itself */
  inputRef?: RefObject<HTMLInputElement | null>
  /** the input's keydown, before the box does anything with it */
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  /** defaults to `placeholder` */
  ariaLabel?: string
  /** on the wrapper (width, margin) — never on the input itself */
  style?: CSSProperties
}

/** The leading mark sits 1px lower than centred: the text's x-height centres
 *  exactly on the box, but `FindMark`'s ring is 1px above its own box's centre. */
export const LEADING_DROP = 1

export function TextInput({ value, onChange, placeholder, leading, clearable = true, size = 'sm', autoFocus = false, inputRef, onKeyDown, ariaLabel, style }: TextInputProps) {
  const [focused, setFocused] = useState(false)
  const own = useRef<HTMLInputElement | null>(null)
  const ref = inputRef || own
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus()
    // mount only, as the DS's effect is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
             or its words; click in and every selection inside works as before */
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

/** Where a filter's text first occurs in a title, case-insensitively; one mark per title. */
export function matchParts(text: string, q?: string | null): { i: number; n: number } | null {
  if (!q || !text) return null
  const i = String(text).toLowerCase().indexOf(String(q).trim().toLowerCase())
  return i < 0 || !String(q).trim() ? null : { i, n: String(q).trim().length }
}

/** Where a front cut starts: the hit's word, or 4 characters before the hit when
 *  that word starts more than 10 back. */
export function leadStart(text: string, i: number): number {
  const w = text.lastIndexOf(' ', i - 1) + 1
  return i - w > 10 ? Math.max(0, i - 4) : w
}

/** A title with a filter's hit marked. The mark is a `--bark-200` highlighter
 *  with a 3px radius and a 1px spread; weight, underline and ink stay the row's
 *  own. `cut` re-renders a hit past the ellipsis from the front, with the full
 *  title as the tooltip. Pass the clipping styles in `style`: this span is the
 *  box that overflows. */
export interface MatchTitleProps {
  text: string
  /** the filter text; empty or absent draws the plain title */
  match?: string
  /** END-truncating title: a hit past the ellipsis re-renders cut from the FRONT */
  cut?: boolean
  /** a clipped title carries the full text as its native tooltip */
  tip?: boolean
  style?: CSSProperties
  [data: string]: unknown
}

export function MatchTitle({ text, match, cut = false, tip = false, style, ...rest }: MatchTitleProps) {
  const parts = matchParts(text, match)
  const clip = useClipped<HTMLSpanElement>(text)
  const key = text + '|' + (match || '')
  const [leadFor, setLeadFor] = useState<string | null>(null)
  const lead = !!parts && cut && leadFor === key
  useLayoutEffect(() => {
    if (!parts || !cut || lead) return
    const sp = clip.ref.current
    const mk = sp && sp.querySelector<HTMLElement>('[data-match]')
    /* whether the hit falls past the ellipsis is only knowable after layout */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mk && mk.getBoundingClientRect().right > sp.getBoundingClientRect().right + 0.5) setLeadFor(key)
  }, [parts, cut, lead, clip, key])
  const from = lead && parts ? leadStart(text, parts.i) : 0
  const body = parts ? [
    lead ? '…' : null,
    text.slice(from, parts.i),
    <span key="m" data-match="1" style={{ background: 'var(--bark-200)', borderRadius: 3, boxShadow: '0 0 0 1px var(--bark-200)' }}>{text.slice(parts.i, parts.i + parts.n)}</span>,
    text.slice(parts.i + parts.n),
  ] : text
  const clipProps = lead ? { ...clip, title: text } : tip ? clip : { ...clip, title: undefined, onPointerEnter: undefined }
  return <span {...clipProps} style={style} {...rest}>{body}</span>
}

/** The capitalised way in, for cards reading `window.<Namespace>`. Same function objects. */
export const MatchMath = { parts: matchParts, leadStart }
