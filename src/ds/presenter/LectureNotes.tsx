import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'

import { IconButton, useRecede, wrapTip } from '../chrome/IconButton'
import { InlineText } from '../chrome/InlineText'
import { settleRead } from '../chrome/MeasureBox'
import { Pane, PaneScroller, SCROLLER_INSET, scrollerPadRight } from '../chrome/Pane'
import { PaneColumnHeader } from '../chrome/PaneColumnHeader'
import { LEGEND_INSET } from '../chrome/PaneHeader'
import { PillButton } from '../chrome/PillButton'
import { portalInto } from '../chrome/portal'
import { Caret } from '../nav/TreeRow'
import { BinMark } from '../sidebar/BinMark'
import type { PaneFit } from '../chrome/PaneDivider'

/* Typed port of the DS components/presenter/LectureNotes.jsx (contract: LectureNotes.d.ts),
   v4 (owner, 6 Oct; flags are notes). */

export interface NoteCategory {
  /** the value stored on an entry's `category` - the host's own string, never a fixed union */
  key: string
  /** ONE typed character inside a coloured box; the box is what says "type" */
  glyph: string
  /** lower case, two or three words - the tag's tooltip, the menu row */
  label: string
  /** the ring's and the tally's short word ("fix" for "fix this slide"). Falls back to `label` */
  short?: string
  /** the tag box's fill. Any colour: a closed union here compiles into a lint rule against hosts */
  wash: string
}

/** ONE FLAG - and every typed note too: "the textbox is just another way for the prof to flag the
 *  slide". A flag pressed on the chip is a note with a type and no words yet; a note typed with no
 *  type is a plain flag. One kind of row, one list, one store. */
export interface LectureNote {
  id?: string | number
  /** a `NoteCategory.key`. Absent = a plain flag. An unknown key draws no tag */
  category?: string
  /** the words. EMPTY for a bare flag; may contain `\n` */
  text: string
  /** the time, verbatim, mono - the host's clock ("10:21") */
  when?: string
  /** WHEN IT WAS MADE, ms. With it the row is FRESH for `LECTURE_NOTES_METRICS.undoMs` */
  at?: number
  /** WHEN IT WAS RESOLVED, ms. Delete resolves: the host stamps this and keeps the entry */
  resolvedAt?: number
  /** THE STOP'S INDEX - stamped by `onSave` when the pane is given `stop` */
  stop?: number
  /** the review group's head verbatim - an override for "stop N · Title" from `stops` */
  stopLabel?: string
}

/** THE TYPE SET - one list for flags and typed notes alike. The first three are the flag types,
 *  the only ones on `FlagChip`'s ring. `short` is the ring's and the tally's word. */
export const NOTE_CATEGORIES: NoteCategory[] = [
  { key: 'question', glyph: '?', label: 'unclear', short: 'unclear', wash: 'var(--hue-cobalt-wash-raised)' },
  { key: 'fix', glyph: '!', label: 'fix this slide', short: 'fix', wash: 'var(--hue-amber-wash-raised)' },
  { key: 'follow-up', glyph: '→', label: 'follow up', short: 'follow up', wash: 'var(--hue-teal-wash-raised)' },
]

/** an unspent glyph and the wash that travels with it */
export interface NoteCategorySlot { glyph: string; wash: string }

/** THE UNSPENT GLYPHS, and the only sanctioned way to mint a type at the desk. */
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

/** HOW FAR EACH TYPE GLYPH IS MOVED DOWN, in em, so its INK sits on its box's centre. */
export const GLYPH_DROP: Record<string, number> = { '!': 0.09, '?': 0.09, '→': 0, '+': 0.06, '~': 0.08, '#': 0.1, '=': 0.06, '@': 0.01, '%': 0.1, '§': 0.03 }

/** a glyph, moved onto its box's centre by `GLYPH_DROP`. Drawn as a grid item (blockified), so the
 *  transform applies; it moves the ink and never the box, so the tag's size cannot change */
export function TagGlyph({ glyph }: { glyph: string }) {
  const d = GLYPH_DROP[glyph] || 0
  return <span style={{ display: 'block', transform: d ? 'translateY(' + d + 'em)' : undefined }}>{glyph}</span>
}

const FLAGS_ROOM = { x: 6, y: 4 }
function flagsRoom(insetY: number): CSSProperties {
  const R = FLAGS_ROOM
  return { paddingTop: R.y, paddingBottom: R.y, paddingLeft: R.x, paddingRight: R.x + scrollerPadRight(), marginTop: insetY - R.y, marginBottom: insetY - R.y, marginLeft: -R.x, marginRight: -R.x }
}

/** The pane's numbers. `chat`/`chatMin` 220, `preparedMin` 260, `divider` 14, `aside` 360,
 *  `prepared` 150, `preparedMinH` 60, `flagsMinH` 96, `undoMs` 2000, `rowTag` 16. */
export const LECTURE_NOTES_METRICS = {
  chat: 220, chatMin: 220, preparedMin: 260, divider: 14, aside: 360,
  prepared: 150, preparedMinH: 60, flagsMinH: 96, undoMs: 2000, rowTag: 16,
  freshFadeMs: 1500,
  composer: 30, composerLines: 4, tag: { w: 22, h: 19 }, gutter: 14, popover: 208, glyphPanel: 104, actions: 46,
  reviewRecede: false,
  liveRecede: false,
  composerLineH: 19,
  headClear: 8,
  legendInset: LEGEND_INSET,
}

