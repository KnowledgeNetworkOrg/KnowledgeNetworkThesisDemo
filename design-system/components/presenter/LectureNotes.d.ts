import type { ReactNode } from 'react'

export interface NoteCategory {
  /** the value stored on an entry's `category` — the host's own string, never a fixed union */
  key: string
  /** ONE typed character inside a coloured box; the box is what says "type" */
  glyph: string
  /** lower case, two or three words — the tag's tooltip, the menu row, no longer a bare flag's text (it reads "enter description" since 15 Oct) */
  label: string
  /** the ring's and the tally's short word ("fix" for "fix this slide"). Falls back to `label` */
  short?: string
  /** the tag box's fill. Any colour: a closed union here compiles into a lint rule against hosts */
  wash: string
}

/** ONE FLAG — and, since v4 (owner, 6 Oct), every typed note too: "the textbox is just another way
 *  for the prof to flag the slide". A flag pressed on the chip is a note with a type and no words
 *  yet; a note typed with no type is a plain flag. One kind of row, one list, one store. */
export interface LectureNote {
  id?: string | number
  /** a `NoteCategory.key`. Absent = a plain flag (the tally's empty dashed slot). An unknown key draws no
   *  tag rather than a fallback one — a wrong type is worse than none */
  category?: string
  /** the words. EMPTY for a bare flag (pressed, no words yet): the row shows "enter description" in
   *  the placeholder's italic third ink (owner, 15 Oct); a click on it opens the words. May contain `\n` */
  text: string
  /** the time, verbatim, mono — the host's clock ("10:21"). The pane never formats it */
  when?: string
  /** WHEN IT WAS MADE, ms. With it the row is FRESH for `LECTURE_NOTES_METRICS.undoMs` (2000):
   *  washed in its own type's colour (a quarter strength), so the eye finds what just landed; when the time is up the wash fades out over `freshFadeMs` (1500, CHOSEN), not the quick hover fade. No undo (owner, 15 Oct): a fresh row is
   *  edited or resolved like any other. Stamp it on every new
   *  entry, chip-made or typed. Omit and the row is never fresh */
  at?: number
  /** WHEN IT WAS RESOLVED, ms. DELETE RESOLVES (owner, 6 Oct): the host stamps this from
   *  `onResolveEntry` and KEEPS the entry, so the slide's history survives for the review of flags.
   *  The bin ASKS FIRST ("Delete this flag?", Keep / Delete, owner 15 Oct); confirmed, the row
   *  leaves both lists at once, with no strikethrough. A resolved flag is counted nowhere */
  resolvedAt?: number
  /** THE STOP'S INDEX — stamped by `onSave` when the pane is given `stop`; the host stamps it on a
   *  chip-made flag itself. What the pane reads to filter the live list and group the review */
  stop?: number
  /** the review group's head verbatim — an override for "stop N · Title" from `stops` */
  stopLabel?: string
}

