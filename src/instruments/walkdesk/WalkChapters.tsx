// RENAMED from WalkPreview.tsx (#246, 2026-09-05): the design system published its own
// `WalkPreview` — the hover card every walk surface hangs above a stop (src/ds/nav/
// WalkPreview.tsx, OB-131) — and two files of one name for two different things is how a
// reader opens the wrong one. This is the walk read as CHAPTERS; the file now says so.
// The walk as chapters (0005 D9, panel 06). A walk *is* a table of contents, so
// the resolved road reads as a book — the ONE surface in the instrument that is
// *read* rather than operated. None of the editing vocabulary crosses over: no
// ⊞ marks, no gutter ranges, no ↺ revisits, and (deliberately) no hover
// correspondence — so this takes no bus, unlike every other surface.
//
//   every top-level group breaks off as a CHAPTER — a hairline, 26px of air,
//     then `chapter n · stops a–b` and the group's title at 17px.
//   a group INSIDE a chapter breaks softer — a dashed hairline and a 20px indent,
//     no 17px title, so nesting is one step quieter rather than one chapter deeper.
//   a fork names its chosen version once, in the section line (the `· label`);
//     alternatives never appear — a preview shows the walk you would take.
//   a stop is number · domain dot · title, no chip, no border, no rail.
//   the closing top-level leaf has no group, so it is a CODA: it runs on after the
//     last chapter with no break and no heading.

import { PaneScroller } from '@/ds'
import { byId, domainOf } from '../../corpus/graph'
import { colorOf } from '../../model/color'
import { isLeaf, type Stop } from './mockwalk'

/** leaves in a resolved subtree. `resolveRoad` has already picked one variant per
 *  container and dropped skipped optionals, so this is a plain sum — no branching. */
function leafCount(s: Stop): number {
  if (isLeaf(s)) return 1
  return s.variants[0]?.steps.reduce((a, c) => a + leafCount(c), 0) ?? 0
}

export default function WalkChapters({ walk }: { walk: Stop[] }) {
  // one render pass, imperative — a running stop number (n), a chapter number, and
  // a key counter that makes a revisited node (stk-tcp-udp appears twice) unique.
  let n = 0
  let chapter = 0
  let key = 0
  const rows: React.ReactNode[] = []

  const render = (stops: Stop[], depth: number) => {
    for (const s of stops) {
      if (isLeaf(s)) {
        n += 1
        const color = colorOf(domainOf(s.node))
        rows.push(
          <div key={key++} className="flex items-center gap-2 py-[3px]" style={{ paddingLeft: depth * 20 }}>
            <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{n}</span>
            <span className="w-[5px] h-[5px] shrink-0 rounded-full" style={{ background: color }} />
            <span className="text-[12px] text-slate-700 truncate">{byId.get(s.node)!.title}</span>
          </div>,
        )
        continue
      }
      // a container — a chapter at the top level, a softer break when nested.
      const label = s.variants[0]?.label ?? '' // non-empty only if it was a fork
      const a = n + 1
      const b = n + leafCount(s)
      if (depth === 0) {
        chapter += 1
        rows.push(
          <div key={key++} className="mt-4 border-t border-slate-200 pt-[26px] first:mt-0 first:border-t-0 first:pt-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              chapter {chapter} · {b > a ? `stops ${a}–${b}` : `stop ${a}`}
            </div>
            <div className="mt-0.5 text-[17px] font-semibold leading-tight text-slate-800">
              {s.title}
              {label && <span className="text-[13px] font-normal text-slate-500"> · {label}</span>}
            </div>
          </div>,
        )
      } else {
        rows.push(
          <div key={key++} className="mt-2 border-t border-dashed border-slate-200 pt-2" style={{ paddingLeft: depth * 20 }}>
            <div className="text-[13px] font-medium text-slate-500">
              {s.title}
              {label && <span className="font-normal text-slate-400"> · {label}</span>}
            </div>
          </div>,
        )
      }
      render(s.variants[0]?.steps ?? [], depth + 1)
    }
  }
  render(walk, 0)

  return (
    <PaneScroller style={{ padding: '12px 16px' }}>
      {rows.length ? rows : <div className="text-[11px] text-slate-400">the road is empty — nothing to read yet.</div>}
    </PaneScroller>
  )
}
