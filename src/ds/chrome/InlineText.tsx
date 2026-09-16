import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { wrapTip } from './IconButton'

/* Typed port of the DS components/chrome/InlineText.jsx (contract: InlineText.d.ts), the file
   the DS extracted out of VersionedGroup.jsx on 2026-08-28. This repo carried the same field
   INSIDE VersionedGroup.tsx until OB-110 (#256), 2026-09-05, when the card's whole-card edit
   mode needed the three things the extracted file had grown: `restPlaceholder`, `autoFocus`
   and the seed-once rule. Every docblock the local field had earned is kept below. */

/** THE CARET GOES WHERE THE POINTER WAS. Opening a line used to select all of it,
 *  which is right for a field whose contents you are replacing and wrong for a line
 *  you are correcting: a click halfway through a sentence means "here", and
 *  select-all answers "start again", one keystroke from losing the text.
 *
 *  The click point is a viewport coordinate and it maps cleanly because NOTHING
 *  MOVES between the click and the caret — a property of editing in place, not luck.
 *  A field would have re-laid the text out first, which is why this could not have
 *  been done with one.
 *
 *  `caretRangeFromPoint` is the Chrome spelling and `caretPositionFromPoint` the
 *  standard one; if neither lands inside the element (an empty line, a click in its
 *  trailing space) the caret goes to the END, never back to select-all. */
