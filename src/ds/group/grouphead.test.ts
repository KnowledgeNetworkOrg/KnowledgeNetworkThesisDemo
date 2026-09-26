// OB-222 and OB-245 — the version group's head, the parts that can be asserted without a DOM.
//
// OB-222 moved the head's tally and its receding controls into ONE right-hand slot, so the
// published geometry now reserves the WIDER of the two and one gap, where it used to reserve
// both plus two gaps. What a unit test can pin is that arithmetic, the new metric, and the
// `closable` flag a spec now carries. The cross-fade itself — the figure out, the buttons in,
// nothing moving — is a laid-out box and an opacity, so it is asserted in the browser
// (`tools/studio-spike/browsertest-groupedit.mjs`), and `shot-foldab.mjs` checks these same
// functions against the rendered card.
//
// OB-245 made the step number's trailing dot the components' rather than the caller's:
// `index="2"` and `index="2."` draw one `2.`, and `NodeChain` numbers `2.1.` under either
// prefix. Both halves are plain strings in a static render, so they are pinned here.
//
// Widths in this environment come from `measure()`'s no-canvas fallback (0.55em a
// character), not from a font — so every expected number below is computed from `measure()`
// and `GROUP_METRICS` rather than typed in, and the assertions hold for whatever the
// fallback answers.

import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import { GROUP_METRICS, GroupGeometry, VersionedGroup } from './VersionedGroup'
import type { VersionedGroupProps } from './VersionedGroup'
import { NodeChain } from '../graph/NodeChain'
import { measure } from '../graph/textMeasure'

const M = GROUP_METRICS
const noop = () => {}

describe('OB-222 — the tally and the controls share one slot', () => {
  it('GROUP_METRICS gains ctlCluster3: 55, beside the two-button 37', () => {
    expect(M.ctlCluster3).toBe(55)
    expect(M.ctlCluster).toBe(37)
  })

  it('groupSpec() sets `closable` from onClose, and only from onClose', () => {
    const base: VersionedGroupProps = { title: 't', versions: [{ id: 'a', name: 'one' }] }
    expect(GroupGeometry.groupSpec({ ...base, onClose: noop }).closable).toBe(true)
    expect(GroupGeometry.groupSpec(base).closable).toBe(false)
  })

  /* The title column, found from the outside: a one-word title of `k` characters takes one line
     exactly while `k` characters' width fits the column, so the longest one-line title brackets
     the column to within one character. */
  const W = 300
  const charW = measure('x', 700, 13, 'display')
  const tallyW = measure('3 nodes', 400, 11, 'ui')
  const beforeCluster = W - GroupGeometry.hairline() * 2 - M.foldPeekX - M.padX * 2 - M.headPadLeft - M.headPadRight
    - (measure('2.', 500, 12, 'mono') + M.pickerGap - 2)
  /** the column after OB-222: the wider of the cluster and the tally, and one gap */
  const column = (closable: boolean) => beforeCluster - (Math.max(closable ? M.ctlCluster3 : M.ctlCluster, tallyW) + M.pickerGap)
  /** the column BEFORE OB-222, for the comparison only: a 37px cluster AND the tally, two gaps */
  const oldColumn = beforeCluster - (M.ctlCluster + M.pickerGap) - (tallyW + M.pickerGap)
  const titleLines = (chars: number, closable?: boolean) => GroupGeometry.headHeight({
    width: W, index: '2', title: 'x'.repeat(chars), count: 3, countLabel: 'nodes', narrow: false, closable,
  }).titleLines

  it('a closable 300px card with a 3-node tally reserves max(55, tally) + one gap', () => {
    const fits = Math.floor(column(true) / charW)
    expect(titleLines(fits, true)).toBe(1)
    expect(titleLines(fits + 1, true)).toBe(2)
  })

  it('which is the old column plus the tally\'s width less 12px — a name that wrapped now fits', () => {
    expect(column(true) - oldColumn).toBeCloseTo(tallyW - 12, 6)
    const k = Math.floor(oldColumn / charW) + 1 // one character too long for the OLD reservation
    expect(k * charW).toBeGreaterThan(oldColumn)
    expect(k * charW).toBeLessThanOrEqual(column(true))
    expect(titleLines(k, true)).toBe(1)
  })

  it('a spec that omits `closable` reserves the two-button cluster — the one case that does', () => {
    const k = Math.floor(column(true) / charW) + 1 // one character too long for a closable card
    expect(k * charW).toBeLessThanOrEqual(column(false))
    expect(titleLines(k, true)).toBe(2)
    expect(titleLines(k)).toBe(1)
  })

  it('narrow, the tally is on its own line and the slot still reserves the cluster', () => {
    const narrowCol = beforeCluster - (M.ctlCluster3 + M.pickerGap)
    const fits = Math.floor(narrowCol / charW)
    const lines = (chars: number) => GroupGeometry.headHeight({
      width: W, index: '2', title: 'x'.repeat(chars), count: 3, countLabel: 'nodes', narrow: true, closable: true,
    }).titleLines
    expect(lines(fits)).toBe(1)
    expect(lines(fits + 1)).toBe(2)
  })
})

