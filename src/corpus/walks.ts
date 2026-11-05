// THE AUTHORED WALKS, for whichever corpus this build carries. A walk is a
// route across the graph with a note at every stop — the narrative artifact the
// Walk Desk edits and Presentation Mode presents.
//
// Like `graph.ts` and `docs.ts`, this file is now only the choice between three
// sets: `teachingwalks.ts` (stories a CS teacher would tell), `coursewalks.ts`
// (generated — real routes through a degree, every step a published
// prerequisite) and `cs2023walks.ts` (generated, and empty until the TMU courses
// arrive as routes over the CS2023 map).

import { COURSE_WALKS } from './coursewalks'
import { CS2023_WALKS } from './cs2023walks'
import { byId, CORPUS_NAME } from './graph'
import { TEACHING_WALKS } from './teachingwalks'

export interface Walk {
  id: string
  title: string
  description: string
  stops: { id: string; note: string }[] // ids are leaf ids
}

export const WALKS: Walk[] =
  CORPUS_NAME === 'courses' ? COURSE_WALKS : CORPUS_NAME === 'cs2023' ? CS2023_WALKS : TEACHING_WALKS

// Module-load guard: every stop id must be a real topic in the chosen corpus.
for (const w of WALKS) {
  for (const s of w.stops) {
    const n = byId.get(s.id)
    if (!n) throw new Error(`walk "${w.id}" references unknown node id: ${s.id}`)
    if (!n.topic) throw new Error(`walk "${w.id}" stop ${s.id} is not a topic`)
  }
}
