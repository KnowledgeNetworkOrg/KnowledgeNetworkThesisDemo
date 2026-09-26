// THE PROJECTOR CHANNEL — how the presenter's window tells the room's window what
// to show (#267 OB-135 clause 2/3, #197's architecture).
//
// TWO WINDOWS, NOT TWO DISPLAYS. The presenter screen stays in the app's own
// window; starting a lecture opens a SECOND window of this same app at
// `?projector`, which renders only the live slide, full-bleed, and nothing else.
// Where that window lands — the laptop, the projector — is the OS's or the
// professor's to decide; display placement is an enhancement layered on later
// (#204), never the mechanism. That is how Google Slides, Figma, Canva and
// reveal.js all ship it, and it works on one monitor or three.
//
// THE TRANSPORT IS `BroadcastChannel`: both windows are same-origin, so it needs
// no window handle and survives either window reloading. reveal.js reaches for
// `postMessage` only because it must cross origins; we do not.
//
// A HANDSHAKE BEFORE STATE (reveal.js's `connect` / `connected`). The projector
// window opens AFTER the presenter has state, so it would otherwise open blank
// on a slide nobody chose. The projector says `connect` when it is ready; the
// presenter answers `connected` and then the current state; from then on every
// change is a `state`. A second projector window (a reload, a second screen)
// joins the same way. The presenter DRIVES — the projector never sends a seek.
//
// `close` is the presenter leaving: the projector window closes itself, so a
// screen nobody is watching is not left showing a slide (#197: closing one
// window closes the other).

import { useEffect, useRef, useState } from 'react'

import type { LectureStep } from './lecture'

/** the channel both windows join */
export const PROJECTOR_CHANNEL = 'kn-lecture-projector'
/** the projector window's name — `window.open` reuses a named window rather than
 *  opening a second one, so pressing ▶ again re-lands the same window */
export const PROJECTOR_WINDOW = 'kn-projector'
/** the query flag that makes a window of this app a projector */
export const PROJECTOR_QUERY = 'projector'

/** is this window the projector? Read off the location's query string */
export const isProjectorLocation = (search: string): boolean => new URLSearchParams(search).has(PROJECTOR_QUERY)

/** what the room sees: the live slide, or nothing */
export interface ProjectedState {
  /** a lecture is live — projecting and not ended. False = the wall goes dark */
  live: boolean
  /** the stop on the wall, or null when nothing is projected */
  slide: LectureStep | null
  /** 1-based, for the slide's own eyebrow */
  stop: number
  /** how many stops the lecture has */
  count: number
  /** THE MAP IS UP (OB-139): the wall shows the map with the walk on it instead of the slide */
  mapUp: boolean
  /** the lecture's stops, as corpus ids — what the projector's own map draws the walk from */
  ids: string[]
  /** which of those stops the walk may skip, INDEXED LIKE `ids` — the projected map's pins dash
   *  and slant from it (DS OB-214 clause 4: "`ProjectedMap`'s lecture pins take the same flag").
   *  Without it the room's map would rebuild the walk from bare ids and draw every optional stop
   *  as required, which is the fault OB-214 exists for. */
  optional: boolean[]
  /** the stops the record has covered, 0-based — the wall's line runs through them */
  covered: number[]
}

export const NOTHING_PROJECTED: ProjectedState = { live: false, slide: null, stop: 0, count: 0, mapUp: false, ids: [], optional: [], covered: [] }

export type ProjectorMessage =
  | { kind: 'connect' }
  | { kind: 'connected' }
  | { kind: 'state'; state: ProjectedState }
  | { kind: 'close' }

/** what a projector holds after one message: state replaces, close darkens, the
 *  handshake words carry nothing. Pure, so the protocol can be asked directly. */
export function receiveProjection(prev: ProjectedState, msg: ProjectorMessage): ProjectedState {
  switch (msg.kind) {
    case 'state': return msg.state
    case 'close': return NOTHING_PROJECTED
    default: return prev
  }
}

/** true when a message is one of ours — the channel is shared by name, and a
 *  stranger's payload must not become a slide */
export function isProjectorMessage(data: unknown): data is ProjectorMessage {
  if (!data || typeof data !== 'object') return false
  const k = (data as { kind?: unknown }).kind
  return k === 'connect' || k === 'connected' || k === 'state' || k === 'close'
}

function openChannel(): BroadcastChannel | null {
  return typeof BroadcastChannel === 'function' ? new BroadcastChannel(PROJECTOR_CHANNEL) : null
}

/** THE PRESENTER'S END. Publishes `state` on every change and answers each
 *  `connect` with `connected` + the current state; says `close` on unmount, which
 *  is the presenter leaving the mode. */
export function useProjectorSender(state: ProjectedState): void {
  const chan = useRef<BroadcastChannel | null>(null)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
    chan.current?.postMessage({ kind: 'state', state } satisfies ProjectorMessage)
  }, [state])
  useEffect(() => {
    const c = openChannel()
    chan.current = c
    if (!c) return
    c.onmessage = (e: MessageEvent<unknown>) => {
      if (!isProjectorMessage(e.data) || e.data.kind !== 'connect') return
      c.postMessage({ kind: 'connected' } satisfies ProjectorMessage)
      c.postMessage({ kind: 'state', state: latest.current } satisfies ProjectorMessage)
    }
    return () => {
      c.postMessage({ kind: 'close' } satisfies ProjectorMessage)
      c.close()
      chan.current = null
    }
  }, [])
}

/** THE PROJECTOR'S END. Says `connect` once it is listening; holds whatever the
 *  presenter last said. `closed` turns true on the presenter's `close`, so the
 *  window can shut itself. */
export function useProjectedState(): { state: ProjectedState; connected: boolean; closed: boolean } {
  const [state, setState] = useState<ProjectedState>(NOTHING_PROJECTED)
  const [connected, setConnected] = useState(false)
  const [closed, setClosed] = useState(false)
  useEffect(() => {
    const c = openChannel()
    if (!c) return
    c.onmessage = (e: MessageEvent<unknown>) => {
      if (!isProjectorMessage(e.data)) return
      const msg = e.data
      if (msg.kind === 'connected') setConnected(true)
      if (msg.kind === 'close') setClosed(true)
      setState((prev) => receiveProjection(prev, msg))
    }
    c.postMessage({ kind: 'connect' } satisfies ProjectorMessage)
    return () => c.close()
  }, [])
  return { state, connected, closed }
}
