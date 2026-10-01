// VERSIONED PERSISTENCE (#170) — every payload this app stores, through one seam.
//
// THE PROBLEM THIS SETTLES. Three naming styles and six storage wrappers grew
// across the app, and none of the payloads carried a version. So when a shape
// drifted from what the current build's reader expected, the reader could not
// tell "written by an older build" from "corrupt": draftpersist repaired what it
// could and silently fell back to the seed, walkstore silently dropped members,
// and presenter notes put a `v1` in the KEY NAME and shipped a reader that only
// checked "is it an object". A stale payload presented as "my plan is wrong",
// never as an error, and there was no migration path.
//
// THE SHAPE NOW. Every app payload is an envelope:
//
//   { v: <number>, data: <what the store wrote> }
//
// One naming rule (a version field, not a version in the key), one place that
// writes it, and one reader that classifies what it finds:
//
//   absent    nothing stored — the store opens on its seed / empty value
//   ok        the current version, read cleanly
//   migrated  an older version, brought forward by the migration chain, and
//             re-written as the current envelope so the work happens once. The
//             bytes committed are the migrated payload BEFORE the store's parse
//             repaired it, so a format upgrade never discards data the current
//             build merely could not read
//   corrupt   not JSON, not an envelope-bearing payload the current reader can
//             use, or a version with no migration to the next
//   future    a version NEWER than this build writes (an older build opening a
//             payload a newer one left) — reported, never overwritten
//
// A READ NEVER THROWS AND NEVER OVERWRITES WHAT IT CANNOT READ. `corrupt` and
// `future` leave the bytes exactly where they are; the store falls back to its
// seed / empty value and keeps working. Both are `console.warn`-ed and recorded
// in the exported `persistenceIssues()` log, which is the report — there is no
// new visible UI (#170 deliberately deletes the only one there was).
//
// VERSION 0 IS "NO ENVELOPE". A payload written before this seam existed is the
// bare value the old store wrote; it is read as version 0 and must be carried
// forward by the store's own `0 → 1` migration. That is what lets the old draft
// and the old saved-walks list load rather than be discarded.

import { platform } from './index'

/** A payload this build could not read. `key` is the storage key, and `detail`
 *  says what was wrong with it in one line. */
export interface PersistenceIssue {
  key: string
  status: 'corrupt' | 'future'
  detail: string
}

/** The log keeps the tail, so a boot looping over one bad key cannot grow it
 *  without bound. 50 is far more than any real session sees. */
const ISSUE_CAP = 50
const issues: PersistenceIssue[] = []

/** Every corrupt or too-new payload this session's reads ran into, oldest
 *  first. A COPY, so a caller cannot mutate the log by holding the array. */
export function persistenceIssues(): readonly PersistenceIssue[] {
  return issues.slice()
}

/** Empty the log. For tests, and for a caller that has reported and moved on. */
export function clearPersistenceIssues(): void {
  issues.length = 0
}

function report(key: string, status: 'corrupt' | 'future', detail: string): void {
  issues.push({ key, status, detail })
  if (issues.length > ISSUE_CAP) issues.shift()
  // warn, never error: a driver's error channel is reserved for a broken app,
  // and a stale payload is a thing the app survives, not a failure of it.
  console.warn(`[persisted] ${key}: ${status} — ${detail}`)
}

export type PersistedStatus = 'absent' | 'ok' | 'migrated' | 'corrupt' | 'future'

/** What a read found. `data` is present for `ok` and `migrated`; `from` is the
 *  version read, present for `migrated` and `future`; `detail` explains a
 *  `corrupt` / `future`. */
export interface PersistedRead<T> {
  status: PersistedStatus
  data?: T
  from?: number
  detail?: string
  /** For `migrated`: the value AFTER the migration chain but BEFORE the store's
   *  `parse` repair. `readPersisted` commits THIS back, so the one-time format
   *  upgrade cannot erase what `parse` would have dropped while repairing. */
  writeBack?: unknown
}

/** Bring data at exactly version `from` forward to `from + 1`. Returns the next
 *  shape; may throw, which the seam turns into `corrupt` rather than a boot bug. */
export type Migration = (data: unknown) => unknown

