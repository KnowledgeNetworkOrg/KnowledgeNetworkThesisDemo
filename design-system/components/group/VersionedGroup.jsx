/* Design rationale, war stories and every "why" trimmed from this file's comments on
   2026-08-22 live in VersionedGroup.prompt.md — this file is now the "what", not the record. */
import React from 'react'
import { IconButton, RESIZE_TIP, subscribePresence, useClipped, useRecede, wrapTip } from '../chrome/IconButton.jsx'
import { InlineText, INLINE_EDIT_STYLE } from '../chrome/InlineText.jsx'
import { EditMark } from '../chrome/EditMark.jsx'
import { Caret } from '../nav/TreeRow.jsx'
import { Bullet } from '../sidebar/InstrumentRow.jsx' // the ring: an option not taken
import { NodeChain } from '../graph/NodeChain.jsx'
import { usedStroke } from '../graph/NodeChip.jsx'
import { measure, linesOfBlock as linesOf, clampToLines, canMeasure, fontsReady } from '../graph/textMeasure.js'
import { portalInto } from '../chrome/portal.js'
import { scrollbarWidth } from '../chrome/Pane.jsx'

/* `InlineText`/`INLINE_EDIT_STYLE` and `EditMark` moved to `chrome/` 2026-08-28 (they
   were already shared internally across the title, description and version-name
   fields, just not documented as their own pieces) — re-exported here so nothing
   reading this file's contract sees a moved export as a removed one. */
export { InlineText, INLINE_EDIT_STYLE, EditMark }

const Depth = React.createContext(0)

export function checkStyle() {
  return {
    width: 9, height: 5, boxSizing: 'border-box',
    borderLeft: '1.75px solid currentColor', borderBottom: '1.75px solid currentColor',
    transform: 'rotate(-45deg) translate(0, -1px)',
  }
}

export function Check({ style }) {
  return <span style={style ? { ...checkStyle(), ...style } : checkStyle()} />
}

/** ITS PAIR, as Windows draws it (owner 2026-10-04): MAXIMIZE is one square, RESTORE is two.
 *  The same 1.25px stroke and 10px box as `RestoreMark`, so they swap without a jump. */
export function MaximizeMark() {
  return <span style={{ display: 'block', width: 10, height: 10, boxSizing: 'border-box', border: '1.25px solid currentColor', borderRadius: 1.5 }} />
}

/** MINIMIZE, as Windows draws it (owner 2026-10-06): one flat line, the square's width and its
 *  1.25px stroke, centred in the same 10px box, so it sits level beside `MaximizeMark`. */
export function MinimizeMark() {
  return <span style={{ display: 'flex', alignItems: 'center', width: 10, height: 10 }}><span style={{ display: 'block', width: 10, height: 0, borderTop: '1.25px solid currentColor' }} /></span>
}

export function RestoreMark() {
  return (
    <span style={{ position: 'relative', width: 10, height: 10, display: 'block' }}>
      <span style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, boxSizing: 'border-box', borderTop: '1.25px solid currentColor', borderRight: '1.25px solid currentColor', borderTopRightRadius: 1.5 }} />
      <span style={{ position: 'absolute', bottom: 0, left: 0, width: 7, height: 7, boxSizing: 'border-box', border: '1.25px solid currentColor', borderRadius: 1.5 }} />
    </span>
  )
}

const SHELL_Z = 1

/** THE TRAILING DOT IS THE SYSTEM'S, NOT THE CALLER'S (2026-09-21, owner, on the running walk
 *  editor: "version nodes' names start with a number like 1, 2, but the node pills start with
 *  numbers like 3. 4. 5."). Until today the dot was inherited from whatever the caller typed:
 *  `index="2."` drew `2.`, `index="2"` drew `2` — and `NodeChain`, which numbers the chips INSIDE
 *  the same card, has always dotted its own. One card, two notations, and neither side was wrong
 *  by its own contract. A caller cannot see the chips' notation from where it passes `index`, so
 *  this is not a rule to write down: `index` is a NUMBER, the dot is how this system draws a step
 *  number, and both spellings now draw the same thing. */
function dotted(raw) {
  const s = String(raw == null ? '' : raw).trim()
  return s ? s.replace(/\.$/, '') + '.' : s
}

function localIndex(index) {
  const raw = String(index == null ? '' : index).trim()
  if (!raw) return index
  const parts = raw.replace(/\.$/, '').split('.')
  return parts[parts.length - 1] + '.'
}

/** what the head actually prints, for the renderer AND for the measurer — `titleColumn()` sizes
 *  the name against the index beside it, so a predictor reading the caller's raw string while the
 *  head draws a dotted one is short by a mono full stop on every undotted call. */
function drawnIndex(index, scope) {
  return scope === 'path' ? dotted(index) : localIndex(index)
}

function DescLine({ text, placeholder, indent, onCommit, onCancel, editMode = false, multiline = false }) {
  if (!onCommit && !text) return null
  const shown = !!text || editMode
  return (
    <div style={{
      display: 'block', marginTop: -GROUP_METRICS.descPullUp, marginBottom: -GROUP_METRICS.descPullUnder,
      padding: '0 7px 0 ' + (7 + (indent || 0)) + 'px',
      cursor: 'inherit',
      fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-tight)',
    }}>
      <InlineText value={text || ''} placeholder={placeholder} multiline={multiline}
        /* A READ-ONLY DESCRIPTION DOES NOT OPEN (2026-09-06, found by the app's OB-110 port;
           OB-160). This passed `editMode` alone, so a card rendered without `onDescribe` opened a
           description it could not commit and then called an undefined handler on save. The row's
           own first line already refuses to draw with neither handler nor text — this is the same
           condition applied to the field. */
        editing={editMode && !!onCommit}
        autoFocus={false}
        /* an empty commit is meaningful here and only here: it clears the line back to its
           invitation. A description is optional both ways. */
        onCommit={(v) => { if (v !== (text || '')) onCommit(v) }}
        onCancel={onCancel}
        style={{
          display: 'inline-block', maxWidth: '100%',
          fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)',
          lineHeight: 'var(--lh-tight)',
          color: text ? 'var(--text-2)' : 'var(--text-3)',
          /* italic is the mark of a thing that is not there yet, so it goes the moment there
             is something to read — including while an empty line is being typed into */
          fontStyle: text ? 'normal' : 'italic',
          cursor: 'default',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          opacity: shown ? 1 : 0,
          transition: 'opacity var(--dur-fade) var(--ease-soft)',
        }}
        editStyle={{ color: 'var(--text-1)', fontStyle: 'normal', width: '100%' }} />
    </div>
  )
}

