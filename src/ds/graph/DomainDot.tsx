// The DomainDot component and its props type. Everything else — the hue ring and
// the slot arithmetic — lives in ./hueslots and is re-exported below, so the
// barrel and every importer still see one home.

import { domainToken } from './hueslots'

export { HUE_RING, TOPIC_WALK, RELATION_WALK_REVERSED, hueToken, relationHue, topicHue, nextTopicSlot, domainToken, topicPaint, FAMILY_SLOTS, familySlots, TOPIC_SEPARATION_MIN, topicSlots, nestedFamilyPaint } from './hueslots'

/** A node's topic identity, rendered as a round dot — the smallest unit of
 *  identity in the whole system. Typed port of the DS DomainDot.jsx. */
export interface DomainDotProps {
  /** a RING hue name (`'teal'`, `'iris'`) — what the corpus stores on a topic
   *  (`topicHueOf`). Unknown or absent draws the anchor swatch — a dot, not a
   *  gap. Prefer this over `domain`. */
  topic?: string
  /** @deprecated the same prop under its old, narrower name — the palette is
   *  no longer a fixed set of six CS domains. Pass `topic`. Still honoured;
   *  `topic` takes precedence. */
  domain?: string
  /** px; 9 in rows and chips, 12+ in headers */
  size?: number
  /** paper halo, for dots sitting on a coloured or busy ground */
  ring?: boolean
  /** THE CORPUS ROOT: a hollow ring (hairline `--text-3`, no fill) instead of a filled dot.
   *  Wins over `topic`/`domain`.
   *  A corpus has one node above its top-level topics, and by the owner's ruling
   *  (2026-09-15) it is a node like any other: drawn in the tree, in an ancestry, as a map
   *  level. It simply has no topic, because it contains every topic.
   *  DO NOT REACH FOR THE UNKNOWN-TOPIC FALLBACK INSTEAD. Passing no topic at all also gives
   *  a neutral mark, and it is the wrong sentence: `domainToken()`'s grey anchor means "a
   *  topic nobody has a hue for", and a filled grey dot among filled hue dots reads as a
   *  territory whose colour failed to load. Hollow reads as "holds the others, has no topic
   *  of its own". */
  root?: boolean
}

export function DomainDot({ topic, domain, size = 9, ring, root }: DomainDotProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-pill)',
        flexShrink: 0,
        boxSizing: 'border-box',
        display: 'inline-block',
        background: root ? 'transparent' : domainToken(topic !== undefined ? topic : domain),
        borderStyle: root ? 'solid' : 'none',
        borderWidth: root ? 1.5 : 0,
        borderColor: root ? 'var(--text-3)' : 'transparent',
        boxShadow: ring ? '0 0 0 2px var(--surface-raised)' : 'none',
      }}
    />
  )
}

/* `topicPaintValues` — the JS-resolved twin of `topicPaint()` for SVG presentation attributes —
   lives in ./topicvalues with the degree table it reads; re-exported here so the barrel and every
   reader see one home */
export { topicPaintValues } from './topicvalues'
export type { OklchValue } from './topicvalues'
