import type { ReactNode } from 'react'

import { useClipped } from './IconButton'

import { DomainDot } from '../graph/DomainDot'

/** The product bar. Brand in plain type (P.Kt has no mark), the corpus line, the
 *  live focus, counts, session actions. Typed port of the DS AppHeader.jsx
 *  (contract: AppHeader.d.ts). The focus dot is a DomainDot. */
export interface AppHeaderProps {
  /** the wordmark, set in plain type — P.Kt has no logo file */
  brand?: string
  /** the product name, e.g. "Studio" */
  product: string
  /** one lower-case line describing the loaded corpus */
  corpusLine?: string
  /** the bus's current focus */
  focus?: { title: string; domain: string } | null
  /** counts and session buttons, right-aligned */
  children?: ReactNode
}

export function AppHeader({ brand = 'P.Kt', product, corpusLine, focus, children }: AppHeaderProps) {
  /* the corpus line is the header's one clipping string — it sits between a fixed
     wordmark and a flexible spacer, so it is the piece that gives way first */
  const corpusClip = useClipped<HTMLSpanElement>(corpusLine)
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '10px var(--space-5)',
        background: 'var(--surface-paper)',
        borderBottom: '1px solid var(--border-hair)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-title)', color: 'var(--moss-600)', letterSpacing: 'var(--ls-display)' }}>{brand}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-title)', color: 'var(--text-1)' }}>{product}</span>
      </span>
      {corpusLine ? (
        <span {...corpusClip} style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{corpusLine}</span>
      ) : null}
      <span style={{ flex: 1 }} />
      {focus ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <DomainDot domain={focus.domain} />
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{focus.title}</span>
        </span>
      ) : (
        <span style={{ fontSize: 'var(--fs-body)', color: 'var(--text-3)', flexShrink: 0 }}>no focus</span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>{children}</span>
    </div>
  )
}
