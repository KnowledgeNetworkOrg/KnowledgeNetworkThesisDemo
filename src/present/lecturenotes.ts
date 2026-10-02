// WHAT A LECTURE LEAVES BEHIND — the notes taken while teaching, the prepared
// notes the professor edited at the lectern, the categories they minted, and the
// shape they dragged the quick actions deck into (#267, parts 6–8).
//
// TWO SCOPES, AND THE SPLIT IS THE WHOLE DESIGN OF THIS FILE:
//
//   · PER LECTURE — the notes and the prepared-note edits. They are about ONE
//     walk's stops, so they are keyed by the walk. Teaching a different walk
//     opens a different notebook; teaching the same one again next term opens
//     the one with last term's notes in it.
//   · USER-WIDE — the minted categories and the habits (the divider's position,
//     where the shelf was dropped, which actions are on the deck). A category
//     the professor minted at one stop belongs to THEM, not to the stop, the
//     walk or the lecture; the DS's `LectureNotes` says so in its contract and
//     this is the half that keeps the promise.
//
// PREPARED NOTES ARE AN OVERLAY, NOT AN EDIT OF THE CORPUS. A walk's stop note
// is authored on the desk, and there is no draft op that writes one from here —
// so the pencil in the notes pane writes into `prepared` in this store, keyed by
// the stop's id, and the pane is handed the override where one exists and the
// stop's own note otherwise. That is a deliberately smaller promise than
// "editing the walk": it means a lectern correction survives the lecture and the
// browser without silently rewriting authored material behind the author's back.
//
// NOTHING HERE THROWS. Every read and write is wrapped: a private-mode browser,
// a full quota or a corrupted value must cost the professor their persistence,
// never their lecture.

import type { NoteCategory } from '@/ds'
import { decodeStored, readPersisted, removePersisted, writePersisted } from '../platform/persisted'
import type { Migration, PersistedSpec } from '../platform/persisted'

/** one note taken during the lecture, as this store keeps it and the pane draws it */
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

/** one walk's notebook */
export interface LectureNotebook {
  /** newest first, which is the order the live column draws */
  notes: LectureNoteRecord[]
  /** stop id → the prepared note as edited at the lectern. Absent = use the
   *  walk's own note */
  prepared: Record<string, string>
}

/** where the professor left the furniture. User-wide, because it is a habit */
export interface LectureHabits {
  /** the notes pane's During column, in px */
  duringWidth?: number
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
const LEGACY_NOTES_KEY = 'pkt.lecture.notes.v1'
const LEGACY_CATEGORIES_KEY = 'pkt.lecture.categories.v1'
const LEGACY_HABITS_KEY = 'pkt.lecture.habits.v1'
const VERSION = 1
/** these payload shapes have not changed; the marker is what makes them migratable */
const identity: Migration = (data) => data

/** WHICH NOTEBOOK THIS LECTURE OPENS. A saved walk has an id and keeps its notes
 *  across sessions; the desk's draft is one moving target, so all of its lectures
 *  share the one 'draft' notebook — which is right, because it is the walk you
 *  are currently building and there is only ever one of it. */
export function notebookKey(source: string, walkId?: string | null): string {
  return NOTES_KEY + ':' + (source === 'saved' && walkId ? 'walk:' + walkId : 'draft')
}

const EMPTY: LectureNotebook = { notes: [], prepared: {} }

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** the pre-#170 name for a notebook key, derived from the versioned one so the
 *  two can never drift apart. `null` for a key outside this module's namespace. */
function legacyNotebookKey(key: string): string | null {
  return key.startsWith(NOTES_KEY) ? LEGACY_NOTES_KEY + key.slice(NOTES_KEY.length) : null
}

/** repair a stored notebook — a missing half gets that half back, which is the
 *  promise this store has always made. A non-object is null: not a notebook. */
function parseNotebook(data: unknown): LectureNotebook | null {
  if (!isObj(data)) return null
  return {
    notes: Array.isArray(data.notes)
      ? (data.notes.filter((n) => isObj(n) && typeof n.text === 'string') as LectureNoteRecord[])
      : [],
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
  if (typeof data.duringWidth === 'number') out.duringWidth = data.duringWidth
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

const NOTEBOOK_SPEC: PersistedSpec<LectureNotebook> = { version: VERSION, migrations: { 0: identity }, parse: parseNotebook }
const CATEGORIES_SPEC: PersistedSpec<NoteCategory[]> = { version: VERSION, migrations: { 0: identity }, parse: parseCategories }
const HABITS_SPEC: PersistedSpec<LectureHabits> = { version: VERSION, migrations: { 0: identity }, parse: parseHabits }

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
 *  half-shaped value: a stored blob missing either half gets that half back */
export function loadNotebook(key: string): LectureNotebook {
  return loadWithLegacy(key, legacyNotebookKey(key), NOTEBOOK_SPEC, EMPTY)
}

export function saveNotebook(key: string, book: LectureNotebook): void {
  writePersisted(key, VERSION, book)
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

export function addNote(book: LectureNotebook, note: Omit<LectureNoteRecord, 'id'>): LectureNotebook {
  const text = (note.text || '').trim()
  if (!text) return book
  return { ...book, notes: [{ ...note, text, id: mintNoteId(note.at) }].concat(book.notes) }
}

export function editNote(book: LectureNotebook, id: string, text: string): LectureNotebook {
  const next = (text || '').trim()
  if (!next) return book
  let hit = false
  const notes = book.notes.map((n) => { if (n.id !== id || n.text === next) return n; hit = true; return { ...n, text: next } })
  return hit ? { ...book, notes } : book
}

export function deleteNote(book: LectureNotebook, id: string): LectureNotebook {
  const notes = book.notes.filter((n) => n.id !== id)
  return notes.length === book.notes.length ? book : { ...book, notes }
}

/** the lectern's correction to a stop's prepared note. An empty string CLEARS
 *  the override rather than storing a blank one — so "select all, delete, enter"
 *  puts the walk's own note back rather than blanking the column forever */
export function setPrepared(book: LectureNotebook, stopId: string, text: string): LectureNotebook {
  const next = (text || '').trim()
  const had = Object.prototype.hasOwnProperty.call(book.prepared, stopId)
  if (!next) {
    if (!had) return book
    const prepared = { ...book.prepared }
    delete prepared[stopId]
    return { ...book, prepared }
  }
  if (had && book.prepared[stopId] === next) return book
  return { ...book, prepared: { ...book.prepared, [stopId]: next } }
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
