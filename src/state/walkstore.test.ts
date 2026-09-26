// #16 — the walk registry. Two things are worth testing here: what a stored
// payload is allowed to do to the app, and that an authored walk can never be
// confused with a shipped one.
//
// The rule that distinguishes this file from draftpersist.test.ts is the one to
// keep in view: a DRAFT repairs a broken stop into a visible placeholder,
// because a draft is a thing you are still editing. A WALK has no such state —
// it is a finished flat reading order — so a broken stop is dropped and a walk
// with nothing left is dropped whole.

import { describe, expect, it } from 'vitest'

import { WALKS } from '../corpus/walks'
import { deleteWalk, isAuthored, listWalks, mintId, parseSaved, saveWalk, subscribeWalks, walkById } from './walkstore'
import type { Walk } from './walkstore'

const A = 'stk-dns-naming'
const B = 'stk-ip-routing'

const walk = (id: string, stops: string[]): Walk => ({
  id,
  title: 'a walk',
  description: '',
  stops: stops.map((s) => ({ id: s, note: '' })),
})

describe('parseSaved — a stored payload cannot break the app', () => {
  it('reads authored walks back', () => {
    const w = walk('authored-x', [A, B])
    expect(parseSaved(JSON.stringify([w]))).toEqual([w])
  })

  it('drops a stop the corpus no longer has, and keeps the rest of the walk', () => {
    const got = parseSaved(JSON.stringify([walk('authored-x', [A, 'was-a-topic-once', B])]))
    expect(got[0].stops.map((s) => s.id)).toEqual([A, B])
  })

  it('drops a walk left with no stops at all', () => {
    expect(parseSaved(JSON.stringify([walk('authored-x', ['gone-1', 'gone-2'])]))).toEqual([])
  })

  it('refuses an id that is not in the authored namespace', () => {
    // otherwise a stored payload could shadow a shipped walk by claiming its id
    expect(parseSaved(JSON.stringify([walk(WALKS[0].id, [A])]))).toEqual([])
    expect(parseSaved(JSON.stringify([walk('loading-a-webpage', [A])]))).toEqual([])
  })

  it('keeps the first of two walks sharing an id — walkById must not be ambiguous', () => {
    const got = parseSaved(JSON.stringify([walk('authored-x', [A]), walk('authored-x', [B])]))
    expect(got).toHaveLength(1)
    expect(got[0].stops[0].id).toBe(A)
  })

  it('one bad member costs that walk, not the others', () => {
    const got = parseSaved(JSON.stringify([{ nope: true }, walk('authored-y', [A])]))
    expect(got.map((w) => w.id)).toEqual(['authored-y'])
  })

  it('junk is empty, not a throw', () => {
    expect(parseSaved('not json {')).toEqual([])
    expect(parseSaved(JSON.stringify({ walks: [] }))).toEqual([])
    expect(parseSaved(JSON.stringify([null, 3, 'x']))).toEqual([])
  })
})

describe('mintId — readable, and unique against everything known', () => {
  it('slugs the title', () => {
    expect(mintId('Load a page, end to end!', [])).toBe('authored-load-a-page-end-to-end')
  })

  it('numbers a collision rather than overwriting', () => {
    const taken = [walk('authored-my-walk', [A])]
    expect(mintId('My walk', taken)).toBe('authored-my-walk-2')
    expect(mintId('My walk', [...taken, walk('authored-my-walk-2', [A])])).toBe('authored-my-walk-3')
  })

  it('a title with nothing sluggable still yields an id', () => {
    expect(mintId('!!!', [])).toBe('authored-walk')
  })

  it('every minted id is in the authored namespace', () => {
    expect(isAuthored(mintId('anything', []))).toBe(true)
    expect(isAuthored(WALKS[0].id)).toBe(false)
  })
})

describe('the registry — built-ins plus what the desk saved', () => {
  it('starts as exactly the built-ins', () => {
    expect(listWalks()).toEqual(WALKS)
  })

  it('a saved walk joins the list, is findable, and notifies subscribers', () => {
    let notified = 0
    const stop = subscribeWalks(() => notified++)

    const before = listWalks()
    const w = saveWalk(walk(mintId('desk walk', listWalks()), [A, B]))

    expect(notified).toBe(1)
    expect(listWalks()).toHaveLength(before.length + 1)
    expect(walkById(w.id)).toEqual(w)
    // built-ins stay first and stay reachable
    expect(walkById(WALKS[0].id)).toEqual(WALKS[0])
    // a fresh array each change: useSyncExternalStore compares by identity
    expect(listWalks()).not.toBe(before)

    stop()
    deleteWalk(w.id)
    expect(walkById(w.id)).toBeUndefined()
    expect(notified).toBe(1) // unsubscribed
  })

  it('saving under an existing id updates in place instead of duplicating', () => {
    const w = saveWalk(walk('authored-fixed', [A]))
    const n = listWalks().length
    saveWalk({ ...w, title: 'renamed' })
    expect(listWalks()).toHaveLength(n)
    expect(walkById('authored-fixed')?.title).toBe('renamed')
    deleteWalk('authored-fixed')
  })

  it('a built-in cannot be deleted', () => {
    deleteWalk(WALKS[0].id)
    expect(walkById(WALKS[0].id)).toEqual(WALKS[0])
  })
})
