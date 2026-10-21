import type { ReactNode, KeyboardEvent, RefObject } from 'react'

/**
 * The system's text box — one recipe, one home. A raised face (`--surface-raised`) on a hairline
 * (`--border-hair`), the primary ring (`--accent-primary`) on focus, `--radius-md`, and the house
 * `✕` to clear: `IconButton`'s own glyph and hover, never a typed × of another size. Extracted from
 * `ConnectionsSplitPane`'s filter on 2026-09-02 when `StopFinder` needed the same box; the filter
 * now renders it. Text inside is always selectable, whatever `user-select` the pane around it sets.
 */
export interface TextInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** a mark drawn inside the left end (e.g. `<FindMark size={12} />`); decorative, `--text-3` */
  leading?: ReactNode
  /** show the ✕ while there is a value. Default `true` */
  clearable?: boolean
  /** `sm` — 12px text, the filter's box; `md` — body size. Default `sm` */
  size?: 'sm' | 'md'
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement>
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  /** defaults to `placeholder` */
  ariaLabel?: string
  /** on the wrapper (width, margin) — never on the input itself */
  style?: Record<string, string | number>
}
/** 1 — how far the `leading` mark sits below centre, so `FindMark`'s ring (drawn 1px above its
 *  box's centre) lines up with the text. DERIVED; re-measure if the leading mark changes */
export const LEADING_DROP: number
export function TextInput(props: TextInputProps): JSX.Element

/** A TITLE WITH A FILTER'S HIT MARKED — the element every filtered list draws its names with
 *  (the Explorer tree's `ContainPill`, `NodePicker`'s menu rows). The other half of the box: the
 *  box takes the text, this shows where it landed.
 *
 *  THE MARK IS A HIGHLIGHTER on the FIRST case-insensitive occurrence: a `--bark-200` fill, 3px
 *  radius, 1px spread of the same colour — and nothing else; weight, underline and ink stay the
 *  row's own (2026-10-01, owner's pick on `guidelines/explorer-filter-hit-mark.html`). Not bold:
 *  root and selected rows are already bold and a bold hit vanished on them. Not a hue: every hue
 *  already has one meaning; bark is the neutral ramp. A port must not mark every occurrence,
 *  change the weight, or swap the fill for a hue.
 *
 *  Render it AS the clipping box (pass `overflow`/`textOverflow`/`whiteSpace` in `style`). Extra
 *  props (`data-*`) land on the span. */
export function MatchTitle(props: {
  text: string
  /** the filter text; empty or absent draws the plain title */
  match?: string
  /** END-truncating title: a hit that would fall past the ellipsis re-renders cut from the FRONT
   *  ("…Statistics"), measured after layout, with the full title as the native tooltip */
  cut?: boolean
  /** a clipped title carries the full text as its native tooltip — `useClipped`'s rule */
  tip?: boolean
  style?: Record<string, string | number>
  [data: string]: unknown
}): JSX.Element

/** where `q` first occurs in `text`, case-insensitive (`{ i, n }`), or null */
export function matchParts(text: string, q?: string | null): { i: number; n: number } | null
/** where a front cut starts — the hit's word, or 4 characters before the hit when that word starts
 *  more than 10 back. CHOSEN, not derived. */
export function leadStart(text: string, i: number): number
/** the capitalised way in, for cards. Same function objects. */
export const MatchMath: { parts: typeof matchParts; leadStart: typeof leadStart }
