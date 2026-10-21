/**
 * One string, editable in place — a `contentEditable` span standing in for whatever
 * text it wraps, rather than a separate `<input>`/`<textarea>` swapped in on click.
 * Extracted from `VersionedGroup` 2026-08-28, where it drives the title, description
 * and live version-name fields; not yet used outside that file, but generic to any
 * host that needs a wrapping, in-place-editable line.
 *
 * WHY NOT A REAL FIELD: every string this has been used on wraps (a title to two
 * lines, three folded; a description to three; a version name to two). A single-line
 * `<input>`/`<textarea>` collapses that to one line on the click that opens it — 14.5px
 * of jump, measured — and matching its border to the rest-state box needs the border's
 * *used* width, which is sub-pixel on a scaled board (0.667px for an authored 1px rule
 * at some zoom levels). Three passes at that arithmetic failed before fields were
 * dropped in favour of editing the line itself.
 *
 * THE CARET NEEDS THE CLICK'S VIEWPORT POINT, captured by whatever opens editing and
 * handed in via `pointRef` (or kept internally if omitted) — this only works because
 * nothing re-lays-out the text between the click and the caret landing. A `<input>`
 * swap would have reflowed the text first and lost the point.
 *
 * AN EMPTY LINE AT REST CARRIES A ZERO-WIDTH STRUT, and a host aligning a row on
 * baselines depends on it. A box with no content has no text baseline, so a
 * `align-items: baseline` row aligns its other children to the empty box's bottom edge
 * instead — 1.33px above the baseline the same row uses once there is a character. That
 * is what made `VersionedGroup`'s stage number and node tally step down on the click
 * into edit mode and back up on the click out (owner-reported 2026-09-15). The strut is
 * `U+200B`: invisible, unselectable into a commit, and never read back (the editable DOM
 * is seeded from `value`, not from what the rest state rendered). A caller that measures
 * this element's `textContent` must expect it.
 *
 * AN EMPTY LINE WHILE OPEN CARRIES ONE TOO, and it lives in the STYLESHEET, not here
 * (OB-273, 2026-10-01). Open, this renders no children, so an empty field is a box with
 * no line box again. Chromium synthesises a baseline for an empty editable anyway;
 * Firefox does not, so in Firefox the row around it grew on the pencil — our own card,
 * dpr 1.5: +4.57 at the foot, +5.12 at the index; Chrome 0.00. The fix is
 * `.kn-inline-edit-selection:empty::before { content: '\200b' }` in `tokens/base.css`, on
 * the class this component already puts on an open line: generated content, so it never
 * enters `textContent`, a commit or the caret. A PORT THAT VENDORS THIS FILE AND NOT
 * `tokens/base.css` SHIPS THE FAULT IN FIREFOX, and passes every Chromium test.
 */
