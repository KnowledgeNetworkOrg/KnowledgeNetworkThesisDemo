// OB-097 — the Map pane's title-bar readout, docked via `Pane.actions`. Plain
// text, no pill/background (tried and rejected as too loud next to the pane
// title): `--text-2` for the labels and the middot, `--text-1` + `--fw-semibold`
// for the numbers, numbers in `--font-mono` with tabular figures.
//
// THE NODE COUNT IS THE CORPUS'S, NOT THE DRAWING'S (DS OB-183, owner-ruled
// 2026-09-14). Until then this printed `territories.length`, and the comment
// beside it claimed that was one-to-one with the corpus's nodes. It is not:
// `territories` (model/nested.ts) is every node the map draws a CELL for — the
// topic level and below — and deliberately never the root, the 6 domains or
// the 16 modules, which are drawn as region outlines built from unions of
// topic cells. So the map said 730 while hovering the corpus root in the
// connections pane said 752, two "nodes" counts on one screen counting two
// populations. A reader of this pane's title is asking how big the corpus is,
// so the number changed, not the word: `nodes.length - 1` — the root IS the
// corpus, not a node in it, the same convention `subtreeCount` and
// `containsSummary` use, so the root's own hover and this readout agree
// exactly. (A rename to "regions" was the other fix, and the owner declined
// it: an accurate label on the wrong population still leaves two node counts
// on screen.) `edges` is the corpus's own authored relations — NOT
// `nestedDots.length`, which counts deep leaf dots with no territory of their
// own and is a different number entirely.

import { edges, nodes } from '../corpus/graph'

export default function MapCountReadout() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)', fontWeight: 'var(--fw-semibold)' }}>{nodes.length - 1}</span> nodes
      </span>
      <span>·</span>
      <span>
        <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)', fontWeight: 'var(--fw-semibold)' }}>{edges.length}</span> relations
      </span>
    </span>
  )
}
