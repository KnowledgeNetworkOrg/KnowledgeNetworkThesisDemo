// #170 — the one storage seam. The risky part is classification: telling an
// older build's payload (migrate it) from a corrupt one (report it) from a
// newer one (leave it alone), and doing it without ever throwing. The payload
// the specs below carry is deliberately trivial — a string with a step appended
// per version — so the CHAIN is what the test reads, not any store's shape.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPersistenceIssues, decodePersisted, persistenceIssues,
  readPersisted, removePersisted, writePersisted,
} from './persisted'
import type { PersistedSpec } from './persisted'

/** as much of localStorage as the seam reaches for — node has none */
const stubStore = (seed: Record<string, string> = {}) => {
  const map = new Map(Object.entries(seed))
  vi.stubGlobal('localStorage', {
    get length() { return map.size },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  })
  return map
}

/** current version 2; each step appends a character so the order is visible */
const SPEC: PersistedSpec<string> = {
  version: 2,
  migrations: { 0: (d) => `${d}!`, 1: (d) => `${d}?` },
  parse: (d) => (typeof d === 'string' ? d : null),
}

describe('the envelope — one shape, one naming rule', () => {
  beforeEach(() => {
    clearPersistenceIssues()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    clearPersistenceIssues()
  })

  it('writes { v, data } and reads it back as ok', () => {
    const store = stubStore()
    writePersisted('pkt.x', 2, 'hello')
    expect(JSON.parse(store.get('pkt.x')!)).toEqual({ v: 2, data: 'hello' })
    expect(readPersisted('pkt.x', SPEC)).toEqual({ status: 'ok', data: 'hello' })
  })

  it('reads an empty store as absent', () => {
    stubStore()
    expect(readPersisted('pkt.none', SPEC)).toEqual({ status: 'absent' })
  })

  it('treats an envelope-less payload as v0 and migrates it forward', () => {
    const store = stubStore({ 'pkt.x': JSON.stringify('hello') })
    expect(readPersisted('pkt.x', SPEC)).toEqual({ status: 'migrated', from: 0, data: 'hello!?' })
    // the migration is written back once, as the current envelope
    expect(JSON.parse(store.get('pkt.x')!)).toEqual({ v: 2, data: 'hello!?' })
  })

  it('runs the chain in order from whatever version was stored', () => {
    expect(decodePersisted(JSON.stringify({ v: 1, data: 'hi' }), SPEC)).toEqual({ status: 'migrated', from: 1, data: 'hi?' })
  })

  it('reports corrupt when a step has no migration to the next', () => {
    const gap: PersistedSpec<string> = { version: 3, migrations: { 0: (d) => d, 1: (d) => d }, parse: (d) => (typeof d === 'string' ? d : null) }
    expect(decodePersisted(JSON.stringify({ v: 2, data: 'x' }), gap, 'pkt.gap').status).toBe('corrupt')
  })

  it('reports a migration that throws as corrupt, not a boot bug', () => {
    const boom: PersistedSpec<string> = { version: 1, migrations: { 0: () => { throw new Error('boom') } }, parse: (d) => (typeof d === 'string' ? d : null) }
    expect(decodePersisted(JSON.stringify('x'), boom, 'pkt.boom').status).toBe('corrupt')
  })

  it('reports a payload that fails its shape guard as corrupt', () => {
    expect(decodePersisted(JSON.stringify({ v: 2, data: 5 }), SPEC, 'pkt.shape').status).toBe('corrupt')
  })

  it('reports a future version and leaves the bytes exactly as they were', () => {
    const stored = JSON.stringify({ v: 3, data: 'from the future' })
    const store = stubStore({ 'pkt.x': stored })
    expect(readPersisted('pkt.x', SPEC)).toMatchObject({ status: 'future', from: 3 })
    expect(store.get('pkt.x')).toBe(stored)
  })

  it('reports invalid JSON and leaves the bytes exactly as they were', () => {
    const store = stubStore({ 'pkt.x': '{not json' })
    expect(readPersisted('pkt.x', SPEC).status).toBe('corrupt')
    expect(store.get('pkt.x')).toBe('{not json')
  })

  it('records every corrupt/future read in the issue log', () => {
    stubStore({ 'pkt.corrupt': '{bad', 'pkt.future': JSON.stringify({ v: 9, data: 1 }) })
    readPersisted('pkt.corrupt', SPEC)
    readPersisted('pkt.future', SPEC)
    expect(persistenceIssues().map((i) => [i.key, i.status])).toEqual([
      ['pkt.corrupt', 'corrupt'],
      ['pkt.future', 'future'],
    ])
    clearPersistenceIssues()
    expect(persistenceIssues()).toEqual([])
  })

  it('removes a key on request', () => {
    const store = stubStore({ 'pkt.x': 'y' })
    removePersisted('pkt.x')
    expect(store.has('pkt.x')).toBe(false)
  })

  it('never throws without any storage at all', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readPersisted('pkt.x', SPEC)).toEqual({ status: 'absent' })
    expect(() => writePersisted('pkt.x', 2, 'x')).not.toThrow()
    expect(() => removePersisted('pkt.x')).not.toThrow()
  })
})
