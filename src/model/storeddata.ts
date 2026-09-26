// Everything this app has written to localStorage, as one list — and one way to
// clear the plans and the layout in it, never what a presenter typed.
//
// TEMPORARY (2026-08-22): built to answer "why did my persisted state break?"
// and to get out of a browser that is already holding a payload the current code
// cannot use. The button that calls it is marked the same way in
// src/instruments/walkdesk/WalkActionBar.tsx. Delete both together.
//
// WHAT IS STORED, AND WHO WRITES IT.
//
//   pkt.walkdesk.draft           the walk being built on the desk — draftpersist.ts
//   pkt.walks.saved              every saved walk — walkstore.ts
//   pkt.lecture.notes.v1:<walk>  a presenter's notes for one walk, and their lectern
//                                corrections to its stops' prepared notes — lecturenotes.ts
//   pkt.lecture.categories.v1    the note categories a presenter minted — lecturenotes.ts
//   pkt.lecture.habits.v1        the presenter's deck and notes-pane layout — lecturenotes.ts
//   kn-connections_leftWidth     the Connections pane's divider and its collapse.
//   kn-connections_collapsed     ConnectionsPane.tsx hands `kn-connections` to the DS's
//                                ConnectionsSplitPane, which appends these suffixes (and
//                                `_narrow` in its narrow layout) and writes them itself
//
// plus one key with no writer left: `pkt.floating-panel.<id>`, the rect
// WalkToolbox's FloatingPanel last saved before #144 retired both.
//
// WHAT RESET CLEARS — RESET_PREFIXES below, and nothing else: the draft, the
// saved walks, and panel layout (the orphaned floating-panel rects and the
// Connections pane's divider). NOT the three `pkt.lecture.` keys. They hold what
// a presenter wrote, and a temporary debugging pill must not be the one way this
// app can lose a person's writing (#331). The sweep used to take every `pkt.`
// key, which on 2026-08-22 meant exactly the draft, the walks and the panel
// rects; presenter mode (#267) then saved its notes under the same namespace,
// and the sweep took them in without anyone deciding it should. So the list is
// OPT-IN: a key a future feature writes survives Reset unless someone adds its
// prefix here on purpose.
//
// WHY PREFIXES AND NOT NAMED KEYS. Importing each module's key would clear
// exactly the keys the CURRENT code knows the names of, which is the one set
// that is guaranteed not to include the problem: a key goes ORPHAN the moment
// the feature that wrote it is retired, and nothing then names it. The
// floating-panel rects are that case, and a prefix is what still reaches them.
// The listing is by prefix for the same reason, and it covers every key the app
// writes, not only the ones Reset clears — the console should show what was kept
// as well as what went.
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

/** every key this app writes starts with one of these — `pkt.` is the app's own
 * namespace, `kn-connections_` is the Connections pane's (see the note above) */
const STORED_PREFIXES = ['pkt.', 'kn-connections_']

/** what Reset clears, and all it clears: the draft, the saved walks, and panel
 * layout. The `pkt.lecture.` keys are left out on purpose — see the note above */
const RESET_PREFIXES = ['pkt.walkdesk.', 'pkt.walks.', 'pkt.floating-panel.', 'kn-connections_']

const under = (prefixes: string[], key: string) => prefixes.some((p) => key.startsWith(p))

/** one stored key as it actually sits in the browser. `preview` is the raw text,
 * cut — the point is to see the SHAPE (is `stops` there? do containers still
 * carry `key`?) without pasting a whole plan into a console line. */
export interface StoredEntry {
  key: string
  bytes: number
  preview: string
}

const PREVIEW_CHARS = 400

/** every key this app has written that is currently in localStorage — the ones
 * Reset keeps as well as the ones it clears — smallest key name first. Never
 * throws: storage can be unavailable (private mode), and a diagnostic that
 * white-screens the app it is diagnosing is worse than no diagnostic. */
export function listStoredData(): StoredEntry[] {
  const out: StoredEntry[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key === null || !under(STORED_PREFIXES, key)) continue
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

/** forget every key under RESET_PREFIXES — the draft, the saved walks and panel
 * layout, never a presenter's lecture notes — and report which ones were
 * forgotten.
 *
 * THE CALLER MUST RELOAD. The stores this clears are read ONCE, at module load —
 * authordraft.ts calls loadDraft() at line 102 to seed its module-level store,
 * walkstore.ts calls read() at line 101 for the same reason. Clearing the keys
 * therefore changes nothing on screen by itself: the live stores still hold what
 * they parsed at boot, and the next edit persists it straight back, which reads
 * as the reset having silently failed. Reloading is what makes the cleared state
 * the state the app boots from. */
export function clearStoredData(): string[] {
  const keys = listStoredData()
    .map((e) => e.key)
    .filter((key) => under(RESET_PREFIXES, key))
  try {
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // unavailable or blocked — nothing was cleared, and the caller's reload will
    // simply come back on the same payload
  }
  return keys
}