/** THE ENTER MARK - the return-key arrow, drawn once. Inherits `currentColor`. */
export function EnterMark({ size = 11, style }: { size?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block', ...style }}>
      <path d="M10 2.7v4.1H3.2M5.6 4.3 3 6.8l2.6 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** ONE TYPE TAG: the glyph in its type's wash. `as="button"` makes it pickable. `dashed` with no
 *  `cat` is the empty slot. */
function CategoryTag({ cat, title, dashed, glyph, hotGlyph, as, onClick, live, size }: {
  cat?: Pick<NoteCategory, 'glyph' | 'wash'> & { label?: string } | null
  title?: string | false
  dashed?: boolean
  glyph?: string
  hotGlyph?: string
  as?: 'button'
  onClick?: (e: ReactMouseEvent<HTMLElement>) => void
  live?: boolean
  size?: number
}) {
  const M = LECTURE_NOTES_METRICS
  const [hot, setHot] = useState(false)
  if (!cat && !dashed) return null
  const button = as === 'button'
  const w = size || M.tag.w, h = size || M.tag.h
  const style: CSSProperties = {
    flexShrink: 0, width: w, height: h, boxSizing: 'border-box', padding: 0,
    borderRadius: size ? 4 : 'var(--radius-xs)', background: cat ? cat.wash : 'transparent',
    border: live ? '1px solid var(--text-2)' : button && hot ? '1px solid var(--border-strong)' : cat ? '1px solid transparent' : '1px dashed var(--border-dashed)',
    boxShadow: 'none',
    display: 'grid', placeItems: 'center', cursor: button ? 'pointer' : undefined,
    fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1, fontWeight: cat ? 'var(--fw-bold)' : 'var(--fw-regular)',
    color: cat ? 'var(--text-1)' : 'var(--text-2)',
    transition: 'var(--transition-wash)',
  }
  const face = cat ? <TagGlyph glyph={cat.glyph} /> : (hot && hotGlyph) || glyph ? <TagGlyph glyph={(hot && hotGlyph) || glyph || ''} /> : null
  const tip = title === false ? undefined : (title || (cat ? cat.label : ''))
  if (button) {
    return (
      <button type="button" onClick={onClick}
        onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)} onBlur={() => setHot(false)}
        title={tip ? wrapTip(tip) : undefined} style={style}>{face}</button>
    )
  }
  return <span onClick={onClick} title={tip ? wrapTip(tip) : undefined} style={style}>{face}</span>
}

/** THE TAG-AND-CARET TRIGGER - "a list drops from here", one hover for every instance. */
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

/** ONE ROW OF A TYPE MENU - `--surface-hover` under the pointer, on the tracking clock. */
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

/** THE TYPE LIST - the same rows in the composer's menu and in a flag row's tag menu. */
function TypeList({ categories, current, onPick }: { categories: NoteCategory[]; current?: string; onPick: (key: string | undefined) => void }) {
  return (
    <Fragment>
      {categories.map((c) => (
        <PopRow key={c.key} selected={current === c.key} onClick={() => onPick(c.key)}>
          <CategoryTag cat={c} title={false} />{c.label}
        </PopRow>
      ))}
      <PopRow selected={current == null} onClick={() => onPick(undefined)} style={{ fontWeight: 'var(--fw-regular)', color: 'var(--text-2)' }}>
        <CategoryTag dashed glyph="" title={false} />no type
      </PopRow>
    </Fragment>
  )
}

