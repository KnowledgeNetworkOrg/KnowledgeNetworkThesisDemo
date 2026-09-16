// THE ROOM'S WINDOW — what a lecture projects (#267 OB-135 clause 2/3).
//
// A second window of this app, opened by the toolbar ▶ at `?projector`, showing
// the live slide full-bleed and nothing else: no header, no toolbar, no panes,
// no controls. It never drives the lecture; it draws what the presenter's window
// says (`projector.ts`) and shuts itself when the presenter leaves.
//
// The slide keeps its 1120:630 shape inside whatever the window is: letterboxed
// on a dark ground, the way every projector app does it, so a 16:10 laptop or a
// 4:3 projector shows the whole slide rather than a cropped one.

import { useCallback, useEffect, useState } from 'react'

import { ProjectedMap } from '@/ds'

import MapView from '../instruments/MapView'
import type { WallFrame } from '../model/walkwall'
import { useStudioBus } from '../studio/bus'
import { LectureSlide } from './LectureSlide'
import { useProjectedState } from './projector'
import { WallTransition } from './WallTransition'

export default function ProjectorScreen() {
  const { state, closed } = useProjectedState()
  /* THE ROOM'S OWN MAP (OB-139 rule 4) — the app's map pane, drawn here from a bus of this
     window's own, whose route is the lecture the presenter published. Nothing else on this bus
     is ever written. */
  const bus = useStudioBus(() => {})
  const idsKey = state.ids.join('\n')
  useEffect(() => {
    bus.setRoute(idsKey ? idsKey.split('\n') : [])
    // the bus object is rebuilt every render; only the published stops should republish
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])
  useEffect(() => { document.title = state.live && state.slide ? state.slide.title : 'projector' }, [state])
  /* the wall's frame, held for the lecture and keyed to the walk (DS OB-163) — the presenter's
     rule, read a second time on this screen so the projector's own M down / M up is one picture */
  const [wallFit, setWallFit] = useState<{ ids: string; frame: WallFrame } | null>(null)
  const wallFrame = wallFit && wallFit.ids === idsKey ? wallFit.frame : null
  const keepWallFrame = useCallback((frame: WallFrame) => setWallFit({ ids: idsKey, frame }), [idsKey])
  // the presenter left: a screen nobody is watching must not keep showing a slide.
  // A script-opened window may close itself; one the user opened by hand ignores
  // this and goes dark instead, which is the honest floor.
  useEffect(() => { if (closed) window.close() }, [closed])
  return (
    <div data-projector={state.live ? 'live' : 'dark'} style={{ position: 'fixed', inset: 0, background: 'var(--bark-900)', display: 'grid', placeItems: 'center' }}>
      {state.live && state.slide ? (
        <div style={{ position: 'relative', width: 'min(100vw, 177.78vh)', aspectRatio: '1120 / 630' }}>
          <WallTransition up={state.mapUp} slide={<LectureSlide step={state.slide} index={state.stop - 1} count={state.count} />}
            map={<ProjectedMap stop={state.stop} count={state.count} territory={state.slide.territory} title={state.slide.title}
              map={<MapView bus={bus} wall={{ lit: state.stop - 1, covered: state.covered, frame: wallFrame, onFrame: keepWallFrame }} />}
              footer={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{state.slide.walk} · the whole walk</span>} />} />
        </div>
      ) : (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--bark-500)' }}>{closed ? 'the lecture has closed' : 'nothing is projected'}</div>
      )}
    </div>
  )
}
