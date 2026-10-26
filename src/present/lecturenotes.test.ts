import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addFlag, applyDeck, createSession, deleteSession, flaggedStops, loadHabits, loadMintedCategories,
  loadNotebook, loadPrepared, loadSessions, notebookKey, renameSession, resolveFlag, saveHabits,
  saveMintedCategories, saveNotebook, saveSessions, serialiseDeck, sessionsKey, setFlagCategory,
  setFlagText, setPrepared, setSessionMeets, writeSessionLast,
} from './lecturenotes'
import type { LectureFlag, LectureNotebook, PreparedNotes } from './lecturenotes'

const book = (over: Partial<LectureNotebook> = {}): LectureNotebook => ({ notes: [], legacy: [], prepared: {}, ...over })
const flag = (id: string, text: string, over: Partial<LectureFlag> = {}): LectureFlag => ({
  id, lectureId: 'L1', stop: 0, stopId: 's0', text, when: '00:10', at: 1, ...over,
})

describe('the notebook is keyed by the walk', () => {
  it('gives a saved walk its own notebook and every draft lecture the same one', () => {
    // #170: the version lives in the payload now, not in the key name
    expect(notebookKey('saved', 'w7')).toBe('pkt.lecture.notes:walk:w7')
    expect(notebookKey('saved', 'w8')).not.toBe(notebookKey('saved', 'w7'))
    expect(notebookKey('draft')).toBe('pkt.lecture.notes:draft')
    // a saved source with no id is still a draft, not a notebook called "walk:null"
    expect(notebookKey('saved', null)).toBe('pkt.lecture.notes:draft')
  })
})

describe('flags on the notebook', () => {
  it('puts a new flag at the front and gives it an id', () => {
    const one = addFlag(book(), { lectureId: 'L1', stop: 3, stopId: 's3', text: 'why is this O(n)?', when: '04:12', at: 1000 })
    const two = addFlag(one, { lectureId: 'L1', stop: 4, stopId: 's4', text: 'ask about collisions', when: '05:01', at: 2000 })
    expect(two.notes.map((n) => n.text)).toEqual(['ask about collisions', 'why is this O(n)?'])
    expect(two.notes[0].id).toBeTruthy()
    expect(two.notes[0].id).not.toBe(two.notes[1].id)
    expect(two.notes[0].lectureId).toBe('L1')
    expect(two.notes[0].stopId).toBe('s4')
  })

  it('gives two flags saved in the same millisecond different ids', () => {
    const b = addFlag(addFlag(book(), { lectureId: 'L1', stop: 0, stopId: 's0', text: 'a', when: '00:01', at: 7 }), { lectureId: 'L1', stop: 0, stopId: 's0', text: 'b', when: '00:01', at: 7 })
    expect(b.notes[0].id).not.toBe(b.notes[1].id)
  })

  it('trims the words, and keeps a bare flag with empty text', () => {
    expect(addFlag(book(), { lectureId: 'L1', stop: 0, stopId: 's0', text: '  spaced  ', when: '00:01', at: 1 }).notes[0].text).toBe('spaced')
    const bare = addFlag(book(), { lectureId: 'L1', stop: 2, stopId: 's2', text: '   ', when: '00:02', at: 2 })
    expect(bare.notes[0].text).toBe('')
    expect(bare.notes[0].stopId).toBe('s2')
    expect(bare.notes[0].lectureId).toBe('L1')
  })

  it('sets a flag\'s words, empty allowed, and returns the same book when they do not move', () => {
    const before = book({ notes: [flag('a', 'first'), flag('b', 'second')] })
    const after = setFlagText(before, 'b', ' second, corrected ')
    expect(after.notes[1].text).toBe('second, corrected')
    expect(after.notes[0]).toBe(before.notes[0])
    expect(setFlagText(before, 'b', '   ').notes[1].text).toBe('')
    expect(setFlagText(before, 'a', 'first')).toBe(before)
    expect(setFlagText(before, 'missing', 'anything')).toBe(before)
  })

  it('sets and clears a flag\'s category', () => {
    const before = book({ notes: [flag('a', 'first')] })
    const typed = setFlagCategory(before, 'a', 'fix')
    expect(typed.notes[0].category).toBe('fix')
    const plain = setFlagCategory(typed, 'a', undefined)
    expect(plain.notes[0].category).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(plain.notes[0], 'category')).toBe(false)
    expect(setFlagCategory(typed, 'a', 'fix')).toBe(typed)
  })

  it('resolves by stamping and keeping the entry, and lists only unresolved stop ids', () => {
    const before = book({ notes: [flag('a', 'first', { stopId: 's0' }), flag('b', 'second', { stopId: 's1' })] })
    expect(flaggedStops(before)).toEqual(new Set(['s0', 's1']))
    const after = resolveFlag(before, 'a', 500)
    expect(after.notes).toHaveLength(2)
    expect(after.notes[0].resolvedAt).toBe(500)
    expect(flaggedStops(after)).toEqual(new Set(['s1']))
    expect(resolveFlag(after, 'a', 900)).toBe(after)
  })
})

