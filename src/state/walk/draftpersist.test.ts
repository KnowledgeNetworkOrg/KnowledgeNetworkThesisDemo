// #16 — the draft across a reload. Everything risky in draftpersist.ts is in
// reading a payload the app did not write this session: a corpus that has moved
// under a stored plan, a half-written value, a hand-edited key. So the tests are
// mostly about what a BAD payload does, and the shape of the repair.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { byId } from '../../corpus/graph'
import { decodePersisted } from '../../platform/persisted'
import type { PersistedSpec } from '../../platform/persisted'
import { loadDraft, migrateDraftFromV0, nextIds, parseDraftData, saveDraft } from './draftpersist'
import type { DraftSnapshot } from './draftpersist'
import { isBox, isLeaf } from './mockwalk'
import type { Stop } from './mockwalk'

/** the same envelope → v0 migration → parse path a store load runs, driven from
 *  a raw string so the tests below still speak in the bytes that were stored. */
const SPEC: PersistedSpec<DraftSnapshot> = { version: 1, migrations: { 0: migrateDraftFromV0 }, parse: parseDraftData }
const parseDraft = (raw: string): DraftSnapshot | null => decodePersisted(raw, SPEC).data ?? null

// the corrupt cases below deliberately warn; keep the test output readable
beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

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

describe('a group\'s own optional flag, from a draft saved before DS OB-215', () => {
  // The ruling: only leaves carry `optional`. A stored group-level flag meant "the road may skip
  // all of this", so the v0→v1 MIGRATION (migrateDraftFromV0, before parse) pushes it down onto
  // the leaves — every version, every depth — and the group keeps no field nothing honours.
  // Driven through the raw string, since that is exactly the bytes an older build left.
  it('is pushed down onto every leaf under the group and removed from the group itself', () => {
    const legacy = {
      key: 'draft-0',
      title: 'a stage',
      optional: true,
      variants: [
        { id: 'v0', label: '', steps: [leaf(A), group('draft-1', 'v1', [leaf(B)])] },
        { id: 'v2', label: 'the other way', steps: [leaf(B)] },
      ],
    }
    const got = parseDraft(snap([legacy as unknown as Stop, leaf(A)]))!
    const box = got.stops[0]
    expect(box).not.toHaveProperty('optional')
    const inner = box.variants[0].steps[1]
    expect(inner).not.toHaveProperty('optional')
    expect(box.variants[0].steps[0].optional).toBe(true)
    expect(inner.variants[0].steps[0].optional).toBe(true)
    expect(box.variants[1].steps[0].optional).toBe(true)
    // a sibling outside the group is untouched
    expect(got.stops[1].optional).toBeUndefined()
  })

  it('a group without the flag reads exactly as before', () => {
    const got = parseDraft(snap([group('draft-0', 'v0', [leaf(A), { node: B, optional: true, variants: [] }])]))!
    const box = got.stops[0]
    expect(box.variants[0].steps.map((s) => s.optional)).toEqual([undefined, true])
  })

  it('the migration is what pushes the flag down, and a leaf keeps its own', () => {
    const migrated = migrateDraftFromV0({
      stops: [{ key: 'draft-0', title: 'g', optional: true, variants: [{ id: 'v0', label: '', steps: [leaf(A)] }] }],
      choices: {},
      withOptionals: true,
    }) as { stops: Stop[] }
    const box = migrated.stops[0]
    expect(box).not.toHaveProperty('optional')
    expect(box.variants[0].steps[0].optional).toBe(true)
  })

  it('a leaf — even one left carrying a legacy flag — is not stripped by the migration', () => {
    // "ungrouped back to a leaf" can leave `variants: [emptied]`, and the handler
    // that ungroups copies the flag it had as a group; the migration must not
    // mistake either for a container and delete the author's own mark
    const migrated = migrateDraftFromV0({
      stops: [
        { node: A, optional: true, variants: [] },
        { node: '', unset: true, optional: true, variants: [{ id: 'v0', label: '', steps: [] }] },
      ],
      choices: {},
      withOptionals: true,
    }) as { stops: Stop[] }
    expect(migrated.stops[0].optional).toBe(true)
    expect(migrated.stops[1].optional).toBe(true)
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

  it('upgrades an old draft in place WITHOUT erasing a stop the corpus no longer knows', () => {
    // the exact data-loss case: the running app repairs the dead binding into a
    // placeholder, but the one-time format upgrade must only re-envelope the
    // payload. If it committed the repaired value, switching back to the
    // catalogue that knows this topic could never revive the author's stop.
    const legacy = snap([leaf('was-a-topic-once', 'keep my prose'), leaf(A)])
    const store = stubStore({ 'pkt.walkdesk.draft': legacy })
    const got = loadDraft()!
    expect(got.stops[0].unset).toBe(true)
    expect(got.stops[0].note).toBe('keep my prose')
    expect(JSON.parse(store.get('pkt.walkdesk.draft')!)).toEqual({ v: 1, data: JSON.parse(legacy) })
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
