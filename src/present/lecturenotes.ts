// WHAT A LECTURE LEAVES BEHIND — the notes taken while teaching, the prepared
// notes the professor edited at the lectern, the categories they minted, and the
// shape they dragged the quick actions deck into (#267, parts 6–8).
//
// TWO SCOPES, AND THE SPLIT IS THE WHOLE DESIGN OF THIS FILE:
//
//   · PER LECTURE — the flags. They are about ONE walk's stops, so they are
//     keyed by the walk. Teaching a different walk opens a different notebook;
//     teaching the same one again next term opens the one with last term's
//     notes in it.
//   · PER STOP — the prepared-note edits. A correction belongs to the stop, so
//     it is the same note in every later lecture rather than a copy in one walk.
//   · PER COURSE — the sessions (course sections), keyed by the corpus and root.
//   · USER-WIDE — the minted categories and the habits (the divider's position,
//     where the shelf was dropped, which actions are on the deck). A category
//     the professor minted at one stop belongs to THEM, not to the stop, the
//     walk or the lecture; the DS's `LectureNotes` says so in its contract and
//     this is the half that keeps the promise.
//
// PREPARED NOTES ARE AN OVERLAY, NOT AN EDIT OF THE CORPUS. A walk's stop note
// is authored on the desk, and there is no draft op that writes one from here —
// so the notes pane writes into the per-stop prepared store, and the pane is
// handed the override where one exists and the stop's own note otherwise. That
// is a deliberately smaller promise than "editing the walk": it means a lectern
// correction survives the lecture and the browser without silently rewriting
// authored material behind the author's back.
//
// NOTHING HERE THROWS. Every read and write is wrapped: a private-mode browser,
// a full quota or a corrupted value must cost the professor their persistence,
// never their lecture.

import type { LectureNote, NoteCategory, StartSession } from '@/ds'
import { CORPUS_NAME, ROOT_ID } from '../corpus/graph'
import { platform } from '../platform'
import { decodeStored, readPersisted, removePersisted, writePersisted } from '../platform/persisted'
import type { Migration, PersistedSpec } from '../platform/persisted'

/** the v1 note shape, kept so an old notebook's notes can survive verbatim in `legacy` */
export interface LectureNoteRecord {
  /** minted here, and the identity the pane's pencil and bin name back */
  id: string
  /** a `NoteCategory.key` — one of the defaults or one the professor minted */
  category?: string
  /** what was written. Line breaks are kept as typed */
  text: string
  /** the stop it was written ABOUT — the roamed stop when roaming, which is the
   *  pane's own rule and not this store's */
  stop: number
  /** the lecture clock when it was saved, "12:04" — what the row shows */
  when: string
  /** ms since the epoch, for ordering and for a real clock later */
  at: number
}

/** one flag taken during the lecture — a note, typed or bare, bound to its stop */
export interface LectureFlag extends LectureNote {
  /** minted here, and the identity the pane's pencil and bin name back */
  id: string
  /** the lecture it was taken in */
  lectureId: string
  /** the course section it was taken in, once the host mints one */
  sessionId?: string
  /** the stop it was written ABOUT — the roamed stop when roaming */
  stop: number
  /** the stop's NODE id, so editing the walk later cannot move a flag */
  stopId: string
  /** a `NoteCategory.key` — one of the defaults or one the professor minted */
  category?: string
  /** what was written. Empty for a bare flag */
  text: string
  /** the lecture clock when it was saved, "12:04" — what the row shows */
  when: string
  /** ms since the epoch, for ordering and for a real clock later */
  at: number
  /** ms when the flag was resolved; a resolved flag is kept, never erased */
  resolvedAt?: number
}

/** one walk's notebook */
export interface LectureNotebook {
  /** newest first, which is the order the live column draws */
  notes: LectureFlag[]
  /** the v1 notes, moved here verbatim and no longer read */
  legacy: LectureNoteRecord[]
  /** stop id → the v1 prepared text. Kept as stored; prepared notes are per stop now */
  prepared: Record<string, string>
}

