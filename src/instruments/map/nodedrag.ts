// THE MAP'S #24 NODE DRAG (#399 cut 2) — the gesture that carries the selected
// cell onto the road, moved out of MapView whole. The drawing is `DragGhost.tsx`.
//
// It is called where the drag state block sat in MapView, so the hook order is
// unchanged. The pan/drag gates stay in MapView — they read `nodeDown.current`,
// which this hook returns — and `drag`/`dragDist`/`setDragging` stay MapView's,
// because pan shares them.

import { useRef, useState } from 'react'
import type { Dispatch, PointerEvent, RefObject, SetStateAction } from 'react'

import { DT } from '../../state/walk/authordnd'

export type Box = { x: number; y: number; width: number; height: number }
export type Ghost = { id: string; x: number; y: number; outside: boolean; bbox: Box }

export function useNodeDrag({ svgRef, dragRef, dragDistRef, setDragging }: {
  svgRef: RefObject<SVGSVGElement | null>
  dragRef: RefObject<{ x: number; y: number } | null>
  dragDistRef: RefObject<number>
  setDragging: Dispatch<SetStateAction<boolean>>
}) {
  // ── #24 — DRAG THE SELECTED CELL ONTO THE ROAD ────────────────────────────
  // A CUSTOM POINTER DRAG, not native HTML5 DnD, for two reasons the ticket's
  // "just add draggable" plan couldn't survive: Chromium ignores the draggable
  // attribute on SVG shapes, and a native drag image is a frozen snapshot — it
  // can't MORPH. So we drive the whole gesture by hand: a portal ghost follows
  // the cursor, showing the cell's own outline while over the map and crossfading
  // into a node pill once it leaves the map (the "shape becomes a node" ask). On
  // as it moves we feed the road a stream of synthetic HTML5 `dragover`/`dragleave`
  // events at the cursor, and a `drop` on release — so the road's OWN handlers do
  // both the live preview caret AND the precise insertion (gaps, stages, branches)
  // verbatim, no reimplementation and no road refactor. A container id rides the
  // same path and lands as a plain visit (everything is a node). Only the SELECTED
  // cell arms this (see the pointerdown gate), so pan is untouched everywhere else.
  const nodeDown = useRef<{ id: string; x: number; y: number; bbox: Box } | null>(null)
  const ndActive = useRef(false)
  // the element the last synthetic dragover went to — so we can dragleave it the
  // moment the cursor moves to a new target (or off the road), which is what
  // clears its caret. Mirrors the enter/leave a native drag would produce.
  const lastOver = useRef<Element | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)

  /** a DnD event carrying the palette payload. Dispatched by hand, these fire the
   * road's real onDragOver / onDragLeave / onDrop exactly as a browser drag would
   * — no browser DnD state machine to satisfy, so a `drop` needs no prior
   * handshake, and dragover/leave drive the road's existing caret. */
  const dndEvent = (type: 'dragover' | 'dragleave' | 'drop', x: number, y: number, id: string) => {
    const dt = new DataTransfer()
    dt.setData(DT, 'pal:' + id)
    return new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt })
  }
  /** point the road's preview caret at the cursor: leave the old target, hover
   * the new one. Called on every move while a node drag is in flight. */
  const dragOverAt = (x: number, y: number, id: string) => {
    const el = document.elementFromPoint(x, y)
    if (el !== lastOver.current) {
      if (lastOver.current) lastOver.current.dispatchEvent(dndEvent('dragleave', x, y, id))
      lastOver.current = el
    }
    if (el) el.dispatchEvent(dndEvent('dragover', x, y, id))
  }

  const down = (ev: PointerEvent<SVGSVGElement>, t: Element, sel: string) => {
    // ARM a node drag on the selected cell (see the block above). Don't
    // capture yet — a pure click must still reach onClick to deselect;
    // capture happens in pointermove once movement confirms a drag. Grab
    // the cell's geometry NOW, while we hold its path element, so the
    // ghost can draw the outline (getBBox is in the same user space as
    // outlineOf's `d`).
    dragRef.current = null
    nodeDown.current = { id: sel, x: ev.clientX, y: ev.clientY, bbox: (t as SVGGraphicsElement).getBBox() }
  }
  const move = (ev: PointerEvent<SVGSVGElement>, nd: { id: string; x: number; y: number; bbox: Box }) => {
    const dist = Math.hypot(ev.clientX - nd.x, ev.clientY - nd.y)
    if (!ndActive.current && dist > 5) {
      // confirmed a drag: capture so moves over the ROAD still reach us
      ndActive.current = true
      ;(ev.currentTarget as Element).setPointerCapture(ev.pointerId)
    }
    if (ndActive.current) {
      const r = svgRef.current!.getBoundingClientRect()
      const outside = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom
      setGhost({ id: nd.id, x: ev.clientX, y: ev.clientY, outside, bbox: nd.bbox })
      // drive the road's live preview caret at the cursor
      dragOverAt(ev.clientX, ev.clientY, nd.id)
    }
  }
  const release = (ev: PointerEvent<SVGSVGElement>) => {
    if (!nodeDown.current) return
    if (ndActive.current) {
      const { clientX: x, clientY: y } = ev
      const id = nodeDown.current.id
      // clear whatever caret we're leaving, THEN drop on the target under
      // the cursor (handleDrop reads the pointer position, not the caret,
      // so the insertion is right either way). Swallow the click this
      // press would fire so a completed drag never also deselects the cell.
      if (lastOver.current) lastOver.current.dispatchEvent(dndEvent('dragleave', x, y, id))
      lastOver.current = null
      const el = document.elementFromPoint(x, y)
      if (el) el.dispatchEvent(dndEvent('drop', x, y, id))
      dragDistRef.current = 999
      try {
        ;(ev.currentTarget as Element).releasePointerCapture(ev.pointerId)
      } catch {
        /* capture may not have been taken (a click, no drag) */
      }
    }
    nodeDown.current = null
    ndActive.current = false
    setGhost(null)
    setDragging(false)
  }

  return { ghost, nodeDown, down, move, release }
}
