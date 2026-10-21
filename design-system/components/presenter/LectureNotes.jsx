import React from 'react'
import { Pane, PaneScroller, scrollerPadRight, SCROLLER_INSET } from '../chrome/Pane.jsx'
import { LEGEND_INSET } from '../chrome/PaneHeader.jsx'
import { PaneColumnHeader } from '../chrome/PaneColumnHeader.jsx'
import { IconButton, wrapTip, useRecede } from '../chrome/IconButton.jsx'
import { PillButton } from '../chrome/PillButton.jsx'
import { portalInto } from '../chrome/portal.js'
import { InlineText } from '../chrome/InlineText.jsx'
import { settleRead } from '../chrome/MeasureBox.jsx'
import { BinMark } from '../sidebar/BinMark.jsx'
import { Caret } from '../nav/TreeRow.jsx'

/** THE TYPE SET — and, since v4 (owner, 6 Oct), ONE list for flags and typed notes alike: "the
 *  textbox is just another way for the prof to flag the slide". A flag is a note with a type and no
 *  words yet. The first three are the flag types, the only ones on `FlagChip`'s ring; anything the
 *  professor adds appears in the composer's menu only. `short` is the ring's and the tally's word.
 *  The key `question` is kept for stored data; its LABEL is "unclear", which is what v4 calls the
 *  type. `?` and `!` are plain punctuation inside a coloured box — the box says "type", so a bare
 *  `?` here is not `OptionalMark`'s circle-? affordance. The set is a PROP, never a closed union. */
export const NOTE_CATEGORIES = [
  { key: 'question', glyph: '?', label: 'unclear', short: 'unclear', wash: 'var(--hue-cobalt-wash-raised)' },
  { key: 'fix', glyph: '!', label: 'fix this slide', short: 'fix', wash: 'var(--hue-amber-wash-raised)' },
  { key: 'follow-up', glyph: '→', label: 'follow up', short: 'follow up', wash: 'var(--hue-teal-wash-raised)' },
]

/** THE UNSPENT GLYPHS, and the only sanctioned way to mint a type at the desk. A type needs a
 *  character nobody else in the product has claimed and a wash from the ring, so the SYSTEM hands
 *  both out and the professor types only a name. `free` is every slot whose glyph is not in use,
 *  `next` the first of them, `make(label, categories, slot)` a whole `NoteCategory` (or `null` when
 *  the name is blank or the pool is spent). THE GLYPHS ARE PLACEHOLDERS (owner, 2026-09-03). */
export const NOTE_CATEGORY_POOL = {
  slots: [
    { glyph: '~', wash: 'var(--hue-violet-wash-raised)' },
    { glyph: '#', wash: 'var(--hue-jade-wash-raised)' },
    { glyph: '=', wash: 'var(--hue-mallow-wash-raised)' },
    { glyph: '@', wash: 'var(--hue-honey-wash-raised)' },
    { glyph: '%', wash: 'var(--hue-river-wash-raised)' },
    { glyph: '§', wash: 'var(--hue-clay-wash-raised)' },
  ],
  free(categories) {
    const spent = {}
    ;(categories || []).forEach((c) => { if (c && c.glyph) spent[c.glyph] = true })
    return NOTE_CATEGORY_POOL.slots.filter((s) => !spent[s.glyph])
  },
  next(categories) {
    return NOTE_CATEGORY_POOL.free(categories)[0] || null
  },
  make(label, categories, slot) {
    const name = (label || '').trim()
    const use = slot || NOTE_CATEGORY_POOL.next(categories)
    if (!name || !use) return null
    const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const taken = {}
    ;(categories || []).forEach((c) => { if (c && c.key) taken[c.key] = true })
    let key = stem || 'category'
    let n = 2
    while (taken[key]) { key = (stem || 'category') + '-' + n; n += 1 }
    return { key, glyph: use.glyph, label: name, wash: use.wash }
  },
}

/** HOW FAR EACH TYPE GLYPH IS MOVED DOWN, in em, so its INK sits on its tag's centre (owner, 21 Oct:
 *  the "!" sat high in its chip). DERIVED from JetBrains Mono, measured with canvas `measureText`
 *  2026-10-21, at bold and regular alike: a box centring a line of `lineHeight: 1` puts the point
 *  (fontAscent 0.93 − fontDescent 0.39) / 2 = 0.27em above the baseline on its centre, and each
 *  value is the glyph's ink centre minus that 0.27. "!" and "?" run from the baseline to cap height,
 *  centre 0.36, so they sat 0.09em (1.2px on the 13px chip) high; "→" is already centred. Re-measure
 *  if the mono face changes. A glyph not listed draws unmoved: add it here when it joins the pool. */
export const GLYPH_DROP = { '!': 0.09, '?': 0.09, '→': 0, '+': 0.06, '~': 0.08, '#': 0.1, '=': 0.06, '@': 0.01, '%': 0.1, '§': 0.03 }

/** a glyph, moved onto its box's centre by `GLYPH_DROP`. Drawn as a grid item (blockified), so the
 *  transform applies; it moves the ink and never the box, so the tag's size cannot change */
export function TagGlyph({ glyph }) {
  const d = GLYPH_DROP[glyph] || 0
  return <span style={{ display: 'block', transform: d ? 'translateY(' + d + 'em)' : undefined }}>{glyph}</span>
}

/* ROOM INSIDE THE FLAG LISTS' SCROLLERS, cancelled by an equal negative margin so nothing moves
   (owner, 21 Oct: the open textbox of a flag was cut off). A scroller clips at its own box, and a
   row bleeds 6px each side (`margin: '0 -6px'`) for its wash, so the wash and the edit outline
   (`INLINE_EDIT_STYLE`: 3px offset + 1px = 4px outside the words) were cut at the column's edge.
   `x` 6 DERIVED: the row's bleed. `y` 4 DERIVED: the outline's reach, so the first and last rows'
   rings clear the scroller's top and foot. */
const FLAGS_ROOM = { x: 6, y: 4 }
/* the scroller style that grants that room, IN LONGHANDS: `PaneScroller` sets `marginTop`/`marginBottom`
   itself, and a `margin` shorthand laid over them replaced the review list's `SCROLLER_INSET` too
   (found in review, 21 Oct: the review list rode 16px up into its head). `insetY` is the vertical
   margin the list had before the room was added: 0 for the live list, `SCROLLER_INSET` for review. */
function flagsRoom(insetY) {
  const R = FLAGS_ROOM
  return { paddingTop: R.y, paddingBottom: R.y, paddingLeft: R.x, paddingRight: R.x + scrollerPadRight(), marginTop: insetY - R.y, marginBottom: insetY - R.y, marginLeft: -R.x, marginRight: -R.x }
}

