import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'

import { MapFloatingButton } from './MapFloatingButton'

const GLYPH = (
  <svg aria-hidden="true" viewBox="0 0 20 20" width={20} height={20} fill="none">
    <path d="M10 2l8 4.5-8 4.5-8-4.5z" stroke="var(--text-1)" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M2 10.5l8 4.5 8-4.5" stroke="var(--text-2)" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M2 14.5l8 4.5 8-4.5" stroke="var(--bark-400)" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)

/**
 * The map's depth control. A stacked-squares icon (`MapFloatingButton` underneath) that
 * opens, on CLICK, a vertical list of every level — never on hover, which would fire while
 * the pointer merely crosses this corner. Placed away from `ZoomControl` and the visibility
 * toggle on purpose: this changes what you're looking AT (depth into the corpus); those
 * change how you're looking (the viewport). Grouping it with them would read as one more
 * zoom-family button and bury the distinction.
 */
export interface LevelPickerProps {
  /** the level labels in order, e.g. ["L0","L1","L2","L3","L4","L5","L6"].
   *
   *  WHAT A LEVEL NUMBER MEANS: a level is a DEPTH INTO THE CORPUS measured from the root, so
   *  level 0 is the corpus root drawn as ONE region — the whole corpus as a single shape —
   *  and level 1 is the top-level topics (the six territories in this app's corpus). A host
   *  must not renumber to suit what it can draw: if the map has no level-0 rendering yet, the
   *  honest list starts at "L1" rather than relabelling the territories as L0, which would
   *  silently redefine the vocabulary the tree, the ancestry and the counts all share
   *  (owner, 2026-09-15). */
  levels: string[]
  /** the current level — must be one of `levels`, drawn with the moss wash in the list */
  level?: string
  onSelect?: (level: string) => void
  /** px, the icon button's own size. 38 is the standard. */
  size?: number
  /** true (default): the popover opens UPWARD from the button — for a button docked at the
   *  bottom edge of the map, which is where this control lives by convention. Set false only
   *  if the button itself is ever moved to a top edge. */
  openUp?: boolean
  /** POSITION ONLY, on the surrounding pane */
  style?: CSSProperties
}

export function LevelPicker({ levels, level, onSelect, size = 38, openUp = true, style }: LevelPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div ref={rootRef} style={{ position: 'relative', ...style }}>
      <MapFloatingButton size={size} title="levels" label="levels" selected={open} onClick={() => setOpen((o) => !o)}>
        {GLYPH}
      </MapFloatingButton>
      {open ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            [openUp ? 'bottom' : 'top']: size + 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: 4,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border-rule)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--lift-2)',
            zIndex: 1,
          }}
        >
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                onSelect?.(l)
                setOpen(false)
              }}
              style={{
                border: 'none',
                background: l === level ? 'var(--moss-100)' : 'transparent',
                color: l === level ? 'var(--moss-700)' : 'var(--text-2)',
                borderRadius: 6,
                padding: '5px 10px',
                font: 'inherit',
                fontSize: 'var(--fs-caption)',
                fontWeight: 'var(--fw-semibold)',
                textAlign: 'left',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