/** A store's storage contract: which version this build writes, how each older
 *  version steps forward, and how the current-version data becomes the value the
 *  store wants. `parse` returning null means "not usable" — the seam reports it
 *  as corrupt and the store falls back. */
export interface PersistedSpec<T> {
  version: number
  /** keyed by the version being migrated FROM; a missing step is corrupt */
  migrations?: Partial<Record<number, Migration>>
  parse: (data: unknown) => T | null
}

const isEnvelope = (v: unknown): v is { v: number; data: unknown } => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const version = (v as { v?: unknown }).v
  return typeof version === 'number' && Number.isInteger(version) && version >= 0
}

/** Classify and decode an already-stored string. Pure: it neither writes nor
 *  reads storage, so a unit test can drive every branch directly. */
export function decodePersisted<T>(raw: string, spec: PersistedSpec<T>, key = '<memory>'): PersistedRead<T> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    report(key, 'corrupt', 'not valid JSON')
    return { status: 'corrupt', detail: 'not valid JSON' }
  }

  // an envelope-less payload is the shape a store wrote before this seam: v0
  let version: number
  let data: unknown
  if (isEnvelope(parsed)) {
    version = parsed.v
    data = parsed.data
  } else {
    version = 0
    data = parsed
  }
  const from = version

  if (version > spec.version) {
    const detail = `stored as v${version}, this build writes v${spec.version}`
    report(key, 'future', detail)
    return { status: 'future', from, detail }
  }

  while (version < spec.version) {
    const migrate = spec.migrations?.[version]
    if (!migrate) {
      const detail = `no migration from v${version}`
      report(key, 'corrupt', detail)
      return { status: 'corrupt', detail }
    }
    try {
      data = migrate(data)
    } catch {
      const detail = `migration from v${version} threw`
      report(key, 'corrupt', detail)
      return { status: 'corrupt', detail }
    }
    version += 1
  }

  const value = spec.parse(data)
  if (value === null) {
    const detail = `payload does not match v${spec.version}`
    report(key, 'corrupt', detail)
    return { status: 'corrupt', detail }
  }
  // `data` here is post-migration but pre-parse: `value` may have been repaired
  // (a stop dropped, a walk discarded). Hand both back so the caller can use the
  // clean value while the seam commits the un-repaired one — see readPersisted.
  return from < spec.version
    ? { status: 'migrated', from, data: value, writeBack: data }
    : { status: 'ok', data: value }
}

/** Read `key` and classify it — the storage half of `decodePersisted`, without
 *  the rewrite. Use this where a migration must NOT be committed back to the key
 *  it was read from (the presenter stores read their old `.v1` names this way). */
export function decodeStored<T>(key: string, spec: PersistedSpec<T>): PersistedRead<T> {
  const raw = platform.storage.get(key)
  return raw === null ? { status: 'absent' } : decodePersisted(raw, spec, key)
}

/** Read `key`, and on a successful migration write the current envelope back so
 *  the migration runs once. `corrupt` and `future` reads change nothing.
 *
 *  What goes back is the migrated data BEFORE `parse` repaired it. A store's
 *  `parse` is allowed to drop what the current build cannot read — a walk stop
 *  the corpus no longer has, a draft leaf pointing at a renamed topic — and
 *  writing THAT back would turn a format upgrade into permanent data loss the
 *  user never asked for. Only the envelope changes; the payload is preserved. */
export function readPersisted<T>(key: string, spec: PersistedSpec<T>): PersistedRead<T> {
  const result = decodeStored(key, spec)
  if (result.status === 'migrated' && result.writeBack !== undefined) {
    writePersisted(key, spec.version, result.writeBack)
  }
  return result
}

/** Store `data` as the envelope for `version`. Never throws — a refused write
 *  (quota, private mode) just means this session does not persist, exactly as
 *  every wrapper before this one behaved. */
export function writePersisted(key: string, version: number, data: unknown): void {
  platform.storage.set(key, JSON.stringify({ v: version, data }))
}

/** Forget a key — the presenter stores use this to clear a legacy `.v1` name
 *  once its contents have moved to the versioned name. */
export function removePersisted(key: string): void {
  platform.storage.remove(key)
}
