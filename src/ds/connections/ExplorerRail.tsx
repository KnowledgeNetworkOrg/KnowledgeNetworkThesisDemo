import { useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'

import { FindMark } from '../chrome/FindMark'
import { OutlineMark } from '../chrome/OutlineMark'
import { TextInput } from '../chrome/TextInput'
import { ContainTree } from './ContainTree'
import type { ContainNode, OpenMap } from './ContainTree'
import { RailCorner, RailFrame, railWidth } from './RailFrame'

/** THE EXPLORER RAIL, WHOLE — the containment column the dissolved connections pane's left half
 *  became: a filter, the tree, and the chrome that hides it and brings it back. A host mounts
 *  this; it does not assemble one.
 *
 *  WHY IT IS A COMPONENT AND NOT A RECIPE: everything ABOUT a rail that is a design decision —
 *  how narrow it may get, when it refuses rather than clips, where the closed button sits, which
 *  mark it wears, that the filter prunes in place rather than opening a list — is invisible in
 *  the parts. Shipped as parts, each host re-derives all of it by eye, and the two builds drift
 *  in exactly the places nobody can point at a contract for.
 *
 *  WHAT THE HOST AROUND IT MUST DO:
 *  1. BE `position: relative` and pass `paneW` from `RailMath.usePaneWidth()` — `RailFrame`'s
 *     three states depend on both.
 *  2. OWN THE SELECTION. The rail reports a node and changes nothing itself; in this product a
 *     selection moves the pane's focus and the map follows.
 *  3. OWN THE OPEN SET, if it wants the map to drive it: pass `open` and `onOpenUpdate`, fold
 *     `OpenOnSelect(root, selectedId)` into your own map ONCE when the selection changes, and
 *     merge `OpenForVisible(root, visibleIds)` over it when the map's view changes — never spread
 *     either over the map on every render (OB-244's two owner reports). Omit both and the tree
 *     keeps its own.
 *  4. OWN THE HOVER PREVIEW. `onNodeEnter`/`onNodeLeave` carry the raw event up to the pane's
 *     single `NodePreviewLayer`, because what a node's preview SAYS is corpus knowledge. Omit
 *     them and the tree washes its own row and answers the count in the pill's title.
 *
 *  THE FILTER IS THE TREE'S OWN `query`: it prunes to matches plus the ancestors leading to them
 *  and force-opens what survives, so a hit is always read inside its own hierarchy. It does NOT
 *  open a floating list of hits — a rail this narrow has no room for an overlay, and "where is
 *  this" is half the answer a search here is for. */
export interface ExplorerRailProps {
  /** the containment tree's root — a REAL node of the corpus, never a synthesised row
   *  (`ContainTree`'s host obligation 7) */
  root: ContainNode
  /** the node drawn as selected. `null` lights nothing */
  selectedId?: string | null
  /** reports the row that was clicked — and NULL when a click cleared the selection, which can
   *  only happen if `deselectable` was granted. A host that does not grant it never sees null */
  onSelect?: (node: { id: string; title: string; domain?: string } | null) => void
  /** LET A CLICK ON THE SELECTED ROW CLEAR THE SELECTION (`onSelect(null)`). Off by default,
   *  because it is a CAPABILITY and not a state: a pane whose selection can never be empty — a
   *  document has to be reading something — would be handed a null it has nowhere to put, and
   *  the absent prop is the honest way to say the selection is mandatory here. Grant it and the
   *  host must decide what empty MEANS: in the Studio the tree and the map go unselected while
   *  the document keeps the last node it was reading, because clearing a highlight must not
   *  blank the prose */
  deselectable?: boolean
  /** the host's open map, if it owns one */
  open?: OpenMap
  /** the open set's controlled setter, receiving an UPDATER — see `ContainTreeProps.onOpenUpdate` */
  onOpenUpdate?: (updater: (prev: OpenMap) => OpenMap) => void
  /** mirror another surface's hover here; omit and the tree washes its own row */
  hoveredId?: string | null
  /** the pointer entered a row — the pane's hook for its single `NodePreviewLayer`, which owns
   *  the card and the clamp. Carries the raw event, and the tree node */
  onNodeEnter?: (e: ReactMouseEvent, node: ContainNode) => void
  /** the pointer left a row */
  onNodeLeave?: () => void
  /** the PANE's measured width, not the rail's */
  paneW?: number
  /** the rail's open state. Default open */
  railOpen?: boolean
  /** the intent to open or close */
  onRailOpenChange?: (open: boolean) => void
  /** controlled filter text. Omit both and the rail keeps its own — filter text is rail state,
   *  and a host only needs it to persist one across a remount */
  query?: string
  /** the controlled filter's report */
  onQueryChange?: (q: string) => void
  /** the rail's name, on the header and the closed button. Default `"Explorer"` */
  label?: string
  /** drop the filter box. Default `true` — turn it off only where the tree is short enough that
   *  filtering says nothing, never to save the 28px */
  filter?: boolean
  /** hand the closed-state control to the pane — see `RailFrameProps.closedControl`. A pane with
   *  a header row of its own passes `"host"` and mounts `ExplorerRailCorner` in that row */
  closedControl?: 'corner' | 'host'
  /** the seam's stored drag width and its report — see `RailFrameProps` (`width`,
   *  `onWidthChange`). Pass `onWidthChange` and the seam between the rail and the map drags */
  width?: number | null
  /** the seam's report; see `RailFrameProps.onWidthChange` */
  onWidthChange?: (width: number | null) => void
}

export function ExplorerRail({
  root, selectedId, onSelect, deselectable, open, onOpenUpdate, hoveredId, onNodeEnter, onNodeLeave,
  paneW, railOpen = true, onRailOpenChange, query, onQueryChange, label = 'Explorer', filter = true,
  closedControl, width, onWidthChange,
}: ExplorerRailProps) {
  const [ownQuery, setOwnQuery] = useState('')
  const q = query === undefined ? ownQuery : query
  const setQ = (v: string) => { if (query === undefined) setOwnQuery(v); if (onQueryChange) onQueryChange(v) }
  return (
    <RailFrame side="left" label={label} mark={<OutlineMark size={12} />} open={railOpen} onOpenChange={onRailOpenChange} paneW={paneW} closedControl={closedControl}
      width={width} onWidthChange={onWidthChange}>
      {filter ? (
        <TextInput value={q} onChange={setQ} placeholder="filter" size="sm"
          leading={<FindMark size={12} />} ariaLabel={'Filter ' + label.toLowerCase() + ' by name'}
          style={{ margin: '0 2px 6px' }} />
      ) : null}
      <ContainTree root={root} compact open={open} onOpenUpdate={onOpenUpdate} selectedId={selectedId}
        query={q} onSelect={onSelect} deselectable={deselectable} hoveredId={hoveredId} onNodeEnter={onNodeEnter} onNodeLeave={onNodeLeave} />
    </RailFrame>
  )
}

/** THE EXPLORER'S WAY BACK, FOR A PANE THAT HAS A HEADER ROW OF ITS OWN — mount this as the
 *  first thing in that row and pass the rail `closedControl="host"`. It exists so the pairing of
 *  WORD and MARK is made once: a host assembling `RailCorner` itself would pick the mark again,
 *  and the day the Explorer's mark changes there would be two answers. Draws nothing while the
 *  rail is open, and the refusal when the pane has no room. */
export interface ExplorerRailCornerProps {
  /** the PANE's measured width — the same number the rail is given */
  paneW?: number
  /** the rail's open state. Draws nothing while open with room to draw */
  open: boolean
  /** the intent to open */
  onOpenChange?: (open: boolean) => void
  /** the rail's name, on the button. Default `"Explorer"` */
  label?: string
  /** placement in the host's own row — this component takes no position of its own */
  style?: CSSProperties
}

export function ExplorerRailCorner({ paneW, open, onOpenChange, label = 'Explorer', style }: ExplorerRailCornerProps) {
  return <RailCorner side="left" label={label} mark={<OutlineMark size={12} />} paneW={paneW} open={open} onOpenChange={onOpenChange} style={style} />
}

/** the rail's own column width at a given pane width — published so a host can size the figure,
 *  card or layer it draws BESIDE the rail against the same number the rail uses. Pass the same
 *  stored `width` the rail is given. */
export function explorerRailWidth(paneW?: number, width?: number | null): number {
  return railWidth('left', paneW, width)
}

/** the capitalised way in, for the same reason as `RailMath`. Same function object.

   Typed port of the DS components/connections/ExplorerRail.jsx (OB-238 / #341). */
export const ExplorerRailMath = { width: explorerRailWidth }