/** The pane's numbers.
 *  - `chat` / `chatMin` (220): the Class chat column STARTS at its minimum (owner, v4, 6 Oct — it
 *    is parked until the student app exists, so it stays on screen but small) and the column
 *    divider widens it. `preparedMin` (260) is the left column's floor. One clamp pair, read by the
 *    drag and by the double-click reset alike. `divider` (14) is the hit strip.
 *  - `prepared` (150): the prepared notes' default HEIGHT above the flags; `preparedMinH` (60) and
 *    `flagsMinH` (96) are the floors either side of the horizontal divider, so neither side can be
 *    dragged shut. All three CHOSEN on the v4 drawing.
 *  - `undoMs` (2000; 4000 until owner, 16 Oct: "start fading sooner"): how long a new flag stays washed in its type's colour. A resolved one no longer lingers (owner,
 *    15 Oct: delete asks first, then the row goes at once). CHOSEN (v4: "the same 4-second undo"); the name outlived the
 *    undo itself (owner, 15 Oct, removed), kept so a host reading it does not break.
 *  - `rowTag` (16): a flag row's tag, smaller than the composer's 22×19 because the row is one line.
 *  - the rest are the composer's and the tag box's own geometry, unchanged. */
export const LECTURE_NOTES_METRICS = {
  chat: 220, chatMin: 220, preparedMin: 260, divider: 14, aside: 360,
  prepared: 150, preparedMinH: 60, flagsMinH: 96, undoMs: 2000, rowTag: 16,
  /* how long a new flag's wash takes to fade out when `undoMs` is up (CHOSEN, owner 16 Oct: "slowly").
     Drawn as `calc(var(--dur-fade) * 6)` so reduced motion collapses it with the rest of the ladder;
     this number is that product (250 × 6) and only times when the row goes back to its quick fade. */
  freshFadeMs: 1500,
  composer: 30, composerLines: 4, tag: { w: 22, h: 19 }, gutter: 14, popover: 208, glyphPanel: 104, actions: 46,
  /* CHOSEN (owner, 2026-10-01): in `review` a row's actions follow its wash with no grace period */
  reviewRecede: false,
  /* CHOSEN (owner, 15 Oct: "reduce the delay"): in class too. The actions sit INSIDE the row, so
     the pointer never crosses a gap to reach them and the grace period bought nothing */
  liveRecede: false,
  /* `--fs-caption` 12 × `--lh-normal` 1.6 ≈ 19, rounded (DERIVED) */
  composerLineH: 19,
  /* the room between the pane's legend and the column heads (CHOSEN, owner 2026-09-03) */
  headClear: 8,
  /* the body's left inset matches the legend's text (DERIVED in `PaneHeader`) */
  legendInset: LEGEND_INSET,
}