describe('OB-245 — one notation per card: the trailing dot is the component\'s', () => {
  const props = (index: string): VersionedGroupProps => ({
    title: 'Reach the machine', index, description: 'Get a packet from here to there',
    versions: [{ id: 'a', name: 'the short way', label: 'v1' }], count: 3, countLabel: 'nodes',
    width: 300, narrow: false, onClose: noop, onDescribe: noop,
  })

  it('groupSpec() hands the predictor the string the head draws, so "2" and "2." are one spec', () => {
    expect(GroupGeometry.groupSpec(props('2'))).toEqual(GroupGeometry.groupSpec(props('2.')))
    expect(GroupGeometry.groupSpec(props('2')).index).toBe('2.')
    expect(GroupGeometry.groupSpec({ ...props('2.1'), numberScope: 'path' }).index).toBe('2.1.')
  })

  it('and a HAND-BUILT spec predicts the same box for either spelling, at every title length', () => {
    for (let n = 1; n <= 60; n++) {
      const spec = { width: 300, title: 'x'.repeat(n), count: 3, countLabel: 'nodes', narrow: false, closable: true }
      expect(GroupGeometry.openHeight({ ...spec, index: '2' }), `title of ${n}`).toEqual(GroupGeometry.openHeight({ ...spec, index: '2.' }))
      expect(GroupGeometry.foldedSize({ ...spec, index: '2' }), `folded, title of ${n}`).toEqual(GroupGeometry.foldedSize({ ...spec, index: '2.' }))
    }
  })

  it('<VersionedGroup index="2" /> and index="2." render identical heads, both reading "2."', () => {
    const draw = (index: string) => renderToStaticMarkup(createElement(VersionedGroup, props(index)))
    expect(draw('2')).toBe(draw('2.'))
    expect(draw('2')).toContain('>2.</span>')
    expect(draw('2')).not.toContain('>2</span>')
  })

  /** a chain member that prints the number the chain hands it */
  const Probe = ({ index }: { index?: string }) => createElement('i', null, index)
  const numbers = (prefix?: string) => {
    const html = renderToStaticMarkup(createElement(NodeChain, { number: true, arrow: false, prefix },
      createElement(Probe, { key: 'a' }), createElement(Probe, { key: 'b' }), createElement(Probe, { key: 'c' })))
    return [...html.matchAll(/<i>([^<]*)<\/i>/g)].map((m) => m[1])
  }

  it('<NodeChain number prefix="2" /> and prefix="2." both number 2.1. 2.2.', () => {
    expect(numbers('2')).toEqual(['2.1.', '2.2.', '2.3.'])
    expect(numbers('2.')).toEqual(['2.1.', '2.2.', '2.3.'])
  })

  it('with no prefix the chain still numbers 1. 2. 3.', () => {
    expect(numbers()).toEqual(['1.', '2.', '3.'])
    expect(numbers('')).toEqual(['1.', '2.', '3.'])
  })
})
