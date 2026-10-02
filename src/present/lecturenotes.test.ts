import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addNote, applyDeck, deleteNote, editNote, loadHabits, loadMintedCategories, loadNotebook,
  notebookKey, saveHabits, saveMintedCategories, saveNotebook, serialiseDeck, setPrepared,
} from './lecturenotes'
import type { LectureNotebook } from './lecturenotes'

const book = (over: Partial<LectureNotebook> = {}): LectureNotebook => ({ notes: [], prepared: {}, ...over })
const note = (id: string, text: string, stop = 0) => ({ id, text, stop, when: '00:10', at: 1 })

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

describe('adding, editing and deleting a note', () => {
  it('puts a new note at the front and gives it an id', () => {
    const one = addNote(book(), { text: 'why is this O(n)?', stop: 3, when: '04:12', at: 1000 })
    const two = addNote(one, { text: 'ask about collisions', stop: 4, when: '05:01', at: 2000 })
    expect(two.notes.map((n) => n.text)).toEqual(['ask about collisions', 'why is this O(n)?'])
    expect(two.notes[0].id).toBeTruthy()
    expect(two.notes[0].id).not.toBe(two.notes[1].id)
  })

  it('gives two notes saved in the same millisecond different ids', () => {
    const b = addNote(addNote(book(), { text: 'a', stop: 0, when: '00:01', at: 7 }), { text: 'b', stop: 0, when: '00:01', at: 7 })
    expect(b.notes[0].id).not.toBe(b.notes[1].id)
  })

  it('trims, and refuses a note that is only whitespace', () => {
    expect(addNote(book(), { text: '  spaced  ', stop: 0, when: '00:01', at: 1 }).notes[0].text).toBe('spaced')
    const same = book()
    expect(addNote(same, { text: '   ', stop: 0, when: '00:01', at: 1 })).toBe(same)
  })

  it('edits one note and leaves the rest identical', () => {
    const before = book({ notes: [note('a', 'first'), note('b', 'second')] })
    const after = editNote(before, 'b', ' second, corrected ')
    expect(after.notes[1].text).toBe('second, corrected')
    expect(after.notes[0]).toBe(before.notes[0])
  })

  it('returns the same notebook when an edit changes nothing', () => {
    const before = book({ notes: [note('a', 'first')] })
    expect(editNote(before, 'a', 'first')).toBe(before)
    expect(editNote(before, 'missing', 'anything')).toBe(before)
    expect(editNote(before, 'a', '   ')).toBe(before)
  })

  it('deletes by id, and returns the same notebook for an id that is not there', () => {
    const before = book({ notes: [note('a', 'first'), note('b', 'second')] })
    expect(deleteNote(before, 'a').notes.map((n) => n.id)).toEqual(['b'])
    expect(deleteNote(before, 'c')).toBe(before)
  })
})

describe('a prepared note edited at the lectern', () => {
  it('stores the override against the stop id', () => {
    const after = setPrepared(book(), 'stop-9', '  say it this way instead  ')
    expect(after.prepared['stop-9']).toBe('say it this way instead')
  })

  it('CLEARS the override when emptied, rather than storing a blank one', () => {
    const written = setPrepared(book(), 'stop-9', 'an override')
    const cleared = setPrepared(written, 'stop-9', '   ')
    expect(Object.prototype.hasOwnProperty.call(cleared.prepared, 'stop-9')).toBe(false)
  })

  it('returns the same notebook when nothing moves', () => {
    const written = setPrepared(book(), 'stop-9', 'an override')
    expect(setPrepared(written, 'stop-9', 'an override')).toBe(written)
    expect(setPrepared(written, 'stop-4', '')).toBe(written)
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

describe('storage never throws', () => {
  beforeEach(() => { vi.unstubAllGlobals(); vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => vi.restoreAllMocks())

  it('reads an empty notebook when there is no store at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(loadNotebook('k')).toEqual({ notes: [], prepared: {} })
    expect(loadMintedCategories()).toEqual([])
    expect(loadHabits()).toEqual({})
  })

  it('swallows a quota error on write', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded') } })
    expect(() => saveNotebook('k', book())).not.toThrow()
    expect(() => saveMintedCategories([])).not.toThrow()
    expect(() => saveHabits({ duringWidth: 320 })).not.toThrow()
  })

  it('reads back what it wrote', () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
    })
    saveNotebook('k', book({ notes: [note('a', 'kept')], prepared: { 's1': 'over' } }))
    expect(loadNotebook('k').notes[0].text).toBe('kept')
    expect(loadNotebook('k').prepared.s1).toBe('over')
    saveHabits({ duringWidth: 280, shelfPosition: { x: -12, y: 30 } })
    expect(loadHabits().shelfPosition).toEqual({ x: -12, y: 30 })
  })

  it('repairs a half-shaped stored notebook rather than handing it on', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"notes":"not an array"}', setItem: () => {} })
    expect(loadNotebook('k')).toEqual({ notes: [], prepared: {} })
    // not JSON is CORRUPT — read as an empty notebook, but not silently repaired
    vi.stubGlobal('localStorage', { getItem: () => 'not json at all', setItem: () => {} })
    expect(loadNotebook('k')).toEqual({ notes: [], prepared: {} })
  })

  it('moves data off the pre-#170 `.v1` key once, under the versioned name', () => {
    const store: Record<string, string> = {
      'pkt.lecture.notes.v1:draft': JSON.stringify({ notes: [{ id: 'a', text: 'old note', stop: 0, when: '00:01', at: 1 }], prepared: {} }),
      'pkt.lecture.categories.v1': JSON.stringify({ list: [{ key: 'mine', glyph: '!', label: 'my own' }] }),
      'pkt.lecture.habits.v1': JSON.stringify({ duringWidth: 300 }),
    }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    expect(loadNotebook(notebookKey('draft')).notes[0].text).toBe('old note')
    expect(loadMintedCategories()).toHaveLength(1)
    expect(loadHabits()).toEqual({ duringWidth: 300 })
    // re-written under the versioned names as an envelope; the old keys are gone
    const moved = JSON.parse(store['pkt.lecture.notes:draft'])
    expect(moved.v).toBe(1)
    expect(moved.data.notes[0].text).toBe('old note')
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
    expect(loadNotebook(notebookKey('draft')).notes[0].text).toBe('old note') // this session still has it
    expect(OLD in store).toBe(true) // and so does the disk: the only copy was not deleted
    expect('pkt.lecture.notes:draft' in store).toBe(false)
  })

  it('does not go back to the old name when the versioned key is corrupt or from a newer build', () => {
    const OLD = 'pkt.lecture.notes.v1:draft'
    const NEW = 'pkt.lecture.notes:draft'
    const oldBook = JSON.stringify({ notes: [{ id: 'a', text: 'old note', stop: 0, when: '00:01', at: 1 }], prepared: {} })
    const unreadable = ['{not json', JSON.stringify({ v: 2, data: { notes: [{ id: 'b', text: 'newer note' }], prepared: {} } })]
    for (const stored of unreadable) {
      const store: Record<string, string> = { [OLD]: oldBook, [NEW]: stored }
      vi.stubGlobal('localStorage', {
        getItem: (k: string) => (k in store ? store[k] : null),
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
      })
      expect(loadNotebook(notebookKey('draft'))).toEqual({ notes: [], prepared: {} })
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
      'pkt.lecture.habits': JSON.stringify({ v: 1, data: { duringWidth: 'wide', shelfPosition: { x: 1 }, deck: { groups: 'no', library: [3] }, unknown: true } }),
    }
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
    expect(loadHabits()).toEqual({})
  })
})
