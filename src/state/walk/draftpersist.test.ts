// #16 — the draft across a reload. Everything risky in draftpersist.ts is in
// reading a payload the app did not write this session: a corpus that has moved
// under a stored plan, a half-written value, a hand-edited key. So the tests are
// mostly about what a BAD payload does, and the shape of the repair.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { byId } from '../../corpus/graph'
import { loadDraft, nextIds, parseDraft, saveDraft } from './draftpersist'
import type { DraftSnapshot } from './draftpersist'
import { isBox, isLeaf } from './mockwalk'
import type { Stop } from './mockwalk'

/** real corpus topics — the guard these tests exercise is exactly "is this id
 * still a topic", so the ids have to be true ones, not placeholders */
const A = 'stk-dns-naming'
const B = 'stk-ip-routing'

const leaf = (node: string, note?: string): Stop => ({ node, note, variants: [] })
const group = (key: string, vid: string, steps: Stop[]): Stop => ({
  key,
  title: 'a stage',
  variants: [{ id: vid, label: '', steps }],
})

const snap = (stops: Stop[], rest: Partial<DraftSnapshot> = {}): string =>
  JSON.stringify({ stops, choices: {}, withOptionals: true, ...rest })

describe('parseDraft — a payload the app did not write this session', () => {
  it('round-trips a tiered plan', () => {
    const stops = [leaf(A, 'the first stop'), group('draft-0', 'v0', [leaf(B)])]
    const got = parseDraft(snap(stops))
    expect(got?.stops).toEqual(stops)
  })

  it('repairs a leaf whose corpus id is gone — the plan survives with a hole to re-bind', () => {
    const got = parseDraft(snap([leaf(A), leaf('was-a-topic-once', 'keep my prose'), leaf(B)]))
    expect(got?.stops).toHaveLength(3)
    const hole = got!.stops[1]
    expect(isLeaf(hole) && hole.unset).toBe(true)
    expect(hole.node).toBe('')
    // the note is the author's, not the corpus's — a missing target is no reason
    // to throw away what they wrote about it
    expect(hole.note).toBe('keep my prose')
  })

  it('repairs a node that exists but is not a topic', () => {
    // a CONTAINER id is a real node and an illegal stop — walks.ts guards the
    // same distinction at module load. Asserted here so this test cannot quietly
    // decay into the unknown-id case above if the corpus is reshaped.
    expect(byId.get('stk')).toBeTruthy()
    expect(byId.get('stk')!.topic).toBeFalsy()
    const got = parseDraft(snap([leaf('stk')]))
    expect(got?.stops[0].unset).toBe(true)
  })

  it('falls back on STRUCTURAL corruption rather than repairing it', () => {
    expect(parseDraft('not json {')).toBeNull()
    expect(parseDraft(JSON.stringify({ stops: 'nope' }))).toBeNull()
    expect(parseDraft(snap([]))).toBeNull()
    // a stop with no variants list is not a plan with a hole in it
    expect(parseDraft(JSON.stringify({ stops: [{ node: A }] }))).toBeNull()
    // a container with no key: choices, collapse and rename all hang off it
    expect(parseDraft(JSON.stringify({ stops: [{ title: 't', variants: [{ id: 'v0', label: '', steps: [] }] }] }))).toBeNull()
    // a variant with no id — #92's whole point is that the id is the identity
    expect(parseDraft(JSON.stringify({ stops: [{ key: 'k', title: 't', variants: [{ label: '', steps: [] }] }] }))).toBeNull()
  })

  it('rejects duplicate container keys', () => {
    // two containers sharing a key would share one branch choice and one rename
    expect(parseDraft(snap([group('draft-0', 'v0', []), group('draft-0', 'v1', [])]))).toBeNull()
    // nested counts too — forEachStop descends every variant
    expect(parseDraft(snap([group('draft-0', 'v0', [group('draft-0', 'v1', [])])]))).toBeNull()
  })

  it('drops a choice naming a container that is no longer in the tree', () => {
    const got = parseDraft(snap([group('draft-0', 'v0', [leaf(A)])], { choices: { 'draft-0': 'v0', 'draft-9': 'v3' } }))
    expect(got?.choices).toEqual({ 'draft-0': 'v0' })
  })

  it('optionals default to ON, and only an explicit false turns them off', () => {
    expect(parseDraft(JSON.stringify({ stops: [leaf(A)] }))?.withOptionals).toBe(true)
    expect(parseDraft(snap([leaf(A)], { withOptionals: false }))?.withOptionals).toBe(false)
  })

  it('keeps the optional flag and a container description', () => {
    const stops: Stop[] = [{ node: A, optional: true, variants: [] }, { key: 'k', title: 't', description: 'what it is', variants: [{ id: 'v0', label: 'one', steps: [] }] }]
    const got = parseDraft(snap(stops))
    expect(got?.stops[0].optional).toBe(true)
    const box = got!.stops[1]
    expect(isBox(box) && box.description).toBe('what it is')
    expect(box.variants[0].label).toBe('one')
  })
})

describe('nextIds — the counters resume past what the restored tree already uses', () => {
  it('resumes past the highest minted key and variant id', () => {
    const stops = [group('draft-0', 'v0', [group('draft-7', 'v2', [])]), group('draft-3', 'va', [])]
    // 'va' is base 36 → 10
    expect(nextIds(stops)).toEqual({ box: 8, vid: 11 })
  })

  it('ignores ids it did not mint, so the hand-written seed does not move them', () => {
    expect(nextIds([group('seed-net', 'seed-net-v0', [])])).toEqual({ box: 0, vid: 0 })
  })

  it('a plan with no containers starts both at zero', () => {
    expect(nextIds([leaf(A), leaf(B)])).toEqual({ box: 0, vid: 0 })
  })
})

describe('loadDraft / saveDraft — never throw', () => {
  afterEach(() => vi.unstubAllGlobals())

  const stubStore = (seed: Record<string, string> = {}) => {
    const map = new Map(Object.entries(seed))
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    })
    return map
  }

  it('round-trips through storage', () => {
    stubStore()
    const s: DraftSnapshot = { stops: [leaf(A)], choices: {}, withOptionals: false }
    saveDraft(s)
    expect(loadDraft()).toEqual(s)
  })

  it('returns null when nothing is stored', () => {
    stubStore()
    expect(loadDraft()).toBeNull()
  })

  it('returns null when storage itself is unavailable', () => {
    // private mode, or the node test environment before a stub — reading must
    // not be the thing that white-screens the desk
    vi.stubGlobal('localStorage', undefined)
    expect(loadDraft()).toBeNull()
  })

  it('a failing write is swallowed — a full quota must not break an edit', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    expect(() => saveDraft({ stops: [leaf(A)], choices: {}, withOptionals: true })).not.toThrow()
  })
})
