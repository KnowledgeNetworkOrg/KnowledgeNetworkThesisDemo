// THE ONE CARD A STOP SHOWS ON HOVER, wherever the pointer finds the stop — the walk
// viewer's strip, the map's dock and the map's pins all pass this same function as
// `renderPreview`, so a stop previews identically on every surface (DS OB-131: "pass
// the SAME function you pass WalkStrip and the map's pins"). It used to be an inline
// closure in WalkViewer.tsx; three hosts would have meant three drifting copies.
//
// IT NAMES THE STOP (DS OB-184, 2026-09-14). Until then a top-level stop with no note
// drew NO card, on the reasoning that its name was already under its dot — true on the
// strip and in the dock's open row, and false on the two surfaces the owner was
// pointing at: a map pin prints only a number, and the closed rail names only the
// stop the walk is ON. So the card leads with the stop's number and name — its full
// step path where it sits inside a GROUP on the road, "3.1 · Name" (#228, DS OB-114,
// WalkPreview's caller rule 4: a pin prints only the group's top-level number and
// several pins may share it, so this card is the ONLY place on the map the path is
// readable) — then the note, when there is one.
//
// A MERGED PIN'S CARD NAMES EVERY STOP UNDER IT (OB-184 clause 3). At a coarse level
// `walkPins` merges a contiguous run of stops resolving to one cell into one pin
// labelled "2-3"; the host builds the mark and passes it as the third argument, and
// this card is the only place that can explain one. Two stops under one pin are two
// different documents, so a card naming the first is wrong rather than incomplete.
// The dock never sends a mark — it draws one dot per stop.

import type { ReactNode } from 'react'

import type { WalkMark, WalkStep } from '@/ds'

import type { PlayStep } from './playback'

type StopLike = WalkStep & Partial<Pick<PlayStep, 'path'>>

const nameOf = (s: StopLike, n?: number) => (s.path ? `${s.path} · ${s.title}` : n !== undefined ? `${n} · ${s.title}` : s.title)

export function renderStopPreview(step: StopLike | undefined, index?: number, mark?: WalkMark): ReactNode {
  // WalkStrip never clamps hoverIndex against a shrinking steps array, so a step
  // can arrive here undefined mid-edit — guard, don't assume the prop's own type.
  if (!step) return null
  const stops = mark && mark.steps && mark.steps.length > 1 ? (mark.steps as StopLike[]) : null
  return (
    <div data-stoppreview className="px-2 py-1 rounded border border-slate-200 bg-white shadow-lg text-[11px] max-w-[220px] text-slate-600">
      {stops ? (
        <>
          <div data-stoplabel className="font-medium text-slate-800">{mark!.label}</div>
          {stops.map((s, i) => <div key={i} data-stoprow>{nameOf(s, mark!.from + i + 1)}{s.note ? <span className="text-slate-500"> · {s.note}</span> : null}</div>)}
        </>
      ) : (
        <>
          <div data-stoppath className="font-medium text-slate-800">{nameOf(step, index !== undefined ? index + 1 : undefined)}</div>
          {step.note ? <div>{step.note}</div> : null}
        </>
      )}
    </div>
  )
}
