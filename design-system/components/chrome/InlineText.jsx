import React from 'react'
import { wrapTip } from './IconButton.jsx'

function caretAt(el, point) {
  const sel = window.getSelection()
  if (!sel) return
  let range = null
  if (point) {
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(point.x, point.y)
    } else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(point.x, point.y)
      if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset) }
    }
    if (range && !el.contains(range.startContainer)) range = null
  }
  if (range) { range.collapse(true) } else {
    range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

/** THE FIELD, NOT JUST THE EDGE. An outline in `--state-editing` (never a border — it
 *  paints outside the box without joining the layout, so the edge cannot move the row
 *  and has no used border width to cancel) plus a full wash behind the text: an outline
 *  alone read as "this line happens to have a border" rather than "this is a textbox"
 *  — owner-reported 2026-08-28. The wash is pond's own 50, one step lighter than the
 *  outline's own vivid step, so the two read as one family.
 *  `boxSizing: 'content-box'` is not incidental: a host that puts these lines in
 *  border-box and caps them at `maxWidth: 100%` would otherwise take the 4px of right
 *  padding out of the width the TEXT wraps in, so a value ending within 4px of the wrap
 *  point gains a line the moment it opens for editing. `padding`/`margin` cancel each
 *  other on the right so the wrap width and row height are exactly what they were at
 *  rest; the left has no padding — only 4px separates most fields from whatever sits
 *  before them, and the outline's own offset already spends 3 of it.
 *  `boxShadow: 'none'` because a global `:focus-visible` ring rule (`base.css`) counts
 *  an editable element as focus-visible even on a mouse click, which would otherwise
 *  draw a second edge on top of this one. `minHeight: '1lh'` so an emptied line still
 *  holds a caret; `maxHeight`/`overflow` release any display clamp so a value longer
 *  than its rest-state cap is legible while it is being typed.
 *  `minWidth: 8` IS THE LAST RESORT, NOT THE FLOOR A READER SEES. A field with a
 *  `placeholder` takes its floor from the invitation instead (the sizer below), because
 *  8px of box behind a 96px invitation reads as a ring drawn around the first two
 *  letters rather than as a textbox — owner-reported 2026-09-15 on an unnamed stage.
 *  A field with no placeholder has nothing to measure and keeps the 8.
 *  Read the values, do not spread the object — implement the recipe on your own
 *  editable element if you are not using `InlineText` directly. */
export const INLINE_EDIT_STYLE = {
  outline: '1px solid var(--state-editing)', outlineOffset: 3,
  boxSizing: 'content-box',
  padding: '0 4px 0 0', margin: '0 -4px 0 0',
  borderRadius: 'var(--radius-xs)',
  caretColor: 'var(--accent-primary)',
  boxShadow: 'none',
  background: 'var(--state-editing-wash)',
  cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text',
  whiteSpace: 'pre-wrap',
  minHeight: '1lh', minWidth: 8,
  maxHeight: 'none', overflow: 'visible',
}

/** One string, editable in place — no separate `<input>`/`<textarea>`, ever: all three
 *  of `VersionedGroup`'s editable fields wrap, and a single-line field collapses them to
 *  one (14.5px of jump, measured), and cancelling a field's own border needs the
 *  border's *used* width, which is sub-pixel on a scaled board. So the STRING ITSELF
 *  becomes a `contentEditable` span, same type, same position, same wrapping — this
 *  component is that span plus the rules editing it needs: commit on Enter/blur, revert
 *  on Escape, plain-text paste, whitespace normalised on the way out, a caret placed at
 *  the click point rather than reset to one end, and a placeholder invitation that
 *  survives the click that opens the field and leaves on the first keystroke.
 *  SEEDED ONCE, THEN THE DOM OWNS IT: content is written into the element exactly once,
 *  at the transition into `editing`, and never reconciled from `value` again — reading
 *  it back from props on every render is what let an unrelated re-render snap a just-
 *  cleared field back to its last-committed text (reported 2026-08-28, before the
 *  seed-once fix: deleting a title, version name or description down to nothing
 *  "wouldn't let go" of the last character). */
/** ZERO-WIDTH, LOAD-BEARING. A line at rest with nothing in it has no text baseline, and
 *  its flex row (`VersionedGroup`'s head is `alignItems: 'baseline'`) then aligns its
 *  siblings to the empty box's bottom edge instead — 1.33px above where the same row sits
 *  once there is a character, so the stage number and the node tally BOTH stepped down on
 *  the click into edit mode and back up on the click out (owner-reported 2026-09-15: "why
 *  does the strings move"). The strut gives an empty line the baseline a full one has, so
 *  the row is in the same place whether the field is empty, full, open or shut. It is not
 *  a space: it cannot be seen, cannot be selected into a commit, and never reaches
 *  `readBack` (the DOM is seeded from `value` the moment editing starts). */
const STRUT = '\u200b'

/** the widest a placeholder may floor a field — a caller's invitation is copy, and copy can be
 *  any length; past this the field is wide enough to type in and the host's row keeps the rest. */
export const INLINE_FLOOR_CEILING = 320
const CEILING = INLINE_FLOOR_CEILING

export function InlineText({ value, display, placeholder, restPlaceholder, editing, onOpen, onCommit, onCancel, tooltip, style, editStyle, pointRef, multiline, enterInserts = false, fill = false, autoFocus = true }) {
  const ref = React.useRef(null)
  const ownPoint = React.useRef(null)
  const point = pointRef || ownPoint
  const [blank, setBlank] = React.useState(!value)
  /* THE WIDTH FLOOR IS MEASURED, NOT OCCUPIED. The first attempt lent the wrapper its width
     with a zero-height span in normal flow, and that span's own empty line box became the
     wrapper's FIRST one — so the flex item's baseline came from it, the row's other children
     rose 1.33px and the field dropped 12px below them. Exactly the movement this change is
     here to remove, in the other direction. So the invitation is measured from an absolutely
     positioned copy (out of flow: no line box, no baseline, no contribution to anyone's
     height) and the number is handed to the line as a `minWidth` in PIXELS.
     Pixels, not `min(100%, Npx)`: the percentage resolves against the wrapper, the wrapper is
     shrink-to-fit around this very line, and with the line empty that is genuinely 0 — a
     clamp that read 0px and drew a 4px box (measured). A host therefore has to leave the
     field at least its invitation's width; `VersionedGroup`'s head already floors the title at
     96 for its own reasons. `CEILING` keeps a caller's very long placeholder from being able
     to push a card's furniture off the row.
     A TYPE MEASUREMENT IS NOT ONE UNTIL THE FACE HAS LOADED (CLAUDE.md), so the read repeats
     on `document.fonts.ready` — a first-frame reload otherwise floors the field at the
     fallback face's width, which is a real number about the wrong font. */
  const sizer = React.useRef(null)
  const [floor, setFloor] = React.useState(0)
  React.useLayoutEffect(() => {
    if (!editing || !placeholder) { setFloor(0); return }
    let live = true
    const read = () => {
      const el = sizer.current
      if (live && el) setFloor(Math.min(CEILING, Math.ceil(el.getBoundingClientRect().width)))
    }
    read()
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(read)
    return () => { live = false }
  }, [editing, placeholder])
  React.useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    el.textContent = value
    setBlank(!el.textContent.trim())
    /* several fields can open together (a caller's "edit mode" toggling more than one
       at once) — only ONE should steal the caret, so a field entering edit mode
       alongside the others passes autoFocus={false} and just sits ready to click into */
    if (autoFocus) { el.focus(); caretAt(el, point.current); point.current = null }
  }, [editing])
  const readBack = () => {
    const el = ref.current
    if (!el) return ''
    if (!multiline) return el.textContent.replace(/\s+/g, ' ').trim()
    /* BLANK LINES ARE THE WRITER'S IN PROSE. The collapse of every `\n\n` to `\n` was written for a
       group's description, where a blank line is a slip; with `enterInserts` the field is prose (a
       professor's notes) and the spacing they typed is theirs — first one blank line came back
       glued (owner, 2026-09-04), then a first fix kept exactly one and still ate the rest (owner,
       same day: "it just retains 1 new line"). Prose keeps every line break as typed; only the
       ends are trimmed. The other fields keep the old rule. */
    const lines = el.innerText.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').split('\n').map((l) => l.trim()).join('\n')
    return (enterInserts ? lines : lines.replace(/\n{2,}/g, '\n')).trim()
  }
  const commit = () => onCommit(readBack())
  const line = (
    <span ref={ref}
      key={editing ? 'edit' : 'rest'}
      /* the ONE class this file reaches for, and only for a browser affordance no inline
         style can touch: the native text-selection highlight. Without it the selection
         and the field's own --state-editing-wash sit close enough in hue and lightness
         to be hard to tell apart while dragging a selection — owner-reported 2026-08-28.
         Rule lives in styles.css under kn-inline-edit-selection. The same class also
         carries the OPEN-STATE STRUT (`:empty::before`, tokens/base.css, OB-273): an
         empty open line has no children, so without it Firefox gives the box no
         baseline and every baseline-aligned row around it grows. */
      className={editing ? 'kn-inline-edit-selection' : undefined}
      contentEditable={editing || undefined}
      suppressContentEditableWarning={editing || undefined}
      title={editing ? undefined : wrapTip(tooltip)}
      onClick={(e) => {
        e.stopPropagation()
        if (editing || !onOpen) return
        point.current = { x: e.clientX, y: e.clientY }
        onOpen()
      }}
      /* SELECT ALL, NOT ONE WORD. A double-click's native default is word-select — right
         for reading, wrong for a field about to be retyped: a whole-field double-click
         is the universal "replace everything" gesture. Only while editing. */
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (!editing) return
        e.preventDefault()
        const el = ref.current
        const sel = el && window.getSelection()
        if (!el || !sel) return
        const range = document.createRange()
        range.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(range)
      }}
      /* the words are a drag surface at rest and a text surface while editing: without
         this a select-drag across them picks up a draggable ancestor instead of the
         sentence. Stops it at the source, protecting every host this is dropped into. */
      onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
      onMouseDown={editing ? (e) => e.stopPropagation() : undefined}
      onInput={editing && placeholder ? (e) => setBlank(!e.currentTarget.textContent.trim()) : undefined}
      onKeyDown={editing ? (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          /* `enterInserts`: a NOTE is prose, and Enter in prose is a new line — the field commits by
             blur or the caller's own control (owner, 2026-09-04). Ctrl/Cmd+Enter still commits, the
             convention every chat box has taught. Only meaningful with `multiline`. */
          if (multiline && (e.shiftKey || (enterInserts && !e.ctrlKey && !e.metaKey))) {
            e.preventDefault()
            document.execCommand('insertLineBreak')
            return
          }
          e.preventDefault()
          commit()
        }
        /* Escape reverts, and the remount above is what restores the words */
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      } : undefined}
      onBlur={editing ? commit : undefined}
      onPaste={editing ? (e) => {
        e.preventDefault()
        const raw = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n')
        document.execCommand('insertText', false,
          multiline ? raw.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n') : raw.replace(/\s+/g, ' '))
      } : undefined}
      style={editing
        /* PIXELS, and no percentage clamp — see the measurement comment above: `min(100%, Npx)`
           resolves against a wrapper that is shrink-to-fit around this line, which is 0 while
           the line is empty, so the clamp drew a 4px box. */
        ? { ...style, ...INLINE_EDIT_STYLE, ...(floor ? { minWidth: floor } : null), ...(fill ? { minHeight: '100%', boxSizing: 'border-box' } : null), ...editStyle }
        : { ...style, ...(fill ? { display: 'block', minHeight: '100%', boxSizing: 'border-box' } : null) }}>{editing ? undefined : ((display || value || (restPlaceholder !== undefined ? restPlaceholder : placeholder)) || STRUT)}</span>
  )
  /* THE WRAPPER IS WHY `fill` IS A PROP AND NOT A CALLER'S STYLE. A percentage height needs a
     definite parent, and when `placeholder` is passed this component puts its own auto-height
     span between the caller's box and the line — which a caller cannot reach, so their
     `minHeight: '100%'` resolves against nothing. Same reason the fill override sits INSIDE the
     `INLINE_EDIT_STYLE` merge above: that recipe carries `minHeight: '1lh'`, so a caller's own
     `style` can never survive editing. Both faults found on `LectureNotes` (2026-09-03) after a
     turn of the field claiming to reach the foot of its column and not doing it. */
  if (!placeholder) return line
  return (
    <span style={{ position: 'relative', display: 'block', maxWidth: '100%', ...(fill ? { height: '100%' } : null) }}>
      {/* THE INVITATION IS THE FIELD'S WIDTH FLOOR, and the floor is mounted for the whole
          editing session, not just while the line is blank: a floor that left on the first
          keystroke would snap a 96px box down to one character's width as you started typing.
          This copy is only ever measured — absolute, hidden, no pointer events — because a
          sizer in normal flow takes over the wrapper's first line box and moves the baseline
          every host aligns its row on. A field whose own box is already wider (a long title,
          or the description's `width: '100%'`) is unaffected. */}
      {editing ? (
        <span ref={sizer} aria-hidden="true" style={{
          position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontStyle: 'italic',
        }}>{placeholder}</span>
      ) : null}
      {line}
      {editing && blank ? (
        <span aria-hidden="true" style={{
          position: 'absolute', left: 0, top: 0, pointerEvents: 'none',
          fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight,
          fontStyle: 'italic', color: 'var(--text-3)', whiteSpace: 'nowrap',
        }}>{placeholder}</span>
      ) : null}
    </span>
  )
}