/** the lectern's prepared note for one stop, timed so two notebooks can be ordered */
export interface PreparedNote {
  text: string
  at: number
}

export type PreparedNotes = Record<string, PreparedNote>

/** where the professor left the furniture. User-wide, because it is a habit */
export interface LectureHabits {
  /** the flag type a new flag starts on; absent means the DS default, 'fix' */
  usualFlag?: string
  /** the notes pane's Class chat column, in px */
  chatWidth?: number
  /** the prepared-notes share above the flags, in px */
  preparedHeight?: number
  /** where the deck's shelf was dropped, as a delta from where it opens */
  shelfPosition?: { x: number; y: number }
  /** the deck's layout by action id: the tiles per group, and what is left on
   *  the shelf. Ids, not actions — an action's behaviour is the host's and is
   *  rebuilt every mount; only the arrangement is remembered */
  deck?: { groups: string[][]; library: string[] }
}

// ONE NAMING RULE (#170): a version field inside the payload, not a `.v1` in
// the key. The old names are kept here only so a read can move a lecture's data
// over the one time; nothing new is written under them.
const NOTES_KEY = 'pkt.lecture.notes'
const CATEGORIES_KEY = 'pkt.lecture.categories'
const HABITS_KEY = 'pkt.lecture.habits'
const PREPARED_KEY = 'pkt.lecture.prepared'
const SESSIONS_KEY = 'pkt.lecture.sessions'
const LEGACY_NOTES_KEY = 'pkt.lecture.notes.v1'
const LEGACY_CATEGORIES_KEY = 'pkt.lecture.categories.v1'
const LEGACY_HABITS_KEY = 'pkt.lecture.habits.v1'
const VERSION = 1
const NOTEBOOK_VERSION = 2
/** these payload shapes have not changed; the marker is what makes them migratable */
const identity: Migration = (data) => data

/** WHICH NOTEBOOK THIS LECTURE OPENS. A saved walk has an id and keeps its notes
 *  across sessions; the desk's draft is one moving target, so all of its lectures
 *  share the one 'draft' notebook — which is right, because it is the walk you
 *  are currently building and there is only ever one of it. */
export function notebookKey(source: string, walkId?: string | null): string {
  return NOTES_KEY + ':' + (source === 'saved' && walkId ? 'walk:' + walkId : 'draft')
}

const EMPTY: LectureNotebook = { notes: [], legacy: [], prepared: {} }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** the pre-#170 name for a notebook key, derived from the versioned one so the
 *  two can never drift apart. `null` for a key outside this module's namespace. */
function legacyNotebookKey(key: string): string | null {
  return key.startsWith(NOTES_KEY) ? LEGACY_NOTES_KEY + key.slice(NOTES_KEY.length) : null
}

/** The v1 notebook held `notes` and `prepared`. The notes move to `legacy`
 *  untouched, `notes` starts empty, and `prepared` is kept for the one-time copy
 *  the per-stop store makes. A non-object is left for `parseNotebook` to reject. */
const notebookV1ToV2: Migration = (data) => {
  if (!isObj(data)) return data
  return {
    notes: [],
    legacy: Array.isArray(data.notes) ? data.notes : [],
    prepared: isObj(data.prepared) ? data.prepared : {},
  }
}

/** repair a stored notebook — a missing half gets that half back, which is the
 *  promise this store has always made. `legacy` is handed on exactly as stored,
 *  because the first save would otherwise delete notes the current build cannot
 *  read. A non-object is null: not a notebook. */
function parseNotebook(data: unknown): LectureNotebook | null {
  if (!isObj(data)) return null
  return {
    notes: Array.isArray(data.notes)
      ? (data.notes.filter((n) => isObj(n) && typeof n.text === 'string') as LectureFlag[])
      : [],
    legacy: Array.isArray(data.legacy) ? (data.legacy as LectureNoteRecord[]) : [],
    prepared: isObj(data.prepared) ? (data.prepared as Record<string, string>) : {},
  }
}

