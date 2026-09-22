// THE DOCUMENT BODY FOR EVERY NODE, for whichever corpus this build carries.
// One body per node, no exceptions — the guard at the bottom is what makes that
// true rather than hoped for.
//
// Like `graph.ts`, this file used to BE the teaching corpus's prose and is now
// only the choice between two sets of it: `teachingdocs.ts` (hand-authored) and
// `coursedocs.ts` (generated from the university outlines by
// `tools/courseimport/`). Importers say `from '../corpus/docs'` exactly as they
// always have.

import { COURSE_DOC } from './coursedocs'
import { CORPUS_NAME, DEEP_DOC, nodes } from './graph'
import { TEACHING_DOC } from './teachingdocs'

export const DOC_BODY: Record<string, string> = {
  ...(CORPUS_NAME === 'courses' ? COURSE_DOC : TEACHING_DOC),
  // the deep layers' one-line blurbs, authored alongside their structure
  ...DEEP_DOC,
}

// Module-load guard: every graph node must have a body, and every body key
// must be a real graph node — the two lists must match exactly.
{
  const graphIds = new Set(nodes.map((n) => n.id))
  const bodyIds = new Set(Object.keys(DOC_BODY))
  const missing = [...graphIds].filter((id) => !bodyIds.has(id))
  const extra = [...bodyIds].filter((id) => !graphIds.has(id))
  if (missing.length) throw new Error(`DOC_BODY missing bodies for: ${missing.join(', ')}`)
  if (extra.length) throw new Error(`DOC_BODY has bodies for unknown ids: ${extra.join(', ')}`)
}