/**
 * The notes pane — v4 (owner, 6 Oct; `ideas/flags-and-notes-v4.html`).
 *
 * WHAT IS ON IT. Two columns with a draggable divider, as before; what they hold changed.
 *  - THE LEFT COLUMN, from the top: the slide's title (the head), the PREPARED NOTES, a HORIZONTAL
 *    DIVIDER, the "Flags" head with its TALLY, this slide's FLAGS, and the COMPOSER at the foot.
 *  - THE RIGHT COLUMN is the CLASS CHAT, PARKED until the student app exists. It stays on screen
 *    because it is coming, starting at its minimum width (220); `chat` fills it when it exists.
 *  - NO FLAG BUTTON. It moved to the film roll's current frame (`FilmRoll onFlag` → `FlagChip`).
 *    The old head flag (`flagged`, `onToggleFlag`) is gone; passing it does nothing.
 *
 * WHAT THE COLUMN AROUND IT MUST DO — unchanged, and a port can get every prop right and still
 * break them:
 *   1. THIS PANE IS THE `flex: 1; min-height: 0` CHILD of the presenter's flex column, under the
 *      strip (`flex: none`). Do not give it a height; do not `position: absolute` it.
 *   2. IT OWNS ITS OWN SCROLL — the prepared notes scroll inside their share and the flags inside
 *      theirs. Never wrap the pane in a scrolling ancestor.
 *   3. THE COMPOSER IS OUTSIDE THE SCROLLER, pinned to the foot of the left column.
 *   4. BOTH DIVIDERS ARE THE PANE'S, AND SO ARE THEIR CLAMPS. Set the chat's width only through
 *      `chatWidth`, the prepared height only through `preparedHeight`.
 *
 * WHAT THE HOST MUST DO FOR FLAGS (the v4 model). ONE LIST for the lecture, newest-first, every
 * entry stamped with its `stop` and `at`; the chip's `onFlag` and the composer's `onSave` both add
 * to it. Pass the whole list with `stop` (the shown slide's index): the pane shows that slide's
 * flags, OLDEST AT THE TOP and the newest at the foot beside the composer, and scrolls so the newest
 * always shows. Delete RESOLVES — stamp `resolvedAt`, never erase — and the pane drops resolved rows
 * at once. THE BIN ASKS FIRST, on a line under the flag (the flag stays in view): "Delete this
 * flag?", Keep (focused) then Delete; Escape or a click outside keeps (owner, 15 Oct). A slide is "flagged" (the film roll's plain mark, the recap's
 * count) while it has an entry with no `resolvedAt`; DERIVE that, never store a second bit.
 *
 * THE PREPARED NOTES ARE PLAIN TEXT ON THE PAGE, AND A CLICK EDITS THEM (owner, 6 Oct, reversing the
 * 4 Sep "the pencil is the only way in"). No shaded box, no pencil. Under the pointer: a faint
 * outline and a text cursor. Clicked: editing at once (`InlineText`, multiline, ⏎ breaks a line);
 * Esc or a click outside saves and leaves. A stray click mid-lecture only puts a cursor in it:
 * nothing changes until the professor types, and the projector never shows it. EDITING CHANGES THE
 * NOTE FOR EVERY LATER LECTURE (owner, Q1: no per-lecture copies); a stray edit is undone by the
 * app-wide undo the owner plans, not by anything here.
 *
 * THE HORIZONTAL DIVIDER between the prepared notes and the flags is the column divider turned
 * over: the same hairline, accent while dragging, double-click to reset (to 150). Each side keeps a
 * floor (60 / 96), so neither can be dragged shut, and the drag stops where the flags would go
 * under theirs. At rest the two boxes are flex items, so a stored height larger than the column
 * gives way instead of pushing the flags out. Persist the height through `onPreparedHeightChange`.
 *
 * A FLAG ROW: one line where the words allow — the type tag, the words, the time at the right.
 * A bare flag shows "enter description", the open box's own placeholder (owner, 15 Oct). ITS WORDS ARE CLICK-TO-EDIT, like the prepared
 * notes (owner, 15 Oct): a faint outline and a text cursor under the pointer, a click opens them in
 * place; there is no pencil. Under the pointer, the bin, which
 * RESOLVES. It appears and leaves with the row's wash, no grace period, in class as in review
 * (`liveRecede`, `reviewRecede` false). It covers the time rather than
 * pushing the words. CLICK THE TAG TO CHANGE THE TYPE (`onEntryCategoryChange`): it opens the
 * composer's own type list. A NOTE WITH NO TYPE KEEPS THE TAG'S PLACE (owner, 21 Oct): an empty dashed
 * slot where the tag goes, so every row's words start at one indent; under the pointer it shows "+"
 * and opens the same list. No "+" among the hover actions. A FRESH row (made within 2s) is washed in its own type's colour (a quarter strength); the
 * wash fades and the flag stays. There is no "+ why" and no undo (owner, 15 Oct). Only the row's own words select.
 *
 * THE TALLY beside "Flags" counts this slide's flags by type: ONLY A TYPE WITH A COUNT SHOWS (no
 * faded zeros, owner 15 Oct). Untyped notes count LAST in the same shape as the rest: their empty
 * dashed slot, then the number (owner, 21 Oct, replacing "N plain"), only when there are any. "N
 * flags" sits at the right. Resolved flags are not counted. NEITHER SHOWS ON A SLIDE WITH NO OPEN
 * FLAGS: the head is "Flags" alone until the first one lands (owner, 15 Oct). The review copy does
 * the same over the whole lecture: no tally and no "N slides · N flags" when nothing is flagged.
 *
 * THE COMPOSER is today's, moved from the old right column to the foot of the left. It starts with
 * NO TYPE; its type button drops the type list (the three flag types first, then the user's own,
 * then "no type", then "new type…"). ⏎ saves, Shift+⏎ breaks a line. CLEARING THE DRAFT IS THE
 * HOST'S.
 *
 * WHO MAY SEE THESE NOTES — RULED BY THE OWNER 2026-09-09 (OB-166): the prepared notes and every
 * flag are the PROFESSOR'S OWN; NOTHING here is ever shown to the class. The prepared notes are NOT
 * the stop's audience-facing `note`; they belong in the LECTURE's own store, keyed by stop. No
 * projected surface reads this pane.
 *
 * A TYPE THE PROFESSOR MINTS IS USER-WIDE, and persisting it is the host's obligation: it must be
 * there at the next slide, in the next lecture, after a reload, on any device. Persist it against
 * the USER and hand the same list to every mount — this pane, the film roll's and the recap's chips.
 *
 * `variant="review"` IS THE RECAP'S COPY: one column, every flag of the lecture grouped by slide
 * in walk order, each slide oldest-first, hairlines between slides only. The head is "Flags" with
 * the tally and "N slides · N flags". Pass `selectedStop` and `onSelectStop`: a click on a slide's
 * head or any of its rows selects that slide (for the recap's viewer), and the selected slide's
 * group is washed. Rows keep edit / resolve / type change.
 */