export const GROUP_METRICS = {
  padX: 8, padTop: 8, padBottom: 12, rowGap: 4,       /* --space-2 / --space-3 / --space-1 */
  headPadLeft: 7, headPadRight: 2, headMinH: 22, titleMinW: 96,
  bodyLine: 17.55,                                     /* --fs-body 13 × --lh-snug 1.35 */
  
  microLine: 14.85,                                    /* --fs-micro 11 × 1.35 */
  titleClampOpen: 2, titleClampFolded: 3, versionClamp: 2,
  descPadY: 0, descPadX: 7,
  
  descLine: 13.8,                                      /* --fs-caption 12 × --lh-tight 1.15 */
  descPullUp: 4, descPullUnder: 2,
  
  pickerMinH: 28, pickerPadY: 10, pickerPadX: 13,       /* --hit-min; 5+5; 7+6 */
  
  pickerMarkLine: 18,
  pickerCheck: 12, pickerCaret: 16, pickerGap: 6,
  narrowAt: 250, ctlCluster: 37, ctlCluster3: 55,      /* two 18px buttons + 1px; three when closable */
  foldPadTop: 8, foldPadX: 8, foldPadBottom: 9, foldPeekX: 4, foldPeekY: 4,
  railIndent: 13, railPadLeft: 10, bodyPadTop: 6, bodyPadRight: 8,
  
  railStroke: 1.5,
  /* the folded card's CONTENT floor — the `foldedMinWidth` prop's default, in the table so a
     caller reserving a fold and the component drawing one cannot disagree about it */
  foldedMinWidth: 190,
  
  emptySlotMin: 34,
  
  bodyMaxHeight: 260,
}

/* MOVED 2026-09-17 to `chrome/Pane.jsx`, where scrollers live, and re-exported here so every
   existing reader (this file's `slotInsets`, the group card, the app's own port) keeps the name
   it already uses. ONE implementation, two names for it — the measurement is a fact about
   scrolling boxes, and `Pane` is the component that owns those. */
export { scrollbarWidth }

export function slotInsets(scrolls) {
  const M = GROUP_METRICS
  const edge = hairline()
  const left = edge + M.padX + M.railIndent + M.railStroke + M.railPadLeft
  const right = M.bodyPadRight + M.padX + edge + (scrolls ? scrollbarWidth() : 0)
  return { left: left, right: right, axisOffset: (left - right) / 2 }
}

/** the 1px case of `NodeChip.usedStroke()` — the only authored weight in the card, published
 *  under its own name because that is what every caller of this file's geometry asks for. */
export function hairline() { return usedStroke(1) }

function titleColumn(width, spec, folded) {
  const M = GROUP_METRICS
  const shellPad = folded ? M.foldPadX * 2 : M.padX * 2
  
  const edges = hairline() * 2
  /* the peek's strip is reserved in both states, so it comes off the column in both:
     the name's room is one number, and folding does not change it */
  let col = width - edges - M.foldPeekX - shellPad - M.headPadLeft - M.headPadRight
  /* `dotted()` here as well as in `groupSpec`: a board building a spec by hand is measuring what
     the head DRAWS, and the head adds the dot. Idempotent on an already-dotted string. */
  if (spec.index) col -= measure(dotted(spec.index), 500, 12, 'mono') + M.pickerGap - 2
  /* ONE RIGHT-HAND SLOT, NOT TWO (2026-09-18). The tally and the receding controls occupy the
     same space: the figure is what is there at rest, the buttons take it over while the card is
     live. So the column loses the WIDER of the two and one gap, never both plus two gaps — which
     is also why the empty strip beside the tally is gone: there is nothing left to reserve. */
  const cluster = spec.closable ? M.ctlCluster3 : M.ctlCluster
  const narrow = spec.narrow === undefined ? width < M.narrowAt : spec.narrow
  const tallyW = narrow ? 0
    : measure((spec.count === undefined ? 0 : spec.count) + ' ' + (spec.countLabel || 'nodes'), 400, 11, 'ui')
  col -= Math.max(cluster, tallyW) + M.pickerGap
  return { col: Math.max(M.titleMinW, col), narrow: narrow }
}

export function headHeight(spec) {
  const s = spec || {}
  const M = GROUP_METRICS
  const width = s.width || 300
  const c = titleColumn(width, s, false)
  const titleLines = Math.max(1, linesOf(s.title || s.titlePlaceholder || 'untitled', c.col, 700, 13, 'display', M.titleClampOpen))
  const hair = hairline()
  let h = hair + M.padTop + Math.max(M.headMinH, titleLines * M.bodyLine)
  if (c.narrow) h += M.rowGap + M.microLine
  
  const describable = s.describable === undefined ? true : !!s.describable
  const descText = s.description
    || (describable ? (s.descPlaceholder === undefined ? 'enter description' : s.descPlaceholder) : '')
  if (s.description || describable) {
    
    const dIndent = s.index ? measure(dotted(s.index), 500, 12, 'mono') + M.pickerGap - 2 : 0
    const dcol = width - hair * 2 - M.padX * 2 - M.descPadX * 2 - dIndent
    /* at least one line: an empty editable row is one line tall, and `linesOf('')` is 0 */
    const dLines = Math.max(1, linesOf(descText, dcol, 400, 12, 'ui', 0))
    h += M.rowGap - M.descPullUp + M.descPadY * 2 + dLines * M.descLine - M.descPullUnder
  }
  
  let pcol = width - hair * 4 - M.padX * 2 - M.pickerPadX - M.pickerCheck - M.pickerCaret - M.pickerGap * 3
  if (s.versionLabel) pcol -= measure(s.versionLabel, 500, 11, 'mono')
  const vLines = Math.max(1, linesOf(s.versionName || s.versionNamePlaceholder || 'untitled', pcol, 600, 13, 'ui', M.versionClamp))
  /* the row is border-box, so its 1px edge is inside the --hit-min floor and on top of
     its own padding — and its content is the taller of the text and the 18px marks */
  h += M.rowGap + Math.max(M.pickerMinH, hair * 2 + M.pickerPadY + Math.max(M.pickerMarkLine, vLines * M.bodyLine))
  return { height: Math.round(h * 100) / 100, narrow: c.narrow, titleLines: titleLines, versionLines: vLines, measured: canMeasure() }
}

export function openHeight(spec) {
  const head = headHeight(spec)
  const s = spec || {}
  const M = GROUP_METRICS
  const told = s.bodyHeight === undefined ? null : s.bodyHeight
  const asked = s.slotHeight === undefined ? 0 : s.slotHeight
  
  const ceiling = s.bodyMaxHeight === undefined ? M.bodyMaxHeight
    : typeof s.bodyMaxHeight === 'number' ? s.bodyMaxHeight : null
  
  const wants = told === null ? asked : told
  
  const wellBox = told !== null ? told
    : asked > 0 ? Math.min(M.bodyPadTop + asked, ceiling === null ? Infinity : ceiling)
    : 0
  const capped = told === null && asked > 0 && ceiling !== null && M.bodyPadTop + asked > ceiling
  
  const lead = wellBox > 0 ? M.rowGap + M.bodyPadTop : 0
  const bodyTop = Math.round((head.height + lead) * 100) / 100
  return {
    ...head,
    bodyTop: bodyTop,
    bodyBox: Math.round(wellBox * 100) / 100,
    bodyScrolls: capped,
    height: Math.round((head.height + (wellBox > 0 ? M.rowGap : 0) + wellBox + M.padBottom + hairline()) * 100) / 100,
  }
}