/** ONE FLAG ROW (v4, 6 Oct) - the type tag, the words, the time at the right. */
function FlagRow({ entry, cat, categories, onCategory, onCommit, onResolve, fresh, resolved, instant, onSelect, onSelected }: {
  entry: LectureNote
  cat?: NoteCategory
  categories: NoteCategory[]
  onCategory?: (note: LectureNote, key: string | undefined) => void
  onCommit?: (note: LectureNote, text: string) => void
  onResolve?: (note: LectureNote) => void
  fresh: boolean
  resolved: boolean
  instant: boolean
  onSelect?: (note: LectureNote) => void
  onSelected?: boolean
}) {
  const M = LECTURE_NOTES_METRICS
  const [hot, setHot] = useState(false)
  const [shown, show, hide] = useRecede()
  const [editing, setEditing] = useState(false)
  const [textHot, setTextHot] = useState(false)
  const [menu, setMenu] = useState<false | 'left' | 'right'>(false)
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!confirming) return undefined
    const keep = confirmRef.current && confirmRef.current.querySelector('button')
    if (keep) keep.focus()
    const off = (e: MouseEvent) => { if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) setConfirming(false) }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [confirming])
  const menuRef = useRef<HTMLSpanElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const [menuAt, setMenuAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const bare = !(entry.text || '').trim()
  useEffect(() => {
    if (!menu) { setMenuAt(null); return undefined }
    const a = menuRef.current && menuRef.current.getBoundingClientRect()
    if (a) {
      const h = (categories.length + 1) * 26 + 16
      const below = window.innerHeight - a.bottom - 8 >= h
      setMenuAt({ left: menu === 'right' ? Math.max(8, a.right - M.popover) : Math.max(8, Math.min(a.left, window.innerWidth - M.popover - 8)), top: below ? a.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - a.top + 6 })
    }
    const off = (e: MouseEvent) => { const inA = menuRef.current && menuRef.current.contains(e.target as Node); const inP = popRef.current && popRef.current.contains(e.target as Node); if (!inA && !inP) setMenu(false) }
    const shut = (e: Event) => { if (!(popRef.current && popRef.current.contains(e.target as Node))) setMenu(false) }
    document.addEventListener('mousedown', off)
    window.addEventListener('scroll', shut, true)
    return () => { document.removeEventListener('mousedown', off); window.removeEventListener('scroll', shut, true) }
  }, [menu, categories.length, M.popover])
  const up = !resolved && !confirming && ((instant ? hot : shown) || editing)
  const canEdit = !!onCommit && !resolved
  const textStyle: CSSProperties = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', color: resolved ? 'var(--text-3)' : 'var(--text-1)', textWrap: 'pretty', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', userSelect: 'text', WebkitUserSelect: 'text' }
  const freshWash = cat ? 'color-mix(in oklab, ' + cat.wash + ' 25%, var(--surface-paper))' : 'var(--bark-50)'
  const restWash = onSelected ? 'var(--state-selected-wash)' : 'var(--bark-50)'
  const wash = fresh ? freshWash : (hot || editing) && !onSelected ? 'var(--bark-50)' : 'transparent'
  const [settling, setSettling] = useState(false)
  const wasFresh = useRef(fresh)
  useEffect(() => {
    if (wasFresh.current && !fresh) {
      setSettling(true)
      const t = setTimeout(() => setSettling(false), M.freshFadeMs)
      wasFresh.current = fresh
      return () => clearTimeout(t)
    }
    wasFresh.current = fresh
    return undefined
  }, [fresh, M.freshFadeMs])
  // the previous render's freshness is what decides whether this one is still settling
  // eslint-disable-next-line react-hooks/refs
  const settlingNow = settling || (wasFresh.current && !fresh)
  const washFade = 'background-color ' + (settlingNow ? 'calc(var(--dur-fade) * 6)' : 'var(--dur-fade)') + ' var(--ease-soft)'
  const tag = cat ? (
    onCategory && !resolved ? <CategoryTag cat={cat} size={M.rowTag} as="button" title={'type: ' + cat.label + ' · click to change'} onClick={(e) => { e.stopPropagation(); setMenu((v) => (v ? false : 'left')) }} />
      : <CategoryTag cat={cat} size={M.rowTag} />
  ) : onCategory && !resolved ? <CategoryTag dashed glyph={up || menu ? '+' : ''} hotGlyph="+" size={M.rowTag} as="button" title="no type · click to give it one" onClick={(e) => { e.stopPropagation(); setMenu((v) => (v ? false : 'left')) }} />
    : <CategoryTag dashed glyph="" size={M.rowTag} title="no type" />
  const typeMenu = () => (menu && menuAt && typeof document !== 'undefined' ? portalInto(document.body,
    <div ref={popRef} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} style={{ position: 'fixed', left: menuAt.left, top: menuAt.top, bottom: menuAt.bottom, width: M.popover, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: 4, boxSizing: 'border-box', zIndex: 1000 }}>
      <TypeList categories={categories} current={entry.category} onPick={(k) => { setMenu(false); if (k !== entry.category && onCategory) onCategory(entry, k) }} />
    </div>
  ) : null)
  const confirmLine = confirming ? (
    <div ref={confirmRef} role="alertdialog" aria-label="delete this flag" onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setConfirming(false) } }}
      style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, paddingTop: 4, paddingBottom: 1 }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>Delete this flag?</span>
      <PillButton size="sm" onClick={() => setConfirming(false)}>Keep</PillButton>
      <PillButton size="sm" tone="danger" onClick={() => { setConfirming(false); if (onResolve) onResolve(entry) }}>Delete</PillButton>
    </div>
  ) : null
  return (
    <div data-lecture-note="" onMouseEnter={() => { setHot(true); show() }} onMouseLeave={() => { setHot(false); hide() }}
      onClick={onSelect && !editing ? () => onSelect(entry) : undefined}
      style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 6, padding: '3px 6px', margin: '0 -6px', borderRadius: 'var(--radius-sm)', background: wash, cursor: onSelect ? 'pointer' : 'default', transition: washFade }}>
      <span ref={menuRef} style={{ position: 'relative', display: 'inline-flex', marginTop: 2, width: M.rowTag, flexShrink: 0 }}>
        {tag}
        {typeMenu()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }} onClick={editing ? (e) => e.stopPropagation() : undefined}>
        {editing ? (
          <InlineText value={entry.text || ''} multiline enterInserts editing placeholder="enter description"
            onCommit={(v) => { setEditing(false); if (v !== (entry.text || '') && onCommit) onCommit(entry, v) }}
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
      {!resolved && (canEdit || onResolve) ? (
        <span onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: 6, top: 3, height: 'calc(var(--fs-body) * var(--lh-snug))', display: 'flex', alignItems: 'center', gap: 0, paddingLeft: 6, borderRadius: 'var(--radius-sm)', background: up || menu ? (fresh ? freshWash : restWash) : 'transparent', transition: settlingNow ? washFade : undefined, pointerEvents: up || menu ? 'auto' : 'none' }}>
          {onResolve ? <IconButton tone="danger" size={20} label="delete this flag" title="delete · asks first" reveal={up} onClick={(e) => { if (e && e.stopPropagation) e.stopPropagation(); setConfirming(true) }}><BinMark lift={false} /></IconButton> : null}
        </span>
      ) : null}
      {confirmLine}
    </div>
  )
}