describe('a prepared note edited at the lectern', () => {
  const empty = (): PreparedNotes => ({})

  it('stores the override against the stop id, with its time', () => {
    expect(setPrepared(empty(), 'stop-9', '  say it this way instead  ', 100))
      .toEqual({ 'stop-9': { text: 'say it this way instead', at: 100 } })
  })

  it('CLEARS the override when emptied, rather than storing a blank one', () => {
    const written = setPrepared(empty(), 'stop-9', 'an override', 100)
    expect(Object.prototype.hasOwnProperty.call(setPrepared(written, 'stop-9', '   ', 200), 'stop-9')).toBe(false)
  })

  it('returns the same map when nothing moves', () => {
    const written = setPrepared(empty(), 'stop-9', 'an override', 100)
    expect(setPrepared(written, 'stop-9', 'an override', 200)).toBe(written)
    expect(setPrepared(written, 'stop-4', '', 200)).toBe(written)
  })
})

describe('the deck layout survives as ids', () => {
  const groups = [
    { label: 'Class controls', actions: [{ id: 'a' }, { id: 'b' }] },
    { label: 'Other actions', actions: [{ id: 'c' }, { id: 'd' }] },
  ]
  const library = [{ id: 'e' }, { id: 'f' }]

  it('writes out what is where', () => {
    expect(serialiseDeck(groups, library)).toEqual({ groups: [['a', 'b'], ['c', 'd']], library: ['e', 'f'] })
  })

  it('puts a swapped-in action back where it was left', () => {
    const out = applyDeck({ groups: [['a', 'e'], ['c', 'd']], library: ['b', 'f'] }, groups, library)
    expect(out.groups[0].actions.map((a) => a.id)).toEqual(['a', 'e'])
    expect(out.groups[0].label).toBe('Class controls')
    expect(out.library.map((a) => a.id)).toEqual(['b', 'f'])
  })

  it('appends an action this release added, rather than losing it', () => {
    const withNew = library.concat([{ id: 'brand-new' }])
    const out = applyDeck({ groups: [['a', 'e'], ['c', 'd']], library: ['b', 'f'] }, groups, withNew)
    expect(out.library.map((a) => a.id)).toEqual(['b', 'f', 'brand-new'])
  })

  it('drops an id that no longer exists by keeping that group as designed', () => {
    const out = applyDeck({ groups: [['a', 'gone'], ['c', 'd']], library: [] }, groups, library)
    expect(out.groups[0].actions.map((a) => a.id)).toEqual(['a', 'b'])
  })

  it('ignores a stored layout whose shape no longer matches the deck', () => {
    expect(applyDeck({ groups: [['a', 'b', 'x']], library: [] }, groups, library).groups).toBe(groups)
    expect(applyDeck(undefined, groups, library).groups).toBe(groups)
  })
})

