// PRESENTING AS A SESSION — the mode flag, the host's fullscreen bit, and the
// keys that drive a deck. No rendering.
//
// NOTHING IMPORTS THIS TODAY, deliberately, and src/unreachedmodule.test.ts records
// that as a decision rather than letting it pass unnoticed. Its only reader was
// PresentationFrame.tsx, the #195 deck, which #267 replaced with PresenterScreen —
// and PresenterScreen does its own fullscreen without this. What is kept here is the
// REASONING below, which the Electron slices (#201, #204) will want and which reads
// the platform seam the way #211 settled. Delete it if those slices end up not
// wanting it; do not quietly re-implement it beside this file.
//
// TWO FLAGS, DELIBERATELY INDEPENDENT.
//
//   `presenting` is OURS: chrome off, the deck on screen, keys bound.
//   `fullscreen` is the HOST'S: whether the window is actually filling the display.
//
// Collapsing them into one would be wrong in both directions. Fullscreen can be
// refused — by policy, by an iframe, by a browser that wants a different gesture
// — and a deck that refuses to start because of that is worse than a deck in a
// window. And the user can leave fullscreen at any moment by pressing F11 or
// Escape, which must not end the presentation: they are un-maximising a window,
// not walking off stage. So `presenting` is state we own and `fullscreen` is a
// value we only ever mirror from the host.

import { useEffect, useRef, useState } from 'react'

import { platform } from '../platform'

export interface PresentSession {
  presenting: boolean
  /** whether the HOST window is fullscreen — a readout, not a control */
  fullscreen: boolean
  /** MUST be called straight from a click handler. The web platform's
   *  requestFullscreen needs the user activation that a click carries, and an
   *  `await` before it would spend that activation. */
  enter(): void
  exit(): void
}

export function usePresentSession(): PresentSession {
  const [presenting, setPresenting] = useState(false)
  // Lazy initializer, not an effect: reading the host once at mount is the
  // correct initial value, and doing it here rather than in a useEffect body is
  // what keeps react-hooks/set-state-in-effect satisfied without a disable.
  const [fullscreen, setFullscreen] = useState(() => platform.isFullscreen())

  // The host is the only source of truth for this bit — our own request may be
  // denied, and F11 never asks us at all. Written from a listener callback,
  // which is not an effect body, so the lint rule is satisfied here too.
  useEffect(() => platform.onFullscreenChange(() => setFullscreen(platform.isFullscreen())), [])

  const enter = () => {
    setPresenting(true)
    // Fire and forget ON PURPOSE. The resolved boolean is deliberately not
    // written to state: `onFullscreenChange` above is the single source of that
    // bit, and writing both would race. A `false` here means the deck runs in a
    // window, which is a working presentation.
    void platform.enterFullscreen()
  }

  const exit = () => {
    setPresenting(false)
    void platform.exitFullscreen()
  }

  return { presenting, fullscreen, enter, exit }
}

export interface PresentationKeyHandlers {
  next(): void
  prev(): void
  first(): void
  last(): void
  exit(): void
}

/** every key that means "next", by what a presenter's hand is actually on:
 *  a clicker (PageDown), a keyboard (arrows, space), or a habit (enter). */
const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'])
const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'])

/** Drives a deck from the keyboard while it is on screen.
 *
 *  BOUND IN THE CAPTURE PHASE, which is the whole trick. The app already has
 *  bubble-phase window listeners that would fight this one — MapView clears the
 *  focus on Escape, and the walk editor takes Ctrl+Z. A capture listener at
 *  `window` runs before the event descends to its target, therefore before every
 *  one of them, and stopping propagation there means MapView never sees the
 *  Escape that exits the deck. That is why exiting a presentation leaves you
 *  standing exactly where you were, and why no other file needed editing.
 *
 *  It stops ONLY the keys it claims, so everything else behaves normally. */
export function usePresentationKeys(active: boolean, handlers: PresentationKeyHandlers): void {
  // A ref mirror so the listener can be bound ONCE and still call the current
  // handlers, which close over a cursor that changes every step. Mirrored in an
  // effect rather than during render (react-hooks/refs) — the same shape any
  // window-level gesture handler needs: bound once, but calling the latest
  // handlers.
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  }, [handlers])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      // Leave the modified combinations to the browser and the OS: Ctrl+PageDown
      // switches tabs, Cmd+Arrow jumps a line. A presenter who wants those
      // should get them.
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // No text inputs in a deck today, but the guard is one line and it is the
      // house pattern (WalkEditorView's undo binding) — a later slice that adds
      // a note field should not have to remember this.
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select') || t.isContentEditable)) return

      const h = ref.current
      let claimed = true
      if (NEXT.has(e.key)) h.next()
      else if (PREV.has(e.key)) h.prev()
      else if (e.key === 'Home') h.first()
      else if (e.key === 'End') h.last()
      else if (e.key === 'Escape') h.exit()
      else claimed = false

      if (!claimed) return
      // preventDefault matters as much as stopPropagation here: Space and
      // PageDown would otherwise scroll the document pane under the deck, so the
      // slide would advance AND the prose would jump.
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active])
}