export function foldedSize(spec) {
  const s = spec || {}
  const M = GROUP_METRICS
  const width = Math.max(s.width || 190, s.foldedMinWidth || 190)
  const c = titleColumn(width, s, true)
  const titleLines = Math.max(1, linesOf(s.title || s.titlePlaceholder || 'untitled', c.col, 700, 13, 'display', M.titleClampFolded))
  const tally = M.rowGap + M.microLine
  const h = M.foldPadTop + Math.max(M.headMinH, titleLines * M.bodyLine)
    + (c.narrow ? tally : 0) + M.foldPadBottom + M.foldPeekY + hairline() * 2
  return { width: width + M.foldPeekX, height: Math.round(h * 100) / 100, titleLines: titleLines, narrow: c.narrow, measured: canMeasure() }
}

export function groupSpec(props) {
  const p = props || {}
  const vs = p.versions || []
  const live = vs.find((v) => v.id === p.activeId) || vs[0] || {}
  const spec = {
    width: p.width, index: drawnIndex(p.index, p.numberScope), title: p.title, titlePlaceholder: p.titlePlaceholder,
    description: p.description, descPlaceholder: p.descPlaceholder,
    /* the spec's half of `onDescribe`: an editable card draws an empty row, a read-only
       undescribed one draws none, and that is the whole condition */
    describable: p.describable === undefined ? !!p.onDescribe : !!p.describable,
    versionName: live.name, versionLabel: live.label, versionNamePlaceholder: p.versionNamePlaceholder,
    count: p.count === undefined ? vs.length : p.count, countLabel: p.countLabel,
    closable: !!p.onClose,
  }
  if (p.narrow !== undefined) spec.narrow = p.narrow
  if (p.foldedMinWidth !== undefined) spec.foldedMinWidth = p.foldedMinWidth
  /* TOLD BEATS ASKED, exactly as it does in the component: `bodyHeight` is a height the caller
     has answered and the well takes it as a `height`, so the ceiling has nothing to cap. */
  if (p.bodyHeight !== undefined && p.bodyHeight !== null) spec.bodyHeight = p.bodyHeight
  else if (p.slotHeight !== undefined) spec.slotHeight = p.slotHeight
  if (p.bodyMaxHeight !== undefined) spec.bodyMaxHeight = typeof p.bodyMaxHeight === 'number' ? p.bodyMaxHeight : null
  return spec
}

export function groupSizeOf(props) {
  const p = props || {}
  const folded = p.folded === undefined ? !!p.defaultFolded : !!p.folded
  const spec = groupSpec(props)
  return folded ? foldedSize(spec) : openHeight(spec)
}

/** Reachable from the DS window namespace, where a bare lowercase export is not. */
export const GroupGeometry = { GROUP_METRICS, headHeight, openHeight, foldedSize, hairline, scrollbarWidth, slotInsets, groupSpec, groupSizeOf, fontsReady }

