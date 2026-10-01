// Not the #160 bug itself, but the same class of defect and the same
// neighbourhood: a y-fraction read off a bounding rect and compared against
// fixed thresholds, sitting right beside AuthorRoad's marquee guard — the
// other half of what #160 found broken. Locking in the 0.3/0.5/0.7 split so a
// future edit here can't silently retarget where a drop lands without a test
// noticing.

import { describe, expect, test, vi } from 'vitest'

import { bandFor, beginDrag, dragPayload, draggedNode, dropAllowed, endDrag, gapFor, handleDrop, heldBox, refusedAt } from './authordnd'
import type { AuthorState } from './authordraft'
import type { Stop } from './mockwalk'

type DragLike = Parameters<typeof bandFor>[0]
function fakeDrag(clientY: number, top: number, height: number): DragLike {
  return { clientY, currentTarget: { getBoundingClientRect: () => ({ top, height }) } } as unknown as DragLike
}

const leaf: Stop = { node: 'leaf-node', variants: [] }

const container: Stop = {
  key: 'c',
  title: 'Container',
  variants: [
    { id: 'v0', label: 'a', steps: [{ node: 'n1', variants: [] }, { node: 'n2', variants: [] }] },
    { id: 'v1', label: 'b', steps: [] },
  ],
}

describe('bandFor', () => {
  test('a leaf is never "inside" — before/after split at the midline', () => {
    expect(bandFor(fakeDrag(20, 0, 100), leaf)).toBe('before')
    expect(bandFor(fakeDrag(80, 0, 100), leaf)).toBe('after')
    expect(bandFor(fakeDrag(50, 0, 100), leaf)).toBe('after') // y===0.5 is NOT < 0.5
  })

  test('a container is "inside" only strictly between 0.3 and 0.7', () => {
    expect(bandFor(fakeDrag(50, 0, 100), container)).toBe('inside')
    expect(bandFor(fakeDrag(31, 0, 100), container)).toBe('inside')
    expect(bandFor(fakeDrag(69, 0, 100), container)).toBe('inside')
    expect(bandFor(fakeDrag(30, 0, 100), container)).toBe('before') // boundary excluded
    expect(bandFor(fakeDrag(70, 0, 100), container)).toBe('after') // boundary excluded
    expect(bandFor(fakeDrag(10, 0, 100), container)).toBe('before')
    expect(bandFor(fakeDrag(90, 0, 100), container)).toBe('after')
  })
})

describe('gapFor', () => {
  test('top-level leaf, before vs after', () => {
    expect(gapFor(fakeDrag(20, 0, 100), [2], leaf, {})).toEqual([2])
    expect(gapFor(fakeDrag(80, 0, 100), [2], leaf, {})).toEqual([3])
  })

  test('nested leaf keeps its parent path, only the last index moves', () => {
    expect(gapFor(fakeDrag(80, 0, 100), [1, 2], leaf, {})).toEqual([1, 3])
  })

  test('dropping inside a container lands at the end of its CHOSEN variant', () => {
    // choices={} → chosenIdx defaults to 0 → v0's 2 steps → append at index 2
    expect(gapFor(fakeDrag(50, 0, 100), [0], container, {})).toEqual([0, 0, 2])
  })

  test('dropping on a container outside the middle band still falls back to before/after', () => {
    expect(gapFor(fakeDrag(10, 0, 100), [0], container, {})).toEqual([0])
    expect(gapFor(fakeDrag(90, 0, 100), [0], container, {})).toEqual([1])
  })

  test('inside-drop respects an explicit choice, not just the default variant', () => {
    expect(gapFor(fakeDrag(50, 0, 100), [0], container, { c: 'v1' })).toEqual([0, 1, 0])
  })
})

// ── OB-219 / OB-220 — the duplicate-neighbour rule, as the road asks it ──────
// The rule itself is the design system's (`neighboursOf`, pinned in
// ds/graph/DropVerdict.test.ts). What is pinned here is the HOST's half: which ids
// the landing list holds, which node a payload carries, and that a block being
// moved leaves its own list before its neighbours are read.

const L = (node: string): Stop => ({ node, variants: [] })
const UNSET: Stop = { node: '', unset: true, variants: [] }
const box = (key: string, steps: Stop[]): Stop => ({ key, title: key, variants: [{ id: key + '-v0', label: '', steps }] })

//            [0]     [1]     [2]     [3]                         [4]
const road = [L('a'), L('b'), L('c'), box('g', [L('x'), L('a')]), L('a')]

