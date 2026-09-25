// Everything this app has written to localStorage, as one list — and one way to
// clear it.
//
// TEMPORARY (2026-08-22): built to answer "why did my persisted state break?"
// and to get out of a browser that is already holding a payload the current code
// cannot use. The button that calls it is marked the same way in
// src/instruments/walkdesk/WalkActionBar.tsx. Delete both together.
//
// WHY A PREFIX SWEEP AND NOT THREE NAMED KEYS. Three modules persist things —
// draftpersist.ts (`pkt.walkdesk.draft`), walkstore.ts (`pkt.walks.saved`) and
// lecturenotes.ts (`pkt.lecture.*`). Importing each module's key would clear
// exactly the keys the CURRENT code knows the names of, which is the one set
// that is guaranteed not to include the problem: a key goes ORPHAN the moment
// the feature that wrote it is retired, and nothing then names it. #144 retired
// WalkToolbox and its FloatingPanel with it, so the `pkt.floating-panel.<id>`
// keys that panel last wrote now have no writer at all — exactly the orphan case
// the prefix sweep exists to reach. Sweeping the shared `pkt.` prefix is what
// reaches those.
//
// WHY THE PAYLOADS CANNOT SAY WHAT THEY ARE. The draft and the walk list carry
// no version or schema field — a stored draft is the bare `DraftSnapshot` shape,
// a stored walk list is a bare array (lecture notes put a version in the key
// name, `.v1`, so they are the exception). So when a payload's shape and the
// reader's expectations drift apart, the reader cannot tell "written by an
// older build" from "corrupt", and both readers already had to pick a silent answer:
// draftpersist repairs what it can and falls back to the seed on structural
// damage, walkstore drops the members it cannot read. Neither can report that it
// happened, and neither can migrate. That is the whole reason a stale payload
// presents as "my plan is wrong" rather than as an error — and it is why this
// file's real job is `listStoredData`, not `clearStoredData`: seeing the bytes is
// the diagnosis, clearing them is only the escape hatch.

/** the namespace every key this app writes shares — see the note above on why
 * the sweep is by prefix rather than by the three known names */
const STORE_PREFIX = 'pkt.'

/** one stored key as it actually sits in the browser. `preview` is the raw text,
 * cut — the point is to see the SHAPE (is `stops` there? do containers still
 * carry `key`?) without pasting a whole plan into a console line. */
export interface StoredEntry {
  key: string
  bytes: number
  preview: string
}

const PREVIEW_CHARS = 400

/** every `pkt.` key currently in localStorage, smallest key name first. Never
 * throws: storage can be unavailable (private mode), and a diagnostic that
 * white-screens the app it is diagnosing is worse than no diagnostic. */
export function listStoredData(): StoredEntry[] {
  const out: StoredEntry[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null || !key.startsWith(STORE_PREFIX)) continue
      const raw = localStorage.getItem(key) ?? ''
      out.push({
        key,
        bytes: raw.length,
        preview: raw.length > PREVIEW_CHARS ? raw.slice(0, PREVIEW_CHARS) + '…' : raw,
      })
    }
  } catch {
    return []
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/** forget every `pkt.` key, and report which ones were forgotten.
 *
 * THE CALLER MUST RELOAD. The stores this clears are read ONCE, at module load —
 * authordraft.ts calls loadDraft() at line 102 to seed its module-level store,
 * walkstore.ts calls read() at line 101 for the same reason. Clearing the keys
 * therefore changes nothing on screen by itself: the live stores still hold what
 * they parsed at boot, and the next edit persists it straight back, which reads
 * as the reset having silently failed. Reloading is what makes the cleared state
 * the state the app boots from. */
export function clearStoredData(): string[] {
  const keys = listStoredData().map((e) => e.key)
  try {
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // unavailable or blocked — nothing was cleared, and the caller's reload will
    // simply come back on the same payload
  }
  return keys
}
