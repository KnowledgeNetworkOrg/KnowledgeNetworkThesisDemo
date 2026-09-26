import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, MutableRefObject, ReactNode } from 'react'

import { EDIT_MARK_LIFT, EditMark } from '../chrome/EditMark'
import { IconButton, useRecede, wrapTip } from '../chrome/IconButton'
import { InlineText } from '../chrome/InlineText'
import { settleRead } from '../chrome/MeasureBox'
import { Pane, PaneScroller } from '../chrome/Pane'
import { PaneColumnHeader } from '../chrome/PaneColumnHeader'
import { LEGEND_INSET } from '../chrome/PaneHeader'
import { Caret } from '../nav/TreeRow'
import { BinMark } from '../sidebar/BinMark'
import { FlagButton } from './FilmRoll'

/* Typed port of the DS components/presenter/LectureNotes.jsx (contract: LectureNotes.d.ts),
   part 5 of the presenter-mode split — OB-145 / #267, on the 2026-09-04 source (the pane does the
   reading: `stop` filters the live column and stamps a save, `stops` groups the review). */

/** the value stored on an entry's `category`, its glyph, its label and its wash */
export interface NoteCategory {
  /** the value stored on an entry's `category` — the host's own string, never a fixed union */
  key: string
  /** ONE typed character. Not a drawn mark and not an emoji: the coloured box is what says
   *  "category", so plain punctuation reads correctly inside it */
  glyph: string
  /** lower case, two or three words — the tag's tooltip and the popover's row label */
  label: string
  /** the tag box's fill, e.g. `'var(--hue-cobalt-wash-raised)'`. Any colour: a host's own
   *  categories are the host's, and a closed union here compiles into a lint rule against them */
  wash: string
}

/** one During-class entry, as the host stores it and the pane draws it */
export interface LectureNote {
  id?: string | number
  /** a `NoteCategory.key`. An unknown key draws no tag rather than a fallback one — a wrong
   *  category is worse than none */
  category?: string
  text: string
  /** WHEN, verbatim, mono — "00:19:12". The component never composes or formats this: only the
   *  host knows the lecture clock. It does not need to name the stop, because the During column
   *  is one stop's (see `entries`). In the recap's `variant="review"` list, which spans stops, the
   *  stop goes into `stopLabel` and the list groups under it; `when` stays the time */
  when?: string
  /** THE STOP THIS NOTE WAS WRITTEN ABOUT, as the head it files under in `variant="review"` —
   *  "stop 20 · Hashing & Hash Tables". Any entry carrying one turns the review list into runs of
   *  entries under stop heads, in order of first appearance (the component sorts nothing: pass the
   *  stops in walk order). Ignored in the live pane, whose whole column is one stop's. */
  stopLabel?: string
  /** THE STOP'S INDEX — stamped by `onSave` when the pane is given `stop`, and what the pane reads
   *  to filter the live column and to group the review list (with `stops` for the titles). The
   *  host stores it; the pane never guesses it. */
  stop?: number
}

/** THE CATEGORY SET the composer offers by default — three, not v18's four. The fourth was
 *  "idea", glyph ✦, and ✦ is already spent: the readme's glyph table gives it to "teach me this
 *  (generate a curriculum)". One character with two meanings in one product is the ★-vs-✦ fault
 *  this system has already paid for once, so the fourth default category is still unwritten. What
 *  IS written is the way to add one at the desk: `NOTE_CATEGORY_POOL` holds the unspent glyphs
 *  and their washes, and the composer's "new category…" row names one in place (see below).
 *  The set is a PROP, not a closed union: a host with its own categories passes its own list.
 *  `?` and `!` are plain Latin punctuation inside a coloured tag box — the box is what says
 *  "category", so a bare `?` here is not `OptionalMark`'s circle-? affordance. */
export const NOTE_CATEGORIES: NoteCategory[] = [
  { key: 'question', glyph: '?', label: 'question', wash: 'var(--hue-cobalt-wash-raised)' },
  { key: 'fix', glyph: '!', label: 'fix this slide', wash: 'var(--hue-amber-wash-raised)' },
  { key: 'follow-up', glyph: '→', label: 'follow up', wash: 'var(--hue-teal-wash-raised)' },
]

/** an unspent glyph and the wash that travels with it */
export interface NoteCategorySlot { glyph: string; wash: string }

/** THE UNSPENT GLYPHS, and the only sanctioned way to mint a category at the desk. A category
 *  needs two things the professor cannot be asked for mid-lecture — a character nobody else in
 *  the product has claimed, and a wash from the ring — so the SYSTEM hands both out and the
 *  professor types only a name. `free` is every slot whose glyph is not already in use (by a
 *  default category or by one minted earlier), `next` is the first of them, and
 *  `make(label, categories, slot)` turns a typed name into a whole `NoteCategory` ready for the
 *  host to append — pass a `slot` from `free` to honour a glyph the professor picked, omit it and
 *  `next` decides. It returns `null` when the name is blank or the pool is spent.
 *
 *  THE GLYPHS ARE PLACEHOLDERS (owner, 2026-09-03). Plain punctuation nothing else in the product
 *  has claimed, standing in until the real set is drawn: none of them appears in the readme's
 *  glyph table, where `★ ✦ ? ! →` are all spoken for. Replacing them is a change to this list and
 *  to nothing else. */
export const NOTE_CATEGORY_POOL = {
  slots: [
    { glyph: '~', wash: 'var(--hue-violet-wash-raised)' },
    { glyph: '#', wash: 'var(--hue-jade-wash-raised)' },
    { glyph: '=', wash: 'var(--hue-mallow-wash-raised)' },
    { glyph: '@', wash: 'var(--hue-honey-wash-raised)' },
    { glyph: '%', wash: 'var(--hue-river-wash-raised)' },
    { glyph: '§', wash: 'var(--hue-clay-wash-raised)' },
  ] as NoteCategorySlot[],
  free(categories?: NoteCategory[]): NoteCategorySlot[] {
    const spent: Record<string, true> = {}
    ;(categories || []).forEach((c) => { if (c && c.glyph) spent[c.glyph] = true })
    return NOTE_CATEGORY_POOL.slots.filter((s) => !spent[s.glyph])
  },
  next(categories?: NoteCategory[]): NoteCategorySlot | null {
    return NOTE_CATEGORY_POOL.free(categories)[0] || null
  },
  make(label: string, categories?: NoteCategory[], slot?: NoteCategorySlot | null): NoteCategory | null {
    const name = (label || '').trim()
    const use = slot || NOTE_CATEGORY_POOL.next(categories)
    if (!name || !use) return null
    const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const taken: Record<string, true> = {}
    ;(categories || []).forEach((c) => { if (c && c.key) taken[c.key] = true })
    let key = stem || 'category'
    let n = 2
    while (taken[key]) { key = (stem || 'category') + '-' + n; n += 1 }
    return { key, glyph: use.glyph, label: name, wash: use.wash }
  },
}

/** The pane's numbers. `during` (300) is the During column's DEFAULT width — a preference now,
 *  not a fixed column: the divider between the two columns drags. `duringMin`/`preparedMin` are
 *  the one clamp pair the drag and the double-click reset both read, so the two can never
 *  disagree; `divider` is the hit strip's width, wider than the hairline it draws because a 1px
 *  target is not a target. `composer` (30) is CHOSEN on the v18 render; `glyphPanel` (104) is the
 *  new-category glyph drop-down's panel, wide enough for four tags a row; the rest is the tag
 *  box's own geometry. A host laying out arithmetically reads them here rather than retyping
 *  them — and a published number is also the only part of the composer a specimen card's
 *  staleness guard can reach, since `Composer` itself is a module-level helper. */
