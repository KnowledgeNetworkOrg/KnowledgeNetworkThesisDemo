// WHAT A LENS SAYS WHEN ITS CENTRE IS NOT A TOPIC, as arithmetic. A cs2023
// route stops at whatever depth its outline item was placed: inside a unit, on
// an area, or on the Science exception group, and each reads differently.

export interface NonTopicLensCase {
  corpus: string
  /** the centre is the Science exception group, which holds no CS2023 unit */
  isScience: boolean
  /** the nearest topic ancestor's title, when the centre sits inside a unit */
  enclosingTitle?: string
}

/** the empty-state sentence for a lens centred on a place that is not a topic */
export function nonTopicLensMessage({ corpus, isScience, enclosingTitle }: NonTopicLensCase): string {
  if (corpus !== 'cs2023') return 'lenses read topics — typed links live at the topic level'
  if (isScience) return 'Science is outside CS2023 — it has no knowledge units for the lenses to read'
  if (enclosingTitle) return `this place sits inside ${enclosingTitle} — lenses read its knowledge unit`
  return 'this place is an area — lenses read its knowledge units'
}
