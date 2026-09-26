// THE ONE CARD A STOP SHOWS ON HOVER, wherever the pointer finds the stop — the walk
// viewer's strip, the map's dock (its two rails and, since OB-196, the current stop's
// name), the map's pins and the presenter's strip and stop finder all pass this same
// function as `renderPreview`, so a stop previews identically on every surface (DS
// OB-131: "pass the SAME function you pass WalkStrip and the map's pins"). It used to be
// an inline closure in WalkViewer.tsx; three hosts would have meant three drifting copies.
// (It lived in instruments/walkdesk/ until #338 moved it here, beside the playback it
// previews, because four screens import it and none of them is the walk desk.)
//
// IT IS THE STOP'S DOCUMENT, NOT ITS NAME (DS OB-199, 2026-09-16). Until then this file
// composed its own card — `address · title` plus the WALK's note — and the note is the
// walk's optional annotation, so every stop the walk never annotated drew a one-line card:
// the owner's screenshot read `1.2 · Transistors & Logic Gates` and nothing else. It was
// also 11px throughout, this system's floor for numerals and never for sentences. So the
// composition now belongs to the design system: `StopCard` draws the address and name, a
// placement line, the walk's note and the opening of the node's document, and this file
// only hands it strings it owns. It draws no card of its own.
//
// A MERGED PIN'S CARD IS THE ONE-STOP CARD PLUS A COUNT (DS OB-186, owner-ruled
// 2026-09-15). At a coarse level `walkPins` merges a contiguous run of stops resolving to
// one cell into one pin; the card names ONE of them — `walkLeadStop`'s choice, which the
// host passes as `index`, with the mark — and `StopCard`'s footer counts the rest. THE
// FOOTER IS LOAD-BEARING: the card names one of several different documents and nothing
// else on screen admits that. It lives in `StopCard` since OB-199; the dock sends no mark.
//
// THE NUMBER IS THE SURFACE'S OWN, and since OB-188 the surfaces AGREE: the dock and the
// map pin both print the stop's two-number ADDRESS (`walkAddresses`), so the card under a
// pin reads the address the pin's run carries (`mark.addresses`, the host's), and every
// other surface counts by position as its dots do. A stop inside a group keeps its FULL
// path on the card (`WalkPreview` rule 4 — the card has room; a mark does not).

import type { ReactNode } from 'react'

import { StopCard } from '@/ds'
import type { WalkMark, WalkStep } from '@/ds'

import { DOC_BODY } from '../../corpus/docs'
import { byId, pathTo } from '../../corpus/graph'
import type { PlayStep } from './playback'

type StopLike = WalkStep & Partial<Pick<PlayStep, 'path'>>

/** WHERE THE STOP SITS, as `StopCard`'s one-line placement: the containment path with the
 *  ROOT AND THE NODE ITSELF left out ("Core Computer Science › Digital Logic"). `pathTo` is
 *  inclusive at both ends — the root names the whole corpus on every card, and the node's
 *  own title is already the card's heading — so it is never passed raw. The walk desk's
 *  palette draws the same string for its own rows; the layering rule keeps this folder
 *  from importing that one (`src/layering.test.ts`: state may not import instruments).
 *  Cached: a hover re-renders on every pointer move. */
const placeCache = new Map<string, string>()
export function stopPlacement(id: string): string {
  let s = placeCache.get(id)
  if (s === undefined) {
    s = pathTo(id)
      .slice(1, -1)
      .map((pid) => byId.get(pid)!.title)
      .join(' › ')
    placeCache.set(id, s)
  }
  return s
}

export function renderStopPreview(step: StopLike | undefined, index?: number, mark?: WalkMark): ReactNode {
  // WalkStrip never clamps hoverIndex against a shrinking steps array, so a step
  // can arrive here undefined mid-edit — guard, don't assume the prop's own type.
  if (!step) return null
  /* the number this surface already prints: a merged pin's run address for the lead stop
     (or its label), the stop's position otherwise — and a grouped stop's FULL path over
     either, because the card has room for it */
  const own = mark
    ? (mark.addresses && index !== undefined ? mark.addresses[index - mark.from] : undefined) ?? mark.label
    : index !== undefined ? index + 1 : undefined
  const address = step.path && step.path.length ? step.path.join('.') : own
  return (
    <StopCard
      address={address}
      title={step.title}
      optional={!!step.optional}
      ancestry={stopPlacement(step.id) || undefined}
      note={step.note || undefined}
      body={DOC_BODY[step.id] || undefined}
      mark={mark}
    />
  )
}
