// Walk·Palette as its own instrument (#21) — where stops come FROM. Search the
// corpus, then drag or click a topic onto the road.
//
// It is a stand-in for the map: the whole feed contract is `pal:<nodeId>` on
// text/plain, so the real map beside it is a dragstart handler away, not a
// redesign. The Plan preset now literally puts the two side by side, which
// is what the google-maps framing on #20 was asking for — the territory you can
// see, and the filtered list of what is in it.
//
// This wrapper exists to JOIN the bus (hover) and the shared draft; Palette
// itself is presentation plus two callbacks, and stays reusable.

import { useAuthorDraft } from '../../state/walk/authordraft'
import Palette from './Palette'
import { useHover } from '../../state/bus'
import type { Bus, HoverBus } from '../../state/bus'

/** the slice of the bus the palette reads and writes: hover, plus the select, look and match
 *  channels it publishes to the map. */
type WalkPaletteViewBus = Pick<Bus, 'setFocus' | 'peekAt' | 'setMatches'> & HoverBus

export default function WalkPaletteView({ bus }: { bus: WalkPaletteViewBus }) {
  const sync = useHover(bus)
  const state = useAuthorDraft()

  // Clicking a hit SELECTS it on the map. Two channels, because "select" and
  // "zoom to" are two different things on this bus: setFocus lights the
  // selection overlay (glow, roads, chip) and re-roots the tree but never moves
  // the camera; peekAt publishes the LOOK that flies the camera to the node's
  // territory. Together they are "zoom in on the map as if we selected it there".
  // 'link' + jump tags the trail as a discontinuous leap — the same gesture
  // NeighborhoodPanel and LensPane already use to jump across the graph.
  const selectOnMap = (id: string) => {
    bus.setFocus(id, 'link', true)
    bus.peekAt(id)
  }

  return (
    <div data-palette className="h-full flex flex-col">
      {/* onMatches publishes the live hit set to the map (#25). bus.setMatches is
          referentially stable (useCallback'd), so Palette's publish effect binds
          to it without re-subscribing every render. */}
      <Palette state={state} sync={sync} onSelect={selectOnMap} onMatches={bus.setMatches} />
    </div>
  )
}
