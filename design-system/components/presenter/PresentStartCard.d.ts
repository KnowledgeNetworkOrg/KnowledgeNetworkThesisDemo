import type { CSSProperties } from 'react'

export interface StartSession {
  id: string | number
  /** the session's own name, authored — "Section B". EMPTY IS LEGITIMATE: a session is created
   *  unnamed (owner, 2026-10-01) and drawn as `untitledLabel` until the professor renames it */
  name: string
  /** OPTIONAL days it meets, PICKED in the card, as day numbers: 0 = Monday … 6 = Sunday, any
   *  order. The card words them ("Mon/Wed", "Mon–Fri" for a run of three or more, "Every day" for
   *  all seven — `StartMath.meetsLabel`).
   *  Omit or `[]` and the row shows the name alone. REPLACES `days`, a free-text string, removed
   *  2026-10-01 before anything ported it: typed text could not be read back as days */
  meets?: number[]
  /** where this session was last presented. Omit for a session never presented: "Continue" then
   *  reads "From start of walk: <walk>, stop 1" on the open walk. A session spans SEVERAL walks, so this names one */
  last?: {
    walkId: string | number
    /** the walk's title, verbatim — "Forwarding" */
    walk: string
    /** 0-based index of the last stop SHOWN in that walk */
    stop: number
    /** THAT STOP'S NODE ID (2026-10-01). Store it: a loaded walk is editable, and an index moves
     *  when stops are inserted or reordered. With it, and `walks` whose stops carry `id`, the card
     *  finds the stop again (`StartMath.placeIndex`); without it, `stop` is trusted */
    stopId?: string
    /** the walk's stop count. `stop === of - 1` means the walk was finished */
    of?: number
    /** WHEN it was last presented (ms or Date) — the lecture's end. The row prints it at the
     *  right of the NAME line (the pencil and bin take the right of the days line), "Today 14:02" / "Mon 14:02" / "28 Sep", worded by
     *  `StartMath.lastLabel`; the tooltip says "last presented". Omit and it is not drawn */
    at?: number | Date
    /** the stop's own title; given, "Continue" names it after the stop number, emphasised */
    stopTitle?: string
    /** THE STOP'S ADDRESS as the walk numbers it — "2.2" for the second stop of a group (owner,
     *  2026-10-01). Optional: omitted, the card looks the stop up in `walks` (`stops[stop].address`),
     *  and only then prints `stop + 1`. `stop` stays the 0-based flat index either way; the
     *  address is for the WORDS only. "of N" is dropped beside a dotted address (a count beside a
     *  path reads as nonsense: "stop 2.2 of 7") */
    address?: string
  }
}

/** what the professor chose. The card starts nothing itself: navigation, the clock and the
 *  session's record are the host's.
 *  - `'elsewhere'` WITH `walkId` + `stop`: picked in the card's own walk list (`walks` passed).
 *  - `'elsewhere'` WITHOUT them, and `'pick-walk'`: only when `walks` is NOT passed — the card
 *    has nothing to list, so the host opens its own pickers. Pass `walks` and neither occurs. */
export interface StartChoice {
  from: 'continue' | 'pick-walk' | 'reading' | 'elsewhere'
  /** the session the lecture is recorded against; `null` with `newSession` */
  sectionId: string | number | null
  /** the professor started with the NEW session: create an untitled session now and record against it */
  newSession?: boolean
  /** for `continue`: which case of `StartMath.resolve` produced it */
  kind?: 'top' | 'continue' | 'next' | 'choose'
  walkId?: string | number | null
  stop?: number | null
}