describe('dropAllowed — a new node from the palette (or the map)', () => {
  test('a twin directly above or below refuses the gap', () => {
    expect(dropAllowed(road, 'pal:b', [1])).toBe(false) // a | b  — b below
    expect(dropAllowed(road, 'pal:b', [2])).toBe(false) // b | c  — b above
  })

  test('every other gap takes it', () => {
    expect(dropAllowed(road, 'pal:b', [0])).toBe(true)
    expect(dropAllowed(road, 'pal:b', [3])).toBe(true)
    expect(dropAllowed(road, 'pal:b', [5])).toBe(true)
  })

  test('the first and last slots have one neighbour each', () => {
    expect(dropAllowed(road, 'pal:a', [0])).toBe(false) // head, a below
    expect(dropAllowed(road, 'pal:a', [5])).toBe(false) // tail, a above
    expect(dropAllowed(road, 'pal:c', [5])).toBe(true)
  })

  test('the same node elsewhere in the walk is fine — only adjacency is refused', () => {
    expect(dropAllowed(road, 'pal:a', [2])).toBe(true) // b | c, with an `a` two steps away
  })

  test('a group beside the gap blocks nothing, whatever it holds', () => {
    // g holds x first — a group is never compared by its contents
    expect(dropAllowed(road, 'pal:x', [3])).toBe(true)
    expect(dropAllowed(road, 'pal:a', [4])).toBe(false) // …but the leaf `a` below the group still counts
    expect(dropAllowed(road, 'pal:c', [4])).toBe(true)
  })

  test('an unset slot beside the gap blocks nothing', () => {
    const r = [L('a'), UNSET, L('b')]
    expect(dropAllowed(r, 'pal:a', [1])).toBe(false) // a | picker
    expect(dropAllowed(r, 'pal:a', [2])).toBe(true) // picker | b
    expect(dropAllowed([UNSET, UNSET], 'pal:a', [1])).toBe(true)
  })

  test("inside a group, the group's own list is the one read", () => {
    expect(dropAllowed(road, 'pal:x', [3, 0, 0])).toBe(false) // head of g, x below
    expect(dropAllowed(road, 'pal:a', [3, 0, 2])).toBe(false) // tail of g, a above
    expect(dropAllowed(road, 'pal:c', [3, 0, 1])).toBe(true)
  })
})

describe('dropAllowed — a block already on the road', () => {
  test('dropping a node back where it stands is allowed', () => {
    expect(dropAllowed(road, 'blk:b.1', [1])).toBe(true)
    expect(dropAllowed(road, 'blk:b.1', [2])).toBe(true)
  })

  test('the moved block leaves its list first, so the gap it lands in is judged without it', () => {
    // the last `a` moved up to sit between a and b — refused; between c and g — fine
    expect(dropAllowed(road, 'blk:b.4', [1])).toBe(false)
    expect(dropAllowed(road, 'blk:b.4', [3])).toBe(true)
    // the first `a` moved to the tail lands beside the other `a`
    expect(dropAllowed(road, 'blk:b.0', [5])).toBe(false)
  })

  test('a move from another list leaves the landing list as it is', () => {
    // the `a` inside g, lifted out to the root
    expect(dropAllowed(road, 'blk:b.3.0.1', [5])).toBe(false)
    expect(dropAllowed(road, 'blk:b.3.0.1', [1])).toBe(false)
    expect(dropAllowed(road, 'blk:b.3.0.1', [2])).toBe(true)
  })

  test('a group or an unset slot is never refused — the rule has no id for it', () => {
    expect(dropAllowed(road, 'blk:b.3', [0])).toBe(true)
    expect(dropAllowed([L('a'), UNSET, L('a')], 'blk:b.1', [0])).toBe(true)
  })

  test('a route pulled out of a fork, or a payload nobody knows, is never refused', () => {
    expect(dropAllowed(road, 'var:b.3~0', [0])).toBe(true)
    expect(dropAllowed(road, '', [0])).toBe(true)
  })
})

describe('draggedNode', () => {
  test('reads the node a payload would put down', () => {
    expect(draggedNode(road, 'pal:b')).toBe('b')
    expect(draggedNode(road, 'blk:b.2')).toBe('c')
    expect(draggedNode(road, 'blk:b.3.0.0')).toBe('x')
    expect(draggedNode(road, 'blk:b.3')).toBeNull()
    expect(draggedNode(road, 'blk:b.9')).toBeNull()
  })
})

