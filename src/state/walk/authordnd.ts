// The one drag-and-drop contract every authoring view shares (round 4 —
// three views author the SAME draft, so a drop must mean the same thing in
// all of them). Payloads: `pal:<nodeId>` from the palette, `blk:<pathKey>`
// for an existing block, `var:<forkPathKey>~<idx>` for a fork's variant tab
// (dragging a route out extracts it as its own group). A drop resolves to an
// insertion Path and goes through the same AuthorState ops regardless of which
// view caught it.

import type { DragEvent as ReactDragEvent } from 'react'

import type { AuthorState, Path } from './authordraft'
import { parsePath } from './authordraft'
import { chosenIdx, chosenSteps, isBox } from './mockwalk'
import type { Stop } from './mockwalk'

export const DT = 'text/plain'

export type Band = 'before' | 'after' | 'inside'

/** the visual twin of gapFor — which band the pointer is in, for drop marks */
export function bandFor(e: ReactDragEvent, stop: Stop): Band {
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / r.height
  if (isBox(stop) && y > 0.3 && y < 0.7) return 'inside'
  return y < 0.5 ? 'before' : 'after'
}

/** where a drag over a block row should insert: before, after, or (containers,
 * middle band) inside the chosen variant at the end — shared by dragover
 * (caret) and drop. A container's inside-drop lands in the variant on show. */
export function gapFor(e: ReactDragEvent, path: Path, stop: Stop, choices: Record<string, string>): Path {
  const r = e.currentTarget.getBoundingClientRect()
  const y = (e.clientY - r.top) / r.height
  const i = path[path.length - 1]
  const parent = path.slice(0, -1)
  if (isBox(stop) && y > 0.3 && y < 0.7) return [...path, chosenIdx(stop, choices), chosenSteps(stop, choices).length]
  return y < 0.5 ? [...parent, i] : [...parent, i + 1]
}

export function handleDrop(e: ReactDragEvent, target: Path, state: AuthorState) {
  e.preventDefault()
  e.stopPropagation()
  const data = e.dataTransfer.getData(DT)
  if (data.startsWith('pal:')) state.insertNode(data.slice(4), target)
  else if (data.startsWith('blk:')) state.moveBlock(parsePath(data.slice(4)), target)
  else if (data.startsWith('var:')) {
    const [pk, idx] = data.slice(4).split('~')
    state.extractVariant(parsePath(pk), Number(idx), target)
  }
  state.setCaret(null)
}