export interface LectureNotesProps {
  /** `live` (default): the two-column lecture pane. `review`: the recap's one-column copy */
  variant?: 'live' | 'review'
  /** 1-based; the left head's FALLBACK when `stopTitle` is absent, and what resets the editor */
  stopNumber?: number
  /** the slide's title — THE LEFT HEAD ITSELF */
  stopTitle?: string
  /** the shown slide is not the projected one; the head's note says "roaming". While roaming the
   *  pane, the list and the flag chip all follow the slide being looked at */
  roaming?: boolean
  /** the prepared notes — a STRING (editable on click, with `onPreparedCommit`) or rich nodes */
  prepared?: ReactNode
  /** what the prepared box says when empty; also the editor's placeholder. Default "nothing was
   *  written for this slide." */
  preparedEmpty?: string
  /** a click on the prepared notes edits them in place (string `prepared` only); this fires on
   *  Esc / click outside / blur with the text, ONLY WHEN IT CHANGED. The store is the host's */
  onPreparedCommit?: (text: string) => void
  /** for rich-node `prepared`: a click asks the host to open its own editor */
  onEditPrepared?: () => void
  /** the prepared notes' height above the flags, px — for a host that PERSISTS the divider.
   *  Authoritative at rest, ignored during the drag. Default `LECTURE_NOTES_METRICS.prepared` */
  preparedHeight?: number
  /** the drag's report on mouse-up, and the double-click reset's. Store it as given */
  onPreparedHeightChange?: (height: number) => void
  /** THE WHOLE LECTURE'S flags, newest first, each stamped `stop` and `at`. See the model above */
  entries?: LectureNote[]
  /** the type list. Default `NOTE_CATEGORIES`. USER-WIDE: persist it against the user */
  categories?: NoteCategory[]
  draft?: string
  onDraftChange?: (draft: string) => void
  /** the composer's chosen type key. `undefined` = not chosen yet, and the composer shows `usualFlag`
   *  (owner, 15 Oct); `null` = "no type", picked from the list — `onCategoryChange` hands back `null`
   *  for it, never `undefined`. Omit both for an uncontrolled composer that starts on `usualFlag` */
  category?: string | null
  onCategoryChange?: (key: string | null) => void
  /** the film roll's usual type — pass the SAME key as `FilmRoll usualFlag`, so a typed note and a
   *  tapped flag default to one kind. Default 'fix' (both defaults agree) */
  usualFlag?: string
  /** the composer saved: `{ category?, text, stop? }`, text trimmed, may contain `\n`. Add an entry
   *  with `when` and `at`; clear the draft */
  onSave?: (note: { category?: string; text: string; stop?: number }) => void
  /** shows "new type…" in the composer's menu and receives the FINISHED type. Persist it against
   *  the user */
  onAddCategory?: (category: NoteCategory) => void
  /** @deprecated renamed `onAddCategory` (2026-09-03); still read */
  onNewCategory?: (category: NoteCategory) => void
  /** a click on a row's words edited them in place; fires only when they changed */
  onEntryCommit?: (note: LectureNote, text: string) => void
  /** the row's tag picked a new type (`undefined` = no type). Omit and the tag is not a button */
  onEntryCategoryChange?: (note: LectureNote, key: string | undefined) => void
  /** THE BIN — DELETE RESOLVES. Stamp `resolvedAt` and keep the entry. Omit and there is no bin */
  onResolveEntry?: (note: LectureNote) => void
  /** @deprecated v4 — renamed `onResolveEntry` because its MEANING changed: delete no longer erases.
   *  Still read; A HOST ON THIS NAME THAT FILTERS THE ENTRY OUT IS NOW ERASING HISTORY — switch it
   *  to stamping `resolvedAt` */
  onDeleteEntry?: (note: LectureNote) => void
  /** @deprecated 15 Oct — the fresh row's "undo" was removed (owner). Never called; resolve instead */
  onUndoEntry?: (note: LectureNote) => void
  /** @deprecated 15 Oct — the resolved row's "undo" was removed (owner). Never called */
  onRestoreEntry?: (note: LectureNote) => void
  /** default "a note for this slide…" */
  composerPlaceholder?: string
  /** the Class chat column's width, px, for a host that PERSISTS the column divider. Default 220 */
  chatWidth?: number
  onChatWidthChange?: (width: number) => void
  /** @deprecated v4 — the right column is the Class chat now, not "During class"; renamed
   *  `chatWidth`. Still read. A STORED During width (300 by default) will open the parked chat wide:
   *  store the new setting under a new key */
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
  onMenuOpenChange?: (open: boolean) => void
  /** the pane's legend. Default "notes" live, "notes from this lecture" in review */
  title?: string
  /** the list's head. Default "Flagged during lecture" live (owner, 15 Oct), "Flags" in review */
  flagsLabel?: string
  /** REVIEW: the slide the recap's viewer is showing — its group is washed */
  selectedStop?: number
  /** REVIEW: a click on a slide's head or one of its rows asks to show that slide */
  onSelectStop?: (stop: number) => void
  /** LIVE: the shown slide's index — the list filters to it and `onSave` stamps it */
  stop?: number
  /** the walk's titles by index — review heads each group "stop N · Title" */
  stops?: string[]
  /** REVIEW: a right-hand column beside the flags, under its own head, a hairline between — the
   *  recap's preview of the shown slide (owner, 21 Oct). `LectureRecap` passes it; a host does not */
  aside?: React.ReactNode
  /** REVIEW: the aside column's head. Default "Preview" */
  asideLabel?: string
  /** REVIEW: the aside column's width. Default `LECTURE_NOTES_METRICS.aside` (360) */
  asideWidth?: number
  style?: React.CSSProperties
}
export function LectureNotes(props: LectureNotesProps): JSX.Element