/** THE ENTER MARK — the return-key arrow, drawn once. Inherits `currentColor`. */
export function EnterMark({ size = 11, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block', ...style }}>
      <path d="M10 2.7v4.1H3.2M5.6 4.3 3 6.8l2.6 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** ONE TYPE TAG: the glyph in its type's wash. `as="button"` makes it pickable and it answers the
 *  pointer with an edge, never by changing the wash (the type's identity), and with no ring round
 *  it (owner, 21 Oct: the 2px bark-100 ring read as a white border on a selected row's wash). `size`
 *  draws it square — a flag row's 16px tag. `dashed` with no `cat` is the empty slot. */
function CategoryTag({ cat, title, dashed, glyph, hotGlyph, as, onClick, live, size }) {
  const M = LECTURE_NOTES_METRICS
  const [hot, setHot] = React.useState(false)
  if (!cat && !dashed) return null
  const button = as === 'button'
  const Tag = button ? 'button' : 'span'
  const w = size || M.tag.w, h = size || M.tag.h
  return (
    <Tag type={button ? 'button' : undefined} onClick={onClick}
      onMouseEnter={button ? () => setHot(true) : undefined} onMouseLeave={button ? () => setHot(false) : undefined}
      onFocus={button ? () => setHot(true) : undefined} onBlur={button ? () => setHot(false) : undefined}
      title={title === false ? undefined : wrapTip(title || (cat ? cat.label : ''))} style={{
        flexShrink: 0, width: w, height: h, boxSizing: 'border-box', padding: 0,
        borderRadius: size ? 4 : 'var(--radius-xs)', background: cat ? cat.wash : 'transparent',
        border: live ? '1px solid var(--text-2)' : button && hot ? '1px solid var(--border-strong)' : cat ? '1px solid transparent' : '1px dashed var(--border-dashed)',
        boxShadow: 'none',
        display: 'grid', placeItems: 'center', cursor: button ? 'pointer' : undefined,
        fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1, fontWeight: cat ? 'var(--fw-bold)' : 'var(--fw-regular)',
        color: cat ? 'var(--text-1)' : 'var(--text-2)',
        transition: 'var(--transition-wash)',
      }}>{cat ? <TagGlyph glyph={cat.glyph} /> : (hot && hotGlyph) || glyph ? <TagGlyph glyph={(hot && hotGlyph) || glyph} /> : null}</Tag>
  )
}

/** THE TAG-AND-CARET TRIGGER — "a list drops from here", one hover for every instance. */
function Trigger({ onClick, disabled, title, active, children }) {
  const [hot, setHot] = React.useState(false)
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

/** ONE ROW OF A TYPE MENU — `--surface-hover` under the pointer, on the tracking clock. */
function PopRow({ selected, onClick, disabled, title, style, children }) {
  const [hot, setHot] = React.useState(false)
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

/** THE TYPE LIST — the same rows in the composer's menu and in a flag row's tag menu, so changing a
 *  flag's type and choosing a note's type are one control. "no type" is the plain note. */
function TypeList({ categories, current, onPick }) {
  return (
    <React.Fragment>
      {categories.map((c) => (
        <PopRow key={c.key} selected={current === c.key} onClick={() => onPick(c.key)}>
          <CategoryTag cat={c} title={false} />{c.label}
        </PopRow>
      ))}
      <PopRow selected={current == null} onClick={() => onPick(undefined)} style={{ fontWeight: 'var(--fw-regular)', color: 'var(--text-2)' }}>
        <CategoryTag dashed glyph="" title={false} />no type
      </PopRow>
    </React.Fragment>
  )
}

/** ONE FLAG ROW (v4, 6 Oct) — one line where the words allow: the type tag, the words, the time at
 *  the right. Several states, each drawn on the v4 sheet:
 *  - A BARE FLAG (no words yet) shows the same "enter description" the open box shows, in the
 *    placeholder's own italic third ink (owner, 15 Oct; it used to repeat the type's label, which the
 *    tag beside it already says). A click opens the words in place, empty.
 *  - A FRESH FLAG (made within `undoMs`) is washed in its own type's colour (a quarter strength); the wash fades when the time is up. It can be
 *    edited and resolved at once — there is no undo (owner, 15 Oct: "+ why" and "undo" removed).
 *  - DELETE ASKS FIRST (owner, 15 Oct), on a second line UNDER the flag, which stays in view:
 *    "Delete this flag?" with Keep, then Delete, right-aligned, no box. Keep has the focus; Escape or a
 *    click outside keeps. Confirmed, the row goes at once: no strikethrough, no lingering.
 *    Delete RESOLVES (owner, 6 Oct): the flag is kept, so the slide's history survives for the
 *    review of flags.
 *  - THE WORDS ARE CLICK-TO-EDIT, like the prepared notes (owner, 15 Oct): a faint outline and a text
 *    cursor under the pointer, a click opens them in place. No pencil.
 *  - UNDER THE POINTER: the bin (resolve). It covers the time rather than pushing the words, so
 *    nothing re-wraps when the pointer arrives.
 *  - A PLAIN NOTE KEEPS THE TAG'S PLACE (owner, 21 Oct): an empty dashed slot where the tag would be,
 *    so every row's words start at the same indent. Under the pointer it shows a "+", and it opens the
 *    type list like a tag does. There is no "+" among the hover actions any more.
 *  - THE TAG IS A BUTTON when `onCategory` is passed: it opens the type list, the composer's own.
 *  The row's own words opt back into selection inside a column that refuses it. */
function FlagRow({ entry, cat, categories, onCategory, onCommit, onResolve, fresh, resolved, instant, onSelect, onSelected }) {
  const M = LECTURE_NOTES_METRICS
  const [hot, setHot] = React.useState(false)
  const [shown, show, hide] = useRecede()
  const [editing, setEditing] = React.useState(false)
  const [textHot, setTextHot] = React.useState(false)
  const [menu, setMenu] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const confirmRef = React.useRef(null)
  React.useEffect(() => {
    if (!confirming) return undefined
    const keep = confirmRef.current && confirmRef.current.querySelector('button')
    if (keep) keep.focus()
    const off = (e) => { if (confirmRef.current && !confirmRef.current.contains(e.target)) setConfirming(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [confirming])
  const menuRef = React.useRef(null)
  const popRef = React.useRef(null)
  const [menuAt, setMenuAt] = React.useState(null)
  const bare = !(entry.text || '').trim()
  React.useEffect(() => {
    if (!menu) { setMenuAt(null); return undefined }
    /* THE ROW'S TYPE MENU PAINTS ON THE PAGE (owner, 15 Oct: it opened inside the flags list, whose
       scroller clips, and was cut off at the list's foot). Placed off the tag's own rect: below it,
       or above when the room below is short, and closed on any scroll so it never floats loose. `menu`
       holds the SIDE: every row's tag (or a plain note's empty slot) sits at the row's left and opens
       rightward ('left'); 'right' opens leftward from a right-hand anchor, unused since 21 Oct */
    const a = menuRef.current && menuRef.current.getBoundingClientRect()
    if (a) {
      const h = (categories.length + 1) * 26 + 16
      const below = window.innerHeight - a.bottom - 8 >= h
      setMenuAt({ left: menu === 'right' ? Math.max(8, a.right - M.popover) : Math.max(8, Math.min(a.left, window.innerWidth - M.popover - 8)), top: below ? a.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - a.top + 6 })
    }
    const off = (e) => { const inA = menuRef.current && menuRef.current.contains(e.target); const inP = popRef.current && popRef.current.contains(e.target); if (!inA && !inP) setMenu(false) }
    const shut = (e) => { if (!(popRef.current && popRef.current.contains(e.target))) setMenu(false) }
    document.addEventListener('mousedown', off)
    window.addEventListener('scroll', shut, true)
    return () => { document.removeEventListener('mousedown', off); window.removeEventListener('scroll', shut, true) }
  }, [menu])
  /* NO UNDO (owner, 15 Oct), so a fresh row is not held back: it can be edited and resolved at once.
     Only a resolved row, on its way out, has no actions */
  const up = !resolved && !confirming && ((instant ? hot : shown) || editing)
  const canEdit = !!onCommit && !resolved
  const textStyle = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', color: resolved ? 'var(--text-3)' : 'var(--text-1)', textWrap: 'pretty', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', userSelect: 'text', WebkitUserSelect: 'text' }
  /* A NEW ROW TAKES ITS OWN TYPE'S COLOUR (owner, 15 Oct: an "unclear" flag lit amber read as the
     wrong kind). A QUARTER STRENGTH (CHOSEN, owner 16 Oct: 55% read as distracting) — a hint of the
     type under the row, with its own tag, the full wash, still the loudest thing on it. A
     plain note, with no type, takes the lightest neutral bark step. MIXED WITH THE PANE'S PAPER, not with
     transparent: the actions' backdrop paints the same value over the row to hide the time, and a
     translucent value laid twice would draw a darker pill round the bin */
  const freshWash = cat ? 'color-mix(in oklab, ' + cat.wash + ' 25%, var(--surface-paper))' : 'var(--bark-50)'
  /* ON A SELECTED SLIDE'S GROUP THE ROW ADDS NO WASH OF ITS OWN (owner, 21 Oct: the hover's bark-50
     painted a pale box over the group's blue, which showed as a white border round the tag while the
     words were open). The group's wash already says "this slide"; the words' outline says the rest.
     The actions' backdrop takes the group's wash for the same reason: it must match what it covers. */
  const restWash = onSelected ? 'var(--state-selected-wash)' : 'var(--bark-50)'
  const wash = fresh ? freshWash : (hot || editing) && !onSelected ? 'var(--bark-50)' : 'transparent'
  /* THE NEW-FLAG WASH FADES SLOWLY (owner, 16 Oct). Only the fresh → settled change takes the long
     fade; hover and editing keep the quick one, so the row still answers the pointer at once. The
     actions' backdrop takes the same timing, or it would snap while the row behind it fades. */
  const [settling, setSettling] = React.useState(false)
  const wasFresh = React.useRef(fresh)
  React.useEffect(() => {
    if (wasFresh.current && !fresh) { setSettling(true); const t = setTimeout(() => setSettling(false), M.freshFadeMs); wasFresh.current = fresh; return () => clearTimeout(t) }
    wasFresh.current = fresh
  }, [fresh])
  /* SETTLING IS KNOWN IN THE SAME RENDER AS THE COLOUR CHANGE: the browser times a transition by the
     AFTER-change style, so a slow timing that arrives one render later (from the effect) never runs.
     `wasFresh` still holds the last render's value here, since the effect updates it afterwards. */
  const settlingNow = settling || (wasFresh.current && !fresh)
  const washFade = 'background-color ' + (settlingNow ? 'calc(var(--dur-fade) * 6)' : 'var(--dur-fade)') + ' var(--ease-soft)'
  const tag = cat ? (
    onCategory && !resolved ? <CategoryTag cat={cat} size={M.rowTag} as="button" title={'type: ' + cat.label + ' · click to change'} onClick={(e) => { e.stopPropagation(); setMenu((v) => (v ? false : 'left')) }} />
      : <CategoryTag cat={cat} size={M.rowTag} />
  ) : onCategory && !resolved ? <CategoryTag dashed glyph={up || menu ? '+' : ''} hotGlyph="+" size={M.rowTag} as="button" title="no type · click to give it one" onClick={(e) => { e.stopPropagation(); setMenu((v) => (v ? false : 'left')) }} />
    : <CategoryTag dashed glyph="" size={M.rowTag} title="no type" />
  const typeMenu = () => (menu && menuAt && typeof document !== 'undefined' ? portalInto(document.body,
    <div ref={popRef} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', left: menuAt.left, top: menuAt.top, bottom: menuAt.bottom, width: M.popover, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: 4, boxSizing: 'border-box', zIndex: 1000 }}>
      <TypeList categories={categories} current={entry.category} onPick={(k) => { setMenu(false); if (k !== entry.category) onCategory(entry, k) }} />
    </div>
  ) : null)
  /* A PLAIN NOTE DRAWS AN EMPTY DASHED SLOT where the tag goes (owner, 21 Oct), REVERSING 2026-09-27's
     "no tag slot at rest" (the OB-207 fault was an INVISIBLE wrapper indenting the words; a drawn
     slot is the indent on purpose). The words of every row start at one indent, and the slot is
     where a type is given. */
  /* THE CONFIRMATION IS A LINE UNDER THE FLAG, NOT IN PLACE OF IT (owner, 15 Oct: replacing the row
     hid what was being deleted, and its border sat on the row's 6px bleed, which the column clips,
     so both sides were cut). The row stays as it was; the question, Keep and Delete sit on a second
     line inside the row's own padding, right-aligned under the time, with no box of their own. */
  const confirmLine = confirming ? (
    <div ref={confirmRef} role="alertdialog" aria-label="delete this flag" onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setConfirming(false) } }}
      style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 4, paddingBottom: 1 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>Delete this flag?</span>
      <PillButton size="sm" onClick={() => setConfirming(false)}>Keep</PillButton>
      <PillButton size="sm" tone="danger" onClick={() => { setConfirming(false); onResolve(entry) }}>Delete</PillButton>
    </div>
  ) : null
  return (
    <div onMouseEnter={() => { setHot(true); show() }} onMouseLeave={() => { setHot(false); hide() }}
      onClick={onSelect && !editing ? () => onSelect(entry) : undefined}
      style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6, padding: '3px 6px', margin: '0 -6px', borderRadius: 'var(--radius-sm)', background: wash, cursor: onSelect ? 'pointer' : 'default', transition: washFade }}>
      <span ref={menuRef} style={{ position: 'relative', display: 'inline-flex', marginTop: 2, width: M.rowTag, flexShrink: 0 }}>
        {tag}
        {typeMenu()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} onClick={editing ? (e) => e.stopPropagation() : undefined}>
        {editing ? (
          <InlineText value={entry.text || ''} multiline enterInserts editing placeholder="enter description"
            onCommit={(v) => { setEditing(false); if (v !== (entry.text || '')) onCommit(entry, v) }}
            onCancel={() => setEditing(false)}
            style={{ display: 'block', ...textStyle }} />
        ) : (
          <div title={canEdit ? wrapTip('click to edit') : undefined}
            onMouseEnter={canEdit ? () => setTextHot(true) : undefined} onMouseLeave={canEdit ? () => setTextHot(false) : undefined}
            onClick={canEdit ? () => { setTextHot(false); setEditing(true) } : undefined}
            style={{ ...textStyle, ...(bare ? { fontStyle: 'italic', color: 'var(--text-3)' } : null), cursor: canEdit ? 'text' : undefined, borderRadius: 'var(--radius-xs)', outline: canEdit && textHot ? '1px solid var(--border-rule)' : '1px solid transparent', outlineOffset: 2 }}>{bare ? 'enter description' : entry.text}</div>
        )}
      </div>
      <span style={{ flexShrink: 0, paddingTop: 1, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', lineHeight: '18px', color: 'var(--text-3)', whiteSpace: 'nowrap', visibility: up ? 'hidden' : 'visible' }}>{entry.when}</span>
      {/* THE ACTIONS SIT ON THE FIRST LINE'S CENTRE AND INSIDE THE ROW'S CONTENT EDGE (owner, 15 Oct:
         the bin read off-centre, not round, and clipped on its right). The row bleeds 6px each side
         (`margin: '0 -6px'`) into a column that clips at its own edge, so `right: 2` put the bin's
         last 4px past the clip and cut its round hover wash flat. `right: 6` (DERIVED: the bleed)
         lines it up with the time it covers. `top: 3` (DERIVED: the row's padding) and a height of ONE
         LINE, computed from the tokens as `calc(var(--fs-body) * var(--lh-snug))` (13 × 1.35 = 17.55)
         rather than typed, centre it on the words' first line, where `top: 1` + 20px had it 0.8px
         high (box centre 11 against the line's 11.78, measured). The bin is drawn WITHOUT its 1.4px lift (`lift={false}`): the lift pairs
         it with a pencil, and alone in its round hover ring it read 1.7px high (owner, 15 Oct).
         THE BACKDROP IS THE ROW'S OWN WASH. It exists to hide the time it covers, so it must be
         invisible against the row: on a FRESH row (amber) a bark-50 backdrop drew a pale pill round
         the bin, which read as an elongated button (owner, 15 Oct). Since the undo went, a fresh row
         is the one that shows its actions while washed. */}
      {!resolved && (canEdit || onResolve) ? (
        <span onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 6, top: 3, height: 'calc(var(--fs-body) * var(--lh-snug))', display: 'flex', alignItems: 'center', gap: 0, paddingLeft: 6, borderRadius: 'var(--radius-sm)', background: up || menu ? (fresh ? freshWash : restWash) : 'transparent', transition: settlingNow ? washFade : undefined, pointerEvents: up || menu ? 'auto' : 'none' }}>
          {onResolve ? <IconButton tone="danger" size={20} label="delete this flag" title="delete · asks first" reveal={up} onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); setConfirming(true) }}><BinMark lift={false} /></IconButton> : null}
        </span>
      ) : null}
      {confirmLine}
    </div>
  )
}