function parseCategories(data: unknown): NoteCategory[] | null {
  if (!isObj(data)) return null
  return Array.isArray(data.list) ? data.list.filter((c) => c && c.key && c.glyph && c.label) : []
}

/** THE ONE SHAPE THAT WAS READ UNCHECKED (`#170`). Every field is kept only
 *  when it has the right type, so a stray string cannot reach the layout
 *  arithmetic; a non-object is corrupt, not an empty layout. */
function parseHabits(data: unknown): LectureHabits | null {
  if (!isObj(data)) return null
  const out: LectureHabits = {}
  if (typeof data.usualFlag === 'string' && data.usualFlag) out.usualFlag = data.usualFlag
  if (typeof data.chatWidth === 'number' && Number.isFinite(data.chatWidth)) out.chatWidth = data.chatWidth
  if (typeof data.preparedHeight === 'number' && Number.isFinite(data.preparedHeight)) out.preparedHeight = data.preparedHeight
  const shelf = data.shelfPosition
  if (isObj(shelf) && typeof shelf.x === 'number' && typeof shelf.y === 'number')
    out.shelfPosition = { x: shelf.x, y: shelf.y }
  const deck = data.deck
  if (isObj(deck) && Array.isArray(deck.groups) && Array.isArray(deck.library)) {
    const groups = deck.groups.filter((g): g is string[] => Array.isArray(g) && g.every((id) => typeof id === 'string'))
    const library = deck.library.filter((id): id is string => typeof id === 'string')
    if (groups.length === deck.groups.length && library.length === deck.library.length) out.deck = { groups, library }
  }
  return out
}

function parsePrepared(data: unknown): PreparedNotes | null {
  if (!isObj(data)) return null
  const out: PreparedNotes = {}
  for (const [stopId, note] of Object.entries(data)) {
    if (isObj(note) && typeof note.text === 'string' && typeof note.at === 'number' && Number.isFinite(note.at))
      out[stopId] = { text: note.text, at: note.at }
  }
  return out
}

function parseSessions(data: unknown): StartSession[] | null {
  if (!Array.isArray(data)) return null
  return data.filter((s): s is StartSession =>
    isObj(s) && (typeof s.id === 'string' || typeof s.id === 'number') && typeof s.name === 'string')
}

const NOTEBOOK_SPEC: PersistedSpec<LectureNotebook> = { version: NOTEBOOK_VERSION, migrations: { 0: identity, 1: notebookV1ToV2 }, parse: parseNotebook }
const CATEGORIES_SPEC: PersistedSpec<NoteCategory[]> = { version: VERSION, migrations: { 0: identity }, parse: parseCategories }
const HABITS_SPEC: PersistedSpec<LectureHabits> = { version: VERSION, migrations: { 0: identity }, parse: parseHabits }
const PREPARED_SPEC: PersistedSpec<PreparedNotes> = { version: VERSION, migrations: { 0: identity }, parse: parsePrepared }
const SESSIONS_SPEC: PersistedSpec<StartSession[]> = { version: VERSION, migrations: { 0: identity }, parse: parseSessions }

/** Read the versioned key; when NOTHING is stored under it, its pre-#170 name
 *  ONCE, moving the value over and dropping the old key. A corrupt or
 *  newer-build payload under the versioned name reads as the fallback — the seam
 *  has already reported it — and is not a reason to go back to the old name:
 *  that copy is older than whatever the new key holds, and moving it over would
 *  overwrite a newer build's notes. */
