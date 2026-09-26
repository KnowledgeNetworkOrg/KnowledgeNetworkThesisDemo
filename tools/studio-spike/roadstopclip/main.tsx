// DS OB-217, made measurable against THIS app's build.
//
// The owner saw a road stop crop its own title in Firefox: two consecutive stops titled
// "Transistors & Logic Gates", the REQUIRED one cutting "Gates" through the middle, the OPTIONAL
// one drawing both lines. The design system reproduced it with `guidelines/road-stop-clip-probe
// .html` — Firefox predicted 1 line in a 150.18px title column and DREW 2 — but that page runs the
// design project's own bundle. This is the same probe against the app's `NodeChip`, so the
// receipt can report the line columns this build produces in the engine that showed the fault.
//
// It asks exactly the road's question: `chipSizeOf` with the props `AuthorRoad`'s `leafSize`
// passes (its bounds transcribed below, not imported — the road is not a module a page can load
// without the whole desk), the chip TOLD that box, then the title's own text node counted as line
// boxes by a Range. Read after `document.fonts.ready` and two frames: a measurement taken before
// that is a measurement of the fallback face. The result is written to `[data-probe-result]` as
// JSON for probe-roadstopclip.mjs to read, and drawn as a table for a person.
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import { NodeChip, chipSizeOf, WRAP_SAFETY_PX } from '../../../src/ds/graph/NodeChip'
import type { NodeChipProps } from '../../../src/ds/graph/NodeChip'

// AuthorRoad.tsx: NODEW, NODE_MAXW, NODE_MAXH — the road's own bounds
const NODEW = 150
const NODE_MAXW = 220
const NODE_MAXH = 66
const TITLE = 'Transistors & Logic Gates'

const stopProps = (index: string, optional: boolean): NodeChipProps => ({
  title: TITLE, domain: 'leaf', index, mark: 'border', wrap: true, optional,
  onDelete: () => {}, minWidth: NODEW, maxWidth: NODE_MAXW, maxHeight: NODE_MAXH,
})

const CASES = [
  { id: 'req', label: 'required — the owner’s stop 2', index: '2.', optional: false },
  { id: 'opt', label: 'optional — the owner’s stop 3', index: '3.', optional: true },
]

interface Row {
  id: string; label: string; width: number; predH: number; column: number; predLines: number
  drawnLines: number; lineH: number; needed: number; short: number; verdict: 'fits' | 'SHORT'
}

function read(): Row[] {
  return CASES.map((c) => {
    const host = document.querySelector(`[data-stop="${c.id}"]`) as HTMLElement
    const pred = chipSizeOf(stopProps(c.index, c.optional))
    /* THE TITLE'S OWN TEXT NODE, counted as line boxes by a Range — not the span's height over its
       line-height, which on the optional chip also contains the "(optional)" row */
    const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    let tn: Text | null = null
    while (walk.nextNode()) if ((walk.currentNode as Text).data.trim() === TITLE) { tn = walk.currentNode as Text; break }
    const span = tn ? tn.parentElement : null
    const lineH = span ? parseFloat(getComputedStyle(span).lineHeight) : 0
    let drawn = 0
    if (tn) { const r = document.createRange(); r.selectNodeContents(tn); drawn = r.getClientRects().length }
    const shell = host.firstElementChild as HTMLElement | null
    const scs = shell ? getComputedStyle(shell) : null
    const padY = scs ? parseFloat(scs.paddingTop) + parseFloat(scs.paddingBottom) : 0
    const edge = scs ? parseFloat(scs.borderTopWidth) + parseFloat(scs.borderBottomWidth) : 0
    const needed = Math.round((drawn * lineH + padY + edge) * 100) / 100
    const short = Math.round((needed - pred.height) * 100) / 100
    return {
      id: c.id, label: c.label, width: pred.width, predH: pred.height, column: pred.titleColumn, predLines: pred.titleLines,
      drawnLines: drawn, lineH: Math.round(lineH * 100) / 100, needed, short, verdict: short > 0.5 ? 'SHORT' : 'fits',
    }
  })
}

function Probe() {
  const [rows, setRows] = useState<Row[] | null>(null)
  useEffect(() => {
    let on = true
    const go = async () => {
      if (document.fonts) await document.fonts.ready
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (on) setRows(read())
    }
    go()
    return () => { on = false }
  }, [])
  return (
    <div style={{ padding: '18px 20px', fontFamily: 'var(--font-ui)', color: 'var(--text-1)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, margin: '0 0 6px' }}>Road stop clip probe — this app’s build</h1>
      <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 12px' }}>
        Wrap safety in this build: <code data-wrap-safety>{String(WRAP_SAFETY_PX)}</code>px. Both stops carry the same title at the
        road’s own bounds (minWidth 150, maxWidth 220, maxHeight 66); only <code>optional</code> differs.
      </p>
      <div style={{ display: 'inline-block', padding: '18px 22px', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)' }}>
        {CASES.map((c) => {
          const p = stopProps(c.index, c.optional)
          const box = chipSizeOf(p)
          return (
            <div key={c.id} style={{ marginBottom: 26 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 5 }}>{c.label}</div>
              <div data-stop={c.id} style={{ position: 'relative', width: box.width, height: box.height }}>
                <NodeChip {...p} width={box.width} height={box.height} />
              </div>
            </div>
          )
        })}
      </div>
      {rows ? (
        <>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 14 }}>
            <tbody>
              <tr>{['stop', 'predicted box', 'title column', 'titleLines', 'lines DRAWN', 'line-height', 'height needed', 'verdict'].map((h) => <th key={h} style={{ border: '1px solid var(--border-hair)', padding: '3px 8px', textAlign: 'left' }}>{h}</th>)}</tr>
              {rows.map((r) => (
                <tr key={r.id}>
                  {[r.label, `${r.width} x ${r.predH}`, r.column, r.predLines, r.drawnLines, r.lineH, r.needed, r.verdict === 'SHORT' ? `+${r.short} SHORT` : 'fits'].map((v, i) => (
                    <td key={i} style={{ border: '1px solid var(--border-hair)', padding: '3px 8px', fontFamily: i ? 'var(--font-mono)' : undefined }}>{String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <pre data-probe-result style={{ display: 'none' }}>{JSON.stringify({ wrapSafetyPx: WRAP_SAFETY_PX, rows })}</pre>
        </>
      ) : null}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Probe /></StrictMode>)