/** THE PARTS, published so a card can READ them (`String(NS.LectureNotes)` holds only the exported
 *  body). Read them; do not render them — they take undocumented internal props. */
export const LECTURE_NOTES_PARTS: { FlagRow: unknown; Composer: unknown; CategoryTag: unknown; Trigger: unknown; PopRow: unknown; Head: unknown; FlagTally: unknown; TypeList: unknown }

/** the list's arithmetic, the same function objects the pane runs: `fresh(e, now)`, `lingering(e,
 *  now)` (always false since 15 Oct: a resolved row leaves at once; kept for hosts that read it), `visible(e, now)`, `nextExpiry(entries, now)`. Use them in a
 *  host that must agree with the pane about which rows are showing. */
export const NoteFlagMath: {
  fresh(e: LectureNote, now: number): boolean
  lingering(e: LectureNote, now: number): boolean
  visible(e: LectureNote, now: number): boolean
  nextExpiry(entries: LectureNote[], now: number): number
}

/** THE NOTES PANE'S `PaneFit` — pass it to `clampDesk`; never type 522. DERIVED:
 *  `gutter * 2 + chatMin + divider + preparedMin`. `minHeight` (340, CHOSEN from a measurement of
 *  332) is the HEIGHT the host must give the pane at least: below it, scroll the host's column, never
 *  squeeze the pane (the flags stop scrolling and the composer falls under the clip). */