function loadWithLegacy<T>(key: string, legacyKey: string | null, spec: PersistedSpec<T>, fallback: T): T {
  const current = readPersisted(key, spec)
  if (current.data !== undefined) return current.data
  if (current.status === 'absent' && legacyKey) {
    const legacy = decodeStored(legacyKey, spec)
    if (legacy.data !== undefined) {
      // Only a bare, pre-envelope payload is moved — the one shape these old names
      // ever held, which reads as `migrated`. Commit the value as it was STORED
      // (`writeBack`), not as `parse` returned it, the same rule `readPersisted`
      // follows: otherwise a store whose parse unwraps writes back a shape its own
      // reader rejects (categories: stored `{list}`, read as a bare list) and loses
      // the data on the next load (#170). Anything else under an old name is shown
      // this session and left where it is, not moved in a shape nobody checked.
      if (legacy.status === 'migrated' && legacy.writeBack !== undefined) {
        const moved = writePersisted(key, spec.version, legacy.writeBack)
        // the old key goes only once the new one has landed: a refused write (full
        // storage) must not cost the person their only copy
        if (moved) removePersisted(legacyKey)
      }
      return legacy.data
    }
  }
  return fallback
}

/** the walk's notebook, or an empty one. Never throws and never returns a
 *  half-shaped value: a stored blob missing a part gets that part back */
export function loadNotebook(key: string): LectureNotebook {
  return loadWithLegacy(key, legacyNotebookKey(key), NOTEBOOK_SPEC, EMPTY)
}

export function saveNotebook(key: string, book: LectureNotebook): void {
  writePersisted(key, NOTEBOOK_VERSION, book)
}

/** THE COURSE'S SESSIONS. A session is a section, not one delivery; it belongs to
 *  the course, and both corpora root at `'root'`, so the corpus names it too. */
export function sessionsKey(corpus = CORPUS_NAME, root = ROOT_ID): string {
  return SESSIONS_KEY + ':' + corpus + ':' + root
}

export function loadSessions(key: string): StartSession[] {
  return readPersisted(key, SESSIONS_SPEC).data ?? []
}

export function saveSessions(key: string, list: StartSession[]): void {
  writePersisted(key, VERSION, list)
}

/** THE FIRST LOAD OF THE PER-STOP STORE moves the v1 notebook overrides into it.
 *  A prepared edit has no time of its own, so it takes the newest note time in
 *  its notebook; where two notebooks wrote one stop, the later note wins and a
 *  tie goes to the key that sorts last. The key is written even when nothing was
 *  found, so this runs once. */
function copyPreparedOnce(): PreparedNotes {
  const out: PreparedNotes = {}
  let keys: string[] = []
  try {
    keys = platform.storage.keys(NOTES_KEY + ':').slice().sort()
  } catch {
    keys = []
  }
  for (const key of keys) {
    const read = decodeStored(key, NOTEBOOK_SPEC)
    if (read.status === 'corrupt' || read.status === 'future' || !read.data) continue
    let at = 0
    for (const n of read.data.legacy) {
      if (isObj(n) && typeof n.at === 'number' && Number.isFinite(n.at) && n.at > at) at = n.at
    }
    for (const n of read.data.notes) {
      if (typeof n.at === 'number' && Number.isFinite(n.at) && n.at > at) at = n.at
    }
    for (const [stopId, text] of Object.entries(read.data.prepared)) {
      if (typeof text !== 'string' || !text.trim()) continue
      const had = out[stopId]
      // keys are ascending, so `>=` hands a tie to the notebook that sorts last
      if (!had || at >= had.at) out[stopId] = { text, at }
    }
  }
  writePersisted(PREPARED_KEY, VERSION, out)
  return out
}

export function loadPrepared(): PreparedNotes {
  const read = readPersisted(PREPARED_KEY, PREPARED_SPEC)
  if (read.data !== undefined) return read.data
  if (read.status === 'absent') return copyPreparedOnce()
  return {}
}

export function savePrepared(prepared: PreparedNotes): void {
  writePersisted(PREPARED_KEY, VERSION, prepared)
}