function caretAt(el: HTMLElement, point: { x: number; y: number } | null): void {
  const sel = window.getSelection()
  if (!sel) return
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  let range: Range | null = null
  if (point) {
    if (doc.caretRangeFromPoint) {
      range = doc.caretRangeFromPoint(point.x, point.y)
    } else if (doc.caretPositionFromPoint) {
      const p = doc.caretPositionFromPoint(point.x, point.y)
      if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset) }
    }
    if (range && !el.contains(range.startContainer)) range = null
  }
  if (range) {
    range.collapse(true)
  } else {
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
 *  — owner-reported 2026-08-28. The wash is pond's own 50 (`--state-editing-wash`), one
 *  step lighter than the outline's own vivid step, so the two read as one family. (Until
 *  OB-110 this port kept the background transparent — the pre-2026-08-28 recipe.)
 *
 *  BLUE, ONE STEP BRIGHTER THAN SELECTION. `--state-editing` is `--pond-vivid` —
 *  pond already means "the thing I am acting on", and the vivid step exists for
 *  this one edge, because a transient outline has to be found at a glance where a
 *  selection wash is read past. A named token rather than a reach into
 *  `--state-selected`, whose name would then be lying on a line being typed into.
 *  What keeps the two apart on screen is the step and the object: selection
 *  outlines a chip or a card at 2px, this outlines a run of TEXT at 1px.
 *
 *  THE ROOM AT THE ENDS IS ASYMMETRIC, because the row is. The head leaves exactly
 *  4px between the index's last glyph and the title's first, so the whole left
 *  inset has to fit inside it — the outline's own 3px offset is that inset, 1px
 *  clear of the number, and there is no left padding at all. The right end takes
 *  4px of padding handed straight back as an equal negative margin, so the wrap
 *  width and the row's height are untouched. Widening the head's index gap to
 *  balance the two ends is refused: that gap is published geometry
 *  (`titleColumn`, and the description's indent reads the same expression), so a
 *  transient editing state would be reshaping the resting card for every caller.
 *
 *  AND THE ROOM IS TAKEN OUTSIDE THE WRAP WIDTH, NOT OUT OF IT. `base.css` puts
 *  everything in `border-box` and all three of the card's lines are capped at
 *  `maxWidth: 100%`, so in border-box that 4px comes off the width the TEXT wraps
 *  in: a name ending within 4px of the wrap point gained a line on the click that
 *  opened it — and where the clamp already allowed two lines the card's height did
 *  not change at all, so nothing reported it. `content-box` makes `maxWidth: 100%`
 *  mean the text's 100% again. The rule: an in-place editor may not change the box
 *  the text wraps in, and `box-sizing` is part of that box.
 *
 *  AND NOT THE FOCUS RING. `base.css` rings every `:focus-visible` element with
 *  `--ring-focus` at a `--radius-sm` corner, and Chrome counts an editable element
 *  as focus-visible even when a CLICK opened it — so an open line wore a second
 *  edge from a global rule rather than from this file. `boxShadow: 'none'`, one
 *  edge, declared in one place. `minHeight: '1lh'` so an emptied line still holds a
 *  caret; `maxHeight`/`overflow` release any display clamp so a value longer than its
 *  rest-state cap is legible while it is being typed — a display compromise has no
 *  business hiding characters from the person typing them.
 *
 *  Read the values, do not spread the object — implement the recipe on your own
 *  editable element if you are not using `InlineText` directly. */
export const INLINE_EDIT_STYLE: React.CSSProperties = {
  outline: '1px solid var(--state-editing)', outlineOffset: 3,
  boxSizing: 'content-box',
  padding: '0 4px 0 0', margin: '0 -4px 0 0',
  borderRadius: 'var(--radius-xs)',
  caretColor: 'var(--accent-primary)',
  boxShadow: 'none',
  background: 'var(--state-editing-wash)',
  cursor: 'text', userSelect: 'text', WebkitUserSelect: 'text',
  /* pre-wrap so a trailing space under the caret does not collapse as it is typed */
  whiteSpace: 'pre-wrap',
  /* `minWidth: 8` IS THE LAST RESORT, NOT THE FLOOR A READER SEES (DS OB-192, 2026-09-15). A
     field with a `placeholder` takes its floor from the invitation instead (the sizer in
     `InlineText`), because 8px of box behind a 96px invitation reads as a ring drawn around
     the first two letters rather than as a textbox — owner-reported on an unnamed stage. A
     field with no placeholder has nothing to measure and keeps the 8. */
  minHeight: '1lh', minWidth: 8,
  maxHeight: 'none', overflow: 'visible',
}

/** ZERO-WIDTH, LOAD-BEARING (DS OB-192, 2026-09-15). A line at rest with nothing in it has no
 *  text baseline, and its flex row (`VersionedGroup`'s head is `alignItems: 'baseline'`) then
 *  aligns its siblings to the empty box's bottom edge instead — 1.33px above where the same row
 *  sits once there is a character, so the stage number and the node tally BOTH stepped down on
 *  the click into edit mode and back up on the click out (owner-reported 2026-09-15: "why does
 *  the strings move"). The strut gives an empty line the baseline a full one has, so the row is
 *  in the same place whether the field is empty, full, open or shut. It is not a space: it
 *  cannot be seen, cannot be selected into a commit, and never reaches `readBack` (the editable
 *  DOM is seeded from `value` the moment editing starts). */
const STRUT = '\u200b'

/** the widest a placeholder may floor a field — a caller's invitation is copy, and copy can be
 *  any length; past this the field is wide enough to type in and the host's row keeps the rest.
 *  Exported because it is a NUMBER crossing the boundary: a retyped 320 stops tracking a
 *  re-tuned one. */
export const INLINE_FLOOR_CEILING = 320

export interface InlineTextProps {
  /** the committed string — what an OPEN line always shows, and what commit compares against.
   *  Read ONCE, at the transition into `editing` — see `editing` for why it must not be
   *  reconciled on every render. */
  value: string
  /** the resting, ellipsised form when the cap cut it (OB-033). Never shown while editing */
  display?: string
  /** the invitation drawn while the line is blank — an overlay BEHIND the caret, never text
   *  in the editable element (as text it would be selectable, committable, and "enter a
   *  value" is the last thing anyone means to save). It survives the click that opens the
   *  field and leaves on the first keystroke.
   *
   *  IT IS ALSO THE FIELD'S WIDTH FLOOR (DS OB-192). While `editing`, a field with a
   *  `placeholder` is never narrower than the invitation it is showing: `INLINE_EDIT_STYLE`'s
   *  `minWidth: 8` is a last resort for a field with no invitation to measure, and on a
   *  shrink-to-fit host (a `width: fit-content` title) it drew an 8px box behind a 96px
   *  invitation — a ring around the first two letters, not a textbox (owner-reported
   *  2026-09-15 on an unnamed stage). The floor holds for the whole editing session, not
   *  only while the line is blank, so the box does not snap down to one character's width
   *  on the first keystroke. A field already wider than its invitation is unaffected.
   *
   *  THE FLOOR IS IN PIXELS, SO THE HOST MUST LEAVE ROOM FOR IT — at least the invitation's
   *  own width, or the field overflows the row it is in. It cannot be a percentage clamp: a
   *  percentage resolves against this component's wrapper, the wrapper is shrink-to-fit
   *  around the line, and with the line empty that is genuinely 0 — `min(100%, 96px)`
   *  measured as a 4px box. `VersionedGroup`'s head already floors its title column at 96 for
   *  its own reasons; a host with less room than its own invitation should shorten the
   *  invitation. `INLINE_FLOOR_CEILING` caps it either way. */
  placeholder?: string
  /** what to render at rest when `value` is empty AND the field is not editing — e.g. a
   *  caller drawing nothing rather than a placeholder word at rest. Omit to fall back to
   *  `placeholder` itself at rest. `VersionedGroup` passes `''` for its title and version
   *  name: at rest an empty name draws nothing, and the invitation appears only once edit
   *  mode opens the field. */
  restPlaceholder?: string
  /** true: a `contentEditable` span, focused (unless `autoFocus={false}`), wearing
   *  `INLINE_EDIT_STYLE`. false: plain text, `onClick` opens it (if `onOpen` is passed).
   *  SEEDED ONCE: `value` is written into the DOM exactly once, at the transition into
   *  `editing`, and the element's children are otherwise `undefined` — nothing reconciles
   *  it again while editing. A field that re-syncs from `value` on every render snaps a
   *  just-cleared field back to its last-committed text the moment anything else on the
   *  page re-renders, because a commit that clears the value never actually LANDS in
   *  `value` until the caller re-renders with the new prop — and by then the DOM has
   *  already been told to forget what was typed. Reported 2026-08-28 as "deleting the
   *  text wouldn't let go of the last character". */
  editing: boolean
  /** fired on click at rest (only when not `editing`) with no argument — the caller
   *  decides what "open" means. In `VersionedGroup` nothing: opening is the pencil's job,
   *  not a per-field click. Kept for a host that still wants click-to-open a single field. */
  onOpen?: () => void
  /** fired on Enter or blur with the read-back string — whitespace-collapsed and trimmed
   *  (multi-line values keep internal line breaks, each line separately trimmed, runs of
   *  blank lines collapsed to one unless `enterInserts`). An empty string is a legitimate
   *  value; whether the caller treats it as "clear to placeholder" or refuses it is the
   *  caller's call, made in this handler. */
  onCommit: (v: string) => void
  /** fired on Escape — the caller reverts (a remount, keyed by `editing`, is what actually
   *  restores the last-committed text; this only needs to flip `editing` back off). */
  onCancel: () => void
  /** the hover tooltip at rest (folded through `wrapTip`). Never shown while editing */
  tooltip?: string
  /** rest-state style. Must include `fontFamily`/`fontSize`/`lineHeight` if a
   *  `placeholder` is passed — the overlay reads them off this object directly rather
   *  than inheriting, since it is a sibling, not a child. */
  style: React.CSSProperties
  /** what the OPEN line adds on top of `style` and the shared recipe */
  editStyle?: React.CSSProperties
  /** a caller whose open line fills its ROW writes the click point here instead */
  pointRef?: React.MutableRefObject<{ x: number; y: number } | null>
  /** Shift+Enter breaks the line. Prose only — a hand-typed break in a NAME is a
   *  layout decision taken in the wrong place */
  multiline?: boolean
  /** With `multiline`: a plain Enter INSERTS a line break and does not commit; the field
   *  commits on blur, on the caller's own control (a pencil clicked again), or on
   *  Ctrl/Cmd+Enter. For prose a person is writing — a note, a paragraph — where Enter
   *  means "new line" (owner, 2026-09-04). ALSO CHANGES THE TIDY ON SAVE: prose keeps every
   *  line break as typed (only the ends are trimmed); without this flag every blank line
   *  collapses to a single break, the right rule for a description and the wrong one for
   *  notes. Default false: Enter commits, Shift+Enter breaks. Ignored without `multiline`.
   *  No caller in this app passes it yet; the notes pane (OB-145, #267) is the first that
   *  will. */
  enterInserts?: boolean
  /** false: this field becomes editable alongside others without stealing focus — for a
   *  caller whose "edit mode" opens several `InlineText`s at once and wants exactly one of
   *  them to take the caret. Default true. */
  autoFocus?: boolean
  /** the field fills the height of its container instead of hugging its text — for a host
   *  whose box IS the field (a notes column, a description pane), where a two-line value
   *  otherwise leaves a two-line box on an empty page and the click target stops where the
   *  words stop. IT HAS TO BE A PROP: a percentage height needs a definite parent, and when
   *  `placeholder` is passed this component inserts its own auto-height wrapper between the
   *  caller's box and the line — unreachable from outside, so a caller's `minHeight: '100%'`
   *  resolves against nothing; and `INLINE_EDIT_STYLE`'s `minHeight: '1lh'` beats anything
   *  in `style` while editing. Give the CONTAINER a definite height or this does nothing.
   *  Added by the DS 2026-09-03 for `LectureNotes`; no caller here yet. */
  fill?: boolean
}

/** THE TIDY ON SAVE, as a function so the rule can be asserted without a DOM. Every run of
 *  spaces collapses and every line's ends are trimmed; whether BLANK LINES survive is the
 *  whole difference between a description and prose. The collapse of every `\n\n` to `\n`
 *  was written for a group's description, where a blank line is a slip; with `enterInserts`
 *  the field is prose (a professor's notes) and the spacing they typed is theirs — first one
 *  blank line came back glued (owner, 2026-09-04), then a first fix kept exactly one and still
 *  ate the rest ("it just retains 1 new line"). Prose keeps every line break as typed; only
 *  the ends are trimmed. */
export function tidyMultiline(drawn: string, keepBlankLines: boolean): string {
  const lines = drawn.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).join('\n')
  return (keepBlankLines ? lines : lines.replace(/\n{2,}/g, '\n')).trim()
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
 *
 *  Commit sends the text whitespace-normalised and trimmed; the caller decides what an
 *  empty string means — since 2026-08-28 it clears every one of the card's three lines. */
export function InlineText({
  value, display, placeholder, restPlaceholder, editing, onOpen, onCommit, onCancel,
  tooltip, style, editStyle, pointRef, multiline, enterInserts = false, autoFocus = true, fill = false,
}: InlineTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const ownPoint = useRef<{ x: number; y: number } | null>(null)
  /* WHERE THE POINTER WAS. Usually this element's own click writes it — but a
     caller whose open line FILLS ITS ROW (the description) opens the editor from
     the row as well and hands the same ref in, so a click on the empty part of the
     row places the caret exactly as a click on the words does. */
  const point = pointRef || ownPoint
  /* IS THE LINE BLANK RIGHT NOW? Tracked rather than derived from `value`, because
     it changes as the user types and `value` cannot: the DOM text is deliberately
     uncontrolled here (React must not patch the words under the caret). This is the
     only state that follows the typing, it holds a boolean rather than the text, and
     a re-render from it leaves the DOM alone — the element's children are `undefined`
     while editing, so there is nothing for React to patch. */
  const [blank, setBlank] = useState(!value)
  /* THE WIDTH FLOOR IS MEASURED, NOT OCCUPIED (DS OB-192). The DS's first attempt lent the
     wrapper its width with a zero-height span in normal flow, and that span's own empty line
     box became the wrapper's FIRST one — so the flex item's baseline came from it, the row's
     other children rose 1.33px and the field dropped 12px below them: exactly the movement
     this change removes, in the other direction. So the invitation is measured from an
     absolutely positioned copy (out of flow: no line box, no baseline, no contribution to
     anyone's height) and the number is handed to the line as a `minWidth` in PIXELS.
     Pixels, not `min(100%, Npx)`: the percentage resolves against the wrapper, the wrapper is
     shrink-to-fit around this very line, and with the line empty that is genuinely 0 — a
     clamp that read 0px and drew a 4px box (measured). A host therefore has to leave the
     field at least its invitation's width; `INLINE_FLOOR_CEILING` keeps a caller's very long
     placeholder from being able to push a card's furniture off the row.
     A TYPE MEASUREMENT IS NOT ONE UNTIL THE FACE HAS LOADED, so the read repeats on
     `document.fonts.ready` — a first-frame reload otherwise floors the field at the fallback
     face's width, which is a real number about the wrong font. */
  const sizer = useRef<HTMLSpanElement | null>(null)
  const [floor, setFloor] = useState(0)
  // (the floor is a measurement of a rendered box, which a render cannot know; the layout
  // effect lands it before paint)
  useLayoutEffect(() => {
    if (!editing || !placeholder) { setFloor(0); return }
    let live = true
    const read = () => {
      const el = sizer.current
      if (live && el) setFloor(Math.min(INLINE_FLOOR_CEILING, Math.ceil(el.getBoundingClientRect().width)))
    }
    read()
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) document.fonts.ready.then(read)
    return () => { live = false }
  }, [editing, placeholder])
  useEffect(() => {
    if (!editing) return
    const el = ref.current
    if (!el) return
    /* SEEDED ONCE — see `editing`. The remount keyed on `editing` hands us a fresh
       element; the committed string goes in here and is never reconciled again. */
    el.textContent = value
    setBlank(!el.textContent?.trim())
    /* several fields can open together (a caller's "edit mode" toggling more than one
       at once) — only ONE should steal the caret, so a field entering edit mode
       alongside the others passes autoFocus={false} and just sits ready to click into */
    if (autoFocus) {
      el.focus()
      caretAt(el, point.current)
      point.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  /* READ BACK WHAT IS DRAWN, NOT WHAT IS IN THE NODES. A Shift+Enter break is a
     `<br>` and `textContent` cannot see one, so the line the user typed would
     arrive as if it were never there. `innerText` is the rendered text, breaks
     included. Single-line strings keep `textContent`, which is cheaper and cannot
     surprise: a name has no breaks to preserve.
     Normalisation differs too — every line has its runs of spaces collapsed and its
     ends trimmed; a multiline value keeps single breaks and collapses blank runs unless
     it is prose (`enterInserts` — see `tidyMultiline`), a single-line value loses breaks
     entirely. */
  const readBack = (): string => {
    const el = ref.current
    if (!el) return ''
    if (!multiline) return (el.textContent || '').replace(/\s+/g, ' ').trim()
    return tidyMultiline(el.innerText, enterInserts)
  }
  const commit = () => onCommit(readBack())
  const line = (
    <span ref={ref}
      /* REMOUNTED ON EVERY OPEN AND CLOSE. React renders the same string either side
         of the transition, so it would see nothing to patch — and the words typed
         into the DOM would survive an Escape. The key makes each state its own
         element, so closing rebuilds the line from the prop, which is the only copy
         that is true. */
      key={editing ? 'edit' : 'rest'}
      /* the ONE class this file reaches for, and only for a browser affordance no inline
         style can touch: the native text-selection highlight. Without it the selection
         and the field's own --state-editing-wash sit close enough in hue and lightness
         to be hard to tell apart while dragging a selection — owner-reported 2026-08-28.
         The rule lives in tokens/base.css. */
      className={editing ? 'kn-inline-edit-selection' : undefined}
      contentEditable={editing || undefined}
      suppressContentEditableWarning={editing || undefined}
      /* nothing while editing: a tooltip over a line you are typing into is noise,
         and it would sit on top of the caret */
      title={editing ? undefined : wrapTip(tooltip)}
      onClick={(e) => {
        e.stopPropagation()
        if (editing || !onOpen) return
        point.current = { x: e.clientX, y: e.clientY }
        onOpen()
      }}
      /* SELECT ALL, NOT ONE WORD (OB-081). A double-click's native default is word-select
         — right for reading, wrong for a field you are about to retype: a whole-field
         double-click is the universal "replace everything" gesture (a URL bar, a
         spreadsheet cell), and word-select instead makes the caller manually extend the
         selection before typing over it. Only while editing — at rest a double-click still
         does nothing of ours, so it falls back to whatever selecting read-only text means
         to the platform. This ALSO stops the event reaching whatever the card is sitting
         in, same as before — see "WHAT THE HOST AROUND IT MUST KNOW" above VersionedGroup's
         props, and take a host gesture in the CAPTURE phase instead. */
      onDoubleClick={(e: React.MouseEvent) => {
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
         this a select-drag across them picks the CARD up instead of the sentence.
         `onPointerDown` is the OTHER half of the guard (OB-081) — `VersionedGroup`'s own
         card-move starts on `onPointerDown` via `data-grab`, which this element never
         carries, so it was already safe here — but `NodeChain` ALSO starts its reorder
         drag on `onPointerDown`, one level further up, for any chip it is handed,
         including a card sitting inside a chain. Its own exclusion list didn't know this
         field existed, so a press-and-drag meant to select text inside an editing title,
         description or version name read as the start of a reorder instead — stopped
         here, at the source, so every host this component is dropped into is protected
         rather than each one having to learn about contentEditable itself. */
      onPointerDown={editing ? (e: React.PointerEvent) => e.stopPropagation() : undefined}
      onMouseDown={editing ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
      onInput={editing && placeholder ? (e: React.FormEvent<HTMLSpanElement>) => setBlank(!e.currentTarget.textContent?.trim()) : undefined}
      onKeyDown={editing ? (e: React.KeyboardEvent) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          /* SHIFT+ENTER BREAKS THE LINE, ENTER COMMITS IT — and only where breaks
             are legal. On a NAME both spellings commit. `insertLineBreak` gives a
             real `<br>` rather than a paragraph, which is why the read-back uses
             innerText.
             `enterInserts` (OB-144): a NOTE is prose, and Enter in prose is a new line —
             the field commits by blur or the caller's own control (owner, 2026-09-04).
             Ctrl/Cmd+Enter still commits, the convention every chat box has taught. */
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
      /* a line takes WORDS from the clipboard, never markup — and never more
         structure than it can hold: a pasted newline is a break where breaks are
         legal and a space where they are not */
      onPaste={editing ? (e: React.ClipboardEvent) => {
        e.preventDefault()
        const raw = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n')
        document.execCommand('insertText', false,
          multiline ? raw.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n') : raw.replace(/\s+/g, ' '))
      } : undefined}
      /* THE OPEN LINE IS ALWAYS THE WHOLE STRING — `display` is the resting,
         ellipsised form of a name too long for its cap. While editing the children are
         `undefined` (seeded once, above); at rest the resting form, the value, or the
         rest placeholder — which a caller may set to '' to draw nothing. */
      style={editing
        /* PIXELS, and no percentage clamp — see the measurement comment above `sizer` */
        ? { ...style, ...INLINE_EDIT_STYLE, ...(floor ? { minWidth: floor } : null), ...(fill ? { minHeight: '100%', boxSizing: 'border-box' } : null), ...editStyle }
        : { ...style, ...(fill ? { display: 'block', minHeight: '100%', boxSizing: 'border-box' } : null) }}>
      {/* AT REST AN EMPTY LINE CARRIES THE STRUT — see `STRUT` above: a caller drawing nothing
          (`restPlaceholder=''`) still gets a baseline, so its row does not step on open/close */}
      {editing ? undefined : ((display || value || (restPlaceholder !== undefined ? restPlaceholder : placeholder)) || STRUT)}
    </span>
  )
  /* NO PLACEHOLDER, NO WRAPPER. A line with no invitation gets the bare span and its
     layout is untouched — it may sit in a tuned flex row where an extra box is a risk
     for nothing. */
  if (!placeholder) return line
  /* THE INVITATION HAS TO SURVIVE THE CLICK. "enter description" IS the empty line's
     only content, so opening the editor replaced the one thing on screen with an
     empty 8px box and a caret in blank space — reported as the click bugging out.
     It stays, as a real placeholder: drawn BEHIND the caret, never as text in the
     editable element, where it would be selectable and committable ("enter
     description" is the last thing anyone means to save). It takes no pointer
     events, so a click still lands on the line under it.

     The wrapper is present in BOTH states, deliberately. If it only appeared while
     editing, the editable span would change parents on the first character typed,
     remount, and lose focus and caret mid-word. Only the overlay is conditional.

     THE WRAPPER IS WHY `fill` IS A PROP AND NOT A CALLER'S STYLE: a percentage height
     needs a definite parent, and this auto-height span sits between the caller's box
     and the line where a caller cannot reach it. */
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
          /* the same italic --text-3 it wears at rest: still an invitation, not content */
          fontStyle: 'italic', color: 'var(--text-3)', whiteSpace: 'nowrap',
        }}>{placeholder}</span>
      ) : null}
    </span>
  )
}