describe('sessions, per course', () => {
  it('creates an unnamed session, renames it, sets days, writes last and deletes it', () => {
    const created = createSession([], 1000)
    expect(typeof created.id).toBe('string')
    expect(created.sessions).toEqual([{ id: created.id, name: '' }])

    const named = renameSession(created.sessions, created.id, '  Section B  ')
    expect(named[0].name).toBe('Section B')

    const met = setSessionMeets(named, created.id, [4, 0, 2, 2])
    expect(met[0].meets).toEqual([0, 2, 4])

    const last = { walkId: 'w1', walk: 'Routing', stop: 2, stopId: 's2', of: 7, at: 123456, stopTitle: 'Forwarding', address: '2.1' }
    const done = writeSessionLast(met, created.id, last)
    expect(done[0].last).toEqual(last)

    expect(deleteSession(done, created.id)).toEqual([])
    expect(deleteSession(done, 'missing')).toBe(done)
  })

  it('stores a Date last.at as ms so it survives JSON', () => {
    const done = writeSessionLast([{ id: 'a', name: 'A' }], 'a', { walkId: 1, walk: 'W', stop: 0, at: new Date(1700000000000) })
    expect(done[0].last?.at).toBe(1700000000000)
    expect(JSON.parse(JSON.stringify(done))[0].last.at).toBe(1700000000000)
  })
})