/** THE COMPOSER — one field with the type button inside its border and an enter button at its
 *  right, always drawn (washed out and inert until there are words; owner, 16 Oct). It
 *  starts on `usual`, the film roll's usual type (owner, 15 Oct); "no type" is still in its menu and
 *  comes back as `null` — a note saved with no type is a plain flag, counted as "plain". The menu
 *  is `TypeList` plus "new type…", which names a type in place on a glyph from the pool. ⏎ saves,
 *  Shift+⏎ breaks a line; the field grows to `composerLines` rows, then scrolls. */
function Composer({ categories, category, onCategoryChange, draft, onDraftChange, onSave, onAddCategory, placeholder, menuOpen, onMenuOpenChange, usual }) {
  const M = LECTURE_NOTES_METRICS
  const [focused, setFocused] = React.useState(false)
  const [ownMenu, setOwnMenu] = React.useState(false)
  const [ownCat, setOwnCat] = React.useState(usual)
  const [sendHot, setSendHot] = React.useState(false)
  const [naming, setNaming] = React.useState(false)
  const [name, setName] = React.useState('')
  const [picking, setPicking] = React.useState(false)
  const [picked, setPicked] = React.useState(null)
  const open = menuOpen != null ? menuOpen : ownMenu
  const setOpen = (v) => { if (onMenuOpenChange) onMenuOpenChange(v); if (menuOpen == null) setOwnMenu(v); if (!v) { setNaming(false); setName(''); setPicking(false); setPicked(null) } }
  /* THE COMPOSER STARTS ON THE FILM ROLL'S USUAL TYPE (owner, 15 Oct), so a typed note and a tapped
     flag are the same kind by default. `undefined` from the host means "not chosen yet" and takes the
     usual type; "no type", picked from the list, comes back as `null`. */
  const raw = onCategoryChange ? category : ownCat
  const key = raw === undefined ? usual : raw
  const choose = (k) => { const v = k === undefined ? null : k; if (onCategoryChange) onCategoryChange(v); else setOwnCat(v) }
  const cat = categories.filter((c) => c.key === key)[0] || null
  const has = !!(draft || '').trim()
  /* a DISABLED button gets no mouseleave, so a hover held while the draft is sent (and the button
     goes inert under the pointer) would leave `sendHot` stuck on, and the next draft's button would
     wake up lit. Drop it whenever the button goes inert. */
  React.useEffect(() => { if (!has) setSendHot(false) }, [has])
  const save = () => { if (has && onSave) onSave({ category: cat ? cat.key : undefined, text: draft.replace(/[ \t]+\n/g, '\n').trim() }) }
  const fieldRef = React.useRef(null)
  React.useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    el.style.height = 'auto'
    const cap = M.composerLineH * M.composerLines + 6
    el.style.height = Math.min(el.scrollHeight, cap) + 'px'
    el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden'
  }, [draft])
  const free = NOTE_CATEGORY_POOL.free(categories)
  const slot = (picked && free.filter((s) => s.glyph === picked.glyph)[0]) || free[0] || null
  const mint = () => {
    const made = NOTE_CATEGORY_POOL.make(name, categories, slot)
    if (!made) return
    onAddCategory(made)
    choose(made.key)
    setNaming(false); setName(''); setPicking(false); setPicked(null); setOpen(false)
  }
  return (
    /* THE COMPOSER BLEEDS LEFT so its type tag stands in the flag rows' tag column (owner, 15 Oct).
       -7 is DERIVED: its own 1px border + 4px left padding + the trigger's 1px border + 1px padding,
       the distance its tag sat right of a row's. It lands 1px outside the rows' 6px hover bleed. The
       column does not clip here (it does for the rows' scroller), so the border is whole. */
    <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: M.composer, boxSizing: 'border-box', marginLeft: -7, padding: '0 6px 3px 4px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid ' + (focused ? 'var(--state-editing)' : 'var(--border-strong)'), transition: 'border-color var(--dur-hover) var(--ease-soft)' }}>
      {open ? (
        <div style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 8px)', width: M.popover, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: 4, boxSizing: 'border-box', zIndex: 6 }}>
          <TypeList categories={categories} current={cat ? cat.key : undefined} onPick={(k) => { choose(k); setOpen(false) }} />
          {onAddCategory && naming ? (
            <div style={{ marginTop: 3, padding: '3px 4px 0', borderTop: '1px solid var(--border-hair)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 26 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Trigger onClick={() => setPicking((v) => !v)} disabled={free.length < 2} active={picking}
                    title={free.length > 1 ? 'pick a glyph · placeholders for now' : 'the last free glyph'}>
                    <CategoryTag cat={slot ? { glyph: slot.glyph, wash: slot.wash } : null} title={false} /><Caret open />
                  </Trigger>
                  {picking ? (
                    <div style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', width: M.glyphPanel, display: 'flex', flexWrap: 'wrap', gap: 4, padding: 5, boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', zIndex: 7 }}>
                      {free.map((s) => (
                        <CategoryTag key={s.glyph} as="button" cat={{ glyph: s.glyph, wash: s.wash }} live={slot && s.glyph === slot.glyph}
                          title={'use ' + s.glyph} onClick={() => { setPicked(s); setPicking(false) }} />
                      ))}
                    </div>
                  ) : null}
                </div>
                <input type="text" value={name} autoFocus placeholder="name it…" aria-label="name the new type"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') { e.preventDefault(); mint() }
                    else if (e.key === 'Escape') { e.preventDefault(); if (picking) { setPicking(false); return } setNaming(false); setName('') }
                  }}
                  style={{ flex: 1, minWidth: 0, height: 22, boxSizing: 'border-box', padding: '0 6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--state-editing)', background: 'var(--state-editing-wash)', outline: 'none', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-1)', userSelect: 'text', WebkitUserSelect: 'text' }} />
                <IconButton tone="chrome" size={20} title="add this type · ⏎" label="add this type" disabled={!name.trim()} onClick={mint}><EnterMark /></IconButton>
              </div>
            </div>
          ) : onAddCategory ? (
            <div style={{ marginTop: 3, paddingTop: 3, borderTop: '1px solid var(--border-hair)' }}>
              <PopRow disabled={!slot} onClick={() => setNaming(true)}
                title={slot ? undefined : 'every glyph in the pool is spent — the next type needs a character adding to NOTE_CATEGORY_POOL'}
                style={{ opacity: slot ? 1 : 'var(--opacity-disabled)', fontWeight: 'var(--fw-regular)', color: 'var(--text-2)' }}>
                <CategoryTag dashed glyph="+" title={false} />new type…
              </PopRow>
            </div>
          ) : null}
        </div>
      ) : null}
      <span style={{ display: 'flex', paddingBottom: 1 }}>
        <Trigger onClick={() => setOpen(!open)} title={cat ? cat.label : 'no type · choose one'} active={open}>
          {cat ? <CategoryTag cat={cat} title={false} /> : null}<Caret open />
        </Trigger>
      </span>
      <textarea ref={fieldRef} rows={1} value={draft || ''} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => onDraftChange && onDraftChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); return }
          if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
        }}
        style={{ flex: 1, minWidth: 0, margin: 0, padding: '3px 6px', boxSizing: 'border-box', border: 'none', borderRadius: 'var(--radius-xs)', outline: 'none', resize: 'none', display: 'block', lineHeight: M.composerLineH + 'px', height: M.composerLineH + 6, background: focused ? 'var(--state-editing-wash)' : 'transparent', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-1)', userSelect: 'text', WebkitUserSelect: 'text', transition: 'var(--transition-wash)' }} />
      {/* THE ENTER BUTTON IS ALWAYS THERE (owner, 16 Oct), so the field reads as one you can send
         from before typing. Empty, it is washed out and does nothing; with words it is the button. */}
      <button type="button" onClick={save} disabled={!has} aria-label="create new flag" onMouseEnter={() => setSendHot(true)} onMouseLeave={() => setSendHot(false)} title={wrapTip(has ? 'create new flag · ⏎ (shift+⏎ for a new line)' : 'create new flag · type a description first')} style={{
        width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', cursor: has ? 'pointer' : 'default', boxSizing: 'border-box', padding: 0,
        borderRadius: 'var(--radius-xs)', border: '1px solid ' + (has && sendHot ? 'var(--acorn-400)' : 'var(--border-hair)'),
        background: has && sendHot ? 'var(--acorn-50)' : 'var(--bark-100)', color: has && sendHot ? 'var(--acorn-600)' : has ? 'var(--text-2)' : 'var(--text-3)',
        opacity: has ? 1 : 0.6, transition: 'var(--transition-wash)',
      }}>
        <EnterMark />
      </button>
    </div>
  )
}