export const LECTURE_NOTES_METRICS = {
  during: 300, duringMin: 220, preparedMin: 260, divider: 14,
  composer: 30, composerLines: 4, tag: { w: 22, h: 19 }, gutter: 14, popover: 208, glyphPanel: 104, actions: 46,
  /* the composer field's line: `--fs-caption` 12 × `--lh-normal` 1.6 ≈ 19, rounded to a whole
     pixel so the field's auto-height never lands on a fraction (DERIVED). One line + 3px padding
     top and bottom = 25, inside the 30px pill at rest, so a one-line composer is the height it
     always was. `composerLines` (4) is CHOSEN: the most a professor writes mid-lecture before the
     box should scroll rather than push the list away. */
  composerLineH: 19,
  /* THE ROOM BETWEEN THE PANE'S LEGEND AND THE COLUMN HEADS. Chosen, not derived: the body
     started at 0 and both heads read as a second line of the 11px legend they sat under — the
     prepared head worst, because it repeats the legend's word (owner, 2026-09-03). 8 is one
     head's own leading, which is the smallest step that reads as a separate heading. */
  headClear: 8,
  /* THE BODY'S LEFT INSET MATCHES THE LEGEND'S TEXT (owner, 2026-09-04: a 7px near-miss between
     "notes from this lecture" and the lines under it — too small to read as a step, too big to
     read as aligned). DERIVED, in `PaneHeader` where the 16 + 5 live; restated here only so a
     card can read it off the metrics. The right side keeps 14 (scrollbar clearance). */
  legendInset: LEGEND_INSET,
}

/** THE ENTER MARK — the return-key arrow, drawn once. Every other place in the presenter parts
 *  that means "the Enter key" says so with this shape rather than with a keycap picture or a
 *  bare `⏎` in whatever font the surface happens to be in (owner, 2026-09-03: the composer's
 *  send button had been drawing a plain up arrow, which is a different key). It inherits
 *  `currentColor`, so a button's own hover ramp colours it. */
export function EnterMark({ size = 11, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block', ...style }}>
      <path d="M10 2.7v4.1H3.2M5.6 4.3 3 6.8l2.6 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** ONE CATEGORY TAG: the glyph in its category's wash. Mono, because it sits in a column of
 *  numerals and marks rather than of words. `as="button"` makes it pickable — the glyph panel's
 *  swatches — and a pickable tag ANSWERS THE POINTER (owner, 2026-09-04: the panel's glyphs sat
 *  inert under the cursor): a strong edge and a bark ring around the wash, so the wash itself,
 *  which is the category's identity, never changes under hover. `live` (the one already chosen)
 *  keeps its ink edge whether hovered or not. */
function CategoryTag({ cat, title, dashed, glyph, as, onClick, live }: {
  cat?: Pick<NoteCategory, 'glyph' | 'wash'> & { label?: string } | null
  title?: string | false
  dashed?: boolean
  glyph?: string
  as?: 'button'
  onClick?: () => void
  live?: boolean
}) {
  const M = LECTURE_NOTES_METRICS
  const [hot, setHot] = useState(false)
  if (!cat && !dashed) return null
  const button = as === 'button'
  const tip = title === false ? undefined : title || (cat ? cat.label : '')
  const style: CSSProperties = {
    flexShrink: 0, width: M.tag.w, height: M.tag.h, boxSizing: 'border-box', padding: 0,
    borderRadius: 'var(--radius-xs)', background: cat ? cat.wash : 'transparent',
    border: live ? '1px solid var(--text-2)' : button && hot ? '1px solid var(--border-strong)' : cat ? '1px solid transparent' : '1px dashed var(--border-dashed)',
    boxShadow: button && hot ? '0 0 0 2px var(--bark-100)' : 'none',
    display: 'grid', placeItems: 'center', cursor: button ? 'pointer' : undefined,
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: cat ? 'var(--fw-bold)' : 'var(--fw-regular)',
    color: cat ? 'var(--text-1)' : 'var(--text-2)',
    transition: 'var(--transition-wash)',
  }
  const face = cat ? cat.glyph : glyph
  if (button) {
    return (
      <button type="button" onClick={onClick} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} title={wrapTip(tip)} style={style}>{face}</button>
    )
  }
  return <span onClick={onClick} title={wrapTip(tip)} style={style}>{face}</span>
}

/** THE TAG-AND-CARET TRIGGER — "a list drops from here", drawn twice in the composer (the category
 *  button, the naming row's glyph button), so it is one helper with one hover: the bark face steps
 *  a rung and the hairline steps to a rule (owner, 2026-09-04: the glyph drop-down gave nothing
 *  back under the pointer). `active` is the open state's edge. */
function Trigger({ onClick, disabled, title, active, children }: { onClick?: () => void; disabled?: boolean; title?: string; active?: boolean; children?: ReactNode }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={wrapTip(title)}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 3, height: 22, padding: '0 4px 0 1px', boxSizing: 'border-box',
        border: '1px solid ' + (active || (hot && !disabled) ? 'var(--border-rule)' : 'var(--border-hair)'), borderRadius: 'var(--radius-xs)',
        background: hot && !disabled ? 'var(--bark-100)' : 'var(--bark-50)', cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        color: hot && !disabled ? 'var(--text-2)' : 'var(--text-3)', transition: 'var(--transition-wash)' }}>
      {children}
    </button>
  )
}

/** ONE ROW OF THE CATEGORY POPOVER. Selected is a bark-50 wash; hovered is `--surface-hover`,
 *  the same face every menu row in the system takes under the pointer — and, since 2026-09-16,
 *  on the same clock: `--transition-wash-tracking` (none, OB-204). A highlight that follows the
 *  pointer down an open list must be where the pointer is; `--transition-wash` left it 140ms behind. */
function PopRow({ selected, onClick, disabled, title, style, children }: { selected?: boolean; onClick?: () => void; disabled?: boolean; title?: string; style?: CSSProperties; children?: ReactNode }) {
  const [hot, setHot] = useState(false)
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={wrapTip(title)}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 26, padding: '0 6px', boxSizing: 'border-box',
        border: 'none', borderRadius: 'var(--radius-xs)', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left',
        background: selected ? 'var(--bark-50)' : hot && !disabled ? 'var(--surface-hover)' : 'transparent',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-medium)', color: 'var(--text-1)',
        transition: 'var(--transition-wash-tracking)', ...style }}>
      {children}
    </button>
  )
}

/** ONE ENTRY. The row's actions arrive with the pointer, the way every hover-revealed control in
 *  this system does (`IconButton`'s own reveal), and they are `EditMark` and `BinMark`: a note is
 *  a user-saved thing, which is the one thing the drawn bin is for — a ✕ here would read as
 *  "remove from the composition". The meta line names the time: the column is one stop's.
 *
 *  THE ROW'S SPACE FOR THOSE ACTIONS IS RESERVED AT REST. It used to be padded in on hover, so
 *  the note's own words re-wrapped and jumped the moment the pointer arrived — the recede rule
 *  ("the button keeps its space, so nothing reflows when it arrives") applied to a control that
 *  was fading rather than to the gap it fades into (owner, 2026-09-03).
 *
 *  THE PENCIL EDITS THE NOTE IN PLACE (owner, 2026-09-04), the same way the prepared column's
 *  pencil does: with `onCommit` the note's words become an `InlineText` — click to open, type,
 *  click the pencil again (or ⏎, or blur) to save and close, esc reverts. The actions arrive on
 *  the system's recede clock (`useRecede`): they wait out the grace period after the pointer
 *  leaves rather than vanishing under its heels. `onEdit` remains the REQUEST route for a host
 *  that wants editing to mean something else; in-place wins when both are passed, as
 *  `onPreparedCommit` wins over `onEditPrepared`.
 *
 *  THE BIN IS `tone="danger"` — BERRY AT REST, hovering within its own ramp. Deleting a note is
 *  destroying a user-saved thing, which is exactly what the tone is for. The two actions sit
 *  flush (`gap: 0`): 20px targets side by side read as one cluster, and the 2px between them
 *  read as a third, empty slot. */
