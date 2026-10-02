import { useState } from 'react'

import { BinMark } from './BinMark'
import { wrapTip } from '../chrome/IconButton'

/** One row of the preset list: a named instrument composition plus its one-line
 *  hint. Active is a moss (primary) wash, never a colour swap. A user-saved preset
 *  also carries a bin mark in its top-right corner, which fades in on hover and
 *  turns danger on its own hover. Typed port of the DS PresetButton.jsx. */
export interface PresetButtonProps {
  /** Title-cased — preset names are proper nouns: "Present", "Explore", "Plan" */
  label: string
  /** the composition read left to right, lower case */
  hint?: string
  active?: boolean
  onClick?: () => void
  /** user-saved presets only — renders the bin mark; omit for built-in presets */
  onDelete?: () => void
}

export function PresetButton({ label, hint, active, onClick, onDelete }: PresetButtonProps) {
  const [hot, setHot] = useState(false)
  const [binHot, setBinHot] = useState(false)
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}>
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: onDelete ? '8px 34px 8px 12px' : '8px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid ' + (active ? 'var(--moss-300)' : 'var(--border-rule)'),
          background: active ? 'var(--accent-primary-wash)' : hot ? 'var(--surface-hover)' : 'transparent',
          cursor: 'pointer',
          transition: 'var(--transition-wash)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--fs-body)',
            fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
            color: active ? 'var(--accent-primary-ink)' : 'var(--text-1)',
          }}
        >
          {label}
        </div>
        {hint ? <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-3)', marginTop: 2, lineHeight: 'var(--lh-snug)' }}>{hint}</div> : null}
      </button>
      {onDelete ? (
        <button
          type="button"
          title={wrapTip('delete “' + label + '”')}
          aria-label={'delete “' + label + '”'}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          onMouseEnter={() => setBinHot(true)}
          onMouseLeave={() => setBinHot(false)}
          /* KEYBOARD FOCUS REVEALS IT (DS OB-251). The corner is `opacity: 0` until the row or the
             button is hot, so a Tab onto it landed on an invisible control. A focus that came from
             the keyboard (`:focus-visible`) sets the same state the pointer does; a mouse press
             focuses it too and must not leave it lit once the pointer has gone. */
          onFocus={(e) => {
            if (e.target.matches(':focus-visible')) setBinHot(true)
          }}
          onBlur={() => setBinHot(false)}
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 20,
            height: 20,
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            boxSizing: 'border-box',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid ' + (binHot ? 'var(--berry-100)' : 'transparent'),
            background: binHot ? 'var(--state-danger-wash)' : 'transparent',
            color: binHot ? 'var(--state-danger)' : 'var(--text-3)',
            opacity: hot || binHot ? 1 : 0,
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            transition: 'var(--transition-wash), opacity var(--dur-hover) var(--ease-soft)',
          }}
        >
          <BinMark />
        </button>
      ) : null}
    </div>
  )
}
