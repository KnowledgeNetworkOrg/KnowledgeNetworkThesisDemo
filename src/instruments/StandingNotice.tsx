// THE STANDING NOTICE a cs2023 route shows wherever it is listed. One element so
// the strip and the document panel cannot word it differently, and the model
// helper is what decides whether this corpus and this route carry one at all.

import type { CSSProperties } from 'react'

import { CORPUS_NAME } from '../corpus/graph'
import type { Walk } from '../corpus/walks'
import { standingNotice } from '../model/standingnotice'

export default function StandingNotice({ walk, className, style }: {
  walk: Pick<Walk, 'description'> | null | undefined
  className?: string
  style?: CSSProperties
}) {
  const notice = standingNotice(walk, CORPUS_NAME)
  if (!notice) return null
  return <p data-standing-notice="" className={className} style={style}>{notice}</p>
}