function Entry({ entry, cat, onEdit, onCommit, onDelete, first }: {
  entry: LectureNote
  cat?: NoteCategory
  onEdit?: (note: LectureNote) => void
  onCommit?: (note: LectureNote, text: string) => void
  onDelete?: (note: LectureNote) => void
  first: boolean
}) {
  const [hot, setHot] = useState(false)
  const [shown, show, hide] = useRecede()
  const [editing, setEditing] = useState(false)
  /* the pencil's memory of the state at mousedown — the field's blur commits BEFORE the click
     lands, so a toggle read at click time would reopen what the blur just saved */
  const wasEditing = useRef(false)
  const point = useRef<{ x: number; y: number } | null>(null)
  const inPlace = !!onCommit && typeof entry.text === 'string'
  const pencil = inPlace || !!onEdit
  const acts = pencil || !!onDelete
  const up = shown || editing
  /* `overflowWrap: 'anywhere'`: a note is whatever was typed, and a run with no space in it (a URL,
     a pasted identifier, a mash of keys) has no break point of its own — without this it drives
     straight through the reserved action space and under the pencil and bin (owner, 2026-09-04,
     with a screenshot of exactly that). `pretty` still governs where an ordinary sentence breaks. */
  const textStyle: CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-1)', textWrap: 'pretty', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text' }
  /* THE FIRST ROW'S TOP PADDING IS SMALLER (4 against 7; DS OB-207). The 7 is half of the 14px
     between two notes' words — it pairs with the row below it across a hairline. The first row has
     no row above it and no hairline, only the column head, which pads itself 8px underneath: the
     full 7 there is a third helping of a gap two other boxes are already giving (owner,
     2026-09-17). Its BOTTOM stays 7, so the rhythm between rows is unchanged, and the hover pill
     still clears the words at the top by 4. */
  return (
    <div data-lecture-note={entry.id} onMouseEnter={() => { setHot(true); show() }} onMouseLeave={() => { setHot(false); hide() }} style={{
      display: 'flex', alignItems: 'flex-start', gap: 9, position: 'relative', padding: first ? '4px 4px 7px' : '7px 4px', margin: '0 -4px',
      borderTop: first ? 'none' : '1px solid ' + (hot ? 'transparent' : 'var(--border-hair)'),
      borderRadius: 'var(--radius-xs)', background: hot ? 'var(--bark-50)' : 'transparent',
      /* the refusal lives on the COLUMN (see the During wrapper), so the row inherits it and the
         note's own words below opt back in — one place for the rule, one for the exception */
      transition: 'var(--transition-wash)',
    }}>
      {/* THE TAG SITS ON THE NOTE'S FIRST LINE, NOT ON THE ROW'S TOP EDGE (DS OB-207). The row is
         `alignItems: 'flex-start'` (a multi-line note plus its meta line must not drag the tag
         down to the block's centre), which by itself puts the tag's own TOP flush with the text's
         top — 0.9px short of the first line's visual centre (`--fs-body` 13 × `--lh-normal` 1.6 =
         20.8px line box, the tag 19px). DERIVED, not chosen: half the difference, rounded to 1px.
         Small, but it was the "bit weird" the tag read as sitting a shade high (owner). */}
      <span style={{ marginTop: 1, display: 'inline-flex' }}><CategoryTag cat={cat} /></span>
      <div style={{ minWidth: 0, flex: 1, paddingRight: acts ? LECTURE_NOTES_METRICS.actions : 0 }}>
        {/* AN ENTRY IS READ, not glanced at, so it takes `--fs-body` — the ramp's rule ("anything
           a person READS is --fs-body or larger") over v18's 12px, which was drawn before this
           column was a real scroller. */}
        {inPlace ? (
          /* keyed by `editing` so esc's revert is a remount; NO `onOpen` — the words stay a reading
             surface and the pencil is the only way in, exactly as on the prepared prose. `pre-wrap`
             at rest so a note with a line break wraps identically open and closed. */
          <InlineText key={editing ? 'edit' : 'rest'} value={entry.text} multiline enterInserts editing={editing} pointRef={point}
            onCommit={(v) => { setEditing(false); if (v !== entry.text && onCommit) onCommit(entry, v) }}
            onCancel={() => setEditing(false)}
            style={{ display: 'block', whiteSpace: 'pre-wrap', ...textStyle }} />
        ) : (
          <div style={textStyle}>{entry.text}</div>
        )}
        {/* `--fs-caption` (12px), NOT `--fs-micro` (11px; DS OB-207). At 11px, mono digits this
           tight over-anti-alias into blobs on a real screen and photograph as "AA·AA" — the
           owner's screenshot of a Preview note read that way, though the digits were right
           ("00:00": nothing is timed in Preview). `--fs-caption` is also the token's own named
           use — "meta lines" — where `--fs-micro` is "step numbers, tags". Same never-clipped
           guard as the note's own text above, so an unusually long `when` wraps. */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{entry.when}</div>
      </div>
      {acts ? (
        /* `reveal` IS THE VISIBILITY PROP — the same lesson the prepared pencil paid for. This span
           carried the fade and the buttons were `reveal={false} reachable={up}`, which is the recede
           pinned permanently on: `IconButton` sets its OWN opacity 0 when `reveal` is false, so no
           wrapper opacity can ever show it, and the row's actions had never once appeared (owner,
           2026-09-04: "i dont see the pencil icon in any of the class notes"). The state drives
           `reveal` itself now; the span only positions. */
        <span style={{ position: 'absolute', right: 4, top: 6, display: 'flex', gap: 0 }}>
          {pencil ? (
            <span onMouseDown={() => { wasEditing.current = editing }} style={{ display: 'inline-flex' }}>
              <IconButton tone="chrome" size={20} label="edit this note" reveal={up}
                title={inPlace && editing ? 'editing · click again or ⌘⏎ saves, esc reverts' : 'edit this note'}
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  if (!inPlace) { if (onEdit) onEdit(entry); return }
                  if (wasEditing.current) { wasEditing.current = false; setEditing(false); return }
                  point.current = e && e.clientX != null ? { x: e.clientX, y: e.clientY } : null
                  setEditing(true)
                }}><EditMark /></IconButton>
            </span>
          ) : null}
          {onDelete ? <IconButton tone="danger" size={20} title="delete this note" label="delete this note" reveal={up} onClick={() => onDelete(entry)}><BinMark /></IconButton> : null}
        </span>
      ) : null}
    </div>
  )
}

/** THE COMPOSER — one field with the category button inside its own border and a QUIET arrow at
 *  the far end. It is not `TextInput`: that box owns its border and offers a decorative `leading`
 *  mark, and this one has to hold a popover-opening BUTTON at one end and a send at the other,
 *  inside one border. It keeps `TextInput`'s recipe where it matters — raised face, hairline at
 *  rest, a ring on focus.
 *
 *  THE TEXTBOX WASH IS ON THE FIELD, NOT ON THE PILL. `--state-editing-wash` lights the typing
 *  area alone, and only while it is active: the pill holds two BUTTONS as well as the field, and
 *  washing the whole of it tinted the controls with it and read as one big lit-up bar (owner,
 *  2026-09-03, correcting the first pass, which had put the wash on the pill at rest).
 *
 *  THE ARROW IS ABSENT UNTIL THERE IS SOMETHING TO SAVE, and grey when it arrives: acorn only
 *  under the pointer, so the colour is a response rather than a decoration (owner, v15 → v18).
 *  It is `EnterMark` — the return key, the same mark every other Enter in the presenter parts
 *  draws. ⏎ saves too, and nothing in the box says so: the room is worth more than the reminder.
 *
 *  "NEW CATEGORY…" NAMES ONE IN PLACE, GLYPH INCLUDED. It used to fire `onNewCategory()` and hand
 *  the whole problem to the host, which meant nothing happened at the desk (owner, 2026-09-03:
 *  "new category in the dropdown dont work"). Now the row becomes a field: the system offers the
 *  next unspent glyph from `NOTE_CATEGORY_POOL`, THE SWATCH OPENS THE REST OF THE POOL so the
 *  professor can pick a different one (owner, same day — placeholders until the real set is
 *  drawn), they type a name, and `onAddCategory` receives a WHOLE `NoteCategory` to append. The
 *  wash still travels with the glyph rather than being a second choice: two decisions where one
 *  will do is how a category ends up unreadable. */
