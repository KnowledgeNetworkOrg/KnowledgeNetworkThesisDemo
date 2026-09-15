// WHAT A LECTURE IS MADE OF — the pure half of presenter mode (#267, DS OB-135).
//
// A lecture is the walk being played (`useWalkPlayback`'s steps: the saved walk if
// one is active, else the road open on the desk), read once into the shape the
// presenter's four parts share: a title, the stop's TERRITORY (its domain's name,
// what the strip's breadcrumb and the finder's outline group by), the territory's
// ring hue, the stop's DOCUMENT (what the slide prints), the stop's own authored
// note, and the walk's name (the slide's foot). No React here — `PresenterScreen.tsx` holds the store, this
// holds the arithmetic it reads, so the arithmetic can be asked directly.
//
// THREE FACTS THE SCREEN KEEPS, named here because every part reads them the
// same way (DS PresenterStrip.d.ts): `activeStop` is the lecture's committed
// record — where the class is; `roamingStop` is where the professor is LOOKING,
// provisional, null when not roaming; `covered` is what was actually presented —
// a stop is covered when the record LEAVES it, so a skip is a gap in the fill.

import { DOC_BODY } from '../corpus/docs'
import { byId, domainOf, topicHueOf } from '../corpus/graph'
import type { PlayStep } from '../instruments/walkdesk/playback'

/** one stop of the lecture, as every presenter part reads it */
export interface LectureStep {
  id: string
  title: string
  /** the stop's domain, by name — the breadcrumb's left half, the finder's group heading */
  territory: string
  /** the domain's ring hue name (`'amber'`), absent for a stop nobody has a hue for */
  hue?: string
  /** THE NODE'S DOCUMENT AS IT STANDS — what the slide prints under the title, and the
   *  only thing the room ever sees of a stop besides its name (owner's ruling closing #217,
   *  DS OB-172). Not the walk's note: the wall shows the corpus, not the tour of it. */
  document: string
  /** the stop's own authored note — the walk's wording for this stop. NOT PROJECTED since
   *  OB-172; it is the strip's and the dock's line, and the presenter's fallback for a
   *  prepared note the professor has not written yet. */
  note: string
  /** the walk's name — the slide's foot */
  walk: string
}

/** the walk being played, as lecture stops. Every id is a corpus node (the player
 *  already guarantees that), so the domain lookups cannot miss. */
export function lectureSteps(steps: readonly PlayStep[], walkTitle: string): LectureStep[] {
  return steps.map((s) => {
    const domain = domainOf(s.id)
    return {
      id: s.id,
      title: s.title,
      territory: byId.get(domain)?.title ?? '',
      hue: topicHueOf(s.id),
      /* a stop is always a topic id (walks.ts), and every topic is authored a body — pinned
         by lecture.test.ts rather than papered over with invented prose, because a wall that
         quietly shows nothing is worse than a test that fails. */
      document: DOC_BODY[s.id] ?? '',
      note: s.note ?? '',
      walk: walkTitle,
    }
  })
}

/** where the lecture starts: at the Studio's focus when the focus is a stop of the
 *  walk (DS: "the lecture starts at the Studio's focus"), else at the first stop */
export function lectureStart(steps: readonly { id: string }[], focus: string | null): number {
  if (steps.length === 0) return 0
  const at = focus === null ? -1 : steps.findIndex((s) => s.id === focus)
  return at < 0 ? 0 : at
}

/** the stops before `active`, as the covered list a lecture starts with — starting at
 *  stop 5 means stops 1–4 are taken as taught, which is what the DS's reference host
 *  does and what "resume from the same place" needs */
export const coveredBefore = (active: number): number[] => Array.from({ length: Math.max(0, active) }, (_, i) => i)

/** "mm:ss" of a duration in seconds — the header's clock, the roll's per-stop timer,
 *  the ended chip's total. Floors, clamps at zero, pads both halves. */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r
}

/** the booked length of a lecture, in seconds — a fixed 50 minutes until a walk
 *  carries its own (the DS reference host's `BOOKED_S`; reported as a stand-in) */
export const BOOKED_SECONDS = 50 * 60

/** clamp a stop index into the walk */
export const clampStop = (i: number, count: number): number => Math.max(0, Math.min(Math.max(0, count - 1), i))
