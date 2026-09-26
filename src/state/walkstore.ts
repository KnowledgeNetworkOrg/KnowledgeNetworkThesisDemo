// The walk registry (#16) — every walk the app knows about, built-in or authored.
//
// `corpus/walks.ts` holds two hand-written walks as a module const, guarded at
// load: every stop must be a real topic or the module throws. That is right for
// shipped data and wrong for user data, which arrives from storage long after
// the corpus was compiled and must never be able to white-screen the app. So
// this file is the seam: WALKS stays exactly what it is, and everything that
// asks "what walks are there" asks HERE instead, where the answer is the
// built-ins plus whatever the Walk·Desk has saved.
//
// It lives in state/, not model/, because the saved-walk list is module-level
// mutable state backed by browser storage — the two things src/model/'s rule
// ("pure arithmetic: no module state, no storage") rules out. It still holds no
// hook: the store is the same tiny subscribe/notify shape authordraft.ts uses,
// and the two React consumers bind it with useSyncExternalStore themselves, one
// line each.
//
// `list()` returns a CACHED array, rebuilt only when the saved set changes.
// useSyncExternalStore compares snapshots by identity and would loop forever on
// a getter that composed a fresh array every call.

import { byId } from '../corpus/graph'
import { WALKS } from '../corpus/walks'
import type { Walk } from '../corpus/walks'
import { platform } from '../platform'

export type { Walk }

const KEY = 'pkt.walks.saved'

/** an id no built-in walk uses, so the two sets can never shadow each other */
const AUTHORED_PREFIX = 'authored-'

export const isAuthored = (id: string): boolean => id.startsWith(AUTHORED_PREFIX)

// ── reading a stored payload ────────────────────────────────────────────────
// The rule differs from the draft's on purpose. A draft leaf whose topic is gone
// becomes a visible `unset` placeholder, because a draft is a thing you are
// editing and a hole is something you can fill. A WALK is a finished flat
// reading order with no such state — a hole in it is just a broken stop — so a
// stop that no longer resolves is DROPPED, and a walk left with nothing is
// dropped whole.

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isTopic = (id: unknown): boolean => typeof id === 'string' && !!byId.get(id)?.topic

function readWalk(v: unknown): Walk | null {
  if (!isObj(v)) return null
  if (typeof v.id !== 'string' || !isAuthored(v.id)) return null
  if (typeof v.title !== 'string' || !v.title) return null
  if (!Array.isArray(v.stops)) return null
  const stops: Walk['stops'] = []
  for (const s of v.stops) {
    if (!isObj(s) || !isTopic(s.id)) continue // the corpus moved under this stop
    stops.push({ id: s.id as string, note: typeof s.note === 'string' ? s.note : '' })
  }
  if (stops.length === 0) return null
  return { id: v.id, title: v.title, description: typeof v.description === 'string' ? v.description : '', stops }
}

/** parse a stored payload into the walks worth keeping. Never throws, never
 * rejects the whole set over one bad member: a corrupt entry costs you that
 * walk, not the others. Exported for its test — this is the risky part. */
export function parseSaved(raw: string): Walk[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const out: Walk[] = []
  const seen = new Set(WALKS.map((w) => w.id))
  for (const v of parsed) {
    const w = readWalk(v)
    if (!w || seen.has(w.id)) continue // a duplicate id would make walkById ambiguous
    seen.add(w.id)
    out.push(w)
  }
  return out
}

// ── the store ───────────────────────────────────────────────────────────────

function read(): Walk[] {
  const raw = platform.storage.get(KEY)
  return raw === null ? [] : parseSaved(raw)
}

function write(walks: Walk[]): void {
  // refused (quota or availability) — the walk still exists in this session
  platform.storage.set(KEY, JSON.stringify(walks))
}

let saved: Walk[] = read()
let cached: Walk[] = [...WALKS, ...saved]
const subs = new Set<() => void>()

function republish(next: Walk[]): void {
  saved = next
  cached = [...WALKS, ...saved]
  write(saved)
  for (const fn of subs) fn()
}

/** every walk, built-ins first. Referentially stable until the saved set
 * changes — see the note at the top about useSyncExternalStore. */
export const listWalks = (): readonly Walk[] => cached

/** just the ones the desk saved — the set the UI may offer to delete */
export const savedWalks = (): readonly Walk[] => saved

export const walkById = (id: string): Walk | undefined => cached.find((w) => w.id === id)

export function subscribeWalks(fn: () => void): () => void {
  subs.add(fn)
  return () => void subs.delete(fn)
}

// ── minting ─────────────────────────────────────────────────────────────────

/** a readable id from the title, kept unique against everything already known.
 * Readable rather than a counter because this id shows up in the trail and in
 * "walks through here" — `authored-load-a-page` says what it is where
 * `authored-3` would need a lookup. */
export function mintId(title: string, taken: readonly Walk[] = cached): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'walk'
  const ids = new Set(taken.map((w) => w.id))
  let id = AUTHORED_PREFIX + slug
  for (let n = 2; ids.has(id); n++) id = `${AUTHORED_PREFIX}${slug}-${n}`
  return id
}

/** store a walk the desk built. A walk whose id already exists REPLACES it, so
 * saving twice under one id is an update rather than a second copy; a fresh id
 * comes from mintId. Returns the stored walk. */
export function saveWalk(w: Walk): Walk {
  const at = saved.findIndex((s) => s.id === w.id)
  republish(at >= 0 ? saved.map((s, i) => (i === at ? w : s)) : [...saved, w])
  return w
}

/** forget an authored walk. Built-ins are not deletable — they are shipped data,
 * and a delete that silently did nothing would be worse than one that can't be
 * asked for. */
export function deleteWalk(id: string): void {
  if (!isAuthored(id)) return
  const next = saved.filter((w) => w.id !== id)
  if (next.length !== saved.length) republish(next)
}