/** THE COMPOSER - one field with the type button inside its border and an enter button at its
 *  right, always drawn. ⏎ saves, Shift+⏎ breaks a line. */
function Composer({ categories, category, onCategoryChange, draft, onDraftChange, onSave, onAddCategory, placeholder, menuOpen, onMenuOpenChange, usual }: {
  categories: NoteCategory[]
  category?: string | null
  onCategoryChange?: (key: string | null) => void
  draft?: string
  onDraftChange?: (draft: string) => void
  onSave?: (note: { category?: string; text: string }) => void
  onAddCategory?: (category: NoteCategory) => void
  placeholder: string
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
  usual: string
}) {
  const M = LECTURE_NOTES_METRICS
  const [focused, setFocused] = useState(false)
  const [ownMenu, setOwnMenu] = useState(false)
  const [ownCat, setOwnCat] = useState<string | null | undefined>(usual)
  const [sendHot, setSendHot] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<NoteCategorySlot | null>(null)
  const open = menuOpen != null ? menuOpen : ownMenu
  const setOpen = (v: boolean) => { if (onMenuOpenChange) onMenuOpenChange(v); if (menuOpen == null) setOwnMenu(v); if (!v) { setNaming(false); setName(''); setPicking(false); setPicked(null) } }
  const raw = onCategoryChange ? category : ownCat
  const key = raw === undefined ? usual : raw
  const choose = (k: string | null | undefined) => { const v = k === undefined ? null : k; if (onCategoryChange) onCategoryChange(v); else setOwnCat(v) }
  const cat = categories.filter((c) => c.key === key)[0] || null
  const has = !!(draft || '').trim()
  // a button that has gone inert under the pointer gets no mouseleave, so drop the hover
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!has) setSendHot(false) }, [has])
  const save = () => { if (has && onSave) onSave({ category: cat ? cat.key : undefined, text: (draft || '').replace(/[ \t]+\n/g, '\n').trim() }) }
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
    choose(made.key)
    setNaming(false); setName(''); setPicking(false); setPicked(null); setOpen(false)
  }
  return (
    <div data-note-composer="" style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: M.composer, boxSizing: 'border-box', marginLeft: -7, padding: '0 6px 3px 4px', background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', border: '1px solid ' + (focused ? 'var(--state-editing)' : 'var(--border-strong)'), transition: 'border-color var(--dur-hover) var(--ease-soft)' }}>
      {open ? (
        <div data-note-categories="" style={{ position: 'absolute', left: 0, bottom: 'calc(100% + 8px)', width: M.popover, background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--lift-2)', padding: 4, boxSizing: 'border-box', zIndex: 6 }}>
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
                        <CategoryTag key={s.glyph} as="button" cat={{ glyph: s.glyph, wash: s.wash }} live={!!slot && s.glyph === slot.glyph}
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

/** THE TALLY beside the "Flags" head: this list's flags counted by type. */
function FlagTally({ list, categories }: { list: LectureNote[]; categories: NoteCategory[] }) {
  const n: Record<string, number> = {}
  let plain = 0
  list.forEach((e) => { if (e.category && categories.some((c) => c.key === e.category)) n[e.category] = (n[e.category] || 0) + 1; else plain += 1 })
  const shown = categories.filter((c) => n[c.key] > 0)
  return (
    <span data-notes-tally="" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--text-2)' }}>
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
function Head({ title, note, trailing, after }: { title: ReactNode; note?: ReactNode; trailing?: ReactNode; after?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <div style={{ flex: after ? 'none' : 1, minWidth: 0 }}><PaneColumnHeader title={title} note={note} /></div>
      {after}
      {trailing ? <span style={{ marginLeft: 'auto' }}>{trailing}</span> : null}
    </div>
  )
}

const plural = (n: number, w: string) => n + ' ' + w + (n === 1 ? '' : 's')
const Count = ({ children }: { children: ReactNode }) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)', color: 'var(--acorn-600)', whiteSpace: 'nowrap' }}>{children}</span>

/** THE ARITHMETIC OF THE LIST, AS CODE. Pure, and the same function objects the pane runs. */
const FlagMath = {
  fresh: (e: LectureNote, now: number) => !!(e && !e.resolvedAt && e.at && now - e.at < LECTURE_NOTES_METRICS.undoMs),
  lingering: (() => false) as (e: LectureNote, now: number) => boolean,
  visible: ((e: LectureNote) => !!e && !e.resolvedAt) as (e: LectureNote, now?: number) => boolean,
  nextExpiry(entries: LectureNote[], now: number) {
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

/** THE PARTS, published so a card can READ them. Read them; do not render them. */
export const LECTURE_NOTES_PARTS = { FlagRow, Composer, CategoryTag, Trigger, PopRow, Head, FlagTally, TypeList }

/** THE NOTES PANE'S `PaneFit` (DERIVED): gutter × 2 + chatMin + divider + preparedMin = 522.
 *  `minHeight` 340 is the pane's HEIGHT floor. */
export const LECTURE_NOTES_FIT: PaneFit & { minHeight: number } = (() => {
  const w = LECTURE_NOTES_METRICS.gutter * 2 + LECTURE_NOTES_METRICS.chatMin + LECTURE_NOTES_METRICS.divider + LECTURE_NOTES_METRICS.preparedMin
  return { narrowBelow: w, floor: w, minHeight: 340 }
})()

/**
 * The notes pane (v4). WHAT THE HOST MUST DO FOR THE COLUMN AROUND IT: this pane is the
 * `flex: 1; min-height: 0` child of the presenter's flex column, under the strip (`flex: none`) -
 * do not give it a height and do not position it; it owns its own scroll, so never wrap it in a
 * scrolling ancestor; the composer stays outside the scroller at the foot of the left column; set
 * the chat width only through `chatWidth` and the prepared height only through `preparedHeight`.
 *
 * WHAT THE HOST MUST DO FOR FLAGS: one list for the lecture, newest-first, every entry stamped with
 * its `stop` and `at`; the chip's `onFlag` and the composer's `onSave` both add to it. Pass the
 * whole list with `stop` (the shown slide's index): the pane filters to that slide with the oldest
 * at the top and the newest at the foot, and scrolls so the newest always shows. Delete RESOLVES -
 * stamp `resolvedAt` and never erase; the pane drops resolved rows at once. A slide is "flagged"
 * while it has an entry without `resolvedAt`: DERIVE it, never store a second bit.
 *
 * THE PREPARED NOTES are plain text; a click edits them in place (`InlineText`, multiline), and a
 * commit changes them for every later lecture. `variant="review"` is the recap's copy: every flag
 * grouped by slide in walk order. Pass `selectedStop` / `onSelectStop` to share the shown slide
 * with the recap, and `aside` for its preview column.
 */
export interface LectureNotesProps {
  /** `live` (default): the two-column lecture pane. `review`: the recap's one-column copy */
  variant?: 'live' | 'review'
  /** 1-based; the left head's FALLBACK when `stopTitle` is absent, and what resets the editor */
  stopNumber?: number
  /** the slide's title - THE LEFT HEAD ITSELF */
  stopTitle?: string
  /** the shown slide is not the projected one; the head's note says "roaming" */
  roaming?: boolean
  /** the prepared notes - a STRING (editable on click, with `onPreparedCommit`) or rich nodes */
  prepared?: ReactNode
  /** what the prepared box says when empty; also the editor's placeholder */
  preparedEmpty?: string
  /** a click on the prepared notes edits them in place; fires on escape, blur or click outside
   *  with the text, ONLY WHEN IT CHANGED. The store is the host's */
  onPreparedCommit?: (text: string) => void
  /** for rich-node `prepared`: a click asks the host to open its own editor */
  onEditPrepared?: () => void
  /** the prepared notes' height above the flags, px - for a host that persists the divider */
  preparedHeight?: number
  /** the drag's report on mouse-up, and the double-click reset's. Store it as given */
  onPreparedHeightChange?: (height: number) => void
  /** THE WHOLE LECTURE'S flags, newest first, each stamped `stop` and `at` */
  entries?: LectureNote[]
  /** the type list. Default `NOTE_CATEGORIES`. USER-WIDE: persist it against the user */
  categories?: NoteCategory[]
  /** the composer's uncontrolled text, when the host holds it */
  draft?: string
  /** the composer's text changed; the host keeps the draft */
  onDraftChange?: (draft: string) => void
  /** the composer's chosen type key. `undefined` = not chosen yet, `null` = "no type" */
  category?: string | null
  /** the composer's type changed; `null` means "no type", never `undefined`. The
   *  `(key: string)` arm is this repo's v3 host, whose setter takes `string | undefined`;
   *  OB-304 rewires it and the arm goes */
  onCategoryChange?: ((key: string | null) => void) | ((key: string) => void)
  /** the film roll's usual type - pass the SAME key as `FilmRoll usualFlag`. Default 'fix' */
  usualFlag?: string
  /** the composer saved: text trimmed, may contain `\n`. Add an entry with `when` and `at` */
  onSave?: (note: { category?: string; text: string; stop?: number }) => void
  /** shows "new type." in the composer's menu and receives the FINISHED type. Persist it */
  onAddCategory?: (category: NoteCategory) => void
  /** @deprecated renamed `onAddCategory`; still read */
  onNewCategory?: (category: NoteCategory) => void
  /** a click on a row's words edited them in place; fires only when they changed */
  onEntryCommit?: (note: LectureNote, text: string) => void
  /** the row's tag picked a new type (`undefined` = no type). Omit and the tag is not a button */
  onEntryCategoryChange?: (note: LectureNote, key: string | undefined) => void
  /** THE BIN - DELETE RESOLVES. Stamp `resolvedAt` and keep the entry. Omit and there is no bin */
  onResolveEntry?: (note: LectureNote) => void
  /** @deprecated v4 - renamed `onResolveEntry`; still read, and must now stamp `resolvedAt` */
  onDeleteEntry?: (note: LectureNote) => void
  /** @deprecated 15 Oct - never called; resolve instead */
  onUndoEntry?: (note: LectureNote) => void
  /** @deprecated 15 Oct - never called */
  onRestoreEntry?: (note: LectureNote) => void
  /** default "a note for this slide…" */
  composerPlaceholder?: string
  /** the Class chat column's width, px, for a host that persists the column divider. Default 220 */
  chatWidth?: number
  /** the Class chat's width changed; the host stores it under the new setting */
  onChatWidthChange?: (width: number) => void
  /** @deprecated v4 - renamed `chatWidth`; still read */
  duringWidth?: number
  /** @deprecated renamed `onChatWidthChange`; still read */
  onDuringWidthChange?: (width: number) => void
  /** the Class chat's content, when it exists. Omit for the parked placeholder */
  chat?: ReactNode
  /** default "Class chat" */
  chatLabel?: string
  /** the parked placeholder's words */
  chatEmpty?: string
  /** controlled composer menu */
  menuOpen?: boolean
  /** the composer menu's open state changed */
  onMenuOpenChange?: (open: boolean) => void
  /** the pane's legend. Default "notes" live, "notes from this lecture" in review */
  title?: string
  /** the list's head. Default "Flagged during lecture" live, "Flags" in review */
  flagsLabel?: string
  /** REVIEW: the slide the recap's viewer is showing - its group is washed */
  selectedStop?: number
  /** REVIEW: a click on a slide's head or one of its rows asks to show that slide */
  onSelectStop?: (stop: number) => void
  /** LIVE: the shown slide's index - the list filters to it and `onSave` stamps it */
  stop?: number
  /** the walk's titles by index - review heads each group "stop N - Title" */
  stops?: string[]
  /** REVIEW: a right-hand column beside the flags - the recap's preview of the shown slide */
  aside?: ReactNode
  /** REVIEW: the aside column's head. Default "Preview" */
  asideLabel?: string
  /** REVIEW: the aside column's width. Default `LECTURE_NOTES_METRICS.aside` (360) */
  asideWidth?: number
  /** the pane's own style overrides */
  style?: CSSProperties
  /** @deprecated v4 - the old per-slide switch. Accepted and ignored */
  flagged?: boolean
  /** @deprecated v4 - the old per-slide switch. Accepted and ignored */
  onToggleFlag?: () => void
}

export function LectureNotes({
  variant = 'live', stopNumber, stopTitle, roaming = false,
  prepared, preparedEmpty = 'nothing was written for this slide.', onPreparedCommit, onEditPrepared,
  preparedHeight, onPreparedHeightChange,
  entries = [], categories = NOTE_CATEGORIES,
  draft, onDraftChange, category, onCategoryChange, onSave, onAddCategory, onNewCategory,
  onEntryCommit, onEntryCategoryChange, onResolveEntry, onDeleteEntry,
  composerPlaceholder = 'a note for this slide…',
  chatWidth, onChatWidthChange, duringWidth, onDuringWidthChange, chat, chatLabel = 'Class chat',
  chatEmpty = 'Messages from students appear here. Parked: comes with the student app.',
  menuOpen, onMenuOpenChange, title, flagsLabel, usualFlag = 'fix', style,
  selectedStop, onSelectStop,
  stop, stops,
  aside, asideLabel = 'Preview', asideWidth = LECTURE_NOTES_METRICS.aside,
}: LectureNotesProps) {
  const M = LECTURE_NOTES_METRICS
  const review = variant === 'review'
  // the pane hands back null for "no type"; the v3 host's setter still does not accept it
  const setCategory = onCategoryChange as ((key: string | null) => void) | undefined
  const resolve = onResolveEntry || onDeleteEntry
  const chatPref = chatWidth != null ? chatWidth : duringWidth
  const reportChat = onChatWidthChange || onDuringWidthChange
  const byKey: Record<string, NoteCategory> = {}
  categories.forEach((c) => { byKey[c.key] = c })
  const [, tick] = useState(0)
  // the clock the rows read: fresh rows wash until it passes, and the tick above re-renders
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  useEffect(() => {
    const t = FlagMath.nextExpiry(entries, Date.now())
    if (t === Infinity) return undefined
    const id = setTimeout(() => tick((n) => n + 1), Math.max(16, t - Date.now() + 16))
    return () => clearTimeout(id)
  })
  const stamped = entries.some((e) => e && e.stop != null)
  const live = entries.filter((e) => FlagMath.visible(e, now))
  const liveList = (!review && stop != null && stamped ? live.filter((e) => e.stop === stop) : live).slice().reverse()
  const counted = (l: LectureNote[]) => l.filter((e) => !e.resolvedAt)
  const labelFor = (i: number) => 'stop ' + (i + 1) + (stops && stops[i] ? ' · ' + stops[i] : '')
  const row = (e: LectureNote, i: number, opts?: { onSelect?: (n: LectureNote) => void; selected?: boolean }) => (
    <FlagRow key={e.id != null ? e.id : i} entry={e} cat={e.category ? byKey[e.category] : undefined} categories={categories}
      onCategory={onEntryCategoryChange} onCommit={onEntryCommit} onResolve={resolve}
      fresh={FlagMath.fresh(e, now)} resolved={FlagMath.lingering(e, now)}
      instant={review ? !M.reviewRecede : !M.liveRecede} onSelect={opts && opts.onSelect} onSelected={!!(opts && opts.selected)} />
  )
  const [editingPrep, setEditingPrep] = useState(false)
  const [prepHot, setPrepHot] = useState(false)
  useEffect(() => { setEditingPrep(false) }, [stopNumber, stop])
  const canEditPrepared = !!onPreparedCommit && typeof prepared === 'string'
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [rowW, setRowW] = useState(0)
  useEffect(() => {
    const el = rowRef.current
    if (!el) return undefined
    const read = () => { if (rowRef.current) setRowW(Math.round(rowRef.current.getBoundingClientRect().width)) }
    const stopRead = settleRead(read)
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(read); ro.observe(el) }
    return () => { stopRead(); if (ro) ro.disconnect() }
  }, [])
  const [ownChat, setOwnChat] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const pref = (!dragging && chatPref != null) ? chatPref : (ownChat != null ? ownChat : M.chat)
  const maxChat = rowW ? Math.max(M.chatMin, rowW - M.gutter * 2 - M.divider - M.preparedMin) : Math.max(M.chatMin, pref)
  const shownChat = Math.min(Math.max(pref, M.chatMin), maxChat)
  const chatRef = useRef(shownChat)
  chatRef.current = shownChat
  const startDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const x0 = e.clientX, w0 = chatRef.current
    setDragging(true)
    const move = (ev: MouseEvent) => { const next = Math.min(Math.max(w0 - (ev.clientX - x0), M.chatMin), maxChat); chatRef.current = next; setOwnChat(next) }
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      setDragging(false)
      if (reportChat) reportChat(chatRef.current)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  const resetChat = () => { const next = Math.min(Math.max(M.chat, M.chatMin), maxChat); setOwnChat(next); if (reportChat) reportChat(next) }
  const prepRef = useRef<HTMLDivElement | null>(null)
  const flagsRef = useRef<HTMLDivElement | null>(null)
  const [ownPrep, setOwnPrep] = useState<number | null>(null)
  const [prepDrag, setPrepDrag] = useState(false)
  const prepPref = (!prepDrag && preparedHeight != null) ? preparedHeight : (ownPrep != null ? ownPrep : M.prepared)
  const startPrepDrag = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = prepRef.current ? prepRef.current.getBoundingClientRect().height : prepPref
    const room = flagsRef.current ? flagsRef.current.getBoundingClientRect().height - M.flagsMinH : 0
    const max = Math.max(M.preparedMinH, h0 + Math.max(0, room))
    let last = h0
    setPrepDrag(true)
    const move = (ev: MouseEvent) => { last = Math.round(Math.min(Math.max(h0 + (ev.clientY - y0), M.preparedMinH), max)); setOwnPrep(last) }
    const up = () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
      setPrepDrag(false)
      if (onPreparedHeightChange) onPreparedHeightChange(last)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }
  const resetPrep = () => { setOwnPrep(M.prepared); if (onPreparedHeightChange) onPreparedHeightChange(M.prepared) }
  const endRef = useRef<HTMLDivElement | null>(null)
  const lastLen = useRef(liveList.length)
  useEffect(() => {
    if (liveList.length > lastLen.current && endRef.current) {
      let p = endRef.current.parentElement
      while (p && !(p.scrollHeight > p.clientHeight && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement
      if (p) p.scrollTop = p.scrollHeight
    }
    lastLen.current = liveList.length
  })
  if (review) {
    const ordered = stamped ? live.slice().reverse().map((e, i) => ({ e, i, s: e.stop != null ? e.stop : -1 })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.e) : live
    const groups: { k: string; stop?: number; label: string; items: LectureNote[] }[] = []
    ordered.forEach((e) => {
      const k = e.stop != null ? 's' + e.stop : (e.stopLabel || (groups.length ? groups[groups.length - 1].k : ''))
      if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, stop: e.stop, label: e.stopLabel || (e.stop != null ? labelFor(e.stop) : ''), items: [] })
      groups[groups.length - 1].items.push(e)
    })
    const all = counted(ordered)
    const slides: Record<string, true> = {}
    all.forEach((e) => { slides[e.stop != null ? 's' + e.stop : e.stopLabel || '?'] = true })
    const nSlides = Object.keys(slides).length
    return (
      <Pane data-lecture-notes="review" title={title || 'notes from this lecture'} scroll="none" bodyStyle={{ padding: M.headClear + 'px 14px 12px ' + M.legendInset + 'px', userSelect: 'none', WebkitUserSelect: 'none', ...(aside ? { flexDirection: 'row', gap: 0 } : null) }}
        style={{ flex: 1, minHeight: 0, userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
        <div style={aside ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: M.gutter } : { display: 'contents' }}>
        <Head title={flagsLabel != null ? flagsLabel : 'Flags'} after={all.length ? <FlagTally list={all} categories={categories} /> : undefined} trailing={all.length ? <Count>{plural(nSlides, 'slide') + ' · ' + plural(all.length, 'flag')}</Count> : undefined} />
        <PaneScroller style={flagsRoom(SCROLLER_INSET)}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groups.length ? groups.map((g, gi) => {
              const sel = selectedStop != null && g.stop === selectedStop
              const s = g.stop
              const pick = onSelectStop && s != null ? () => onSelectStop(s) : undefined
              return (
                <div key={g.k + gi} data-notes-group="" data-flagged-slide="" style={{ padding: '4px 6px 6px', margin: '0 -6px', borderTop: gi && !sel ? '1px solid var(--border-hair)' : '1px solid transparent', borderRadius: sel ? 'var(--radius-md)' : 0, background: sel ? 'var(--state-selected-wash)' : 'transparent', transition: 'var(--transition-wash)' }}>
                  <div onClick={pick} title={pick ? wrapTip('show this slide') : undefined} style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)', padding: '4px 0 3px', cursor: pick ? 'pointer' : 'default' }}>{g.label}</div>
                  {g.items.map((e, i) => row(e, i, { onSelect: pick, selected: sel }))}
                </div>
              )
            }) : <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-normal)' }}>nothing was flagged this lecture.</p>}
          </div>
        </PaneScroller>
        </div>
        {aside ? (
          <Fragment>
            <div aria-hidden="true" style={{ flex: 'none', width: M.divider, marginLeft: -M.divider / 2, marginRight: M.gutter - M.divider / 2, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: M.divider / 2, width: 1, background: 'var(--border-hair)' }} />
            </div>
            <div style={{ flexShrink: 0, width: asideWidth, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Head title={asideLabel} />
              {aside}
            </div>
          </Fragment>
        ) : null}
      </Pane>
    )
  }
  const n = counted(liveList).length
  const hasFlags = n > 0
  const liveFlagsLabel = flagsLabel != null ? flagsLabel : 'Flagged during lecture'
  const proseStyle: CSSProperties = { display: 'block', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-normal)', color: 'var(--text-1)', textWrap: 'pretty', whiteSpace: 'pre-wrap', cursor: 'text' }
  const hairline = (vertical: boolean, active: boolean): CSSProperties => ({ position: 'absolute', background: active ? 'var(--accent-primary)' : 'var(--border-hair)', ...(vertical ? { top: 0, bottom: 0, left: M.divider / 2, width: 1 } : { left: 0, right: 0, top: M.divider / 2, height: 1 }) })
  return (
    <Pane data-lecture-notes="live" title={title || 'notes'} scroll="none" bodyStyle={{ flexDirection: 'row', gap: 0, padding: M.headClear + 'px 14px 12px ' + M.legendInset + 'px' }}
      style={{ flex: 1, minHeight: 0, userSelect: 'none', WebkitUserSelect: 'none', ...style }}>
      <div ref={rowRef} style={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, paddingRight: M.gutter }}>
          <div style={{ userSelect: 'text', WebkitUserSelect: 'text' }}><Head title={stopTitle || 'stop ' + (stopNumber != null ? stopNumber : '—')} note={roaming ? 'roaming' : undefined} /></div>
          <div ref={prepRef} data-notes-prepared="" style={{ flex: '0 1 ' + prepPref + 'px', minHeight: M.preparedMinH, display: 'flex', flexDirection: 'column', userSelect: 'text', WebkitUserSelect: 'text' }}>
            <PaneScroller style={{ padding: '4px 4px 4px 4px', paddingRight: 8 + scrollerPadRight(), margin: '-4px -4px -4px -4px' }}>
              {canEditPrepared ? (
                <div onMouseEnter={() => setPrepHot(true)} onMouseLeave={() => setPrepHot(false)}
                  style={{ borderRadius: 'var(--radius-xs)', outline: prepHot && !editingPrep ? '1px solid var(--border-rule)' : '1px solid transparent', outlineOffset: 3, transition: 'outline-color var(--dur-hover) var(--ease-soft)' }}>
                  <InlineText key={editingPrep ? 'edit' : 'rest'} value={prepared as string} multiline enterInserts editing={editingPrep}
                    placeholder={preparedEmpty} onOpen={() => setEditingPrep(true)}
                    onCommit={(v) => { setEditingPrep(false); if (v !== (prepared as string) && onPreparedCommit) onPreparedCommit(v) }}
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
          <div ref={flagsRef} data-notes-during="" style={{ flex: '1 1 0', minHeight: M.flagsMinH, display: 'flex', flexDirection: 'column' }}>
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
            <Composer categories={categories} category={category} onCategoryChange={setCategory}
              draft={draft} onDraftChange={onDraftChange} onSave={onSave ? (s) => onSave(stop != null ? { ...s, stop } : s) : undefined} onAddCategory={onAddCategory || onNewCategory}
              placeholder={composerPlaceholder} menuOpen={menuOpen} onMenuOpenChange={onMenuOpenChange} usual={usualFlag} />
          </div>
        </div>
        <div onMouseDown={startDrag} onDoubleClick={resetChat} title={wrapTip('drag to resize · double-click to reset')}
          style={{ flex: 'none', width: M.divider, marginLeft: -M.divider / 2, marginRight: M.gutter - M.divider / 2, cursor: 'ew-resize', position: 'relative' }}>
          <div style={hairline(true, dragging)} />
        </div>
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
