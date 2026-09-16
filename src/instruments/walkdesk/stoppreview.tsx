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
// A MERGED PIN'S CARD IS THE ONE-STOP CARD PLUS A COUNT (DS OB-186, owner-ruled 2026-09-15,
// REPLACING what OB-184 clause 3 built here — a list of every stop under the pin). At a
// coarse level `walkPins` merges a contiguous run of stops resolving to one cell into one
// pin; the list answered "which stops are under this pin" and never "what is this page",
// which is the question a hover over a document pin asks — an index in a preview's
// position, and one that grew with the run exactly when the map was busiest. So the card
// is the SAME one-stop preview every other surface shows — that stop's number, name and
// note — plus a footer counting the rest. WHICH stop is `walkLeadStop`'s (the host passes
// it as `index`, with the mark): the cursor clamped into the run. THE FOOTER IS
// LOAD-BEARING, NOT OPTIONAL: the card names one of several different documents and
// nothing else on screen admits that; without it the card reads as the pin's whole
// contents.
//
// THE NUMBER IS THE SURFACE'S OWN, and since OB-188 the surfaces AGREE: the dock and the
// map pin both print the stop's two-number ADDRESS (`walkAddresses`), so the card under a
// pin reads the address the pin's run carries (`mark.addresses`, the host's), and the
// dock's card counts by position as its dots do. A stop inside a group keeps its FULL path
// on the card (`WalkPreview` rule 4 — the card has room; a mark does not).

import type { ReactNode } from 'react'

import type { WalkMark, WalkStep } from '@/ds'

import type { PlayStep } from './playback'

type StopLike = WalkStep & Partial<Pick<PlayStep, 'path'>>

/** the FULL path on the card (`WalkPreview` rule 4 — the card has room), the surface's own number otherwise */
const nameOf = (s: StopLike, n?: number | string) => (s.path && s.path.length ? `${s.path.join('.')} · ${s.title}` : n !== undefined ? `${n} · ${s.title}` : s.title)

export function renderStopPreview(step: StopLike | undefined, index?: number, mark?: WalkMark): ReactNode {
  // WalkStrip never clamps hoverIndex against a shrinking steps array, so a step
  // can arrive here undefined mid-edit — guard, don't assume the prop's own type.
  if (!step) return null
  /* the count of OTHER stops under the pin; `index` is the lead stop the host chose */
  const under = mark ? Math.max(0, mark.to - mark.from) : 0
  const own = mark
    ? (mark.addresses && index !== undefined ? mark.addresses[index - mark.from] : undefined) ?? mark.label
    : index !== undefined ? index + 1 : undefined
  return (
    <div data-stoppreview className="px-2 py-1 rounded border border-slate-200 bg-white shadow-lg text-[11px] max-w-[220px] text-slate-600">
      <div data-stoppath className="font-medium text-slate-800">{nameOf(step, own)}</div>
      {step.note ? <div>{step.note}</div> : null}
      {under > 0 ? (
        <div data-stopmore className="mt-1 pt-1 border-t border-slate-100 text-slate-500">{mark!.label} · +{under} more stop{under === 1 ? '' : 's'} under this pin</div>
      ) : null}
    </div>
  )
}