/** the categories the professor has minted, appended to the system's own three.
 *  The defaults are NOT stored: they are the DS's and may change, and a stored
 *  copy would pin last month's set forever */
export function loadMintedCategories(): NoteCategory[] {
  return loadWithLegacy(CATEGORIES_KEY, LEGACY_CATEGORIES_KEY, CATEGORIES_SPEC, [])
}

export function saveMintedCategories(list: NoteCategory[]): void {
  writePersisted(CATEGORIES_KEY, VERSION, { list })
}

export function loadHabits(): LectureHabits {
  return loadWithLegacy(HABITS_KEY, LEGACY_HABITS_KEY, HABITS_SPEC, {})
}

export function saveHabits(h: LectureHabits): void {
  writePersisted(HABITS_KEY, VERSION, h)
}

/* ── the arithmetic, pure ───────────────────────────────────────────────────
   Each takes a notebook and returns a new one. Kept apart from the storage
   above so the wiring can be tested without a browser, and so a note added
   twice by a double-render cannot be a storage bug. */

let seq = 0
/** a note's id: the clock plus a counter, because two notes saved inside one
 *  millisecond are two notes */
export function mintNoteId(at: number): string {
  seq += 1
  return 'n' + at.toString(36) + '-' + seq.toString(36)
}

export function addFlag(book: LectureNotebook, flag: Omit<LectureFlag, 'id'>): LectureNotebook {
  const text = (flag.text || '').trim()
  return { ...book, notes: [{ ...flag, text, id: mintNoteId(flag.at) }].concat(book.notes) }
}

export function setFlagText(book: LectureNotebook, id: string, text: string): LectureNotebook {
  const next = (text || '').trim()
  let hit = false
  const notes = book.notes.map((n) => { if (n.id !== id || n.text === next) return n; hit = true; return { ...n, text: next } })
  return hit ? { ...book, notes } : book
}

export function setFlagCategory(book: LectureNotebook, id: string, category: string | undefined): LectureNotebook {
  let hit = false
  const notes = book.notes.map((n) => {
    if (n.id !== id || n.category === category) return n
    hit = true
    const next = { ...n }
    if (category === undefined) delete next.category
    else next.category = category
    return next
  })
  return hit ? { ...book, notes } : book
}

export function resolveFlag(book: LectureNotebook, id: string, at: number): LectureNotebook {
  let hit = false
  const notes = book.notes.map((n) => {
    if (n.id !== id || n.resolvedAt != null) return n
    hit = true
    return { ...n, resolvedAt: at }
  })
  return hit ? { ...book, notes } : book
}

/** "flagged" is derived, never stored: the stops with an unresolved flag */
export function flaggedStops(book: LectureNotebook): Set<string> {
  const out = new Set<string>()
  for (const n of book.notes) if (!n.resolvedAt) out.add(n.stopId)
  return out
}

/** the lectern's correction to a stop's prepared note. An empty string CLEARS
 *  the override rather than storing a blank one — so "select all, delete, enter"
 *  puts the walk's own note back rather than blanking the column forever */
export function setPrepared(prepared: PreparedNotes, stopId: string, text: string, at: number): PreparedNotes {
  const next = (text || '').trim()
  const had = Object.prototype.hasOwnProperty.call(prepared, stopId)
  if (!next) {
    if (!had) return prepared
    const out = { ...prepared }
    delete out[stopId]
    return out
  }
  if (had && prepared[stopId].text === next) return prepared
  return { ...prepared, [stopId]: { text: next, at } }
}

export interface CreatedSession {
  sessions: StartSession[]
  id: string
}

export function createSession(list: StartSession[], at: number): CreatedSession {
  const id = mintNoteId(at)
  return { sessions: list.concat({ id, name: '' }), id }
}

export function renameSession(list: StartSession[], id: string | number, name: string): StartSession[] {
  const next = (name || '').trim()
  let hit = false
  const sessions = list.map((s) => {
    if (String(s.id) !== String(id) || s.name === next) return s
    hit = true
    return { ...s, name: next }
  })
  return hit ? sessions : list
}