export interface InlineTextProps {
  /** the committed string. Read once, at the transition into `editing` — see
   *  `editing` below for why this must not be reconciled on every render. */
  value: string
  /** rest-state rendering, if different from `value` (e.g. `VersionedGroup` clamps a
   *  long title to a fixed number of lines with a trailing "…" at rest, but shows the
   *  whole string while editing). Omit to just show `value`. */
  display?: string
  /** shown, italic `--text-3`, wherever `value` is empty. Drawn as an absolutely
   *  positioned overlay BEHIND the caret, never as real content inside the editable
   *  element — as text it would be selectable, committable, and "enter a value" is the
   *  last thing anyone means to save. It survives the click that opens the field (so a
   *  fresh caret does not land in blank space with nothing to say what the row is for)
   *  and leaves on the first keystroke. Omit both this and `value` and nothing renders
   *  at rest (no placeholder text without an editable value at all).
   *
   *  IT IS ALSO THE FIELD'S WIDTH FLOOR. While `editing`, a field with a `placeholder`
   *  is never narrower than the invitation it is showing: `INLINE_EDIT_STYLE`'s
   *  `minWidth: 8` is a last resort for a field with no invitation to measure, and on a
   *  shrink-to-fit host (a `width: fit-content` title) it drew an 8px box behind a 96px
   *  invitation — a ring around the first two letters, not a textbox (owner-reported
   *  2026-09-15 on an unnamed stage). The floor holds for the whole editing session, not
   *  only while the line is blank, so the box does not snap down to one character's width
   *  on the first keystroke. A field already wider than its invitation is unaffected.
   *
   *  THE FLOOR IS IN PIXELS, SO THE HOST MUST LEAVE ROOM FOR IT — at least the
   *  invitation's own width, or the field overflows the row it is in. It cannot be a
   *  percentage clamp: a percentage resolves against this component's wrapper, the
   *  wrapper is shrink-to-fit around the line, and with the line empty that is genuinely
   *  0 — `min(100%, 96px)` measured as a 4px box. `VersionedGroup`'s head already floors
   *  its title column at 96 for its own reasons; a host with less room than its own
   *  invitation should shorten the invitation. `INLINE_FLOOR_CEILING` caps it either way. */
  placeholder?: string
  /** what to render at rest when `value` is empty AND `placeholder` is not being shown
   *  (i.e. not editing) — e.g. a caller drawing nothing rather than a placeholder word
   *  at rest. Omit to fall back to `placeholder` itself at rest. */
  restPlaceholder?: string
  /** true: a `contentEditable` span, focused (unless `autoFocus={false}`), wearing
   *  `INLINE_EDIT_STYLE`. false: plain text, `onClick` opens it (if `onOpen` passed).
   *  SEEDED ONCE: `value` is written into the DOM exactly once, at the transition into
   *  `editing`, and the element's children are otherwise `undefined` — nothing
   *  reconciles it again while editing. A field that re-syncs from `value` on every
   *  render snaps a just-cleared field back to its last-committed text the moment
   *  anything else on the page re-renders, because a commit that clears the value
   *  never actually LANDS in `value` until the caller re-renders with the new prop —
   *  and by then the DOM has already been told to forget what was typed. Reported
   *  2026-08-28 as "deleting the text wouldn't let go of the last character". */
  editing: boolean
  /** fired on click at rest (only when not `editing`) with no argument — the caller
   *  decides what "open" means (in `VersionedGroup` today, nothing: opening is the
   *  pencil's job, not a per-field click; kept for a host that still wants click-to-
   *  open a single field). */
  onOpen?: () => void
  /** fired on Enter or blur with the read-back string — whitespace-collapsed and
   *  trimmed (multi-line values keep internal line breaks, each line separately
   *  trimmed, runs of blank lines collapsed to one). An empty string is a legitimate
   *  value; whether the caller treats it as "clear to placeholder" or refuses it is the
   *  caller's call, made in this handler. */
  onCommit: (value: string) => void
  /** fired on Escape — the caller reverts (a remount, keyed by `editing`, is what
   *  actually restores the last-committed text; this only needs to flip `editing`
   *  back off). */
  onCancel: () => void
  /** the hover tooltip at rest (via `wrapTip` from `chrome/IconButton.jsx`). Never
   *  shown while editing. */
  tooltip?: string
  /** rest-state style. Must include `fontFamily`/`fontSize`/`lineHeight` if a
   *  `placeholder` is passed — the overlay reads them off this object directly rather
   *  than inheriting, since it is a sibling, not a child. */
  style: Record<string, string | number>
  /** extra style merged on top of `INLINE_EDIT_STYLE` while editing — for a caller that
   *  needs one more property (e.g. a specific `width`) without redeclaring the whole
   *  recipe. */
  editStyle?: Record<string, string | number>
  /** where to stash the click point between `onOpen` and the caret landing. Omit to
   *  keep it in an internal ref — only pass this if a caller's own `onOpen` needs to
   *  capture the point itself (e.g. because opening happens via a button, not a click
   *  on this element, so there is no click here to read the point from). */
  pointRef?: { current: { x: number; y: number } | null }
  /** Shift+Enter inserts a line break instead of committing, breaks are preserved and
   *  drawn (`white-space: pre-wrap`), and a paste is line-aware. false (default):
   *  Enter always commits, and a hand-typed break has no meaning — refused both by
   *  keyboard and by paste. */
  multiline?: boolean
  /** With `multiline`: a plain Enter INSERTS a line break and does not commit; the field
   *  commits on blur, on the caller's own control (a pencil clicked again), or on Ctrl/Cmd+Enter.
   *  For prose a person is writing — a note, a paragraph — where Enter means "new line"
   *  (owner, 2026-09-04). ALSO CHANGES THE TIDY ON SAVE: prose keeps every line break as typed
   *  (only the ends are trimmed); without this flag every blank line collapses to a single break,
   *  the right rule for a description and the wrong one for notes. Default false:
   *  Enter commits, Shift+Enter breaks. Ignored without `multiline`. */
  enterInserts?: boolean
  /** false: this field becomes editable alongside others without stealing focus —
   *  for a caller whose "edit mode" opens several `InlineText`s at once and wants
   *  exactly one of them to take the caret. Default true. */
  autoFocus?: boolean
  /** the field fills the height of its container instead of hugging its text — for a host whose
   *  box IS the field (a notes column, a description pane), where a two-line value otherwise
   *  leaves a two-line box on an empty page and the click target stops where the words stop.
   *  IT HAS TO BE A PROP: a percentage height needs a definite parent, and when `placeholder` is
   *  passed this component inserts its own auto-height wrapper between the caller's box and the
   *  line — unreachable from outside, so a caller's `minHeight: '100%'` resolves against nothing;
   *  and `INLINE_EDIT_STYLE`'s `minHeight: '1lh'` beats anything in `style` while editing. Give
   *  the CONTAINER a definite height (a flex child with `min-height: 0`, or a scroller) or this
   *  does nothing. Added 2026-09-03 for `LectureNotes`. */
  fill?: boolean
}
export function InlineText(props: InlineTextProps): JSX.Element

/** THE RECIPE an editing `InlineText` wears — read the values, do not spread the
 *  object; a caller not using `InlineText` directly implements this on its own
 *  editable element. See the doc comment in `chrome/InlineText.jsx` for why each
 *  value is what it is (outline vs. border, the content-box padding cancellation,
 *  the focus-ring suppression). `VersionedGroup.d.ts` re-exports this same object;
 *  it is declared once, here. */
export const INLINE_EDIT_STYLE: Record<string, string | number>

/** the widest a `placeholder` may floor a field (320) — an invitation is copy, and copy can be
 *  any length; past this the field is wide enough to type in and the host's row keeps the rest.
 *  Exported because it is a NUMBER crossing the boundary: a retyped 320 stops tracking a
 *  re-tuned one. */
export const INLINE_FLOOR_CEILING: number