/**
 * The card that opens when Present is pressed: choose a session on the left, then where to start.
 * Version D of `ideas/present-class-mark.html` §02, owner-picked 2026-09-30; filed to the app
 * 2026-10-01 (OB-281). Every wording is a prop.
 *
 * WHEN IT OPENS (owner, 2026-10-01): ONLY from the app toolbar's ▶, when nothing is presenting
 * (idle) or the palette's preview is up. Never from the palette's Present preset, which stays a
 * preview; never on resume, which continues the lecture already chosen.
 *
 * WHAT THE HOST MUST DO.
 * - **Store the sessions.** A session belongs to the COURSE, not to one walk, and remembers the
 *   walk and stop it was last presented at (`last`). The card reads it and never writes it:
 *   update `last` when a lecture ends, from the stops the lecture actually stepped through.
 * - **Pass the walk that is open** (`openWalk`) — it is the guess for "next" when the session
 *   finished its walk last time. No walk order is stored anywhere; this is deliberate.
 * - **Do what `onStart` says.** The card resolves the choice; it does not navigate.
 * - **Mount it as a modal** over the screen Present was pressed from, and unmount it on
 *   `onCancel`. It draws its own frame and lift, and nothing outside it.
 *
 * THE ROWS NEVER CHANGE (owner's D over C, 2026-09-30: rows that changed per case were
 * confusing). Three, in order — Continue from last presentation (Enter), Where I'm reading (R), Load
 * another walk (P). Only the first row's title and grey line change, worded by `StartMath.resolve`,
 * not by the host. A session never presented titles it "Start from the beginning":
 * - no `last`                         → "From start of walk: Routing, stop 1"
 * - stopped mid-walk                  → "Forwarding, stop 4 of 7 – <stop title>" (that walk, even if another is open; "of N" dropped beside a dotted address)
 * - finished, another walk open       → "Finished the walk Forwarding" / "Next: Routing, the walk you have open"
 * - finished, the same walk still open → "Finished the walk Forwarding" / "Choose the next walk" (`from: 'pick-walk'`)
 * A finished walk takes TWO grey lines: the walk that was finished, then what Enter does
 * (owner, 2026-10-01 — on one line the walk's name read as a stop's).
 *
 * THE SESSION IS REQUIRED, AND NEVER ASKED FOR. The column is headed "Choose Session" and shows
 * even with none, so "+ New session" is always findable. A NEW, UNTITLED SESSION IS THE DEFAULT
 * (see `selectedId`): the card never creates one by itself, and the starts are always enabled. A
 * start with the new session lit carries `newSession: true` and the HOST creates it then. Clicking
 * the lit "+ New session" calls `onAddSection('')` at once; when the new id appears the card
 * selects it and opens its name for typing. The days line is optional.
 *
 * EDIT is a pencil on each session row, hover-revealed beside the bin. It opens the row as a
 * small form: the NAME at the column's full width (`InlineText`), then a DAY PICKER — seven
 * toggles, Mo Tu We Th Fr Sa Su — and a Done pill; the pencil and bin step aside while it is
 * open. Enter in the name moves to the first day; Done, Escape, or focus leaving the row closes
 * it. `onRenameSection(id, name)` fires when the name changed (trimmed; `''` means untitled).
 * `onSetSectionMeets(id, meets)` fires on EVERY toggle with the whole sorted list (`[]` = no
 * days). Omit `onRenameSection` and no pencil is drawn; omit `onSetSectionMeets` and the days
 * are read-only. Days only, no times of day (owner, 2026-10-01: "days is enough").
 *
 * DELETE is a bin on each session row, hover-revealed (it keeps its space, fades on
 * `--dur-fade`), berry when shown. It CONFIRMS IN THE CARD (owner, 2026-10-01): the row becomes
 * a box — "Delete Section B?", what is lost, Keep and Delete — and only Delete calls
 * `onDeleteSection`. The host must NOT confirm again.
 *
 * "LOAD ANOTHER WALK" IS ONE PAGE INSIDE THE CARD (owner, 2026-10-01; it was "Somewhere else…"). It
 * is `LoadPicker` at the presenter's depth: the open map's walks (`walks`), the open walk first
 * (no "open" note since 2026-10-01), each with its stop count and a disclosure caret. Clicking a walk opens its
 * stops UNDERNEATH it in a `flat` `StopFinder` — its search, ↑↓ and Enter; one walk is
 * open at a time, and clicking it again or Escape in its search closes it. A pick fires `onStart({ from:
 * 'elsewhere', walkId, stop })`. "Back" (the caret turned left) and Escape return to the start rows. The session column
 * stays live throughout. "Continue" on a finished walk with that walk still open opens the walk list
 * too, since there is nothing to guess. DELIBERATE: no search across walks — a remembered stop
 * name whose walk you have forgotten costs a guess (the cost B accepted).
 *
 * KEYS: Enter starts the highlighted row, R and P go straight to theirs, ↑↓ move the highlight
 * (stepping over "Where I'm reading" when there is no `reading`), Escape cancels. All ignored
 * while a text field has focus or a session row is open. THE KEYS ARE NAMED IN EACH ROW'S
 * TOOLTIP, "Continue from last presentation (Enter)", not drawn on the row (owner, 2026-10-01: the key chips
 * were removed). `keys={false}` turns them off for a
 * host with its own key handling.
 */
