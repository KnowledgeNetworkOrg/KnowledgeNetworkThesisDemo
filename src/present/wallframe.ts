import { useCallback, useState } from 'react'

import type { WallFrame } from '../model/walkwall'

/** THE WALL'S FRAME IS THE HOST'S (DS OB-163): the map fits the whole walk the first time it
 *  goes up and reports the frame back; every later mount — M down, M up — gets it back and draws
 *  the same picture. Kept WITH the walk it was fitted for, so a change to the walk is the one
 *  thing that re-fits: a frame kept for another `key` is simply not handed over. `key` is
 *  whatever identifies the walk on that screen — the steps array itself, or the ids joined.
 *
 *  ONE HOOK FOR BOTH SCREENS. The presenter and the projector each carried these lines; two
 *  copies of one rule had already started to differ in how they keyed it. Spread the result
 *  into `MapView`'s `wall` prop. */
export function useKeptWallFrame(key: unknown): { frame: WallFrame | null; onFrame: (frame: WallFrame) => void } {
  const [kept, setKept] = useState<{ key: unknown; frame: WallFrame } | null>(null)
  const onFrame = useCallback((frame: WallFrame) => setKept({ key, frame }), [key])
  return { frame: kept && kept.key === key ? kept.frame : null, onFrame }
}