function Composer({ categories, category, onCategoryChange, draft, onDraftChange, onSave, onAddCategory, placeholder, menuOpen, onMenuOpenChange }: {
  categories: NoteCategory[]
  category?: string
  onCategoryChange?: (key: string) => void
  draft?: string
  onDraftChange?: (draft: string) => void
  onSave?: (note: { category?: string; text: string }) => void
  onAddCategory?: (category: NoteCategory) => void
  placeholder: string
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
}) {
  const M = LECTURE_NOTES_METRICS
  const [focused, setFocused] = useState(false)
  const [ownMenu, setOwnMenu] = useState(false)
  const [sendHot, setSendHot] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<NoteCategorySlot | null>(null)
  const open = menuOpen != null ? menuOpen : ownMenu
  const setOpen = (v: boolean) => { if (onMenuOpenChange) onMenuOpenChange(v); if (menuOpen == null) setOwnMenu(v); if (!v) { setNaming(false); setName(''); setPicking(false); setPicked(null) } }
  const cat = categories.find((c) => c.key === category) || categories[0]
  const has = !!(draft || '').trim()
  const save = () => { if (has && onSave) onSave({ category: cat ? cat.key : undefined, text: (draft || '').replace(/[ \t]+\n/g, '\n').trim() }) }
  /* THE FIELD GROWS WITH ITS LINES. It was an `<input>`, which cannot hold a line break at all; a
     professor mid-lecture had no way to write two lines (owner, 2026-09-04). It is a one-row
     `<textarea>` now that sizes itself to its content up to `composerLines` rows, then scrolls; the
     pill's height follows and the two controls stay on the bottom row, where a chat box keeps them.
     ⏎ still saves — that is what the arrow promises — and SHIFT+⏎ breaks a line, the convention
     every send-on-Enter box shares; Ctrl+⏎ is the other convention, used where ⏎ already breaks,
     which is what the in-place editors do. The two boxes therefore agree: the modifier is always
     the one that does the OTHER thing. */
  const fieldRef = useRef<HTMLTextAreaElement | null>(null)
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    el.style.height = 'auto'
    const cap = M.composerLineH * M.composerLines + 6
    el.style.height = Math.min(el.scrollHeight, cap) + 'px'
    el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden'
  }, [draft, M.composerLineH, M.composerLines])
  const free = NOTE_CATEGORY_POOL.free(categories)
  const slot = (picked && free.filter((s) => s.glyph === picked.glyph)[0]) || free[0] || null
  const mint = () => {
    const made = NOTE_CATEGORY_POOL.make(name, categories, slot)
    if (!made || !onAddCategory) return
    onAddCategory(made)
    if (onCategoryChange) onCategoryChange(made.key)
    setNaming(false); setName(''); setPicking(false); setPicked(null); setOpen(false)
  }
  return (
    <div data-note-composer style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: M.composer, boxSizing: 'border-box', padding: '0 6px 3px 4px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid ' + (focused ? 'var(--state-editing)' : 'var(--border-strong)'), transition: 'border-color var(--dur-hover) var(--ease-soft)' }}>
      {open ? (
        <div data-note-categories style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 8px)', width: M.popover, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: 4, boxSizing: 'border-box', zIndex: 6 }}>
          {categories.map((c) => (
            <PopRow key={c.key} selected={!!cat && c.key === cat.key} onClick={() => { if (onCategoryChange) onCategoryChange(c.key); setOpen(false) }}>
              {/* NO INDEX NUMBER ON THE ROW. Each row carried its 1-based position as a mono
                 numeral, drawn from v18 as a keyboard hint — and nothing anywhere pressed a
                 digit, so it was a shortcut that did not exist, reading as a count or a rank
                 (owner, 2026-09-03: "what are the numbers in the dropdown?"). A real digit
                 shortcut has to be GLOBAL to be worth anything (you would not open a menu to
                 press 1), and the keyboard outside this field is the host's. */}
              <CategoryTag cat={c} title={false} />{c.label}
            </PopRow>
          ))}
          {onAddCategory && naming ? (
            /* THE NAMING ROW: the glyph swatch, the name field, the commit. The swatch is a
               BUTTON — it opens the rest of the pool, because the first free glyph is an offer
               and not a ruling. The wash travels with the glyph and is never a second choice. */
            <div style={{ marginTop: 3, padding: '3px 4px 0', borderTop: '1px solid var(--border-hair)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 26 }}>
                {/* THE GLYPH IS A DROP-DOWN, not a swatch that cycles: it wears the same tag +
                   caret shape as the category button below it, and opens a panel of the free
                   glyphs (owner, 2026-09-03 — the first pass laid them out in a row under the
                   field, which reads as "here are some glyphs" rather than as a control). One
                   idiom for "a list drops from here", twice in the same composer. */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Trigger onClick={() => setPicking((v) => !v)} disabled={free.length < 2} active={picking}
                    title={free.length > 1 ? 'pick a glyph · placeholders for now' : 'the last free glyph'}>
                    <CategoryTag cat={slot ? { glyph: slot.glyph, wash: slot.wash } : null} title={false} /><Caret open />
                  </Trigger>
                  {picking ? (
                    <div style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', width: M.glyphPanel, display: 'flex', flexWrap: 'wrap', gap: 4, padding: 5, boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', zIndex: 7 }}>
                      {free.map((s) => (
                        <CategoryTag key={s.glyph} as="button" cat={{ glyph: s.glyph, wash: s.wash }} live={!!slot && s.glyph === slot.glyph}
                          title={'use ' + s.glyph} onClick={() => { setPicked(s); setPicking(false) }} />
                      ))}
                    </div>
                  ) : null}
                </div>
                <input type="text" value={name} autoFocus placeholder="name it…" aria-label="name the new category"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') { e.preventDefault(); mint() }
                    else if (e.key === 'Escape') { e.preventDefault(); if (picking) { setPicking(false); return } setNaming(false); setName('') }
                  }}
                  style={{ flex: 1, minWidth: 0, height: 22, boxSizing: 'border-box', padding: '0 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--state-editing)', background: 'var(--state-editing-wash)', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-1)', userSelect: 'text', WebkitUserSelect: 'text' }} />
                <IconButton tone="chrome" size={20} title="add this category · ⏎" label="add this category" disabled={!name.trim()} onClick={mint}><EnterMark /></IconButton>
              </div>
            </div>
          ) : onAddCategory ? (
            <div style={{ marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--border-hair)' }}>
              <PopRow disabled={!slot} onClick={() => setNaming(true)}
                title={slot ? undefined : 'every glyph in the pool is spent — the next category needs a character adding to NOTE_CATEGORY_POOL'}
                style={{ opacity: slot ? 1 : 'var(--opacity-disabled)', fontWeight: 'var(--fw-regular)', color: 'var(--text-2)' }}>
                <CategoryTag dashed glyph="+" title={false} />new category…
              </PopRow>
            </div>
          ) : null}
        </div>
      ) : null}
      <Trigger onClick={() => setOpen(!open)} title={cat ? cat.label : 'category'} active={open}>
        {/* the caret points DOWN in both states: the button says "a list drops from here", and
           the popover's own presence is the disclosure feedback — a mark that swung to
           right-pointing at rest read as "expands sideways" */}
        <CategoryTag cat={cat} title={false} /><Caret open />
      </Trigger>
      {/* THE TYPING AREA is the washed box, and only while it is lit */}
      <textarea ref={fieldRef} rows={1} value={draft || ''} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => { if (onDraftChange) onDraftChange(e.target.value) }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); return }
          if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
        }}
        style={{ flex: 1, minWidth: 0, margin: 0, padding: '3px 6px', boxSizing: 'border-box', border: 'none', borderRadius: 'var(--radius-xs)', outline: 'none', resize: 'none', display: 'block', lineHeight: M.composerLineH + 'px', height: M.composerLineH + 6, background: focused ? 'var(--state-editing-wash)' : 'transparent', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-1)', userSelect: 'text', WebkitUserSelect: 'text', transition: 'var(--transition-wash)' }} />
      {has ? (
        <button type="button" onClick={save} onMouseEnter={() => setSendHot(true)} onMouseLeave={() => setSendHot(false)} title={wrapTip('save the note · ⏎ (shift+⏎ for a new line)')} aria-label="save the note" style={{
          width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', boxSizing: 'border-box',
          borderRadius: 'var(--radius-xs)', border: '1px solid ' + (sendHot ? 'var(--acorn-400)' : 'var(--border-hair)'),
          background: sendHot ? 'var(--acorn-50)' : 'var(--bark-100)', color: sendHot ? 'var(--acorn-600)' : 'var(--text-2)',
          transition: 'var(--transition-wash)',
        }}>
          <EnterMark />
        </button>
      ) : null}
    </div>
  )
}

