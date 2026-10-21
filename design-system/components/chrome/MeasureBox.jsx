import React from 'react'

/** WHEN A COMPONENT MAY BELIEVE ITS OWN MEASUREMENT.
 *
 *  Three faults in one session taught this file (2026-09-04), each of them a number that LOOKED
 *  measured and was not:
 *   1. An OBSERVER-ONLY measurement keeps its FIRST callback, and that one is early. The
 *      observer's initial notification fires at observe time, before layout is final in this
 *      host — and a box that never changes size afterwards never gets a second one. So the value
 *      stays whatever that early callback said: 0 for a flex-derived height, measured on a mock
 *      pane that was 141px tall. **The observer is not broken** (probed: observe a 20px div →
 *      callback 20; resize to 40 → callback 40) — it reports CHANGE, and a settled box has none
 *      to report. Corrected 2026-09-04 after review: the first diagnosis written here said the
 *      observer "never fires", which was wrong and would have sent the next reader looking for a
 *      broken API instead of a mis-timed read.
 *   2. A read on the mount frame measures the FALLBACK, not the layout. The component that
 *      measures itself has not laid out yet.
 *   3. A SINGLE `requestAnimationFrame` is not enough here either — measured: the card's mock pane
 *      still printed 0 with `read(); requestAnimationFrame(read)`, and a later stray `resize`
 *      corrected it to 141. So the first frame after mount can still precede final layout.
 *
 *  `settleRead` is therefore a LADDER, not a callback: read now (right in a settled host), on the
 *  next frame, on the frame after that (the double rAF is what fixed fault 3), when fonts resolve
 *  (type metrics move boxes), and on every window resize. Cheap — a handful of reads on mount, all
 *  of them idempotent — and the point is that no single one of them has to be the lucky one.
 *
 *  Pair it with a `ResizeObserver` for LATER changes; that is what an observer is good at. Never
 *  use the observer alone, and never trust one frame. */
export function settleRead(read) {
  if (typeof read !== 'function') return () => {}
  read()
  let outer = null, inner = null
  if (typeof requestAnimationFrame === 'function') {
    outer = requestAnimationFrame(() => { read(); inner = requestAnimationFrame(read) })
  }
  /* type metrics change box sizes, and a font can resolve after the frames above */
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(read).catch(() => {})
  }
  if (typeof window !== 'undefined') window.addEventListener('resize', read)
  return () => {
    if (outer != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(outer)
    if (inner != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(inner)
    if (typeof window !== 'undefined') window.removeEventListener('resize', read)
  }
}

/** READ A BOX AND KEEP READING IT — the whole recipe in one hook: the settle ladder above for the
 *  value now, an observer for later. Returns nothing; `read` is yours and receives no arguments,
 *  so it reads whatever box it likes (several, if a component measures more than one). */
export function useSettledMeasure(read, deps) {
  const held = React.useRef(read)
  held.current = read
  React.useEffect(() => {
    const run = () => held.current && held.current()
    const stop = settleRead(run)
    let ro = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(run) }
    return () => { stop(); if (ro) ro.disconnect() }
  }, deps || [])
}

/** The capitalised way in for a card or a rig — the same function objects, not copies. */
export const MeasureBox = { settleRead, useSettledMeasure }
