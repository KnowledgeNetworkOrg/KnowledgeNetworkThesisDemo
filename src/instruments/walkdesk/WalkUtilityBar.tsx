// The Walk Editor's WALK-LEVEL controls: view the resolved walk, save it out,
// load one in (#16's bridge, #154's move onto the DS Toolbar). Docked in the
// actionBar slot ABOVE WalkActionBar (instruments.tsx stacks this first) — the
// two bars are two separate categories, not one merged row: this one treats the
// walk as a whole, portable thing (a name, a save, a load); WalkActionBar edits
// the draft tree under construction. Previously rendered inline inside
// WalkEditorView's own body; moved into the actionBar slot WalkActionBar already
// used, so both now get the same DS-clipped corners (Pane's actionBar slot is
// the only place that clips a docked bar's top corners to the frame's own arc —
// a plain child sitting in the scroller cannot get that).
//
// naming/walkName/picking/receipt are local: their drawers (the name-this-walk
// input, the save receipt, the load picker) moved here along with the buttons
// that open them, so nothing outside this component needs them any more.
// previewOpen is the one exception — the slide-in it opens is drawn by
// WalkEditorView, a sibling this component cannot reach directly — so that one
// flag stays a shared store in authordraft.ts (usePreviewOpen).

import { useState, useSyncExternalStore } from 'react'

import { saveDraftAsWalk, useAuthorDraft, usePreviewOpen, useRoad } from '../../state/walk/authordraft'
import { listWalks, subscribeWalks } from '../../state/walkstore'
import { IconButton, Toolbar, wrapTip } from '@/ds'
import type { ToolbarItemSpec } from '@/ds'

export default function WalkUtilityBar() {
  const state = useAuthorDraft()
  const { withOptionals, setWithOptionals } = useRoad()
  const [, setPreviewOpen] = usePreviewOpen()
  const walks = useSyncExternalStore(subscribeWalks, listWalks)

  const [naming, setNaming] = useState(false)
  const [walkName, setWalkName] = useState('')
  const [picking, setPicking] = useState(false)
  /** what the last save did, shown until the next one is started. No timer:
   *  a receipt that erases itself is a receipt you can miss. */
  const [receipt, setReceipt] = useState<string | null>(null)

  const openNaming = () => {
    setReceipt(null)
    setWalkName('')
    setPicking(false)
    setNaming(true)
  }

  const commitWalk = () => {
    const w = saveDraftAsWalk(walkName)
    setNaming(false)
    setWalkName('')
    setReceipt(
      w
        ? `saved "${w.title}" — ${w.stops.length} stops. The Trail can play it now.`
        : 'nothing on the road to save — the plan is empty, or every stop is still an unbound slot.',
    )
  }

  const roadItems: ToolbarItemSpec[] = [
    {
      label: withOptionals ? 'optionals: on the road' : 'optionals: bypassed',
      on: !withOptionals,
      tone: 'walk',
      onClick: () => setWithOptionals(!withOptionals),
    },
    {
      glyph: '▶',
      label: 'read the walk',
      title: 'read the resolved walk as chapters',
      onClick: () => setPreviewOpen(true),
    },
    {
      glyph: '⤓',
      label: 'save as walk',
      title: 'save the resolved road as a walk the rest of the app can play',
      onClick: openNaming,
    },
    {
      glyph: '⤒',
      label: 'add a walk',
      title: 'drop an existing walk into the plan as one stage',
      on: picking,
      tone: 'walk',
      onClick: () => {
        setNaming(false)
        setPicking(!picking)
      },
    },
  ]

  return (
    <>
      {/* `seam`: this bar sits ABOVE WalkActionBar in one actionBar slot, so the bar below owns the
          rule and the first items of both rows share one left edge (DS OB-205) */}
      <Toolbar seam groups={[{ items: roadItems }]} />

      {naming && (
        <div data-name-walk className="px-2 py-1 flex items-center gap-1">
          <input
            autoFocus
            value={walkName}
            placeholder="name this walk"
            onChange={(e) => setWalkName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitWalk()
              if (e.key === 'Escape') setNaming(false)
            }}
            className="flex-1 min-w-0 text-[var(--fs-caption)] px-1.5 py-0.5 rounded border border-[var(--border-rule)]"
            style={{ color: 'var(--text-1)', background: 'var(--surface-paper)' }}
          />
          <button
            data-name-walk-save
            onClick={commitWalk}
            className="text-[var(--fs-caption)] px-1.5 py-0.5 rounded border border-[var(--border-rule)]"
            style={{ color: 'var(--text-2)', background: 'var(--surface-raised)' }}
          >
            save
          </button>
          <IconButton onClick={() => setNaming(false)} title="back to the road" />
        </div>
      )}

      {receipt && (
        <div data-walk-receipt className="px-2 py-1 text-[var(--fs-caption)]" style={{ color: 'var(--text-3)' }}>
          {receipt}
        </div>
      )}

      {picking && (
        <div data-walk-picker className="px-2 py-1 flex flex-wrap gap-1">
          {walks.map((w) => (
            <button
              key={w.id}
              onClick={() => {
                state.insertWalkAsStage(w.id)
                setPicking(false)
              }}
              title={wrapTip(w.description || `${w.stops.length} stops`)}
              className="text-[var(--fs-caption)] px-1.5 py-0.5 rounded border border-[var(--border-rule)] max-w-full truncate"
              style={{ color: 'var(--text-2)', background: 'var(--surface-raised)' }}
            >
              {w.title}
              <span className="ml-1" style={{ color: 'var(--text-3)' }}>{w.stops.length}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