/** The tally beside the During-class head. IT DOES NOT SAY "QUESTIONS" UNLESS THE HOST SAYS SO:
 *  what lands in this column is whatever the professor typed — a fix, a follow-up, a thought —
 *  so the neutral word is the default and `countLabel` is how a host that really is counting
 *  questions says it (owner, 2026-09-03).
 *
 *  THERE IS NO MINUTES READING, and that is a decision rather than an omission: the owner asked
 *  what "7 min" meant, and the honest answer is that nothing in the product can measure how long
 *  a class spent on questions — no clock starts when a hand goes up. A number nobody can compute
 *  is a number that would be estimated, and an estimated figure in a head reads exactly like a
 *  measured one. The prop is gone (2026-09-03, owner: "lets take that out"). */
function Tally({ tally, entries }: { tally?: LectureNotesProps['tally']; entries: number }) {
  const t = tally || {}
  const count = t.count != null ? t.count : t.questions
  const label = t.countLabel || 'note'
  const n = count != null ? count : entries
  return <span data-notes-tally style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--acorn-600)', whiteSpace: 'nowrap' }}>{n + ' ' + (n === 1 || /s$/.test(label) ? label : label + 's')}</span>
}

/* THE TALLY SITS ON THE TITLE'S BASELINE. With `flex-start` and a 2px nudge it floated in the
   gap between "During class" and its "0 entries" line, on neither (owner, 2026-09-04: "does the
   text do ugly when they're not aligned horizontally?" — it did). A flex item's baseline is its
   FIRST line's, so the wrapper around PaneColumnHeader hands up the title's baseline, not the note's. */
function Head({ title, note, trailing }: { title: ReactNode; note?: ReactNode; trailing?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}><PaneColumnHeader title={title} note={note} /></div>
      {trailing}
    </div>
  )
}

/** THE PARTS, PUBLISHED SO THEY CAN BE READ — the same `Entry`, `Composer`, `CategoryTag`,
 *  `Trigger`, `PopRow` and `Head` function objects this component renders, not a second copy and
 *  not a widened API. `String(NS.LectureNotes)` contains only the exported function's OWN body,
 *  so anything living in a module-level helper is invisible to a specimen card's staleness guard.
 *  Read them; do not render them. The supported surface is `LectureNotes`. */
export const LECTURE_NOTES_PARTS = { Entry, Composer, CategoryTag, Trigger, PopRow, Head }

/**
 * The notes and composer pane — part 5 of the presenter-mode split. Two columns: what was
 * written BEFORE the lecture on the left, what is being written DURING it on the right, with the
 * composer pinned under the right column, and a DRAGGABLE divider between the two.
 *
 * WHAT THE COLUMN AROUND IT MUST DO — the same three rules `PresenterStrip` states from the
 * other side, and a port can get every prop right and still overlap them: this pane is the
 * `flex: 1; min-height: 0` child of the presenter's flex COLUMN, directly under the strip; it
 * owns its own scroll (each column is a `PaneScroller`); the composer is OUTSIDE the scroller,
 * pinned to the bottom of the During column; the divider is the pane's, and so is the clamp.
 *
 * THE DURING COLUMN IS THIS STOP'S NOTES (owner, 2026-09-03). Both columns answer the same
 * question — what belongs to the stop in front of the class — so the pane is never half
 * stop-scoped and half lecture-scoped. With `stop` the pane filters the whole lecture's list to
 * the shown stop itself and stamps a save with it; the whole lecture's list is the recap's
 * (`variant="review"`, `LectureRecap.notes`), which is where a professor reads back across stops.
 *
 * WHAT IT DOES NOT OWN. The draft, the chosen category and the entries are all INPUTS: the host
 * holds them so the same facts feed the recap, the header's tally and any autosave. The pane asks
 * for changes through its callbacks and stores nothing. A MINTED CATEGORY IS USER-WIDE, and that
 * is the host's obligation: persist it against the user and hand the same list to every mount.
 */
export interface LectureNotesProps {
  /** `live` (default) is the two-column lecture pane. `review` is the recap's copy: ONE column of
   *  entries under stop heads, no prepared notes, no composer — once the lecture is over there
   *  is no stop to be at and nothing left to compose against it. THE PENCIL AND THE BIN STAY in
   *  review when `onEntryCommit` / `onDeleteEntry` are passed; only `onEditEntry` (the composer
   *  request) is live-only. Pass it as `LectureRecap.notes` */
  variant?: 'live' | 'review'
  /** 1-based. NOT SHOWN when `stopTitle` is passed (owner, 2026-09-03: the strip, the roll and the
   *  slide already count the walk — a fourth counter here was furniture). It is the left head's
   *  FALLBACK for a corpus with no title, so the head is never blank, and it still drives the
   *  in-place editor's reset on a stop change. The SHOWN stop, so it follows a roam */
  stopNumber?: number
  /** the stop's title, and THE LEFT HEAD ITSELF (owner, 2026-09-03): the pane frame says what the
   *  column is, so the head says which node the prose belongs to. Pass it — a host that omits it
   *  gets "stop 20" as the heading, which is the fallback and not the design */
  stopTitle?: string
  /** the shown stop is not the active node — the head's note says so, because a professor who
   *  thinks these notes belong to what the class is looking at will write on the wrong stop */
  roaming?: boolean
  /** the prepared notes: a STRING (which the pencil can then edit in place — see
   *  `onPreparedCommit`), or the host's own rich nodes (which it cannot) */
  prepared?: ReactNode
  /** what the left column says when `prepared` is empty. Default: "nothing was written for this
   *  stop." — a sentence, because a blank column reads as a broken pane. Doubles as the
   *  in-place editor's placeholder */
  preparedEmpty?: string
  /** makes the prepared notes editable IN PLACE (string `prepared` only): the pencil opens an
   *  `InlineText` over the prose and this fires on ⏎ or blur with the committed text, trimmed,
   *  line breaks kept. The pane stores nothing — the corpus is the host's, so an un-saved commit
   *  reverts on the next render, which is the contract a controlled field gives */
  onPreparedCommit?: (text: string) => void
  /** the OTHER route for the same pencil, for a host whose `prepared` is rich nodes: no string
   *  means nothing to edit in place, so the click is a request to open the host's own editor.
   *  `onPreparedCommit` wins if both are passed. Omitted (and no commit handler), the pencil is
   *  absent rather than disabled */
  onEditPrepared?: () => void
  /** the During-class entries, newest first (the component does not sort). With `stop`, the WHOLE
   *  lecture's list, each entry stamped `stop`: the live column filters to the shown stop itself.
   *  Without `stop` the host pre-filters to the shown stop's notes and follows a roam with them */
  entries?: LectureNote[]
  /** the composer's category set. Defaults to `NOTE_CATEGORIES`. THIS LIST IS USER-WIDE: a
   *  category the professor minted at one stop belongs to them, not to the stop, the walk or the
   *  lecture — persist it against the user and hand the same list to every mount */
  categories?: NoteCategory[]
  /** the head's right-hand reading: `count` with an optional `countLabel` (default "note",
   *  pluralised by the component). Omitted, the head reports the entry count. There is no
   *  minutes reading — see the tally's note on why it was removed rather than labelled.
   *  `questions` is the deprecated name of `count` (2026-09-03), still read */
  tally?: { count?: number; countLabel?: string; questions?: number }
  /** the composer's text, the host's — held outside so an autosave can read it */
  draft?: string
  /** every keystroke in the composer */
  onDraftChange?: (draft: string) => void
  /** the chosen category's key. Uncontrolled hosts may omit both — the first category is used */
  category?: string
  /** the popover picked a category, or a freshly minted one was chosen */
  onCategoryChange?: (key: string) => void
  /** the note the professor just committed (⏎ or the arrow; Shift+⏎ breaks a line instead). Text
   *  arrives trimmed, trailing spaces stripped from each line, line breaks kept as typed, and may
   *  contain `\n`. `stop` is present when the pane was given `stop` — store it on the entry. The
   *  host clears `draft` itself */
  onSave?: (note: { category?: string; text: string; stop?: number }) => void
  /** shows "new category…" at the foot of the category popover, and receives the FINISHED
   *  category once the professor has named it. THE HOST'S JOB IS TO PERSIST IT AGAINST THE USER
   *  — appending to screen state builds a category that survives until they navigate. The glyph
   *  and wash are the system's, from `NOTE_CATEGORY_POOL`. Omit and the foot is absent */
  onAddCategory?: (category: NoteCategory) => void
  /** @deprecated renamed to `onAddCategory` on 2026-09-03, when its MEANING changed from a
   *  request into a delivery. Still read, and now called WITH the finished category */
  onNewCategory?: (category: NoteCategory) => void
  /** EDITS THE NOTE IN PLACE: the pencil turns the note's words into an `InlineText` — click to
   *  open, click again (or ⏎, or blur) to save and close, esc reverts — and this fires with the
   *  committed text, trimmed, only when it changed. The pane stores nothing, so the host writes it
   *  back or the row reverts on the next render. Read in BOTH variants */
  onEntryCommit?: (note: LectureNote, text: string) => void
  /** the other route for the pencil — a REQUEST, for a host that wants editing a one-liner to mean
   *  something else. In-place wins when both are passed. Live-only */
  onEditEntry?: (note: LectureNote) => void
  /** the row's bin — BERRY AT REST (`IconButton tone="danger"`), the system's rule for a
   *  destructive control. Omitted, the bin is absent. Read in both variants */
  onDeleteEntry?: (note: LectureNote) => void
  /** default "a note for this stop…" */
  composerPlaceholder?: string
  /** the During column's width, in px, for a host that PERSISTS the divider. Authoritative at
   *  rest and ignored during the drag (a controlled drag routed through a host lags); the pane
   *  clamps it against its own measured width, so a stale value can never put the handle out of
   *  reach. Omit and the pane keeps what it was dragged to for the session */
  duringWidth?: number
  /** the drag's report, on mouse-up, and the double-click reset's too — already clamped. A host
   *  that ignores it gets the snap-back a controlled input gives: the contract, not a bug */
  onDuringWidthChange?: (width: number) => void
  /** controlled category popover, for a host that closes it on an outside click or Escape.
   *  Omit and the composer owns it */
  menuOpen?: boolean
  /** the controlled popover's report */
  onMenuOpenChange?: (open: boolean) => void
  /** the pane's own legend. Default "notes" live, "notes from this lecture" in review */
  title?: string
  /** the right column's head. Default "During class" */
  duringLabel?: string
  /** whether the SHOWN stop — the one the prepared column's head titles — is flagged. With
   *  `onToggleFlag`, the film roll's own `FlagButton` sits at the head's RIGHT, flush before the
   *  pencil, and behaves exactly as it does on the roll's live card. PASS THE SAME BIT YOU HAND
   *  THE ROLL — one flag per stop, read in two places, never two stores */
  flagged?: boolean
  /** toggles the shown stop's flag. Without it no flag is drawn and the head keeps its old shape */
  onToggleFlag?: () => void
  /** THE SHOWN STOP'S INDEX — the stop the prepared column titles (roaming: the ROAMED stop).
   *  With it, pass the WHOLE lecture's `entries` (newest-first, each stamped `stop`): the live
   *  column filters to this stop itself, the tally counts what it shows, and `onSave` hands back
   *  `{ category, text, stop }` with this index — so "a note made while roaming files against the
   *  roamed stop" is the pane's code, not the host's sentence. Without it the host pre-filters */
  stop?: number
  /** the walk's stop titles by index, for `variant="review"`: with `entries` stamped `stop`, the
   *  pane sorts walk-first and each stop oldest-first (the reverse of the newest-first list the
   *  live column shows) and heads each group `stop N · Title` itself. An entry's own `stopLabel`
   *  still wins; entries without `stop` take the old path */
  stops?: string[]
  /** merged into the pane frame — for a host that needs a different flex share. Not the surface,
   *  the radius or the border: those are the pane's */
  style?: CSSProperties
}

