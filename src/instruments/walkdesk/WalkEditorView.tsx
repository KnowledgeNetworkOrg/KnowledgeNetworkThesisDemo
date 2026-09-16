// The WALK EDITOR (#21) — the surface you WRITE the plan on, and, parallel to it,
// the flat route that plan projects to.
//
// WAS `RailroadView.tsx`, instrument id `railroad`, until 2026-08-20. The old
// name was the DRAWING — a railroad diagram — and not the job. What this is, is
// where a walk gets written. The line is kept because two dated notes in
// `src/ds/PROVENANCE.json` cite the old filename, and a dated record is not a
// thing to rewrite — it would then lie about its own moment. This is what makes
// them resolve. `tools/walk-tiers-spike/RESULTS.md` is left alone for the same
// reason: it records what was decided in July, under July's name.
// The ROAD keeps its name throughout (`AuthorRoad`, `layoutRoad`,
// `data-road-root`): the road is the drawing this editor hosts, which is a
// different noun doing a different job.
//
// One view, one lane that ever branches:
//
//   the ROAD is the only view in the Studio that ever sees a branch. Forks fan
//   out into labelled lanes that rejoin below, optionals wear a bypass rail, and
//   the choice of which lane is "the road" lives here too, because it is an
//   authoring decision until a presentation surface reads the result.
//
//   the road's RECEIPT — resolveRoad() with the branch picked and the skipped
//   optionals dropped — is not a permanent second lane. It is the WalkChapters
//   slide-in below (0005 D9): opened on demand, overlaying the road rather than
//   splitting the pane. An always-visible receipt beside the road was tried and
//   retired (`ce08f09`); whether one comes back, and in what shape, is #27.
//
// It shares ONE draft with the palette (its own instrument since #21) through
// the module-level stores in authordraft.ts — see the note there for why a
// singleton is the right shape. Everything downstream still receives
// resolveRoad()'s linear walk (now shared as presented.ts's usePresentedRoad,
// so Walk·Columns/Walk·Stack/Walk·Viewer resolve the same draft the same way),
// and it IS published on bus.route (#14, closed) via usePublishPresentedRoute.
// The Map draws it as a path across the territory and Connections highlights
// along it.

import { useEffect } from 'react'

import AuthorRoad from './AuthorRoad'
import { redoDraft, undoDraft, useAuthorDraft, usePreviewOpen, useRoad } from './authordraft'
import { usePresentedRoad, usePublishPresentedRoute } from './presented'
import WalkChapters from './WalkChapters'
import { useHover } from '../../studio/bus'
import type { Bus } from '../../studio/bus'
import { IconButton } from '@/ds'

/** the slide-in preview pane (0005 D9). It OVERLAYS the road rather than splitting
 *  the pane, so it takes no width from the layout and the road never reflows. */
const PREVIEW_W = 344

export default function WalkEditorView({ bus }: { bus: Bus }) {
  const sync = useHover(bus)
  const state = useAuthorDraft()
  const { choices, pickBranch, withOptionals } = useRoad()
  const [previewOpen, setPreviewOpen] = usePreviewOpen()

  // Undo / redo shortcuts (#34). Global so they work wherever focus sits ON the
  // road — but bail inside a text field so a rename keeps its own native undo,
  // and Cmd-Z there edits the word, not the whole tree. undo/redo are stable
  // module-level fns, so this binds once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select') || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoDraft()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        redoDraft()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resolved = usePresentedRoad()
  usePublishPresentedRoute(bus, resolved)

  return (
    // DS PaneHeader.d.ts rule 2: THE PANE BODY TAKES NO BACKGROUND OF ITS OWN — the
    // pane's --surface-paper shows through. Painting canopy here started the fill
    // INSIDE the pane's 20px corner arc with square corners, biting two square
    // notches of desk colour out of the rounded top where the content starts.
    <div data-walk-editor className="h-full flex flex-col">
      {/* The road, and the walk you slide in over it. The preview OVERLAYS rather
          than splits (D9): the road keeps its full width and never reflows, it only
          fades to 30% behind the pane. Dismiss and you are back on exactly the road
          you left. overflow-hidden clips the pane while it sits off to the right. */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          className="h-full flex flex-col transition-opacity ease-out"
          style={{ opacity: previewOpen ? 0.3 : 1, transitionDuration: previewOpen ? '280ms' : '200ms' }}
        >
          <AuthorRoad
            state={state}
            sync={sync}
            choices={choices}
            pickBranch={pickBranch}
            withOptionals={withOptionals}
            onLeafFocus={(id) => bus.setFocus(id, 'desk')}
            /* the pill's hover reaches the dock as a STOP index (DS OB-189): a halo there, never a
               selection — the click below still selects on the map only */
            stepHover={{ enter: bus.setHoverStep, leave: bus.endHoverStep }}
          />
        </div>

        {/* clicking the faded road dismisses the preview */}
        {previewOpen && <div className="absolute inset-0 z-10" onClick={() => setPreviewOpen(false)} />}

        <div
          data-walk-preview
          className="absolute inset-y-0 right-0 z-20 flex flex-col border-l transition-transform ease-out"
          style={{
            background: 'var(--surface-paper)',
            borderColor: 'var(--border-rule)',
            boxShadow: 'var(--lift-3)',
            width: PREVIEW_W,
            transform: previewOpen ? 'translateX(0)' : `translateX(${PREVIEW_W}px)`,
            transitionDuration: previewOpen ? '280ms' : '200ms',
          }}
        >
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--border-hair)]">
            <span className="text-[var(--fs-caption)] font-bold uppercase tracking-wide" style={{ color: 'var(--text-3)', letterSpacing: 'var(--ls-caps)' }}>the walk</span>
            <IconButton onClick={() => setPreviewOpen(false)} title="back to the road" />
          </div>
          <div className="flex-1 min-h-0">
            <WalkChapters walk={resolved} />
          </div>
        </div>
      </div>
    </div>
  )
}