/** THE TALLY beside the "Flags" head (v4): this list's flags counted by type. ONLY A COUNTED TYPE
 *  SHOWS (owner, 15 Oct: no faded zeros beside a real count). The notes with no type count LAST, in
 *  the same shape as the rest — their empty dashed slot, then the number (owner, 21 Oct: "1 plain"
 *  put its number first and read as something else) — and only when there is one. The head draws
 *  no tally at all on an empty list. */
function FlagTally({ list, categories }) {
  const n = {}
  let plain = 0
  list.forEach((e) => { if (e.category && categories.some((c) => c.key === e.category)) n[e.category] = (n[e.category] || 0) + 1; else plain += 1 })
  const shown = categories.filter((c) => n[c.key] > 0)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-2)' }}>
      {shown.map((c) => (
        <span key={c.key} title={wrapTip(c.label)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: n[c.key] ? 'var(--text-2)' : 'var(--text-3)' }}>
          <span style={{ display: 'inline-flex', opacity: n[c.key] ? 1 : 0.5 }}><CategoryTag cat={c} size={LECTURE_NOTES_METRICS.rowTag} title={false} /></span>{n[c.key] || 0}
        </span>
      ))}
      {plain ? (
        <span title={wrapTip('no type')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <CategoryTag dashed glyph="" size={LECTURE_NOTES_METRICS.rowTag} title={false} />{plain}
        </span>
      ) : null}
    </span>
  )
}