describe('refusedAt — the picker filling its own slot (OB-220)', () => {
  test('a slot between two resolved stops refuses exactly those two', () => {
    expect(refusedAt([L('a'), UNSET, L('b')], [1], [1])).toEqual(['a', 'b'])
  })

  test('with a picker on one side, only the resolved side is refused', () => {
    expect(refusedAt([L('a'), UNSET, UNSET, L('b')], [1], [1])).toEqual(['a'])
    expect(refusedAt([L('a'), UNSET, UNSET, L('b')], [2], [2])).toEqual(['b'])
  })

  test('at either end of a list, the one neighbour it has', () => {
    expect(refusedAt([UNSET, L('b')], [0], [0])).toEqual(['b'])
    expect(refusedAt([L('a'), UNSET], [1], [1])).toEqual(['a'])
    expect(refusedAt([UNSET], [0], [0])).toEqual([])
  })

  test('a group beside the slot refuses nothing', () => {
    expect(refusedAt([box('g', [L('a')]), UNSET, L('b')], [1], [1])).toEqual(['b'])
  })
})

// ── the drag in flight — what a real drag cannot say until it is dropped ─────

type DragFake = Parameters<typeof dragPayload>[0]
function dragEvent(opts: { readable?: string; x?: number; y?: number; rect?: { left: number; top: number; width: number; height: number } }): DragFake {
  return {
    clientX: opts.x ?? 0,
    clientY: opts.y ?? 0,
    currentTarget: { getBoundingClientRect: () => opts.rect ?? { left: 0, top: 0, width: 0, height: 0 } },
    dataTransfer: {
      setData: () => {},
      // protected mode: a real dragover reads '' — only a fake told otherwise can read
      getData: () => opts.readable ?? '',
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as DragFake
}

describe('the in-flight record', () => {
  test('a dragover that cannot read its payload falls back to what the source recorded', () => {
    beginDrag(dragEvent({ x: 110, y: 215, rect: { left: 100, top: 200, width: 150, height: 34 } }), 'pal:b')
    expect(dragPayload(dragEvent({}))).toBe('pal:b')
    endDrag()
    expect(dragPayload(dragEvent({}))).toBe('')
  })

  test('an event that CAN be read wins over the record (the map dispatches its own)', () => {
    beginDrag(dragEvent({}), 'pal:b')
    expect(dragPayload(dragEvent({ readable: 'pal:c' }))).toBe('pal:c')
    endDrag()
  })

  test('the held node is drawn where the pointer holds it, at the size it was picked up at', () => {
    beginDrag(dragEvent({ x: 110, y: 215, rect: { left: 100, top: 200, width: 150, height: 34 } }), 'blk:b.1')
    expect(heldBox(dragEvent({ x: 410, y: 515 }))).toEqual({ left: 400, top: 500, width: 150, height: 34 })
    // a readable payload from some other drag is not this record's
    expect(heldBox(dragEvent({ readable: 'pal:z', x: 410, y: 515 }))).toBeNull()
    endDrag()
    expect(heldBox(dragEvent({ x: 410, y: 515 }))).toBeNull()
  })
})

describe('handleDrop re-asks the rule, and a refusal does nothing at all', () => {
  const fakeState = () => {
    const ops = { insertNode: vi.fn(), moveBlock: vi.fn(), extractVariant: vi.fn(), setCaret: vi.fn() }
    return { ops, state: { stops: road, ...ops } as unknown as AuthorState }
  }

  test('refused: no op runs, nothing is said, and the drop still goes no further', () => {
    const { ops, state } = fakeState()
    const e = dragEvent({ readable: 'pal:b' })
    handleDrop(e, [1], state)
    expect(ops.insertNode).not.toHaveBeenCalled()
    expect(ops.moveBlock).not.toHaveBeenCalled()
    expect(ops.setCaret).not.toHaveBeenCalled()
    // stopped, so the road's catch-all cannot then append it at the end
    expect(e.stopPropagation).toHaveBeenCalled()
  })

  test('allowed: the same op as ever', () => {
    const a = fakeState()
    handleDrop(dragEvent({ readable: 'pal:b' }), [3], a.state)
    expect(a.ops.insertNode).toHaveBeenCalledWith('b', [3])
    const b = fakeState()
    handleDrop(dragEvent({ readable: 'blk:b.4' }), [3], b.state)
    expect(b.ops.moveBlock).toHaveBeenCalledWith([4], [3])
  })

  test('a drop clears the in-flight record — a block that moved has no dragend left to', () => {
    beginDrag(dragEvent({}), 'blk:b.4')
    handleDrop(dragEvent({ readable: 'blk:b.4' }), [3], fakeState().state)
    expect(dragPayload(dragEvent({}))).toBe('')
  })
})