describe('storage never throws', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => vi.restoreAllMocks())

  it('reads an empty notebook when there is no store at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(loadNotebook('k')).toEqual({ notes: [], legacy: [], prepared: {} })
    expect(loadMintedCategories()).toEqual([])
    expect(loadHabits()).toEqual({})
  })

  it('swallows a quota error on write', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded') } })
    expect(() => saveNotebook('k', book())).not.toThrow()
    expect(() => saveMintedCategories([])).not.toThrow()
    expect(() => saveHabits({ chatWidth: 320 })).not.toThrow()
  })

  it('reads back what it wrote', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
    })
    saveNotebook('k', book({ notes: [flag('a', 'kept')], prepared: { 's1': 'over' } }))
    expect(loadNotebook('k').notes[0].text).toBe('kept')
    expect(loadNotebook('k').prepared.s1).toBe('over')
    saveHabits({ chatWidth: 280, shelfPosition: { x: -12, y: 30 } })
    expect(loadHabits().shelfPosition).toEqual({ x: -12, y: 30 })
  })

  it('repairs a half-shaped stored notebook rather than handing it on', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"notes":"not an array"}', setItem: () => {} })
    expect(loadNotebook('k')).toEqual({ notes: [], legacy: [], prepared: {} })
    // not JSON is CORRUPT — read as an empty notebook, but not silently repaired
    vi.stubGlobal('localStorage', { getItem: () => 'not json at all', setItem: () => {} })
    expect(loadNotebook('k')).toEqual({ notes: [], legacy: [], prepared: {} })
  })

  it('moves a v1 notebook to v2, keeping every old note verbatim in legacy', () => {
    const KEY = notebookKey('saved', 'v1-to-v2')
    const oldNotes = [
      { id: 'a', text: 'old note', stop: 0, when: '00:01', at: 1 },
      { id: 'b', text: 'another', stop: 2, category: 'fix', when: '00:02', at: 2 },
    ]
    const store: Record<string, string> = {
      [KEY]: JSON.stringify({ v: 1, data: { notes: oldNotes, prepared: { 's1': 'kept' } } }),
    }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })

    const loaded = loadNotebook(KEY)
    expect(loaded.notes).toEqual([])
    expect(loaded.legacy).toEqual(oldNotes)
    expect(loaded.prepared).toEqual({ 's1': 'kept' })

    const stored = JSON.parse(store[KEY])
    expect(stored.v).toBe(2)
    expect(stored.data.notes).toEqual([])
    expect(stored.data.legacy).toEqual(oldNotes)
    expect(stored.data.prepared).toEqual({ 's1': 'kept' })
  })

  it('copies prepared edits once, the newer notebook winning and a tie going to the last key', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    const v2 = (at: number, text: string) => JSON.stringify({ v: 2, data: {
      notes: [{ id: 'n' + at, lectureId: 'L', stop: 0, stopId: 's0', text: 'x', when: '00:00', at }],
      legacy: [], prepared: { 'stop-9': text },
    } })
    store.set('pkt.lecture.notes:walk:a', v2(100, 'older'))
    store.set('pkt.lecture.notes:walk:b', v2(200, 'newer'))

    expect(loadPrepared()).toEqual({ 'stop-9': { text: 'newer', at: 200 } })
    expect(JSON.parse(store.get('pkt.lecture.prepared')!))
      .toEqual({ v: 1, data: { 'stop-9': { text: 'newer', at: 200 } } })

    // the key now exists, so a later load never runs the copy again
    store.set('pkt.lecture.notes:walk:b', v2(200, 'changed later'))
    expect(loadPrepared()).toEqual({ 'stop-9': { text: 'newer', at: 200 } })
  })

  it('breaks a prepared tie by the notebook whose key sorts last', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    const v2 = (text: string) => JSON.stringify({ v: 2, data: {
      notes: [{ id: 'n', lectureId: 'L', stop: 0, stopId: 's0', text: 'x', when: '00:00', at: 200 }],
      legacy: [], prepared: { 'stop-9': text },
    } })
    store.set('pkt.lecture.notes:walk:a', v2('from a'))
    store.set('pkt.lecture.notes:walk:b', v2('from b'))

    expect(loadPrepared()).toEqual({ 'stop-9': { text: 'from b', at: 200 } })
  })

  it('writes the prepared key even when the store cannot list its keys', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    expect(loadPrepared()).toEqual({})
    expect(JSON.parse(store['pkt.lecture.prepared'])).toEqual({ v: 1, data: {} })
  })

  it('moves data off the pre-#170 `.v1` key once, under the versioned name', () => {
    const store: Record<string, string> = {
      'pkt.lecture.notes.v1:draft': JSON.stringify({ notes: [{ id: 'a', text: 'old note', stop: 0, when: '00:01', at: 1 }], prepared: {} }),
      'pkt.lecture.categories.v1': JSON.stringify({ list: [{ key: 'mine', glyph: '!', label: 'my own' }] }),
      'pkt.lecture.habits.v1': JSON.stringify({ chatWidth: 300 }),
    }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    expect(loadNotebook(notebookKey('draft')).legacy[0].text).toBe('old note')
    expect(loadMintedCategories()).toHaveLength(1)
    expect(loadHabits()).toEqual({ chatWidth: 300 })
    // re-written under the versioned names as an envelope; the old keys are gone
    const moved = JSON.parse(store['pkt.lecture.notes:draft'])
    expect(moved.v).toBe(2)
    expect(moved.data.legacy[0].text).toBe('old note')
    expect('pkt.lecture.notes.v1:draft' in store).toBe(false)
    expect('pkt.lecture.categories.v1' in store).toBe(false)
    expect('pkt.lecture.habits.v1' in store).toBe(false)
    // the moved bytes must be re-readable: categories are stored wrapped in
    // `{list}`, so committing the parsed bare list would make the next read
    // report the store's own fresh write as corrupt (#170)
    expect(loadMintedCategories()).toHaveLength(1)
  })

  it('keeps the old key when the move to the versioned name is refused', () => {
    const OLD = 'pkt.lecture.notes.v1:draft'
    const store: Record<string, string> = {
      [OLD]: JSON.stringify({ notes: [{ id: 'a', text: 'old note', stop: 0, when: '00:01', at: 1 }], prepared: {} }),
    }
    // reads and removals work; every write is refused, as in a full store
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: () => { throw new Error('QuotaExceeded') },
      removeItem: (k: string) => { delete store[k] },
    })
    expect(loadNotebook(notebookKey('draft')).legacy[0].text).toBe('old note') // this session still has it
    expect(OLD in store).toBe(true) // and so does the disk: the only copy was not deleted
    expect('pkt.lecture.notes:draft' in store).toBe(false)
  })

  it('does not go back to the old name when the versioned key is corrupt or from a newer build', () => {
    const NEW = notebookKey('saved', 'future-only')
    const OLD = 'pkt.lecture.notes.v1:walk:future-only'
    const oldBook = JSON.stringify({ notes: [{ id: 'a', text: 'old note', stop: 0, when: '00:01', at: 1 }], prepared: {} })
    const unreadable = ['{not json', JSON.stringify({ v: 3, data: { notes: [{ id: 'b', text: 'newer note' }], legacy: [], prepared: {} } })]
    for (const stored of unreadable) {
      const store: Record<string, string> = { [OLD]: oldBook, [NEW]: stored }
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
      })
      expect(loadNotebook(NEW)).toEqual({ notes: [], legacy: [], prepared: {} })
      expect(store[NEW]).toBe(stored) // the load left the unreadable bytes where they were
      expect(store[OLD]).toBe(oldBook) // and did not move the older copy over them
    }
  })

  it('shows, but does not move, a value already in the new format under an old name', () => {
    // no build wrote this, but if one did: categories are stored wrapped as `{list}`
    // and read back as a bare list, so moving the READ value would store a shape
    // the reader then calls corrupt
    const OLD = 'pkt.lecture.categories.v1'
    const stored = JSON.stringify({ v: 1, data: { list: [{ key: 'mine', glyph: '!', label: 'my own' }] } })
    const store: Record<string, string> = { [OLD]: stored }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    expect(loadMintedCategories()).toHaveLength(1)
    expect('pkt.lecture.categories' in store).toBe(false)
    expect(store[OLD]).toBe(stored)
    expect(loadMintedCategories()).toHaveLength(1) // and it still reads the same next time
  })

  it('shape-guards the habits it reads instead of handing them on unchecked', () => {
    const store: Record<string, string> = {
      'pkt.lecture.habits': JSON.stringify({ v: 1, data: { duringWidth: 300, chatWidth: 'wide', preparedHeight: 'tall', usualFlag: 3, shelfPosition: { x: 1 }, deck: { groups: 'no', library: [3] }, unknown: true } }),
    }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    // duringWidth is retired: it does not become chatWidth, and the bad types are dropped
    expect(loadHabits()).toEqual({})
  })

  it('round-trips chatWidth, preparedHeight and usualFlag, ignoring duringWidth', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    saveHabits({ usualFlag: 'question', chatWidth: 240, preparedHeight: 180, shelfPosition: { x: 1, y: 2 } })
    expect(loadHabits()).toEqual({ usualFlag: 'question', chatWidth: 240, preparedHeight: 180, shelfPosition: { x: 1, y: 2 } })

    store['pkt.lecture.habits'] = JSON.stringify({ v: 1, data: { duringWidth: 300 } })
    expect(loadHabits()).toEqual({})
  })

  it('keeps sessions under two course keys separate after a re-read, and round-trips last', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    const A = sessionsKey('teaching', 'root')
    const B = sessionsKey('courses', 'root')
    const created = createSession([], 1000)
    const last = { walkId: 'w1', walk: 'Routing', stop: 2, stopId: 's2', of: 7, at: 123456, stopTitle: 'Forwarding', address: '2.1' }
    const done = writeSessionLast(renameSession(created.sessions, created.id, 'Section B'), created.id, last)

    saveSessions(A, done)
    saveSessions(B, [{ id: 'x', name: 'Other' }])

    expect(loadSessions(A)).toEqual([{ id: created.id, name: 'Section B', last }])
    expect(loadSessions(B)).toEqual([{ id: 'x', name: 'Other' }])
  })
})
