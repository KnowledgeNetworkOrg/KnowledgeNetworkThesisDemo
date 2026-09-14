import { useState } from 'react'

import { DomainDot } from '../graph/DomainDot'
import { wrapTip } from '../chrome/IconButton'

/** One entry of the append-only trail: where a focus landed, and how it got
 *  there. A jump is accented so the divergence from the breadcrumb is visible.
 *  Typed port of the DS TrailChip.jsx. */
export interface TrailChipProps {
  title: string
  /** a ring hue name (`'teal'`) — what the corpus stores on a topic (`topicHueOf`); resolved by
   *  `domainToken()`. **Typed `string`**, as the DS's own contract has been since 2026-08-21j: a
   *  closed six-code union was compiled into the adherence lint, and a general corpus passing a
   *  ring hue was reported as an invalid prop (OB-153 retired the union here). The NAME is still
   *  wrong — this is a topic, not a domain — and OB-061 decides the rename on both sides at once. */
  domain: string
  /** the three-letter writer tag: MAP TREE LNK TRL WLK GPH NAV */
  via?: string
  /** the focus crossed a typed link rather than stepping through containment */
  jump?: boolean
  onClick?: () => void
}

export function TrailChip({ title, domain, via, jump, onClick }: TrailChipProps) {
  const [hot, setHot] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      title={wrapTip(via ? via + ' · ' + title : title)}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid ' + (jump ? 'var(--acorn-300)' : 'var(--border-hair)'),
        background: jump ? 'var(--accent-walk-wash)' : hot ? 'var(--surface-hover)' : 'var(--surface-raised)',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--fs-body)',
        fontWeight: 'var(--fw-semibold)',
        color: 'var(--text-1)',
        cursor: 'pointer',
        transition: 'var(--transition-wash)',
        whiteSpace: 'nowrap',
      }}
    >
      {jump ? <span style={{ color: 'var(--accent-walk)', flexShrink: 0 }}>{'⤳'}</span> : null}
      <DomainDot domain={domain} size={7} />
      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
      {via ? (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-micro)',
            color: 'var(--text-3)',
            flexShrink: 0,
          }}
        >
          {via}
        </span>
      ) : null}
    </button>
  )
}
