// THE STANDING NOTICE a cs2023 route carries wherever it is shown. The sentence
// is the one the generated route descriptions already end with (60 of 61; the
// zero-stop CPS 40A/B has none), so the data stays the one source of the
// wording and the generator is not touched. The tail is returned rather than a
// constant copied out of it.

import type { Walk } from '../corpus/walks'

export const PLACEMENT_NOTICE = "Placements are AI-suggested and under the author's review."

/** the notice for a route, or null when this corpus has none or this route's
 *  description does not end with it. */
export function standingNotice(walk: Pick<Walk, 'description'> | null | undefined, corpus: string): string | null {
  if (corpus !== 'cs2023' || !walk) return null
  const description = (walk.description ?? '').trim()
  return description.endsWith(PLACEMENT_NOTICE)
    ? description.slice(description.length - PLACEMENT_NOTICE.length)
    : null
}
