// THE STANDING NOTICE a cs2023 route carries wherever it is shown. The sentence
// is the one each generated route description already ends with, so the data
// stays the one source of the wording and the generator is not touched. A
// zero-stop route has no stops to place and so carries none.
//
// The opener identifies the sentence; it is not a copy of the wording, which
// stays in the description. A naive last-sentence split would swallow the
// abbreviation before it ("(2 hr. Lab every other week)").

import type { Walk } from '../corpus/walks'

const NOTICE_OPENER = 'Placements are'

/** the notice for a route, or null when this corpus has none, this route has no
 *  stops, or its description does not carry the notice. */
export function standingNotice(
  walk: Pick<Walk, 'description' | 'stops'> | null | undefined,
  corpus: string,
): string | null {
  if (corpus !== 'cs2023' || !walk || !walk.stops.length) return null
  const description = (walk.description ?? '').trim()
  const at = description.lastIndexOf(NOTICE_OPENER)
  return at === -1 ? null : description.slice(at)
}