export function VersionedGroup({
  title, titlePlaceholder = 'untitled', index, description, versions = [], activeId,
  folded, defaultFolded = false, count, addLabel = 'add new version', defaultOpen = false,
  descPlaceholder = 'enter description', versionNamePlaceholder = 'untitled',
  emptyLabel = 'no nodes in this version \u2014 drag one in', numberSteps = true, countLabel = 'nodes',
  onReorderNodes,
  maxWidth = 300, bodyMaxHeight = GROUP_METRICS.bodyMaxHeight, menuMaxHeight = 240,
  foldedMinWidth = GROUP_METRICS.foldedMinWidth,
  resizable = true, minWidth = 200, resizeMaxWidth = 680, minBodyHeight = 72, onResize,
  width, bodyHeight, offset, narrow, menuPortal,
  movable = true, onMove, onDeleteVersion, ungroupConfirmLabel, ungroupBlockedLabel, confirmDelete = true,
  bodySlot = false, slotHeight, onBodySlot, depth: depthProp,
  selected, defaultSelected = false, onSelectedChange, numberScope = 'local',
  editMode: editModeProp, defaultEditMode = false, onEditModeChange,
  onRetitle, onDescribe, onSelect, onRename, onAddVersion, onToggleFold, onClose, children,
}) {
  const ctxDepth = React.useContext(Depth)
  /* the prop wins when given: a board's nested card has no ancestor to count. */
  const depth = depthProp == null ? ctxDepth : depthProp
  const shownIndex = drawnIndex(index, numberScope)
  const [open, setOpen] = React.useState(defaultOpen)
  const [ownEditMode, setOwnEditMode] = React.useState(!!defaultEditMode)
  const editMode = editModeProp === undefined ? ownEditMode : editModeProp
  /* ONE SWITCH, THREE FIELDS. The pencil replaces click-any-line-to-edit-that-line: title,
     description and the live version's name all turn editable together, and stay that way
     until the pencil is clicked again, the pointer lands outside the card, or Escape is hit.
     Escape discards all three (nothing committed since the last blur); the other two exits
     commit, because focus leaving a field already fires its own onBlur commit — by the time
     the pencil or an outside click is seen, whichever field had focus has already saved. */
  const setEditMode = (next) => {
    setOwnEditMode((prev) => {
      const v = typeof next === 'function' ? next(editModeProp === undefined ? prev : editModeProp) : next
      if (onEditModeChange) onEditModeChange(v)
      return v
    })
  }
  const [ownFold, setOwnFold] = React.useState(defaultFolded)
  const [hot, setHot] = React.useState(null)
  const [ownSize, setOwnSize] = React.useState(null) // {w, h} once the user has dragged
  const [ownPos, setOwnPos] = React.useState(null)   // {x, y} offset once the user has moved it
  const [carrying, setCarrying] = React.useState(false)
  
  const [ownSel, setOwnSel] = React.useState(!!defaultSelected)
  const [sizing, setSizing] = React.useState(false)
  /* a drag is not a click: the gesture starts on the same surface selection is picked
     from, so a pointerup that moved must not toggle anything */
  const dragged = React.useRef(false)
  const shell = React.useRef(null)
  const body = React.useRef(null)
  const slot = React.useRef(null)
  const pickerRef = React.useRef(null)
  const menuRef = React.useRef(null)
  const refusalRef = React.useRef(null)
  const [anchor, setAnchor] = React.useState(null)
  
  const [live, setLive] = React.useState(false)
  
  const [ownNarrow, setOwnNarrow] = React.useState(false)
  const [refusal, setRefusal] = React.useState(null)
  const [refusalAt, setRefusalAt] = React.useState(null)
  
  const [confirming, setConfirming] = React.useState(null)
  const isFolded = folded === undefined ? ownFold : folded
  
  const at = offset === undefined || carrying ? ownPos : offset
  const curW = width === undefined || sizing ? (ownSize && ownSize.w) || null : width
  const curH = bodyHeight === undefined || sizing ? (ownSize && ownSize.h) || null : bodyHeight
  const isNarrow = narrow === undefined ? ownNarrow : narrow
  
  /* ONE OBSERVER ON THE SHELL reads both of the things the shell's width decides: `shellW`
     (border-box, for the title column) and, unless the host TOLD us, `ownNarrow` (content-box
     under 250). They were two observers on the same element until 2026-09-02 — three per card,
     sixty on a twenty-card board. A told `narrow` is never measured: a caller that predicts
     this head's height before it renders cannot also be waiting on it to measure itself. */
  const [shellW, setShellW] = React.useState(0)
  React.useEffect(() => {
    const el = shell.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const readW = () => setShellW(Math.round(el.getBoundingClientRect().width))
    readW()
    const ro = new ResizeObserver((entries) => {
      readW()
      const box = narrow === undefined && entries[0] && entries[0].contentRect
      if (box) setOwnNarrow(box.width < 250)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [narrow])
  
  
  const verRO = React.useRef(null)
  const [verCol, setVerCol] = React.useState(0)
  const verBox = React.useCallback((el) => {
    if (verRO.current) { verRO.current.disconnect(); verRO.current = null }
    if (!el) return
    const read = () => setVerCol(Math.round(el.getBoundingClientRect().width))
    read()
    if (typeof ResizeObserver === 'undefined') return
    verRO.current = new ResizeObserver(read)
    verRO.current.observe(el)
  }, [])
  const titleBox = React.useRef(null)
  const [titleCol, setTitleCol] = React.useState(0)
  const colKey = title + '|' + shellW + '|' + (isFolded ? 'f' : 'o') + '|' + (isNarrow ? 'n' : 'w')
  const colKeyRef = React.useRef(null)
  React.useLayoutEffect(() => {
    const el = titleBox.current
    if (!el) return
    
    if (colKeyRef.current !== colKey) {
      colKeyRef.current = colKey
      if (titleCol !== 0) { setTitleCol(0); return }
    }
    /* `titleCol === 0` means the FULL string is on screen, which is the only state this may be
       measured in — see the note above the ref. */
    if (titleCol === 0) {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setTitleCol(w)
    }
  }, [colKey, titleCol])
  const isSel = selected === undefined ? ownSel : selected
  const toggleSel = () => {
    const next = !isSel
    if (selected === undefined) setOwnSel(next)
    if (onSelectedChange) onSelectedChange(next)
  }
  
  const chromeClick = (e) => {
    const el = e.target
    if (!(el && el.hasAttribute && el.hasAttribute('data-grab'))) return
    if (dragged.current) { dragged.current = false; return }
    toggleSel()
  }
  const active = versions.find((v) => v.id === activeId) || versions[0] || { id: null, name: 'untitled' }
  const kids = React.Children.toArray(children).filter(Boolean)
  const tally = count === undefined ? kids.length : count
  


  // one clock for everything that recedes, owned by IconButton.jsx
  React.useEffect(() => subscribePresence(shell.current, setLive), [])

  React.useEffect(() => {
    if (!open) return undefined
    const away = (e) => {
      if (shell.current && shell.current.contains(e.target)) return
      /* a portaled menu is not inside the shell, so the shell test alone would
         close it on mousedown and unmount the row before its click landed */
      if (menuRef.current && menuRef.current.contains(e.target)) return
      setOpen(false); setConfirming(null)
    }
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); setConfirming(null) } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key) }
  }, [open])

  /* THE OTHER TWO EXITS FROM EDIT MODE: click outside the card, or Escape from anywhere in
     it that isn't itself inside one of the three fields (their own onCancel covers that
     case and discards the same way). A portaled version menu is exempt for the same reason
     the picker's own away-listener exempts it.
     Outside click must COMMIT, not discard: a mousedown on a non-focusable outside element
     changes focus as part of the browser's default action, which runs AFTER this listener
     sees the event — so setEditMode(false) here used to fire and unmount the field before
     its own onBlur commit ever ran, silently reverting whatever was typed. Blurring the
     active element ourselves, first, fires that onBlur commit synchronously and in order,
     before edit mode closes. */
  React.useEffect(() => {
    if (!editMode) return undefined
    const away = (e) => {
      if (shell.current && shell.current.contains(e.target)) return
      if (menuRef.current && menuRef.current.contains(e.target)) return
      if (document.activeElement && shell.current && shell.current.contains(document.activeElement)) {
        document.activeElement.blur()
      }
      setEditMode(false)
    }
    const key = (e) => { if (e.key === 'Escape') setEditMode(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', key) }
  }, [editMode])

  
  React.useEffect(() => {
    if (!bodySlot || !onBodySlot) return undefined
    
    if (isFolded) {
      onBodySlot({ left: 0, top: 0, width: 0, height: 0, zIndex: SHELL_Z + 1, depth: depth + 1, visible: false })
      return undefined
    }
    const el = slot.current
    const sh = shell.current
    if (!el || !sh) return undefined
    const report = () => {
      const a = el.getBoundingClientRect()
      const b = sh.getBoundingClientRect()
      onBodySlot({
        left: Math.round(a.left - b.left), top: Math.round(a.top - b.top),
        width: Math.round(a.width), height: Math.round(a.height),
        
        zIndex: SHELL_Z + 1,
        
        depth: depth + 1,
        visible: true,
      })
    }
    report()
    const raf = requestAnimationFrame(report)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(report) : null
    if (ro) { ro.observe(el); ro.observe(sh) }
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect() }
  }, [bodySlot, onBodySlot, isFolded, curW, curH, isNarrow, slotHeight, depth])

  const fold = () => { setOpen(false); if (folded === undefined) setOwnFold((f) => !f); if (onToggleFold) onToggleFold(!isFolded) }

  
  const askUngroup = () => {
    if (versions.length > 1) {
      setRefusal({
        confirm: true,
        
        text: ungroupConfirmLabel || ungroupBlockedLabel || ('This node has ' + versions.length
          + ' versions currently. Confirm ungrouping of this node and deleting the unselected versions?'),
      })
      return
    }
    
    if (onClose) onClose({ versionId: active.id, count: kids.length })
  }

  
  React.useEffect(() => {
    if (!refusal) return undefined
    if (refusal.confirm) {
      const key = (e) => { if (e.key === 'Escape') setRefusal(null) }
      document.addEventListener('keydown', key)
      return () => document.removeEventListener('keydown', key)
    }
    const t = setTimeout(() => setRefusal(null), 4500)
    const away = () => setRefusal(null)
    document.addEventListener('pointerdown', away, true)
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', away, true) }
  }, [refusal])

  
  const portalTarget = menuPortal === null ? null
    : menuPortal || (typeof document !== 'undefined' ? document.body : null)
  React.useEffect(() => {
    if (!open || !portalTarget) return undefined
    const place = () => {
      const el = pickerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const room = window.innerHeight - r.bottom - 8
      const cap = typeof menuMaxHeight === 'number' ? menuMaxHeight : 240
      /* flip above the picker when the list would run off the bottom — in the card
         the well's own scroll absorbed that, and at viewport level nothing does */
      const up = room < Math.min(cap, 160) && r.top > room
      const next = {
        left: Math.round(r.left), width: Math.round(r.width), up: up,
        top: up ? undefined : Math.round(r.bottom + 3),
        bottom: up ? Math.round(window.innerHeight - r.top + 3) : undefined,
      }
      
      const node = menuRef.current
      if (node) {
        node.style.left = next.left + 'px'
        node.style.width = next.width + 'px'
        if (next.up) { node.style.top = 'auto'; node.style.bottom = next.bottom + 'px' }
        else { node.style.bottom = 'auto'; node.style.top = next.top + 'px' }
      }
      /* same rect, same object: place() runs from an observer and from three event
         sources, and a fresh object every time would re-render on every scroll tick */
      setAnchor((prev) => (prev && prev.left === next.left && prev.width === next.width
        && prev.top === next.top && prev.bottom === next.bottom && prev.up === next.up) ? prev : next)
    }
    place()
    
    const raf = requestAnimationFrame(place)
    /* and the picker keeps moving after that: this group resizes and is carried
       around, both of which change the rect with no scroll and no window resize */
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (ro && pickerRef.current) ro.observe(pickerRef.current)
    
    const dismiss = (e) => {
      if (menuRef.current && e.target && menuRef.current.contains(e.target)) return
      setOpen(false); setConfirming(null)
    }
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', place)
    }
  }, [open, portalTarget, menuMaxHeight, at, curW, curH, isNarrow])
  const portaled = !!(portalTarget && anchor)

  
  React.useEffect(() => {
    if (!refusal || !portalTarget) return undefined
    const place = () => {
      const el = shell.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const next = { top: Math.round(r.top + 28), right: Math.round(window.innerWidth - r.right + 8) }
      /* pinned in the scroll's own frame, for the reason the menu is */
      const node = refusalRef.current
      if (node) { node.style.top = next.top + 'px'; node.style.right = next.right + 'px' }
      setRefusalAt((prev) => (prev && prev.top === next.top && prev.right === next.right) ? prev : next)
    }
    place()
    const raf = requestAnimationFrame(place)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (ro && shell.current) ro.observe(shell.current)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      if (ro) ro.disconnect()
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [refusal, portalTarget])

  
  const startDrag = (axis) => (e) => {
    e.preventDefault(); e.stopPropagation()
    const box = shell.current && shell.current.getBoundingClientRect()
    if (!box) return
    const bodyBox = body.current && body.current.getBoundingClientRect()
    const from = { x: e.clientX, y: e.clientY, w: box.width, h: curH || (bodyBox && Math.round(bodyBox.height)) || bodyMaxHeight }
    const node = e.currentTarget
    let last = { w: curW || Math.round(box.width), h: from.h }
    /* seed own state from what is on screen NOW, so a controlled group does not
       flash back to automatic between pointerdown and the first move */
    setSizing(true)
    setOwnSize(last)
    try { node.setPointerCapture(e.pointerId) } catch (err) { /* older pointer impls */ }
    const move = (ev) => {
      const w = axis === 'y' ? last.w
        : Math.round(Math.max(minWidth, Math.min(resizeMaxWidth, from.w + (ev.clientX - from.x))))
      const h = axis === 'x' ? last.h
        : Math.round(Math.max(minBodyHeight, from.h + (ev.clientY - from.y)))
      last = { w: w, h: h }
      setOwnSize(last)
    }
    const up = () => {
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', up)
      setSizing(false)
      if (onResize) onResize({ width: last.w, height: last.h })
    }
    node.addEventListener('pointermove', move)
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
  }

  
  const resetAxis = (axis) => (e) => {
    e.preventDefault(); e.stopPropagation()
    if (!curW && !curH) return
    const next = { w: axis === 'y' ? curW : null, h: axis === 'x' ? curH : null }
    setOwnSize(!next.w && !next.h ? null : next)
    if (onResize) onResize({ width: next.w, height: next.h })
  }

  
  const startMove = (e) => {
    if (!movable || e.button !== 0) return
    const el = e.target
    if (!(el && el.hasAttribute && el.hasAttribute('data-grab'))) return
    e.preventDefault()
    const from = { x: e.clientX, y: e.clientY, ox: (at && at.x) || 0, oy: (at && at.y) || 0 }
    let last = { x: from.ox, y: from.oy }
    dragged.current = false
    setCarrying(true)
    
    const move = (ev) => {
      last = { x: Math.round(from.ox + (ev.clientX - from.x)), y: Math.round(from.oy + (ev.clientY - from.y)) }
      /* 3px of slop: a click with a shaking hand is still a click */
      if (Math.abs(ev.clientX - from.x) > 3 || Math.abs(ev.clientY - from.y) > 3) dragged.current = true
      setOwnPos(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setCarrying(false)
      if (onMove) onMove(last)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const edge = (side) => {
    const common = { position: 'absolute', zIndex: 2, background: 'transparent', touchAction: 'none' }
    if (side === 'right') return <span aria-hidden="true" title={wrapTip(RESIZE_TIP)} onPointerDown={startDrag('x')} onDoubleClick={resetAxis('x')} style={{ ...common, top: 14, bottom: 14, right: -3, width: 8, cursor: 'ew-resize' }} />
    if (side === 'bottom') return <span aria-hidden="true" title={wrapTip(RESIZE_TIP)} onPointerDown={startDrag('y')} onDoubleClick={resetAxis('y')} style={{ ...common, left: 14, right: 14, bottom: -3, height: 8, cursor: 'ns-resize' }} />
    return <span aria-hidden="true" title={wrapTip(RESIZE_TIP)} onPointerDown={startDrag('both')} onDoubleClick={resetAxis('both')} style={{ ...common, right: -3, bottom: -3, width: 16, height: 16, cursor: 'nwse-resize' }} />
  }

  
  const word = tally === 1 ? String(countLabel).replace(/s$/, '') : countLabel
  /* one condition for both halves of the shared slot: what brings the buttons out is exactly
     what takes the figure away */
  const ctlShown = live || open || editMode
  const tallyLine = (
    <span title={wrapTip(tally + ' ' + word + ' inside this version')} style={{
      flexShrink: 0, display: 'inline-block', fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-micro)', lineHeight: 'var(--lh-snug)', color: 'var(--text-3)',
      fontWeight: 'var(--fw-regular)',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontVariantNumeric: 'var(--tnum)',
        fontWeight: 'var(--fw-medium)',
      }}>{tally}</span>
      {' ' + word}
    </span>
  )

  
  const headRow = (
    <div data-grab="" style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-15)', minHeight: 22 }}>
      {}
      {shownIndex ? (
        <span style={{
          flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-caption)',
          fontVariantNumeric: 'var(--tnum)', color: 'var(--text-2)', fontWeight: 'var(--fw-medium)',
          marginRight: -2, lineHeight: 'var(--lh-snug)',
        }}>{shownIndex}</span>
      ) : null}
      <span data-grab="" ref={titleBox} style={{
        /* a floor, not a share: the head's fixed furniture is what shrinks when the
           group is narrow, never the name */
        flex: '0 1 auto', minWidth: 96, display: 'block', cursor: 'inherit', marginRight: 2,
      }}>
        {}
        <InlineText value={title || ''}
          
          display={title ? clampToLines(title, isFolded ? GROUP_METRICS.titleClampFolded : GROUP_METRICS.titleClampOpen,
            titleCol, 700, 13, 'display') : undefined}
          placeholder={titlePlaceholder}
          restPlaceholder={''}
          editing={editMode}
          /* an empty commit CLEARS to the placeholder — same rule as description now,
             changed 2026-08-28: refusing it stood in the way of a name simply going empty. */
          onCommit={(v) => { if (v !== title && onRetitle) onRetitle(v) }}
          onCancel={() => setEditMode(false)}
          tooltip={title ? wrapTip(title) : undefined}
          style={{
            
            width: 'fit-content',
            
            maxWidth: '100%', lineHeight: 'var(--lh-snug)',
            display: 'block',
            maxHeight: (isFolded ? GROUP_METRICS.titleClampFolded : GROUP_METRICS.titleClampOpen) * GROUP_METRICS.bodyLine,
            
            whiteSpace: 'normal', overflowWrap: 'anywhere',
            overflow: 'hidden',
            fontFamily: 'var(--font-display)', fontSize: 'var(--fs-body)',
            fontWeight: 'var(--fw-bold)', color: title ? 'var(--text-1)' : 'var(--text-3)',
            /* italic marks the invitation WORD, only visible while editing — at rest an empty
               title draws nothing at all, so there's nothing to style upright or not */
            fontStyle: title ? 'normal' : (editMode ? 'italic' : 'normal'),
            cursor: editMode ? 'text' : 'default',
          }}
          editStyle={{ color: 'var(--text-1)', fontStyle: 'normal' }} />
      </span>
      <span style={{ flex: 1 }} />
      {/* THE SHARED RIGHT SLOT. At rest it holds the tally; the moment the card is live the
         buttons cross-fade into the same place and the figure steps out. Nothing reflows,
         because the slot is the wider of the two and it is reserved in both states — the old
         layout reserved the buttons' strip BESIDE the tally, which is the empty gap the owner
         reported (2026-09-18). The buttons are centred on the tally's own line, so their
         position follows the figure's baseline rather than being nudged off the row's top. */}
      <span style={{
        position: 'relative', flexShrink: 0, display: 'flex', justifyContent: 'flex-end',
        /* narrow, the tally has moved to its own line, so this box has no in-flow content and
           therefore no baseline to align on — it would hang off the row's bottom edge and take
           the buttons with it. Top-align it in that state only. */
        alignSelf: isNarrow ? 'flex-start' : undefined,
        minWidth: onClose ? GROUP_METRICS.ctlCluster3 : GROUP_METRICS.ctlCluster,
        minHeight: GROUP_METRICS.microLine,
      }}>
        <span style={{
          opacity: ctlShown ? 0 : 1, transition: 'opacity var(--dur-fade) var(--ease-soft)',
        }}>{isNarrow ? null : tallyLine}</span>
        <span style={{
          position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', alignItems: 'center', gap: 1, height: 18,
          opacity: ctlShown ? 1 : 0, pointerEvents: ctlShown ? 'auto' : 'none',
          transition: 'opacity var(--dur-fade) var(--ease-soft)',
        }}>
          <IconButton title={editMode ? 'done editing' : 'edit'} glyphSize={10} onClick={() => setEditMode((m) => !m)}
            reachable={live || open || editMode}
            /* ON WEARS THE STATE IT TURNS ON (2026-09-18, owner: "grey is more like
               disabled/not available in our app"). `--state-editing-wash` with the
               `--state-editing` edge is what the title, the description and the version
               name are wearing at that same moment, so the toggle and its effect are one
               colour. Not moss: moss means "this version is live" 30px below, on the
               check. Not a filled pond face either — pond also means SELECTED, and a
               selection is a ring round the whole card, never a disc in the head. */
            style={editMode ? { color: 'var(--state-editing)', background: 'var(--state-editing-wash)', borderColor: 'var(--state-editing)' } : undefined}>
            <EditMark />
          </IconButton>
          <IconButton title={isFolded ? 'maximize' : 'minimize'} glyphSize={12} onClick={fold} reachable={live || open}>{isFolded ? <RestoreMark /> : '\u2013'}</IconButton>
          {onClose ? <IconButton title="ungroup nodes" glyphSize={10} onClick={askUngroup} reachable={live || open} /> : null}
        </span>
      </span>
    </div>
  )

  const menuList = (
    <div role="listbox" ref={menuRef} style={{
      
      ...(portaled ? {
        position: 'fixed', left: anchor.left, width: anchor.width,
        top: anchor.up ? undefined : anchor.top, bottom: anchor.up ? anchor.bottom : undefined,
        zIndex: 60,
      } : {
        position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 30,
      }),
      maxHeight: menuMaxHeight, overflowY: 'auto', overflowX: 'hidden',
      
      boxSizing: 'border-box',
      padding: 'var(--space-1)', borderRadius: 'var(--radius-md)',
      background: 'var(--surface-raised)', border: '1px solid var(--border-rule)', boxShadow: 'var(--lift-2)',
    }}>
      {versions.map((v) => (
        <VersionRow key={v.id} version={v} on={v.id === active.id} namePlaceholder={versionNamePlaceholder}
          onPick={() => { setOpen(false); if (onSelect) onSelect(v.id) }}
          confirming={confirming === v.id}
          onCancel={() => setConfirming(null)}
          onDelete={onDeleteVersion && versions.length > 1 ? () => {
            if (confirmDelete && confirming !== v.id) { setConfirming(v.id); return }
            setConfirming(null)
            onDeleteVersion(v.id)
          } : undefined} />
      ))}
      <div style={{ height: 1, background: 'var(--border-hair)', margin: '4px 6px' }} />
      <AddRow label={addLabel} onClick={() => { setOpen(false); if (onAddVersion) onAddVersion(); setEditMode(true) }} />
    </div>
  )

  const picker = (
    <div style={{ position: 'relative' }}>
      <div
        ref={pickerRef}
        role="button" tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o) } }}
        onMouseEnter={() => setHot('picker')} onMouseLeave={() => setHot(null)}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--space-15)', minHeight: 'var(--hit-min)',
          
          fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)',
          padding: '5px 6px 5px 7px', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box',
          border: '1px solid ' + (hot === 'picker' ? 'var(--border-rule)' : 'transparent'),
          background: hot === 'picker' ? 'var(--surface-sunken-2)' : 'transparent',
          cursor: 'pointer', transition: 'var(--transition-wash)',
        }}>
        <span style={{ width: 12, display: 'grid', placeItems: 'center', flexShrink: 0, height: 18, color: 'var(--accent-primary-ink)' }}>
          <Check />
        </span>
        {active.label ? (
          <span style={{
            flexShrink: 0, lineHeight: '18px',
            fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)',
            fontVariantNumeric: 'var(--tnum)', color: 'var(--accent-primary-ink)', fontWeight: 'var(--fw-medium)',
          }}>{active.label}</span>
        ) : null}
        <span ref={verBox} style={{ flex: 1, minWidth: 0, display: 'block', cursor: 'inherit' }}>
          {/* the live version's name, edited in place like the other two. It wraps to two lines,
              so the single-line field it used to open had the same collapse the title's did. */}
          <InlineText value={active.name || ''}
            /* KEYED BY THE VERSION (2026-09-06, found by the app's OB-110 port; OB-160). The field
               seeds itself ONCE, at the transition into editing, so with edit mode open a version
               picked from the list left the PREVIOUS version's name in the field — and committing
               then wrote that name onto the newly-picked version. The key remounts the field, which
               is what "the field belongs to the version now showing" has to mean; the effect's deps
               cannot express it, because the version changed without `editing` changing. */
            key={active.id}
            
            display={active.name ? clampToLines(active.name, GROUP_METRICS.versionClamp, verCol, 600, 13, 'ui') : undefined}
            placeholder={versionNamePlaceholder}
            restPlaceholder={''}
            editing={editMode}
            autoFocus={false}
            /* an empty commit CLEARS to the placeholder, same as title — see its comment */
            onCommit={(v) => { if (v !== active.name && onRename) onRename(active.id, v) }}
            onCancel={() => setEditMode(false)}
            tooltip={active.name ? wrapTip(active.name) : undefined}
            style={{
              width: 'fit-content',
              
              maxWidth: '100%', display: 'block',
              maxHeight: GROUP_METRICS.versionClamp * GROUP_METRICS.bodyLine,
              overflow: 'hidden', whiteSpace: 'normal',
              overflowWrap: 'anywhere', lineHeight: 'var(--lh-snug)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)',
              fontWeight: 'var(--fw-semibold)', color: active.name ? 'var(--accent-primary-ink)' : 'var(--text-3)',
              fontStyle: active.name ? 'normal' : (editMode ? 'italic' : 'normal'),
              cursor: editMode ? 'text' : 'default',
            }}
            editStyle={{ color: 'var(--accent-primary-ink)', fontStyle: 'normal' }} />
        </span>
        <span style={{
          width: 16, height: 16, flexShrink: 0, display: 'grid', placeItems: 'center', marginTop: 1,
          color: open ? 'var(--text-2)' : 'var(--text-3)',
          transition: 'color var(--dur-hover) var(--ease-soft)',
        }}><Caret open={open} /></span>
      </div>
      {open ? (portalTarget ? portalInto(portalTarget, menuList) : menuList) : null}
    </div>
  )

  const portaledRefusal = !!(portalTarget && refusalAt)
  const refusalPanel = refusal ? (
    <div role={refusal.confirm ? 'dialog' : 'status'} ref={refusalRef} style={{
      ...(portaledRefusal
        ? { position: 'fixed', top: refusalAt.top, right: refusalAt.right, zIndex: 60 }
        : { position: 'absolute', top: 28, right: 8, zIndex: 45 }),
      maxWidth: 232,
      padding: '9px 11px', borderRadius: 'var(--radius-md)',
      background: 'var(--surface-raised)', border: '1px solid var(--border-rule)',
      boxShadow: 'var(--lift-2)', fontFamily: 'var(--font-ui)',
      fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-snug)', color: 'var(--text-2)',
    }}>
      <div>{refusal.text || refusal}</div>
      {refusal.confirm ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)', marginTop: 'var(--space-15)' }}>
          <ConfirmButton label="keep" onClick={() => setRefusal(null)} />
          <ConfirmButton label="ungroup" danger onClick={() => {
            setRefusal(null)
            if (onClose) onClose({ versionId: active.id, count: kids.length })
          }} />
        </div>
      ) : null}
    </div>
  ) : null

  const desc = (
    <DescLine text={description} placeholder={descPlaceholder} editMode={editMode}
      
      multiline
      
      indent={shownIndex ? measure(shownIndex, 500, 12, 'mono') + GROUP_METRICS.pickerGap - 2 : 0}
      onCommit={onDescribe ? (v) => onDescribe(v) : undefined}
      onCancel={() => setEditMode(false)} />
  )

  

  return (
    <Depth.Provider value={depth + 1}>
    <div ref={shell} style={{
      position: 'relative',
      width: curW || undefined,
      maxWidth: curW ? undefined : maxWidth,
      minWidth: isFolded ? foldedMinWidth : undefined,
      
      paddingRight: GROUP_METRICS.foldPeekX,
      paddingBottom: isFolded || depth > 0 ? GROUP_METRICS.foldPeekY : undefined,
      transform: at ? 'translate(' + at.x + 'px, ' + at.y + 'px)' : undefined,
      zIndex: carrying ? 40 : undefined,
    }}>
      {}
      {isFolded || depth > 0 ? (
        <div aria-hidden="true" style={{
          position: 'absolute', inset: '4px 0 0 4px', borderRadius: 'var(--radius-lg)',
          background: depth % 2 ? 'var(--surface-sunken-2)' : 'var(--surface-sunken)', zIndex: 0,
        }} />
      ) : null}
      <div data-grab="" onPointerDown={startMove} onClick={chromeClick} style={{
        position: 'relative', zIndex: 1, borderRadius: 'var(--radius-lg)', boxSizing: 'border-box',
        /* the horizontal padding is --space-2 in BOTH states, so the head row is the
           same width either way; only the vertical padding differs, which the title
           does not wrap against */
        padding: isFolded ? '8px var(--space-2) 9px' : 'var(--space-2) var(--space-2) var(--space-3)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-rule)',
        
        boxShadow: carrying ? 'var(--lift-drag)' : 'var(--lift-group)',
        
        outline: isSel ? 'var(--stroke-ring) solid var(--state-selected)' : undefined,
        
        outlineOffset: isSel ? 2 : undefined,
        
        
        cursor: movable ? 'move' : 'inherit',
        userSelect: 'none', WebkitUserSelect: 'none',
        transition: carrying ? 'none' : 'var(--transition-wash)',
      }}>
        {refusal ? (portaledRefusal ? portalInto(portalTarget, refusalPanel) : refusalPanel) : null}
        {/* folded, only the WIDTH edge exists: a folded group has no body to make
            taller, and the height it does have is its own title wrapping. */}
        {resizable ? edge('right') : null}
        {isFolded || !resizable ? null : edge('bottom')}
        {isFolded || !resizable ? null : edge('corner')}
        <div data-grab="" style={{ padding: '0 2px 0 7px' }}>{headRow}</div>
        {isNarrow ? <div data-grab="" style={{ padding: '0 2px 0 7px' }}>{tallyLine}</div> : null}
        {isFolded ? null : desc}
        {isFolded ? null : picker}
        {}
        {isFolded ? null : (
          <div ref={body} data-grab="" style={{
            marginLeft: GROUP_METRICS.railIndent, paddingLeft: GROUP_METRICS.railPadLeft,
            borderLeft: GROUP_METRICS.railStroke + 'px solid var(--bark-300)',
            display: 'flex', flexDirection: 'column',
            
            ...(curH ? { height: curH, minHeight: 0 } : { maxHeight: bodyMaxHeight }),
            overflowY: 'auto', overflowX: 'hidden',
          }}>
            {bodySlot ? (
              
              <div data-grab="" style={{
                display: 'flex', flexDirection: 'column', minHeight: 0,
                flex: curH ? 1 : '0 0 auto',
                
                paddingTop: 'var(--space-15)', paddingRight: 'var(--space-2)',
              }}>
              {}
              <div ref={slot} data-grab="" style={{
                position: 'relative', flex: curH ? 1 : '0 0 auto',
                minHeight: curH ? 0 : (slotHeight || 0),
              }}>
                {tally === 0 ? (
                  <div data-grab="" style={{
                    height: '100%', minHeight: GROUP_METRICS.emptySlotMin, display: 'grid', placeItems: 'center',
                    padding: '11px 12px', borderRadius: 'var(--radius-md)',
                    border: '1.5px dashed var(--border-dashed)', background: 'transparent',
                    fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)',
                    lineHeight: 'var(--lh-snug)', color: 'var(--text-3)', textAlign: 'center',
                  }}>{emptyLabel}</div>
                ) : kids}
              </div>
              </div>
            ) : kids.length === 0 ? (
              
              <div data-grab="" style={{
                flex: curH ? 1 : '0 0 auto', minHeight: 0,
                marginTop: 'var(--space-15)', marginRight: 'var(--space-2)',
                display: 'grid', placeItems: 'center',
                padding: '11px 12px', borderRadius: 'var(--radius-md)',
                border: '1.5px dashed var(--border-dashed)', background: 'transparent',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)',
                lineHeight: 'var(--lh-snug)', color: 'var(--text-3)', textAlign: 'center',
              }}>{emptyLabel}</div>
            ) : (
              <div data-grab="" style={{ paddingTop: 'var(--space-15)', paddingRight: 'var(--space-2)' }}>
                {}
                <NodeChain number={numberSteps} prefix={numberScope === 'path' ? shownIndex : ''} onReorder={onReorderNodes}>
                  {kids}
                </NodeChain>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </Depth.Provider>
  )
}

function VersionRow({ version, on, onPick, onDelete, confirming, onCancel, namePlaceholder }) {
  const shownName = version.name || namePlaceholder
  const clip = useClipped(shownName)
  /* TWO CLOCKS, BECAUSE THERE ARE TWO THINGS HERE AND THEY WANT OPPOSITE THINGS (2026-09-17).
     The WASH is a cursor: instant in both directions, or it lingers behind the pointer running
     down the list. The ✕ is a receding control: it waits out the shared grace period
     (`window.PKT_SB.LEAVE` via `useRecede`) so it never vanishes under the cursor's heels and so
     keyboard focus can hand off to it. One `hot` state drove BOTH, so the row stayed washed for
     the full 500ms after the pointer left — the delay the owner reported the day after the CSS
     transition was removed from this row. The transition was never the big half. */
  const [hot, setHot] = React.useState(false)
  const [revealed, revealShow, revealHide] = useRecede()
  const show = () => { setHot(true); revealShow() }
  const hide = () => { setHot(false); revealHide() }
  return (
    
    <div style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={show} onMouseLeave={hide}
      onFocus={show} onBlur={hide}>
    {confirming ? (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-15)', width: '100%',
        minHeight: 'var(--hit-min)', padding: '4px 6px 4px 8px', boxSizing: 'border-box',
        borderRadius: 'var(--radius-sm)', background: 'var(--state-danger-wash)',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-2)',
      }}>
        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>delete this version?</span>
        <ConfirmButton label="keep" onClick={onCancel} />
        <ConfirmButton label="delete" danger onClick={onDelete} />
      </div>
    ) : (
    <React.Fragment>
    <button type="button" role="option" aria-selected={on} onClick={onPick}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-15)', width: '100%',
        minHeight: 'var(--hit-min)', padding: '4px 8px', textAlign: 'left', boxSizing: 'border-box',
        borderRadius: 'var(--radius-sm)', border: '1px solid ' + (hot ? 'var(--border-rule)' : 'transparent'),
        background: hot ? 'var(--surface-hover-raised)' : 'transparent',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)',
        fontWeight: on ? 'var(--fw-semibold)' : 'var(--fw-medium)',
        color: on ? 'var(--accent-primary-ink)' : 'var(--text-1)',
        /* A MENU ROW'S WASH DOES NOT ANIMATE (2026-09-16, owner, on this list). The highlight in
           an open list is a cursor, not a state change: on --transition-wash it lingered 140ms
           behind the pointer. See --transition-wash-tracking in tokens/motion.css for why it is
           instant in BOTH directions. */
        cursor: 'pointer', transition: 'var(--transition-wash-tracking)',
      }}>
      <span style={{ width: 12, display: 'grid', placeItems: 'center', flexShrink: 0, color: 'var(--accent-primary-ink)' }}>
        {on ? <Check /> : <Bullet on={false} slot={0} />}
      </span>
      {version.label ? (
        <span style={{
          flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-micro)',
          fontVariantNumeric: 'var(--tnum)', color: on ? 'var(--accent-primary-ink)' : 'var(--text-2)',
        }}>{version.label}</span>
      ) : null}
      {}
      <span {...clip} style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: onDelete ? 16 : 0, fontStyle: version.name ? 'normal' : 'italic', color: version.name ? undefined : 'var(--text-3)' }}>{shownName}</span>
    </button>
    {}
    {onDelete ? (
      <IconButton tone="danger" title="delete this version" label="delete this version"
        reveal={revealed} onClick={onDelete}
        style={{ position: 'absolute', top: 5, right: 5 }} />
    ) : null}
    </React.Fragment>
    )}
    </div>
  )
}