export function setSessionMeets(list: StartSession[], id: string | number, meets: number[]): StartSession[] {
  const next = Array.from(new Set(meets.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))).sort((a, b) => a - b)
  let hit = false
  const sessions = list.map((s) => {
    if (String(s.id) !== String(id)) return s
    const had = Array.isArray(s.meets) ? s.meets : []
    if (had.length === next.length && had.every((n, i) => n === next[i])) return s
    hit = true
    return { ...s, meets: next }
  })
  return hit ? sessions : list
}

export function deleteSession(list: StartSession[], id: string | number): StartSession[] {
  const sessions = list.filter((s) => String(s.id) !== String(id))
  return sessions.length === list.length ? list : sessions
}

export function writeSessionLast(list: StartSession[], id: string | number, last: StartSession['last']): StartSession[] {
  let hit = false
  const sessions = list.map((s) => {
    if (String(s.id) !== String(id)) return s
    hit = true
    if (!last) {
      const next = { ...s }
      delete next.last
      return next
    }
    // stored as ms: a Date would serialise as a string and stop being a time
    if (last.at instanceof Date) return { ...s, last: { ...last, at: last.at.getTime() } }
    return { ...s, last }
  })
  return hit ? sessions : list
}

/* ── the deck's layout ──────────────────────────────────────────────────────
   Stored as ids so the actions themselves stay the host's: each mount rebuilds
   the real handlers (they close over this render's state) and then arranges them
   the way the professor left them. An id in the store that no longer exists is
   dropped; an action the store has never heard of is appended to the shelf, so
   a new action shipped next release ARRIVES rather than being invisible. */

/** the saved arrangement, as ids */
export function serialiseDeck(groups: { actions: { id: string }[] }[], library: { id: string }[]): { groups: string[][]; library: string[] } {
  return { groups: groups.map((g) => g.actions.map((a) => a.id)), library: library.map((a) => a.id) }
}

/** put this mount's real actions where the saved layout says. `groups` is the
 *  DEFAULT arrangement — its group labels and its shape (how many tiles each
 *  group holds) are the design's, and a stored layout only decides WHICH action
 *  sits in each slot. A stored group with the wrong number of slots is ignored
 *  rather than reshaping the deck. */
export function applyDeck<A extends { id: string }, G extends { label?: string; actions: A[] }>(
  saved: { groups: string[][]; library: string[] } | undefined,
  groups: G[],
  library: A[],
): { groups: G[]; library: A[] } {
  if (!saved || !Array.isArray(saved.groups)) return { groups, library }
  const known: Record<string, A> = {}
  groups.forEach((g) => g.actions.forEach((a) => { known[a.id] = a }))
  library.forEach((a) => { known[a.id] = a })
  if (saved.groups.length !== groups.length) return { groups, library }
  const used: Record<string, true> = {}
  const nextGroups = groups.map((g, i) => {
    const ids = saved.groups[i]
    if (!Array.isArray(ids) || ids.length !== g.actions.length) return g
    const picked = ids.map((id) => known[id]).filter((a): a is A => !!a)
    if (picked.length !== g.actions.length) return g
    picked.forEach((a) => { used[a.id] = true })
    return { ...g, actions: picked }
  })
  // anything the saved layout did not place is shelf: the saved shelf order
  // first, then whatever this release added, so a new action is always findable
  nextGroups.forEach((g) => g.actions.forEach((a) => { used[a.id] = true }))
  const savedShelf = (Array.isArray(saved.library) ? saved.library : []).map((id) => known[id]).filter((a): a is A => !!a && !used[a.id])
  savedShelf.forEach((a) => { used[a.id] = true })
  const rest = Object.keys(known).map((id) => known[id]).filter((a) => !used[a.id])
  return { groups: nextGroups, library: savedShelf.concat(rest) }
}
