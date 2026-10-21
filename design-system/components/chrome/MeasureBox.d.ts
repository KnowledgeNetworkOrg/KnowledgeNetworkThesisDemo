import type { DependencyList } from 'react'

/**
 * WHEN A COMPONENT MAY BELIEVE ITS OWN MEASUREMENT.
 *
 * Three faults in one day (2026-09-04) wrote this file, each a number that LOOKED measured:
 *  1. **An observer-only measurement keeps its first callback, and that one is early.** The
 *     initial notification fires at observe time, before layout is final in this host, and a box
 *     that never changes size afterwards gets no second one — so the value stays what that early
 *     callback said: 0 for a flex-derived height. The observer is NOT broken (probed: observe a
 *     20px div → 20; resize to 40 → 40); it reports CHANGE, and a settled box has none.
 *  2. **A read on the mount frame measures the fallback.** The box has not laid out yet.
 *  3. **One `requestAnimationFrame` is not enough either** — measured: a readout still printed 0
 *     with `read(); requestAnimationFrame(read)`, and a stray `resize` then corrected it to 141.
 *
 * So the answer is a LADDER rather than a moment. `settleRead` reads now, on the next frame, on
 * the frame after that, when `document.fonts.ready` resolves (type metrics move boxes), and on
 * every window resize; it returns its own teardown. Pair it with a `ResizeObserver` for LATER
 * changes, which is what an observer is good at. **Never the observer alone, and never one frame.**
 *
 * The reads are idempotent and there are a handful of them, so the cost is nil and no single one
 * has to be the lucky one — which is the actual design goal.
 */
/** MeasureBox is FUNCTIONS, not a rendered component — there are no props, and this interface
 *  exists so the shape is declared rather than implied: a caller passes a read and gets a
 *  teardown. */
export interface MeasureBoxProps {
  /** measure whatever boxes you like; takes no arguments and must be idempotent, because the
   *  ladder calls it several times on mount */
  read: () => void
}

export function settleRead(read: () => void): () => void

/** The whole recipe in one hook: the settle ladder for the value NOW, an observer for later.
 *  `read` takes no arguments and may measure several boxes. */
export function useSettledMeasure(read: () => void, deps?: DependencyList): void

/** The capitalised way in for a card or a rig — the same function objects, not copies. */
export const MeasureBox: { settleRead: typeof settleRead; useSettledMeasure: typeof useSettledMeasure }