/** the head of a list: the title, then whatever trails it, on the title's baseline */
function Head({ title, note, trailing, after }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <div style={{ flex: after ? 'none' : 1, minWidth: 0 }}><PaneColumnHeader title={title} note={note} /></div>
      {after}
      {trailing ? <span style={{ marginLeft: 'auto' }}>{trailing}</span> : null}
    </div>
  )
}

const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's')
const Count = ({ children }) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--acorn-600)', whiteSpace: 'nowrap' }}>{children}</span>

/** THE ARITHMETIC OF THE LIST, AS CODE (v4). `fresh(e, now)` says whether a row is FRESH (made
 *  within `undoMs`); `visible(e, now)` whether it draws at all — a resolved row never does, since
 *  delete asks first and then the row goes at once (owner, 15 Oct); `lingering` is kept for hosts
 *  that read it and is always false; `nextExpiry(entries, now)` is when the pane must look again.
 *  Pure, and the same function objects the pane runs. */
const FlagMath = {
  fresh: (e, now) => !!(e && !e.resolvedAt && e.at && now - e.at < LECTURE_NOTES_METRICS.undoMs),
  lingering: () => false,
  visible: (e) => !!e && !e.resolvedAt,
  nextExpiry(entries, now) {
    let t = Infinity
    ;(entries || []).forEach((e) => {
      if (!e || e.resolvedAt) return
      const s = e.at
      if (s && now - s < LECTURE_NOTES_METRICS.undoMs) t = Math.min(t, s + LECTURE_NOTES_METRICS.undoMs)
    })
    return t
  },
}
export const NoteFlagMath = FlagMath

/** THE PARTS, published so a card can READ them — `String(NS.LectureNotes)` holds only the
 *  exported body. Read them; do not render them. */
export const LECTURE_NOTES_PARTS = { FlagRow, Composer, CategoryTag, Trigger, PopRow, Head, FlagTally, TypeList }

/** THE NOTES PANE'S `PaneFit` (DERIVED): gutter × 2 + chatMin + divider + preparedMin = 522.
 *  `minHeight` 340 is the pane's HEIGHT floor (CHOSEN from a measurement, 16 Oct: its content at its
 *  own minimums measured 332 — two heads, prepared 60, the divider, flags 96, the composer, the
 *  legend and padding). A host must give it at least this, and scroll its own column below that, or
 *  the flags cannot scroll and the composer falls under the clip. */
export const LECTURE_NOTES_FIT = (() => {
  const w = LECTURE_NOTES_METRICS.gutter * 2 + LECTURE_NOTES_METRICS.chatMin + LECTURE_NOTES_METRICS.divider + LECTURE_NOTES_METRICS.preparedMin
  return { narrowBelow: w, floor: w, minHeight: 340 }
})()

/**
 * The notes pane — v4 (owner, 6 Oct). TWO COLUMNS AND THE DIVIDER BETWEEN THEM, as before; what
 * they hold changed. The LEFT column is the slide's title, the prepared notes, a horizontal divider,
 * the "Flags" head with its tally, this slide's flags, and the composer at the foot. The RIGHT
 * column is the Class chat, parked until the student app exists. No flag button here: it is on the
 * film roll's current frame (`FlagChip`). `variant="review"` is the recap's copy: one column, every
 * flag of the lecture grouped by slide.
 */
