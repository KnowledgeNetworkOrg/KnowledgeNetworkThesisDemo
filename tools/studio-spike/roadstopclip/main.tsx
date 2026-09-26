// DS OB-217's own probe (`guidelines/road-stop-clip-probe.html`), ported to OUR build.
//
// The design side's page draws the DESIGN SYSTEM's bundle, so running it tells you about their
// NodeChip, not ours. This page asks the identical question of `src/ds/graph/NodeChip.tsx`: two
// road stops with the SAME title at the road's own bounds (min 150, max 220, max height 66), one
// required and one optional, and for each the line count `chipSizeOf` PREDICTS against the line
// boxes the browser actually DRAWS — counted by a Range over the title's own text node, exactly as
// their page does it. In Firefox before OB-217 the owner read 1 predicted against 2 drawn; the fix
// is `WRAP_SAFETY_PX` narrowing the column inside `wrappedLines`.
//
// Readings land on `window.__roadStopRows` once fonts are ready plus two frames, for
// `probe-roadstopclip.mjs` to collect in each engine.
import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import * as Chip from '../../../src/ds/graph/NodeChip'
import type { NodeChipProps } from '../../../src/ds/graph/NodeChip'

/* read through the namespace, so the page still loads on a build that predates the constant
   and reports it ABSENT — the before half of the pair (measured 2026-09-26 on main at 9d85c83:
   predicted 1 line, drew 2, in Firefox 151 AND Chromium 153) */
const { NodeChip, chipSizeOf } = Chip
const WRAP_SAFETY_PX = (Chip as Record<string, unknown>).WRAP_SAFETY_PX ?? 'absent'

/* the road's own policy numbers, from src/instruments/walkdesk/AuthorRoad.tsx */
const NODEW = 150, NODE_MAXW = 220, NODE_MAXH = 66
const TITLE = 'Transistors & Logic Gates'
const CASES = [
  { id: 'req', label: 'required (stop 2)', optional: false },
  { id: 'opt', label: 'optional (stop 3)', optional: true },
]

const stopProps = (optional: boolean): NodeChipProps => ({
  title: TITLE, index: optional ? '3.' : '2.', domain: 'hw', mark: 'border', wrap: true, optional,
  onDelete: () => {}, minWidth: NODEW, maxWidth: NODE_MAXW, maxHeight: NODE_MAXH,
} as NodeChipProps)

function read() {
  return CASES.map((c) => {
    const host = document.querySelector(`[data-stop="${c.id}"]`) as HTMLElement
    const pred = chipSizeOf(stopProps(c.optional))
    const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    let tn: Text | null = null
    while (walk.nextNode()) if ((walk.currentNode as Text).data.trim() === TITLE) { tn = walk.currentNode as Text; break }
    const span = tn ? tn.parentElement : null
    const lineH = span ? parseFloat(getComputedStyle(span).lineHeight) : 0
    let drawn = 0
    if (tn) { const r = document.createRange(); r.selectNodeContents(tn); drawn = r.getClientRects().length }
    const shell = host.firstElementChild as HTMLElement | null
    const s = shell ? getComputedStyle(shell) : null
    const padY = s ? parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) : 0
    const edge = s ? parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth) : 0
    const needed = Math.round((drawn * lineH + padY + edge) * 100) / 100
    return {
      id: c.id, label: c.label, width: pred.width, predH: pred.height, column: pred.titleColumn,
      predLines: pred.titleLines, drawnLines: drawn, lineH: Math.round(lineH * 100) / 100, needed,
      short: Math.round((needed - pred.height) * 100) / 100,
    }
  })
}

function Probe() {
  useEffect(() => {
    let on = true
    ;(async () => {
      await document.fonts.ready
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (on) (window as unknown as { __roadStopRows: unknown }).__roadStopRows = { safety: WRAP_SAFETY_PX, rows: read() }
    })()
    return () => { on = false }
  }, [])
  return (
    <div style={{ padding: 22, background: 'var(--surface-paper)', display: 'inline-block' }}>
      {CASES.map((c) => {
        const p = stopProps(c.optional)
        const size = chipSizeOf(p)
        return (
          <div key={c.id} style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>{c.label}</div>
            <div data-stop={c.id} style={{ position: 'relative', width: size.width, height: size.height }}>
              <NodeChip {...p} width={size.width} height={size.height} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Probe /></StrictMode>)
