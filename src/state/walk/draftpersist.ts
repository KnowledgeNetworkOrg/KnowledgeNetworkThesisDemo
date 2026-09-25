// The draft, across a reload (#16).
//
// The Walk·Desk draft has been session-local since #21: the stores in
// authordraft.ts are module-level, which makes them SHARED, not DURABLE. Reload
// and the plan you were writing is gone. This file is the durable half — one
// namespaced key, `pkt.walkdesk.draft`, following the convention
// src/ui/floatingPanelRect.ts established for the only other stored thing in the
// app.
//
// Two decisions make it more than JSON.stringify:
//
//   REPAIR, DON'T REJECT. A stored leaf whose corpus id no longer exists cannot
//   be drawn — but throwing away a whole authored plan because one topic was
//   renamed is a worse answer than showing the hole. Such a leaf comes back
//   `unset`, which is the model's OWN placeholder (mockwalk.Stop): it draws as
//   "pick a node", it is dropped from the projection so nothing downstream ever
//   sees a bad id, and it is ready to re-bind. Nothing new had to be invented.
//   STRUCTURAL corruption is a different kind of wrong — a stop with no variants
//   list is not a plan with a hole in it, it is not a plan — and that does fall
//   back to the seed.
//
//   THE ID COUNTERS ARE RECOVERED, NOT STORED. Container keys (`draft-3`) and
//   variant ids (`v7`) come from two counters that live in a module and start at
//   zero. Restore a tree without them and the next group you make is `draft-0`
//   again — colliding with the one already in the plan, and container keys are
//   what `choices`, collapse and rename all hang off. Recovering them from the
//   restored tree rather than storing them alongside means the two can never
//   disagree: the tree is the only thing that could be wrong about its own ids.

import { byId } from '../../corpus/graph'
import { forEachStop, isBox } from './mockwalk'
import type { Stop, Variant } from './mockwalk'

const KEY = 'pkt.walkdesk.draft'

/** what survives a reload. The stops tree, plus the road's VIEW of it — which
 * branch each fork takes and whether optionals are on the road. History is
 * deliberately absent: undo is a session's worth of intent, not a property of
 * the plan, and a restored redo stack pointing at trees you never saw this
 * session would be a trap. Selection and caret are ephemeral for the same
 * reason they are cleared on every commit. */
export interface DraftSnapshot {
  stops: Stop[]
  choices: Record<string, string>
  withOptionals: boolean
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** a real, bindable corpus stop — the same gate walks.ts applies at module load,
 * asked as a question instead of as a throw */
const isTopic = (id: unknown): boolean => typeof id === 'string' && !!byId.get(id)?.topic

/** rebuild one stop from stored JSON, or null if its SHAPE is unusable. An
 * unknown corpus id is not unusable — it comes back as a placeholder. */
function readStop(v: unknown): Stop | null {
  if (!isObj(v)) return null
  if (!Array.isArray(v.variants)) return null

  const note = typeof v.note === 'string' ? v.note : undefined
  const optional = v.optional === true ? true : undefined

  if (v.variants.length === 0) {
    // a leaf. Bound to a topic that still exists, or a placeholder — including
    // the case where it was already a placeholder when it was stored.
    if (v.unset === true || !isTopic(v.node)) return { node: '', unset: true, note, optional, variants: [] }
    return { node: v.node as string, note, optional, variants: [] }
  }

  // a container: it must carry the identity everything else hangs off
  if (typeof v.key !== 'string' || !v.key) return null
  if (typeof v.title !== 'string') return null
  const variants: Variant[] = []
  for (const raw of v.variants) {
    if (!isObj(raw)) return null
    if (typeof raw.id !== 'string' || !raw.id) return null
    if (typeof raw.label !== 'string') return null
    if (!Array.isArray(raw.steps)) return null
    const steps = readStops(raw.steps)
    if (!steps) return null
    variants.push({ id: raw.id, label: raw.label, steps })
  }
  return {
    key: v.key,
    title: v.title,
    description: typeof v.description === 'string' ? v.description : undefined,
    note,
    optional,
    variants,
  }
}

/** rebuild a sibling list, or null if any member's shape is unusable */
function readStops(v: unknown): Stop[] | null {
  if (!Array.isArray(v)) return null
  const out: Stop[] = []
  for (const s of v) {
    const stop = readStop(s)
    if (!stop) return null
    out.push(stop)
  }
  return out
}

/** every container key in the tree, or null if one repeats. A duplicate key can
 * only arrive from a bug or a hand-edited value, and it silently breaks the
 * thing keys exist for: two containers would share one branch choice, one
 * collapse state and one rename. mockwalk's module-load guard makes the same
 * check on the authored PLAN; here it decides a fallback instead of throwing. */
function uniqueKeys(stops: Stop[]): Set<string> | null {
  const keys = new Set<string>()
  let dupe = false
  forEachStop(stops, (s) => {
    if (!isBox(s)) return
    if (keys.has(s.key)) dupe = true
    keys.add(s.key)
  })
  return dupe ? null : keys
}

/** parse a stored payload. Returns null when there is nothing usable in it —
 * the caller seeds instead. Exported for its test: this is the whole of the
 * risk in this file, and it is pure. */
export function parseDraft(raw: string): DraftSnapshot | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObj(parsed)) return null

  const stops = readStops(parsed.stops)
  if (!stops || stops.length === 0) return null
  const keys = uniqueKeys(stops)
  if (!keys) return null

  // choices name containers by key; one naming a container that is no longer in
  // the tree is dropped rather than carried, so the record cannot grow forever
  // across sessions of grouping and ungrouping.
  const choices: Record<string, string> = {}
  if (isObj(parsed.choices)) {
    for (const [k, v] of Object.entries(parsed.choices)) {
      if (typeof v === 'string' && keys.has(k)) choices[k] = v
    }
  }

  return {
    stops,
    choices,
    // the road's default is optionals ON; only an explicit stored `false` turns
    // them off, so a payload written before this field existed reads as on
    withOptionals: parsed.withOptionals !== false,
  }
}

/** where the two id counters must resume so nothing they mint collides with
 * what is already in the tree. Reads the shapes authordraft.ts mints —
 * `draft-<n>` container keys and `v<base36>` variant ids — and ignores every
 * other id, which is how the hand-written seed's `seed-net-v0` stays out of it. */
export function nextIds(stops: Stop[]): { box: number; vid: number } {
  let box = 0
  let vid = 0
  forEachStop(stops, (s) => {
    if (!isBox(s)) return
    const m = /^draft-(\d+)$/.exec(s.key)
    if (m) box = Math.max(box, Number(m[1]) + 1)
    for (const vr of s.variants) {
      const vm = /^v([0-9a-z]+)$/.exec(vr.id)
      if (vm) {
        const n = parseInt(vm[1], 36)
        if (Number.isFinite(n)) vid = Math.max(vid, n + 1)
      }
    }
  })
  return { box, vid }
}

/** the stored draft, or null when there is none / storage is unavailable /
 * what is there is unusable. Never throws: a private-mode browser must open the
 * desk on a seed, not on a stack trace. */
export function loadDraft(): DraftSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === null ? null : parseDraft(raw)
  } catch {
    return null
  }
}

/** persist the draft. Never throws — a full or unavailable store must not break
 * an edit, it just means this session won't be there tomorrow. */
export function saveDraft(s: DraftSnapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // quota or availability — the desk keeps working, unpersisted
  }
}
