// #340 / OB-234 — the two rail marks on one page, because the item ships them as a PAIR.
//
// The screenshot is the judgement: an indented outline (a parent rule with two children)
// beside a three-node cluster, both at the 12px the closed pill draws them at, in the pill
// itself. Alone, neither shape is self-evident; the contrast is what makes both legible.
//
// The driver (tools/studio-spike/shot-markspair.mjs) reads the geometry back: same 16
// viewBox, same 1.4 stroke, same 12x12 rendered box, both in `currentColor`, each with its
// word still beside it.
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import { OutlineMark, RelationsMark, RailOpenButton } from '../../../src/ds'

function MarkRow({ label, name, children }: { label: string; name: string; children: ReactNode }) {
  return (
    <div data-mark={name} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ width: 90, fontSize: 'var(--fs-micro)', color: 'var(--text-3)' }}>{label}</span>
      <span data-mark-box="1" style={{ color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center' }}>{children}</span>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div style={{
      padding: 28, background: 'var(--surface-paper)', minHeight: '100vh',
      fontFamily: 'var(--font-ui)', display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)' }}>
        the two rail marks, as a pair — 12px
      </div>
      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', maxWidth: 520 }}>
        OutlineMark names a hierarchy, RelationsMark names a network. Same viewBox, same
        stroke, same box — the difference is the only thing that has to survive at 12px.
      </div>

      <MarkRow label="outline · 12" name="outline"><OutlineMark size={12} /></MarkRow>
      <MarkRow label="relations · 12" name="relations"><RelationsMark size={12} /></MarkRow>

      <div style={{ height: 1, background: 'var(--border-hair)', margin: '6px 0' }} />

      <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>
        in the closed pill, where they ship — the word stays beside the mark:
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <span data-pill="explorer"><RailOpenButton label="Explorer" mark={<OutlineMark size={12} />} onOpen={() => {}} /></span>
        <span data-pill="relations"><RailOpenButton label="Relations" count={12} mark={<RelationsMark size={12} />} onOpen={() => {}} /></span>
      </div>
    </div>
  </StrictMode>,
)
