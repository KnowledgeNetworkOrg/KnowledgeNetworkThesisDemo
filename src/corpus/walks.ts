// THE AUTHORED WALKS, for whichever corpus this build carries. A walk is a
// route across the graph with a note at every stop — the narrative artifact the
// Walk Desk edits and Presentation Mode presents.
//
// Like `graph.ts` and `docs.ts`, this file is now only the choice between two
// sets: `teachingwalks.ts` (stories a CS teacher would tell) and `cs2023walks.ts`
// (generated — the TMU courses as routes over the CS2023 map).

import { CS2023_WALKS } from './cs2023walks'
import { byId, CORPUS_NAME } from './graph'
import { TEACHING_WALKS } from './teachingwalks'

/** how a course outline item reached its place: the outline named it, the data
 *  split it across places, or the data filled a gap the outline left. */
export type StopSource = 'outline' | 'split' | 'filled'

/** how sure the placement is — `not matched` is the nearest area, `exception`
 *  the author's Science group rather than a CS2023 place. */
export type StopConfidence = 'clear' | 'judgment call' | 'not matched' | 'exception'

/** one stop. The note is what every view reads; the rest are the course route's
 *  marks, carried so a later view can say where the words came from. */
export interface WalkStop {
  id: string
  /** the course's words for this stop, verbatim */
  note: string
  /** the same words, named for what they are */
  label?: string
  source?: StopSource
  confidence?: StopConfidence
  /** places the same outline item also touches — data, not tree ids, so they are
   *  listed as text and never checked against the corpus */
  secondary?: { id: string; label: string; confidence: StopConfidence }[]
  /** the course outline's own item id */
  item?: string
}

/** one prerequisite row: the route this route builds on, or an outside course
 *  the calendar names. `group` is the row's alternative group — its `.B` suffix
 *  kept, because an "and" can sit inside one alternative — not the route's own
 *  `group`. */
export interface WalkBuildsOn {
  course: string
  /** set when `course` is one of the routes; absent for an outside course */
  walkId?: string
  /** the calendar's title for an outside course, when the data gives one */
  title?: string
  group?: string
  /** the calendar's prerequisite sentence, verbatim */
  wording: string
}

/** A route across the corpus. A course route's stops sit on the places its
 *  outline items were placed on, at any depth, and repeat visits are kept in
 *  order. A measure over walks skips the `split` and `filled` stops of a course
 *  route: they say where the data divided or filled an item, not what the
 *  outline named (see `tools/cs2023import/README.md`). */
export interface Walk {
  id: string
  title: string
  description: string
  category?: string
  group?: string
  buildsOn?: WalkBuildsOn[]
  stops: WalkStop[]
}

export const WALKS: Walk[] = CORPUS_NAME === 'cs2023' ? CS2023_WALKS : TEACHING_WALKS

// Module-load guard: every stop id must be a real node in the chosen corpus, and
// a topic — except on cs2023, whose course routes stop at whatever depth the
// placement chose, including an area.
const anyDepth = CORPUS_NAME === 'cs2023'
for (const w of WALKS) {
  for (const s of w.stops) {
    const n = byId.get(s.id)
    if (!n) throw new Error(`walk "${w.id}" references unknown node id: ${s.id}`)
    if (!anyDepth && !n.topic) throw new Error(`walk "${w.id}" stop ${s.id} is not a topic`)
  }
}