export function LectureNotes({
  variant = 'live', stopNumber, stopTitle, roaming = false,
  prepared, preparedEmpty = 'nothing was written for this slide.', onPreparedCommit, onEditPrepared,
  preparedHeight, onPreparedHeightChange,
  entries = [], categories = NOTE_CATEGORIES,
  draft, onDraftChange, category, onCategoryChange, onSave, onAddCategory, onNewCategory,
  onEntryCommit, onEntryCategoryChange, onResolveEntry, onDeleteEntry, onUndoEntry, onRestoreEntry,
  composerPlaceholder = 'a note for this slide…',
  chatWidth, onChatWidthChange, duringWidth, onDuringWidthChange, chat, chatLabel = 'Class chat',
  chatEmpty = 'Messages from students appear here. Parked: comes with the student app.',
  menuOpen, onMenuOpenChange, title, flagsLabel, usualFlag = 'fix', style,
  selectedStop, onSelectStop,
  stop, stops,
  aside, asideLabel = 'Preview', asideWidth = LECTURE_NOTES_METRICS.aside,
}) {
  const M = LECTURE_NOTES_METRICS
  const review = variant === 'review'
  const resolve = onResolveEntry || onDeleteEntry
  const chatPref = chatWidth != null ? chatWidth : duringWidth
  const reportChat = onChatWidthChange || onDuringWidthChange
  const byKey = {}
  categories.forEach((c) => { byKey[c.key] = c })
  /* THE CLOCK THE ROWS READ: re-render when the next fresh or resolved row runs out */
  const [, tick] = React.useState(0)
  const now = Date.now()
  React.useEffect(() => {
    const t = FlagMath.nextExpiry(entries, Date.now())
    if (t === Infinity) return undefined
    const id = setTimeout(() => tick((n) => n + 1), Math.max(16, t - Date.now() + 16))
    return () => clearTimeout(id)
  })
  /* ONE LIST, TWO READINGS. The host keeps ONE list for the lecture, newest-first, each entry
     stamped with its `stop`. Live, the pane filters to the shown stop and draws OLDEST AT THE TOP,
     newest at the foot beside the composer, so a new row lands where the eye already is. Review
     groups walk-first and reads each stop oldest-first. Resolved rows drop out at once (delete has
     already asked). */
  const stamped = entries.some((e) => e && e.stop != null)
  const live = entries.filter((e) => FlagMath.visible(e, now))
  const liveList = (!review && stop != null && stamped ? live.filter((e) => e.stop === stop) : live).slice().reverse()
  const counted = (l) => l.filter((e) => !e.resolvedAt)
  const labelFor = (i) => 'stop ' + (i + 1) + (stops && stops[i] ? ' · ' + stops[i] : '')
  const row = (e, i, opts) => (
    <FlagRow key={e.id != null ? e.id : i} entry={e} cat={byKey[e.category]} categories={categories}
      onCategory={onEntryCategoryChange} onCommit={onEntryCommit} onResolve={resolve}
      fresh={FlagMath.fresh(e, now)} resolved={FlagMath.lingering(e, now)}
      instant={review ? !M.reviewRecede : !M.liveRecede} onSelect={opts && opts.onSelect} onSelected={!!(opts && opts.selected)} />
  )
  /* ── LIVE STATE (declared before the review branch so the hook order never depends on the variant) ── */
  const [editingPrep, setEditingPrep] = React.useState(false)
  const [prepHot, setPrepHot] = React.useState(false)
  React.useEffect(() => { setEditingPrep(false) }, [stopNumber, stop])
  const canEditPrepared = !!onPreparedCommit && typeof prepared === 'string'
  /* THE COLUMN DIVIDER (the Class chat's width). Own state during the drag, reported on mouse-up;
     a passed width wins at rest; the drawn width is derived from the MEASURED row every render. */
  const rowRef = React.useRef(null)
  const [rowW, setRowW] = React.useState(0)
  React.useEffect(() => {
    const el = rowRef.current
    if (!el) return undefined
    const read = () => { if (rowRef.current) setRowW(Math.round(rowRef.current.getBoundingClientRect().width)) }
    const stopRead = settleRead(read)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stopRead(); if (ro) ro.disconnect() }
  }, [])
  const [ownChat, setOwnChat] = React.useState(null)
  const [dragging, setDragging] = React.useState(false)
  const pref = (!dragging && chatPref != null) ? chatPref : (ownChat != null ? ownChat : M.chat)
  const maxChat = rowW ? Math.max(M.chatMin, rowW - M.gutter * 2 - M.divider - M.preparedMin) : Math.max(M.chatMin, pref)
  const shownChat = Math.min(Math.max(pref, M.chatMin), maxChat)
  const chatRef = React.useRef(shownChat)
  chatRef.current = shownChat
  const startDrag = (e) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = chatRef.current
    setDragging(true)
    const move = (ev) => { const next = Math.min(Math.max(w0 - (ev.clientX - x0), M.chatMin), maxChat); chatRef.current = next; setOwnChat(next) }
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      setDragging(false)
      if (reportChat) reportChat(chatRef.current)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  const resetChat = () => { const next = Math.min(Math.max(M.chat, M.chatMin), maxChat); setOwnChat(next); if (reportChat) reportChat(next) }
  /* THE ROW DIVIDER (the prepared notes' height above the flags). The two boxes share the column as
     flex items — the prepared box `0 1 H`, floored at `preparedMinH`; the flags box `1 1 0`, floored
     at `flagsMinH` — so the LAYOUT does the clamping at rest and a stored height larger than the
     column simply gives way. The drag measures both boxes at mousedown and stops where the flags
     would go under their floor, so the handle never has a dead zone. */
  const prepRef = React.useRef(null)
  const flagsRef = React.useRef(null)
  const [ownPrep, setOwnPrep] = React.useState(null)
  const [prepDrag, setPrepDrag] = React.useState(false)
  const prepPref = (!prepDrag && preparedHeight != null) ? preparedHeight : (ownPrep != null ? ownPrep : M.prepared)
  const startPrepDrag = (e) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = prepRef.current ? prepRef.current.getBoundingClientRect().height : prepPref
    const room = flagsRef.current ? flagsRef.current.getBoundingClientRect().height - M.flagsMinH : 0
    const max = Math.max(M.preparedMinH, h0 + Math.max(0, room))
    let last = h0
    setPrepDrag(true)
    const move = (ev) => { last = Math.round(Math.min(Math.max(h0 + (ev.clientY - y0), M.preparedMinH), max)); setOwnPrep(last) }
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      setPrepDrag(false)
      if (onPreparedHeightChange) onPreparedHeightChange(last)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  const resetPrep = () => { setOwnPrep(M.prepared); if (onPreparedHeightChange) onPreparedHeightChange(M.prepared) }
  /* THE NEWEST ROW ALWAYS SHOWS: when the list grows, its scroller runs to the foot */
  const endRef = React.useRef(null)
  const lastLen = React.useRef(liveList.length)
  React.useEffect(() => {
    if (liveList.length > lastLen.current && endRef.current) {
      let p = endRef.current.parentElement
      while (p && !(p.scrollHeight > p.clientHeight && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement
      if (p) p.scrollTop = p.scrollHeight
    }
    lastLen.current = liveList.length
  })
  if (review) {
    /* GROUPED BY SLIDE, walk order; a group is one slide's flags, oldest first. Hairlines fall
       BETWEEN slides, never between rows (v4). The selected slide's group is washed; clicking a
       group's head or any of its rows selects that slide (`onSelectStop`) for the recap's viewer. */
    const ordered = stamped ? live.slice().reverse().map((e, i) => ({ e, i, s: e.stop != null ? e.stop : -1 })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.e) : live
    const groups = []
    ordered.forEach((e) => {
      const k = e.stop != null ? 's' + e.stop : (e.stopLabel || (groups.length ? groups[groups.length - 1].k : ''))
      if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, stop: e.stop, label: e.stopLabel || (e.stop != null ? labelFor(e.stop) : ''), items: [] })
      groups[groups.length - 1].items.push(e)
    })
    const all = counted(ordered)
    const slides = {}
    all.forEach((e) => { slides[e.stop != null ? 's' + e.stop : e.stopLabel || '?'] = true })
    const nSlides = Object.keys(slides).length
    return (
      <Pane title={title || 'notes from this lecture'} scroll="none" bodyStyle={{ padding: M.headClear + 'px 14px 12px ' + M.legendInset + 'px', userSelect: 'none', WebkitUserSelect: 'none', ...(aside ? { flexDirection: 'row', gap: 0 } : null) }}
        style={{ flex: 1, minHeight: 0, userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
        {/* WITH `aside` THE REVIEW COPY HAS TWO COLUMNS, as the live pane has (owner, 21 Oct): the flags
           on the left, the aside (the recap's preview of the shown slide) on the right under its own
           head, a hairline between. The same gutter and hairline as the live pane's chat divider, but
           fixed: nothing here is worth resizing at the end of a lecture. */}
        <div style={aside ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: M.gutter } : { display: 'contents' }}>
        <Head title={flagsLabel != null ? flagsLabel : 'Flags'} after={all.length ? <FlagTally list={all} categories={categories} /> : undefined} trailing={all.length ? <Count>{plural(nSlides, 'slide') + ' · ' + plural(all.length, 'flag')}</Count> : undefined} />
        <PaneScroller style={flagsRoom(SCROLLER_INSET)}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groups.length ? groups.map((g, gi) => {
              const sel = selectedStop != null && g.stop === selectedStop
              const pick = onSelectStop && g.stop != null ? () => onSelectStop(g.stop) : undefined
              return (
                <div key={g.k + gi} style={{ padding: '4px 6px 6px', margin: '0 -6px', borderTop: gi && !sel ? '1px solid var(--border-hair)' : '1px solid transparent', borderRadius: sel ? 'var(--radius-md)' : 0, background: sel ? 'var(--state-selected-wash)' : 'transparent', transition: 'var(--transition-wash)' }}>
                  <div onClick={pick} title={pick ? wrapTip('show this slide') : undefined} style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)', padding: '4px 0 3px', cursor: pick ? 'pointer' : 'default' }}>{g.label}</div>
                  {g.items.map((e, i) => row(e, i, { onSelect: pick, selected: sel }))}
                </div>
              )
            }) : <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)' }}>nothing was flagged this lecture.</p>}
          </div>
        </PaneScroller>
        </div>
        {aside ? (
          <React.Fragment>
            <div aria-hidden="true" style={{ flex: 'none', width: M.divider, marginLeft: -M.divider / 2, marginRight: M.gutter - M.divider / 2, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: M.divider / 2, width: 1, background: 'var(--border-hair)' }} />
            </div>
            <div style={{ flexShrink: 0, width: asideWidth, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Head title={asideLabel} />
              {aside}
            </div>
          </React.Fragment>
        ) : null}
      </Pane>
    )
  }
  const n = counted(liveList).length
  /* NO COUNTS ON AN EMPTY SLIDE (owner, 15 Oct): the tally and "N flags" appear with the first flag;
     until then the head is the word "Flags" alone, and the list's own "nothing yet." says the rest */
  const hasFlags = n > 0
  /* THE LIST'S HEAD (owner, 15 Oct): "Flagged during lecture" in class; the recap's copy keeps "Flags",
     under a legend that already says "notes from this lecture" */
  const liveFlagsLabel = flagsLabel != null ? flagsLabel : 'Flagged during lecture'
  const proseStyle = { display: 'block', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-1)', textWrap: 'pretty', whiteSpace: 'pre-wrap', cursor: 'text' }
  const hairline = (vertical, active) => ({ position: 'absolute', background: active ? 'var(--accent-primary)' : 'var(--border-hair)', ...(vertical ? { top: 0, bottom: 0, left: M.divider / 2, width: 1 } : { left: 0, right: 0, top: M.divider / 2, height: 1 }) })
  return (
    <Pane title={title || 'notes'} scroll="none" bodyStyle={{ flexDirection: 'row', gap: 0, padding: M.headClear + 'px 14px 12px ' + M.legendInset + 'px' }}
      style={{ flex: 1, minHeight: 0, userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
      <div ref={rowRef} style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        {/* THE LEFT COLUMN — the slide's title, its prepared notes, the flags, the composer */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: M.gutter }}>
          <div style={{ userSelect: 'text', WebkitUserSelect: 'text' }}><Head title={stopTitle || 'stop ' + (stopNumber != null ? stopNumber : '—')} note={roaming ? 'roaming' : undefined} /></div>
          {/* THE PREPARED NOTES ARE PLAIN TEXT ON THE PAGE, AND A CLICK EDITS THEM (owner, v4, 6 Oct,
             reversing the 4 Sep "only the pencil opens it"). At rest they read like the column; under
             the pointer a faint outline and a text cursor; clicked, editing at once — Esc or a click
             outside saves and leaves. There is no pencil. A stray click only puts a cursor in it;
             nothing changes until the professor types, and the projector never shows it. */}
          <div ref={prepRef} style={{ flex: '0 1 ' + prepPref + 'px', minHeight: M.preparedMinH, display: 'flex', flexDirection: 'column', userSelect: 'text', WebkitUserSelect: 'text' }}>
            {/* THE RIGHT PADDING IS SPELT OUT (owner, 15 Oct: the open textbox was clipped on its right,
               twice). A `padding` shorthand is overridden by `PaneScroller`'s own right padding, so it
               is given as `paddingRight`. 8 is DERIVED: the 4px the left side has, plus the 4px the
               OPEN box bleeds rightward (`INLINE_EDIT_STYLE`'s `margin: '0 -4px 0 0'`, whose padding
               then holds the caret off the ring). With 4 the ring sat 4px under the scrollbar; with 8
               it sits as far from the right edge as from the left. Plus the overlay-bar room where
               there is one */}
            <PaneScroller style={{ padding: '4px 4px 4px 4px', paddingRight: 8 + scrollerPadRight(), margin: '-4px -4px -4px -4px' }}>
              {canEditPrepared ? (
                <div onMouseEnter={() => setPrepHot(true)} onMouseLeave={() => setPrepHot(false)}
                  style={{ borderRadius: 'var(--radius-xs)', outline: prepHot && !editingPrep ? '1px solid var(--border-rule)' : '1px solid transparent', outlineOffset: 3, transition: 'outline-color var(--dur-hover) var(--ease-soft)' }}>
                  <InlineText key={editingPrep ? 'edit' : 'rest'} value={prepared} multiline enterInserts editing={editingPrep}
                    placeholder={preparedEmpty} onOpen={() => setEditingPrep(true)}
                    onCommit={(v) => { setEditingPrep(false); if (v !== prepared) onPreparedCommit(v) }}
                    onCancel={() => setEditingPrep(false)}
                    tooltip={editingPrep ? undefined : 'click to edit · changes it for every later lecture'}
                    style={proseStyle} />
                </div>
              ) : (
                <div onClick={onEditPrepared} style={{ ...proseStyle, cursor: onEditPrepared ? 'text' : 'auto' }}>
                  {prepared || <span style={{ color: 'var(--text-2)' }}>{preparedEmpty}</span>}
                </div>
              )}
            </PaneScroller>
          </div>
          <div onMouseDown={startPrepDrag} onDoubleClick={resetPrep} title={wrapTip('drag to resize the prepared notes and the flags · double-click to reset')}
            role="separator" aria-orientation="horizontal" aria-label="resize the prepared notes and the flags"
            style={{ flex: 'none', height: M.divider, margin: '2px 0 0', cursor: 'ns-resize', position: 'relative' }}>
            <div style={hairline(false, prepDrag)} />
          </div>
          <Head title={liveFlagsLabel} after={hasFlags ? <FlagTally list={counted(liveList)} categories={categories} /> : undefined} trailing={hasFlags ? <Count>{plural(n, 'flag')}</Count> : undefined} />
          <div ref={flagsRef} style={{ flex: '1 1 0', minHeight: M.flagsMinH, display: 'flex', flexDirection: 'column' }}>
            <PaneScroller style={flagsRoom(0)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {liveList.length ? liveList.map((e, i) => row(e, i)) : (
                  <p style={{ margin: '2px 0 0', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)' }}>nothing yet.</p>
                )}
                <div ref={endRef} />
              </div>
            </PaneScroller>
          </div>
          <div style={{ flexShrink: 0, paddingTop: 6 }}>
            <Composer categories={categories} category={category} onCategoryChange={onCategoryChange}
              draft={draft} onDraftChange={onDraftChange} onSave={onSave ? (s) => onSave(stop != null ? { ...s, stop } : s) : undefined} onAddCategory={onAddCategory || onNewCategory}
              placeholder={composerPlaceholder} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} usual={usualFlag} />
          </div>
        </div>
        <div onMouseDown={startDrag} onDoubleClick={resetChat} title={wrapTip('drag to resize · double-click to reset')}
          style={{ flex: 'none', width: M.divider, marginLeft: -M.divider / 2, marginRight: M.gutter - M.divider / 2, cursor: 'ew-resize', position: 'relative' }}>
          <div style={hairline(true, dragging)} />
        </div>
        {/* THE RIGHT COLUMN — the Class chat. PARKED (owner, 6 Oct): it needs the student app. It
           stays on screen because it is coming, at its minimum width; `chat` fills it when it exists. */}
        <div style={{ flexShrink: 0, width: shownChat, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Head title={chatLabel} />
          {chat || (
            <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: 14, boxSizing: 'border-box', border: '1px dashed var(--border-dashed)', borderRadius: 'var(--radius-md)', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-normal)', color: 'var(--text-3)', textWrap: 'pretty' }}>{chatEmpty}</div>
          )}
        </div>
      </div>
    </Pane>
  )
}