function ConfirmButton({ label, danger, onClick }) {
  const [hot, setHot] = React.useState(false)
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{
        flexShrink: 0, padding: '3px 9px', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box',
        border: '1px solid ' + (hot ? (danger ? 'var(--state-danger)' : 'var(--border-rule)') : 'transparent'),
        background: hot ? (danger ? 'var(--berry-100)' : 'var(--surface-hover)') : 'transparent',
        color: danger ? 'var(--berry-600)' : 'var(--text-2)',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)',
        fontWeight: danger ? 'var(--fw-semibold)' : 'var(--fw-medium)',
        cursor: 'pointer', transition: 'var(--transition-wash)',
      }}>{label}</button>
  )
}

function AddRow({ label, onClick }) {
  const [hot, setHot] = React.useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-15)', width: '100%',
        minHeight: 'var(--hit-min)', padding: '4px 8px', textAlign: 'left', boxSizing: 'border-box',
        borderRadius: 'var(--radius-sm)', border: '1px solid ' + (hot ? 'var(--border-rule)' : 'transparent'),
        background: hot ? 'var(--surface-hover-raised)' : 'transparent',
        color: hot ? 'var(--text-1)' : 'var(--text-2)',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-medium)',
        /* same list, same rule: --transition-wash-tracking, never --transition-wash */
        fontStyle: 'italic', cursor: 'pointer', transition: 'var(--transition-wash-tracking)',
      }}>
      <span aria-hidden="true" style={{
        width: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
        
        fontSize: 13, lineHeight: 1, fontStyle: 'normal',
      }}>+</span>
      {label}
    </button>
  )
}

VersionedGroup.joinBorder = 1