export interface PresentStartCardProps {
  /** the course or map name. NOT DRAWN IN THE TITLE since 2026-10-01: the title names the walk the
   *  highlighted row would start ("Start presenting — Forwarding"), following hover and ↑↓, and is
   *  bare on a row with no fixed walk. Kept for a screen reader's label of the walk list */
  course?: string
  sections?: StartSession[]
  /** THE CHOSEN SESSION. `null` (the default, and what the host passes on every open) MEANS THE NEW
   *  SESSION (owner, 2026-10-01): "+ New session" is lit, so Enter presents with an untitled
   *  session at once. Nothing is created until a start: the choice then carries `sectionId: null`
   *  and `newSession: true`, and the HOST creates the untitled session and records the lecture
   *  against it. Opening and cancelling creates nothing. Do not pre-select the last-used session:
   *  a professor teaching another group would record against the wrong one. Clicking the lit
   *  "+ New session" creates it at once (`onAddSection('')`) and opens it for a name; the card
   *  then selects it through `onSelectSection`. `onSelectSection(null)` means "the new session".
   *  Scrolled out of the list, a chosen existing session is named by a pill at that edge ("↑ Section
   *  B"); a click scrolls it back — the Explorer rail's edge label */
  selectedId?: string | number | null
  onSelectSection?: (id: string | number) => void
  /** create a session now. Called with `''` — sessions are made unnamed — when the lit "+ New
   *  session" is clicked. Never called by the card on its own. The host stores it and passes it back */
  onAddSection?: (name: string) => void
  /** the new name, trimmed; `''` means untitled. Omit and no pencil is drawn */
  onRenameSection?: (id: string | number, name: string) => void
  /** the whole new list of day numbers, sorted, after one toggle; `[]` = no days. Omit and the
   *  days cannot be edited */
  onSetSectionMeets?: (id: string | number, meets: number[]) => void
  /** called only after the card's own confirmation. Omit and no bin is drawn */
  onDeleteSection?: (id: string | number) => void
  /** the walk open in Explore or Plan when Present was pressed */
  openWalk?: { id: string | number; title: string }
  /** every walk "Load another walk" can start in, each with its stops in walk order. The stops are
   *  `StopFinder` steps (`title`, optional `territory` and `hue`). Omit and the card hands
   *  "Load another walk" and "choose the next walk" to the host (`from: 'elsewhere'` / `'pick-walk'`) */
  walks?: Array<{ id: string | number; title: string; stops: Array<{ title: string; /** the stop's node id — lets a stored `last.stopId` find its stop again */ id?: string; territory?: string; hue?: string; /** the walk's own number for this stop, "1.2" inside a group; omit for a flat walk */ address?: string }> }>
  /** the professor's own reading place; omit and "Where I'm reading" is disabled */
  reading?: { walkId: string | number; walk: string; stop: number; stopTitle?: string; /** "1.2" — as `last.address`, looked up in `walks` when omitted */ address?: string }
  onStart?: (choice: StartChoice) => void
  /** omit and no ✕ is drawn, and Escape does nothing */
  onCancel?: () => void
  /** Enter / R / P / ↑↓ / Escape on the window while mounted. Default `true` */
  keys?: boolean
  /** the instant "Today" is measured from. Default: the clock. A card passes a fixed one */
  now?: number | Date
  /** placeholder wordings, owner-kept 2026-09-30. Defaults: "Start presenting", "Choose Session",
   *  "+ New session", "Untitled session", "Where I'm reading", "Load another walk", and
   *  `elsewhereLine` "" — the row has no grey line (owner, 2026-10-01: renamed from "Somewhere
   *  else…", its "find any walk or stop" line removed) */
  title?: string
  untitledLabel?: string
  sessionsLabel?: string
  newLabel?: string
  /** the first row's title. Default "Continue from last presentation"; a session never presented
   *  shows `beginLabel` instead, default "Start from the beginning" (owner, 2026-10-01). The
   *  session's name is NOT in the title: the chosen session is lit on the left */
  continueLabel?: string
  beginLabel?: string
  readingLabel?: string
  /** the lit "+ New session" row's second line. Default "untitled · click to name it" */
  newLitLine?: string
  elsewhereLabel?: string
  elsewhereLine?: string
  /** default `START_CARD_METRICS.width` (640); capped at 100% of its container */
  width?: number
  style?: CSSProperties
}
/** PRESENTING NEVER CHANGES THE DESK (owner, 2026-10-01, option A). WHAT THE HOST MUST DO WITH A
 *  CHOICE: start the PRESENTER on its walk and stop — and nothing else. Do not load that walk into
 *  Explore or Plan, do not move the desk's focus while presenting, and on leaving return the desk
 *  to exactly where it was before the ▶. Because nothing open on the desk is replaced, the card
 *  asks nothing about unsaved work. The card never loads a map either: it picks a walk and a stop
 *  on the map already open; another map is the toolbar's Load. */