export function LectureNotes({
  variant = 'live', stopNumber, stopTitle, roaming = false,
  prepared, preparedEmpty = 'nothing was written for this stop.', onEditPrepared, onPreparedCommit,
  entries = [], categories = NOTE_CATEGORIES, tally,
  draft, onDraftChange, category, onCategoryChange, onSave, onAddCategory, onNewCategory,
  onEditEntry, onEntryCommit, onDeleteEntry, composerPlaceholder = 'a note for this stop…',
  duringWidth, onDuringWidthChange,
  menuOpen, onMenuOpenChange, title, duringLabel = 'During class', style,
  flagged = false, onToggleFlag,
  stop, stops,
}: LectureNotesProps) {
  const M = LECTURE_NOTES_METRICS
  const review = variant === 'review'
  /* ONE LIST, TWO READINGS — AND THE PANE DOES THE READING (2026-09-04, filing parts 5–7: every
     rule a host could get wrong was moved here first). The host keeps ONE list for the lecture,
     newest-first, each entry stamped with the `stop` it was written about. With `stop` (the shown
     stop's index) the LIVE column filters to that stop's entries; `onSave` hands back `{ category,
     text, stop }` so "an entry made while roaming files against the ROAMED stop" is code, not a
     sentence. With `stops` (the walk's titles, by index) REVIEW groups walk-first and reads each
     stop oldest-first — the order a lecture reads back — and writes the head as `stop N · Title`.
     A host that pre-filters, pre-sorts or passes `stopLabel` itself still works: an entry's own
     `stopLabel` wins, and entries without `stop` take the old path unchanged. */
  const stamped = entries.some((e) => e && e.stop != null)
  const shownEntries = !review && stop != null && stamped ? entries.filter((e) => e && e.stop === stop) : entries
  const labelFor = (i: number) => 'stop ' + (i + 1) + (stops && stops[i] ? ' · ' + stops[i] : '')
  const reviewEntries = review && stamped ? entries.slice().reverse()
    .map((e, i) => ({ e, i, s: e.stop != null ? e.stop : -1 }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map(({ e }) => (e.stopLabel || e.stop == null ? e : { ...e, stopLabel: labelFor(e.stop) })) : entries
  const shownList = review ? reviewEntries : shownEntries
  const byKey: Record<string, NoteCategory> = {}
  categories.forEach((c) => { byKey[c.key] = c })
  /* the prepared pencil rides the same recede clock as an entry row's actions: it waits out the
     grace period after the pointer leaves the column rather than vanishing on the way to it */
  const [prepHot, prepShow, prepHide] = useRecede()
  /* THE PENCIL EDITS THE PROSE HERE when it can: `onPreparedCommit` + a STRING `prepared` turns
     the block into an `InlineText` — the system's in-place editor, the same one the group's title
     and description use — and the commit goes to the host, which owns the corpus. `onEditPrepared`
     remains the route for a host whose `prepared` is rich NODES: there is no string to edit in
     place, so the click has to be a request. If both are passed, in-place wins. */
  const [editingPrep, setEditingPrep] = useState(false)
  const prepPoint = useRef<{ x: number; y: number } | null>(null)
  /* the pencil's own memory of whether the field was open when the pointer went DOWN — see the
     button's comment: the blur commit lands between mousedown and click */
  const wasEditing = useRef(false)
  /* the stop's own words: the head's FALLBACK when the corpus has no title for the stop. Not the
     note line any more — the number is not shown when a title is (owner, 2026-09-03) */
  const stopWord = 'stop ' + (stopNumber != null ? stopNumber : '—')
  const canEditPrepared = !!onPreparedCommit && typeof prepared === 'string'
  /* the DS's own effect: a stop change closes the prepared editor — one reset on one prop change,
     never a cascade per render, which is what the rule below is about */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { setEditingPrep(false) }, [stopNumber])
  /* eslint-enable react-hooks/set-state-in-effect */
  /* THE DIVIDER. The During column was a fixed 300 and the prose took the rest; a professor whose
     prepared notes are three paragraphs and whose entries are long sentences wants that share the
     other way round, and only they know which (owner, 2026-09-03). The gesture runs on OWN state
     — routing every pointermove out to a host and back is what makes a controlled drag lag — and
     reports on pointer-up through `onDuringWidthChange`; at rest a passed `duringWidth` wins.
     ONE CLAMP PAIR, read by the drag and by the double-click reset alike: the During column never
     goes under `duringMin`, and never grows so far that the prose column drops under
     `preparedMin`. The drawn width is derived from the MEASURED row every render rather than
     read straight off the preference, so a pane that narrows afterwards (or a width restored
     from a host's storage into a smaller pane) cannot push the divider out of reach. */
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [rowW, setRowW] = useState(0)
  /* READ ONCE DIRECTLY, THEN OBSERVE. An observer-only measurement reports nothing in a host
     where `ResizeObserver` never fires, and the component then runs on its INITIAL value: a
     guessed width, a zero, silently and forever. The observer is the follow-up; the first read is
     the answer, with the settle ladder behind it for a first paint the direct read is too early for. */
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const read = () => { if (rowRef.current) setRowW(Math.round(rowRef.current.getBoundingClientRect().width)) }
    const stopReading = settleRead(read)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stopReading(); if (ro) ro.disconnect() }
  }, [review])
  const [ownDuring, setOwnDuring] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const pref = (!dragging && duringWidth != null) ? duringWidth : (ownDuring != null ? ownDuring : M.during)
  const maxDuring = rowW ? Math.max(M.duringMin, rowW - M.gutter * 2 - M.divider - M.preparedMin) : Math.max(M.duringMin, pref)
  const shownDuring = Math.min(Math.max(pref, M.duringMin), maxDuring)
  /* the drag's closures read the drawn width through a ref, written from an effect after every
     render (a ref written during render is what react-hooks/refs forbids) */
  const shownRef = useRef(shownDuring)
  useEffect(() => { shownRef.current = shownDuring })
  const startDrag = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = shownRef.current
    setDragging(true)
    /* the column grows as the pointer goes LEFT: the divider is on its leading edge */
    const move = (ev: globalThis.MouseEvent) => {
      const next = Math.min(Math.max(w0 - (ev.clientX - x0), M.duringMin), maxDuring)
      shownRef.current = next
      setOwnDuring(next)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setDragging(false)
      if (onDuringWidthChange) onDuringWidthChange(shownRef.current)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  const resetDivider = () => {
    const next = Math.min(Math.max(M.during, M.duringMin), maxDuring)
    setOwnDuring(next)
    if (onDuringWidthChange) onDuringWidthChange(next)
  }
  const row = (e: LectureNote, i: number) => (
    <Entry key={e.id != null ? e.id : i} entry={e} cat={e.category ? byKey[e.category] : undefined} first={i === 0}
      onEdit={review ? undefined : onEditEntry} onCommit={onEntryCommit} onDelete={onDeleteEntry} />
  )
  /* GROUPED BY STOP IN REVIEW (owner, 2026-09-04). The recap's list spans the lecture, so the stop
     goes back in — as a HEAD over each run of entries rather than repeated on every row. Groups
     form in order of first appearance and the component still sorts nothing: a host wanting the
     stops in walk order passes them that way. An entry without `stopLabel` files under the last
     head it followed; a list with no labels at all is the flat list it always was.
     THE HEAD IS A HEAD, NOT A RULE: the first cut set it in the meta line's mono and ruled under
     it, so the heading read as one more `00:24` and the rule cut it off from its own rows (owner,
     same day, "the notes look separate from their headers"). It now takes the UI face, semibold,
     sits tight on its first row, and the hairline moves ABOVE the group — between one stop's notes
     and the next stop's head, which is where the break actually is. */
  const grouped = review && shownList.some((e) => e && e.stopLabel)
  const groups: { label: string; items: LectureNote[] }[] = []
  if (grouped) shownList.forEach((e) => {
    const k = e.stopLabel || (groups.length ? groups[groups.length - 1].label : '')
    if (!groups.length || groups[groups.length - 1].label !== k) groups.push({ label: k, items: [] })
    groups[groups.length - 1].items.push(e)
  })
  const list = (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {grouped ? groups.map((g, gi) => (
        <div key={g.label + gi} data-notes-group={g.label} style={{ paddingTop: gi ? 12 : 0, marginTop: gi ? 10 : 0, borderTop: gi ? '1px solid var(--border-rule)' : 'none' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)', paddingBottom: 1 }}>{g.label}</div>
          {g.items.map(row)}
        </div>
      )) : shownList.length ? shownList.map(row) : (
        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)' }}>nothing yet.</p>
      )}
    </div>
  )
  /* REVIEW IS ONE COLUMN. Once the lecture is over there is no stop to be at and nothing left to
     compose against it, so the prepared notes and the composer both go and the entries take the
     whole pane — the same rows, the same tags, no divider to drag. THE PENCIL AND THE BIN STAY when
     the host passes `onEntryCommit` / `onDeleteEntry` (owner, 2026-09-04): a professor reading the
     recap after class is exactly the person who wants to fix a note's wording or drop a note that
     was a mis-tap; only `onEditEntry`, the composer request, has no composer to go to. */
  if (review) {
    return (
      <Pane title={title || 'notes from this lecture'} scroll="none" data-lecture-notes="review" bodyStyle={{ padding: M.headClear + 'px 14px 12px ' + M.legendInset + 'px',
        /* THE REVIEW COPY REFUSES SELECTION TOO. The recap renders the same rows through
           `LectureRecap.notes`, so the rule the live column carries has to be here as well. TWO
           MOUNTS, ONE RULE: this pane and the live column, both refusing, with the note's own
           words opting back in inside `Entry`. */
        userSelect: 'none', WebkitUserSelect: 'none' }} style={{ flex: 1, minHeight: 0, userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
        <Head title={duringLabel} trailing={<Tally tally={tally} entries={shownList.length} />} />
        <PaneScroller style={{ paddingRight: 6 }}>{list}</PaneScroller>
      </Pane>
    )
  }
  return (
    <Pane title={title || 'notes'} scroll="none" data-lecture-notes="live" bodyStyle={{ flexDirection: 'row', gap: 0, padding: M.headClear + 'px 14px 12px ' + M.legendInset + 'px' }} style={{ flex: 1, minHeight: 0,
      /* THE FRAME REFUSES SELECTION, NOT JUST THE BODY (owner, 2026-09-04: the pane's own legend,
         the During head and its tally were all still draggable). A legend is drawn OUTSIDE the
         body — it straddles the frame's top edge — so a body-level rule could never reach it.
         Refusing on the frame and opting the CONTENT back in is also the right way round for a
         pane: everything a pane draws of itself is furniture, and the two things here that are
         not — the professor's prepared prose and the notes they typed — each say so where they
         are drawn. */
      userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
      <div ref={rowRef} style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        {/* THE PREPARED SIDE — the professor's own writing, read at a glance while talking, so it
           keeps `--fs-body` prose at `--lh-normal` and nothing else: no rows, no marks. Its ONE
           control is the edit pencil in the head, which arrives with activity in the column the
           way a row's actions do; prepared notes are written before the lecture and corrected
           during it, and with `onPreparedCommit` the correction happens HERE, on `InlineText`. */}
        <div data-notes-prepared onMouseEnter={prepShow} onMouseLeave={prepHide}
          onFocus={prepShow} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) prepHide() }}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: M.gutter,
            /* THE ONE COLUMN THAT IS CONTENT: the head's node title and the prose under it are the
               professor's own words, and quoting them mid-lecture is a real thing to want. The
               frame refuses selection; this column takes it back for both. */
            userSelect: 'text', WebkitUserSelect: 'text' }}>
          {/* THE HEAD IS THE NODE'S TITLE AND NOTHING ELSE (owner, 2026-09-03, fourth and last
             reading of this head). The stop number went with the rest: the strip, the film roll
             and the projected slide all count the walk out loud, so a fourth counter in the one
             pane that is about the node's own words was furniture. The note line now carries the
             ROAM WARNING alone — the one thing nothing else on this screen says, and the reason
             the line still exists. `stopNumber` survives as the head's fallback for a corpus
             with no title, so the head is never blank. */}
          <Head title={stopTitle || stopWord} note={roaming ? 'roaming' : undefined}
            trailing={canEditPrepared || onEditPrepared || onToggleFlag ? (
              <span style={{ display: 'inline-flex', gap: 0 }}>
              {onToggleFlag ? (
                /* THE FLAG, THE FILM ROLL'S OWN (owner, 2026-09-04: "synced and behave like the film
                   roll's", "on the right next to the edit icon"): the same `FlagButton`, the same
                   rule — filled and always shown once set, an outline only while the column is
                   recently hovered, never a solid flag for a state that is not true. It flags the
                   SHOWN stop, which is the stop this head titles, so the host passes the same bit
                   it hands the roll's live card. Flush with the pencil, gap 0 — the row's pencil
                   and bin set that rule: two 20px targets read as one cluster. THE FLAG TAKES THE
                   PENCIL'S LIFT (owner, 2026-09-04: "do those 2 icons not look aligned"). */
                <span style={{ display: 'inline-flex', opacity: flagged || prepHot ? 1 : 0, pointerEvents: flagged || prepHot ? 'auto' : 'none', transition: 'opacity var(--dur-fade) var(--ease-soft)' }}>
                  <FlagButton flagged={flagged} size={20} glyphSize={10} lift={EDIT_MARK_LIFT} onClick={onToggleFlag} title={flagged ? 'unflag this stop' : 'flag this stop'} />
                </span>
              ) : null}
              {canEditPrepared || onEditPrepared ? (
              /* THE SECOND CLICK SAVES AND EXITS, and it needs the state from BEFORE the blur
                 (owner, 2026-09-04). The sequence is mousedown → the field blurs → `InlineText`
                 commits → `onCommit` sets `editingPrep` false → click. So by click time a toggle
                 read false and turned editing back ON: the pencil saved and instantly reopened,
                 which reads as a control that does nothing. `wasEditing` is captured on mousedown,
                 before any of that, so the click knows which gesture it is. The SAVE itself stays
                 `InlineText`'s — blur is already its commit path, and repeating it here would be a
                 second copy of one rule. */
              <span onMouseDown={() => { wasEditing.current = editingPrep }} style={{ display: 'inline-flex' }}>
              <IconButton tone="chrome" size={20}
                title={canEditPrepared ? (editingPrep ? 'editing · click again or ⌘⏎ saves, esc reverts' : 'edit these notes') : 'edit the prepared notes for this stop'}
                label="edit the prepared notes for this stop"
                reveal={prepHot || editingPrep}
                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                  if (!canEditPrepared) { if (onEditPrepared) onEditPrepared(); return }
                  if (wasEditing.current) { wasEditing.current = false; setEditingPrep(false); return }
                  prepPoint.current = e && e.clientX != null ? { x: e.clientX, y: e.clientY } : null
                  setEditingPrep(true)
                }}><EditMark /></IconButton>
              </span>
              ) : null}
              </span>
            ) : null} />
          {/* THE EDITABLE BLOCK NEEDS 4px OF ROOM ON EVERY SIDE INSIDE THE SCROLLER.
             `INLINE_EDIT_STYLE` draws an OUTLINE at `outlineOffset: 3` — 4px outside the text box,
             on all four edges — and the block fills the scroller, so any edge flush with the
             scroll box gets clipped (owner, 2026-09-03: top and left first, then the right). The
             scroller is inset by 4 and pulled back out by 4, so the prose still aligns with the
             head above it and the edge always has somewhere to paint. The 6px that keeps text
             clear of the scrollbar stays, on top of the inset. */}
          <PaneScroller style={{ padding: '4px 10px 4px 4px', margin: '-4px -4px -4px -4px' }}>
            {canEditPrepared ? (
              /* keyed by `editing` so Escape's revert is a remount, which is what actually
                 restores the last-committed text (see `InlineText`'s contract).
                 `whiteSpace: 'pre-wrap'` IS NOT OPTIONAL HERE: prepared notes are paragraphs, and
                 `INLINE_EDIT_STYLE` carries pre-wrap only in the EDITING state — so a rest style
                 without it collapsed the blank lines into one run-on block and then re-laid the
                 text out into paragraphs the moment the pencil opened. Rest and editing must wrap
                 identically. THE MEASURE IS THE COLUMN, not a fixed character cap: the divider is
                 how the professor sets this column's width. `fill` IS WHAT REACHES THE FOOT OF THE
                 COLUMN (owner, 2026-09-03), and it had to be a prop on `InlineText`.
                 NO `onOpen`: THE PENCIL IS THE ONLY WAY IN (owner, 2026-09-04). Prepared notes are
                 PROSE the professor reads aloud mid-lecture, so the click that lands on them is a
                 reading gesture. The text stays selectable at rest; the pencil states the intent. */
              <InlineText key={editingPrep ? 'edit' : 'rest'} value={prepared as string} multiline enterInserts fill editing={editingPrep}
                placeholder={preparedEmpty} pointRef={prepPoint as MutableRefObject<{ x: number; y: number } | null>}
                onCommit={(v) => { setEditingPrep(false); if (onPreparedCommit) onPreparedCommit(v) }}
                onCancel={() => setEditingPrep(false)}
                tooltip={editingPrep ? undefined : 'click to edit these notes'}
                style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-1)', textWrap: 'pretty', whiteSpace: 'pre-wrap', cursor: 'text' }} />
            ) : (
              <div style={{ minHeight: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-1)', textWrap: 'pretty' }}>
                {prepared || <span style={{ color: 'var(--text-2)' }}>{preparedEmpty}</span>}
              </div>
            )}
          </PaneScroller>
        </div>
        <div onMouseDown={startDrag} onDoubleClick={resetDivider} title={wrapTip('drag to resize · double-click to reset')}
          style={{ flex: 'none', width: M.divider, marginLeft: -M.divider / 2, marginRight: M.gutter - M.divider / 2, cursor: 'col-resize', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: M.divider / 2, width: 1, background: dragging ? 'var(--accent-primary)' : 'var(--border-hair)' }} />
        </div>
        {/* THE DURING SIDE — the entries are one-liners, so it starts narrower than the prose and
           the divider decides the rest. The composer is OUTSIDE the scroller: a field that
           scrolls away is a field you cannot type into while reading back what you wrote. */}
        <div data-notes-during style={{ flexShrink: 0, width: shownDuring, display: 'flex', flexDirection: 'column', minHeight: 0,
          /* THE WHOLE COLUMN REFUSES SELECTION AND THE NOTE'S WORDS OPT BACK IN. This was on each
             ROW for a turn, which left the head and the tally selectable — so a drag begun on
             "During class" still smeared the heading and the count before it reached a note
             (found by review, 2026-09-04). "Only the notes" has to be refused where the column
             is, not where the rows are; the opt-in stays on `entry.text` in `Entry`. */
          userSelect: 'none', WebkitUserSelect: 'none' }}>
          <Head title={duringLabel} trailing={<Tally tally={tally} entries={shownList.length} />} />
          {/* NEITHER END OF THIS SCROLLER IS AT A CORNER, so it carries neither `SCROLLER_INSET`
             (12; DS OB-207). The inset exists so a scrollbar's end arrows clear a pane's rounded
             corner. The bottom has the composer against it; the top has the "During class" head
             above it, and the HEAD ALREADY OWNS THE HEAD-TO-BODY GAP — `PaneColumnHeader` pads
             itself 8px underneath, and the first row adds its own 4 (see `Entry`). The composer's
             wrapper keeps 6 above the field, so the last note sits 6px from it, not 20. The
             PREPARED column's scroller keeps both insets: its body is an in-place editor whose
             outline needs the room. */}
          <PaneScroller data-notes-during-scroller style={{ paddingRight: 6, marginTop: 0, marginBottom: 0 }}>{list}</PaneScroller>
          <div style={{ flexShrink: 0, paddingTop: 6 }}>
            <Composer categories={categories} category={category} onCategoryChange={onCategoryChange}
              draft={draft} onDraftChange={onDraftChange} onSave={onSave ? (n) => onSave(stop != null ? { ...n, stop } : n) : undefined} onAddCategory={onAddCategory || onNewCategory}
              placeholder={composerPlaceholder} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} />
          </div>
        </div>
      </div>
    </Pane>
  )
}