export const LECTURE_NOTES_FIT: { narrowBelow: number; floor: number; minHeight: number }

/** the default types: unclear `?` (cobalt, key 'question'), fix this slide `!` (amber), follow up
 *  `→` (teal). The first three of any list are the flag types, the only ones on the ring */
export const NOTE_CATEGORIES: NoteCategory[]

/** HOW FAR EACH TYPE GLYPH IS MOVED DOWN, in em, so its INK sits on its box's centre (owner, 21 Oct:
 *  the "!" sat high). DERIVED from JetBrains Mono's metrics, measured 2026-10-21: the glyph's ink
 *  centre minus 0.27em, the point a `lineHeight: 1` box centres. "!" and "?" 0.09, "→" 0. A port draws
 *  every type glyph through `TagGlyph` rather than re-applying these by hand; a glyph not listed is
 *  drawn unmoved, so a glyph added to the pool needs its value added here. Re-measure if the mono
 *  face changes. */
export const GLYPH_DROP: Record<string, number>

/** one type glyph, moved onto its box's centre by `GLYPH_DROP`. Place it as the only child of a
 *  grid- or flex-centred box (it must be a grid or flex item for its transform to apply) */
export function TagGlyph(props: { glyph: string }): JSX.Element

/** THE UNSPENT GLYPHS — the only sanctioned way to mint a type. Placeholders (owner, 2026-09-03) */
export const NOTE_CATEGORY_POOL: {
  slots: { glyph: string; wash: string }[]
  free(categories?: NoteCategory[]): { glyph: string; wash: string }[]
  next(categories?: NoteCategory[]): { glyph: string; wash: string } | null
  make(label: string, categories?: NoteCategory[], slot?: { glyph: string; wash: string }): NoteCategory | null
}

/** THE RETURN-KEY ARROW, drawn once; inherits `currentColor` */
export function EnterMark(props: { size?: number; style?: React.CSSProperties }): JSX.Element

/** The pane's numbers. `chat`/`chatMin` 220 (the chat starts at its floor), `preparedMin` 260 (the
 *  left column's floor), `divider` 14 (both hit strips); `prepared` 150, `preparedMinH` 60,
 *  `flagsMinH` 96 (the horizontal divider's default and floors, CHOSEN on the v4 drawing);
 *  `undoMs` 2000 (CHOSEN, owner 16 Oct, was 4000: the fresh wash; the undo it was named for and the resolved linger are gone); `rowTag` 16 (a row's tag); the
 *  composer's own geometry; `reviewRecede` and `liveRecede` false (CHOSEN: a row's actions leave with
 *  its wash); `headClear` 8; `legendInset` (DERIVED). */
export const LECTURE_NOTES_METRICS: {
  chat: number; chatMin: number; preparedMin: number; divider: number
  /** the review copy's aside column (the recap's preview), 360 — the quick actions deck's column, so
   *  nothing moves sideways when the lecture ends. `LECTURE_RECAP_METRICS.aside` reads this one */
  aside: number
  prepared: number; preparedMinH: number; flagsMinH: number; undoMs: number; rowTag: number; freshFadeMs: number
  composer: number; composerLines: number; composerLineH: number; tag: { w: number; h: number }; gutter: number; popover: number
  glyphPanel: number; actions: number; reviewRecede: boolean; liveRecede: boolean; headClear: number; legendInset: number
}