export function PresentStartCard(props: PresentStartCardProps): JSX.Element

/** CHOSEN, not derived: `width` 640 holds the longest grey line on one line at 12px; `side` 210
 *  holds a session name with its days; `row` 52 the start row's minimum height; `icon` 28 its tile.
 *  `metaLine` 22 is DERIVED: the line the pencil and bin sit on, their height. `pairGap` 0 is
 *  CHOSEN: the two touch. `editRows` 2 is CHOSEN: an open session is the name field, then the day
 *  picker — no worded "Meets …" line between them; the lit toggles say it (owner, 2026-10-01).
 *  A press anywhere inside the open row never closes it, in any browser: Safari and Firefox on
 *  macOS do not focus a clicked button, so a port that closes the row on a blur with no
 *  `relatedTarget` drops the day the professor just picked.
 *
 *  A SESSION ROW is two lines — the name with the last-presented time at its right, then the
 *  days with the pencil and bin at theirs — or ONE line, the pair at the right of the name, when
 *  it has neither days nor a last-presented time (owner, 2026-10-01). */
export const START_CARD_METRICS: { width: number; side: number; row: number; icon: number; metaLine: number; pairGap: number; editRows: number; bodyMax: number; pairRecede: boolean }

/** THE CARD'S BODY STOPS AT `bodyMax` (360, CHOSEN). Past it the session list scrolls between its
 *  fixed heading and "+ New session", and the walk list scrolls under "Back". A host must not give
 *  the card a height of its own; it sizes to its content up to this ceiling. */

/** `resolve(section, openWalk, walks?)` → `{ kind, walkId, stop, line, lineEm, next?, nextEm? }`, the four cases above
 *  (`next`, the second grey line, only on a finished walk). `lineEm` / `nextEm` are the same words
 *  as runs, `[text, emphasised][]`: the walk's name and the stop are emphasised (semibold, first
 *  ink; owner, 2026-10-01). Draw the runs, not the plain string, or the emphasis is lost;
 *  `displayName(section, untitled?)` → the name, or the untitled label for an empty one;
 *  `meetsLabel(meets)` → "Mon/Wed", "Mon–Fri", "Mon–Wed/Fri", "Every day", or `''`; `toggleDay(meets, n)` → the sorted list
 *  with day `n` flipped; `lastLabel(at, now?)` → "Today 14:02", "Yesterday 14:02", "Mon 14:02"
 *  within a week, then "28 Sep", "28 Sep 2025" — 24-hour, the time dropped past a week;
 *  `DAY_SHORT` → ['Mon' … 'Sun'], index = day number. */
export const StartMath: {
  resolve: (section: StartSession | { last?: StartSession['last'] } | null, openWalk?: { id: string | number; title: string } | null, walks?: PresentStartCardProps['walks']) =>
    { kind: 'top' | 'continue' | 'next' | 'choose'; walkId: string | number | null | undefined; stop: number | null; line: string; lineEm: Array<[string, boolean]>; next?: string; nextEm?: Array<[string, boolean]> }
  displayName: (section: StartSession | null, untitled?: string) => string
  meetsLabel: (meets?: number[]) => string
  toggleDay: (meets: number[] | undefined, n: number) => number[]
  lastLabel: (at?: number | Date, now?: number | Date) => string
  /** `(walks, walkId, stop, stopId?)` → the stop's index found again by node id, else `stop` */
  placeIndex: (walks: PresentStartCardProps['walks'] | undefined, walkId: string | number, stop: number, stopId?: string) => number
  /** `(reading, walks?)` → the "Where I'm reading" line as runs: "<walk>, stop <address> – <title>", walk and stop emphasised */
  readingRuns: (reading?: PresentStartCardProps['reading'], walks?: PresentStartCardProps['walks']) => Array<[string, boolean]>
  /** `(walks, walkId, stop, own?)` → the stop's address: `own`, else `walks`' `stops[stop].address`, else `stop + 1` */
  stopAddress: (walks: PresentStartCardProps['walks'] | undefined, walkId: string | number | null | undefined, stop: number, own?: string) => string
  /** `(title, key?)` → a start row's tooltip, "Continue from last presentation (Enter)" */
  rowTitle: (title: string, key?: string) => string
  DAY_SHORT: string[]
}
