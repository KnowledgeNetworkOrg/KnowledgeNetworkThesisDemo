// WHAT A STOP'S MARKS SAY, as arithmetic. #503 carries `source` and
// `confidence` on a course route's stops; this file decides which of those
// values are worth drawing and gives each one a tone a surface can style.
//
// `outline`, `clear` and `judgment call` are the quiet values: a route whose
// words came straight from the outline, with no doubt about the place. They
// draw nothing, so the four notable marks stand out by not being the default.

import type { StopConfidence, StopSource } from '../corpus/walks'

/** how a mark is drawn — one tone per notable value, so `split` and `not
 *  matched` cannot be confused with `filled` or `exception` */
export type StopMarkTone = 'split' | 'filled' | 'unmatched' | 'exception'

export interface StopMark {
  kind: 'source' | 'confidence'
  /** the data's own value, verbatim — also the badge's test hook */
  value: string
  /** the word the badge prints, which is the value itself */
  label: string
  tone: StopMarkTone
}

const SOURCE_TONE: Partial<Record<StopSource, StopMarkTone>> = {
  split: 'split',
  filled: 'filled',
}

const CONFIDENCE_TONE: Partial<Record<StopConfidence, StopMarkTone>> = {
  'not matched': 'unmatched',
  exception: 'exception',
}

/** the marks a stop should show, source first. Empty for a plain stop. */
export function stopMarksOf(stop: { source?: StopSource; confidence?: StopConfidence }): StopMark[] {
  const marks: StopMark[] = []
  const source = stop.source && SOURCE_TONE[stop.source]
  if (source) marks.push({ kind: 'source', value: stop.source!, label: stop.source!, tone: source })
  const confidence = stop.confidence && CONFIDENCE_TONE[stop.confidence]
  if (confidence) marks.push({ kind: 'confidence', value: stop.confidence!, label: stop.confidence!, tone: confidence })
  return marks
}
