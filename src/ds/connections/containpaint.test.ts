// containpaint.test.ts — every contains pill draws its OWN node's topic colour (DS OB-174).
//
// WHY THIS IS A UNIT TEST AND NOT A SCREENSHOT. The reported fault was visible — "the
// connections pane's contains tree node pill border colours are all the same colour" — but the
// RULE underneath it is arithmetic over a tree, and arithmetic is exactly what a look cannot
// check. A screenshot can tell you the column is no longer monochrome; it cannot tell you that
// the third pill took slot 2 because the two above it share its hue, nor that a pill whose hue
// changed went back to slot 0 rather than continuing someone else's ladder. Those are the
// clauses, so they are pinned here, and the LOOK is checked in the browser driver beside them.
//
// The one rule worth restating, because it is the reason this function may exist at all: a tree
// stacks its pills in ONE COLUMN, so the only pill that touches a given pill is the one drawn
// immediately before it in visible order. That makes "step one slot down the family ladder per
// same-hue pill" a complete answer here. A MAP cannot reason this way — there, which regions
// touch is geometry, and the host has to call `familySlots()` with its own adjacency.

import { describe, expect, it } from 'vitest'

import { FAMILY_SLOTS, topicPaint } from '../graph/DomainDot'
import { ContainPaint } from './ContainTree'
import type { ContainNode } from './ContainTree'

/** ring hue names — what a corpus stores on a topic and hands the tree (OB-153; the six demo
 *  codes no longer resolve anywhere in this app) */
const SYS = 'leaf'
const MATH = 'violet'

const leaf = (id: string, domain?: string): ContainNode => ({ id, title: id, domain })

describe('ContainPaint — a node draws its OWN topic, not the tree\'s', () => {
  it('the root falls back to the tree-level domain when it carries none', () => {
    const paint = ContainPaint({ id: 'r', title: 'r' }, { domain: SYS })
    expect(paint.r.topic).toBe(SYS)
    expect(paint.r.stroke).toBe(topicPaint(SYS).stroke)
  })

  it('a node with no topic of its own inherits the NEAREST ancestor\'s', () => {
    // r(sys) -> a(no topic) -> b(no topic): both read sys, so a single-topic subtree
    // still draws as one family rather than falling back to grey.
    const tree: ContainNode = { ...leaf('r', SYS), children: [{ ...leaf('a'), children: [leaf('b')] }] }
    const paint = ContainPaint(tree)
    expect(paint.a.topic).toBe(SYS)
    expect(paint.b.topic).toBe(SYS)
  })

  it('a nearer ancestor\'s topic wins over a further one', () => {
    const tree: ContainNode = { ...leaf('r', SYS), children: [{ ...leaf('m', MATH), children: [leaf('deep')] }] }
    const paint = ContainPaint(tree)
    expect(paint.deep.topic).toBe(MATH)
  })

  it('a pill whose hue differs from the one above it draws its TRUE topic colour, slot 0', () => {
    // the clause asks for this as a VALUE, not a relationship: the same string the map's
    // territory draws for that topic.
    const tree: ContainNode = { ...leaf('r', SYS), children: [leaf('m', MATH)] }
    const paint = ContainPaint(tree)
    expect(paint.m.slot).toBe(0)
    expect(paint.m.stroke).toBe(topicPaint(MATH).stroke)
    expect(paint.r.stroke).toBe(topicPaint(SYS).stroke)
  })
})

describe('ContainPaint — two pills that touch are never the same colour', () => {
  const runOf = (n: number): ContainNode => ({
    ...leaf('r', SYS),
    children: Array.from({ length: n }, (_, i) => leaf('k' + i, SYS)),
  })

  it('a run of same-hue pills steps one slot down the family ladder per pill', () => {
    const paint = ContainPaint(runOf(3))
    expect([paint.r.slot, paint.k0.slot, paint.k1.slot, paint.k2.slot]).toEqual([0, 1, 2, 3])
  })

  it('no two CONSECUTIVE pills share a stroke, even past the end of the ladder', () => {
    // a run longer than FAMILY_SLOTS wraps, and the wrap is the case worth pinning: slot goes
    // ...3, 4, 0 — never 4, 4 — so the pair that touches at the seam still differs.
    const n = FAMILY_SLOTS + 3
    const paint = ContainPaint(runOf(n))
    const order = ['r', ...Array.from({ length: n }, (_, i) => 'k' + i)]
    for (let i = 1; i < order.length; i++) {
      expect(paint[order[i]].stroke, `${order[i - 1]} and ${order[i]} touch`).not.toBe(paint[order[i - 1]].stroke)
    }
  })

  it('a hue CHANGE resets the ladder rather than continuing the previous topic\'s', () => {
    const tree: ContainNode = { ...leaf('r', SYS), children: [leaf('a', SYS), leaf('b', MATH), leaf('c', MATH)] }
    const paint = ContainPaint(tree)
    expect(paint.a.slot).toBe(1)   // second sys pill in a row
    expect(paint.b.slot).toBe(0)   // new hue, true colour
    expect(paint.c.slot).toBe(1)   // second math pill in a row
  })
})

describe('ContainPaint — the walk is VISIBLE order', () => {
  const nested: ContainNode = {
    ...leaf('r', SYS),
    children: [
      { ...leaf('closed', SYS), children: [leaf('hidden', MATH)] },
      leaf('after', SYS),
    ],
  }

  it('skips a closed node\'s children — a hidden pill touches nothing', () => {
    const paint = ContainPaint(nested, { isOpen: (n) => n.id !== 'closed' })
    expect(paint.hidden).toBeUndefined()
    // and the pill AFTER the closed one grades against the closed one, not against the
    // descendant nobody can see — which is the whole reason the pass takes `isOpen`.
    expect(paint.after.slot).toBe(paint.closed.slot + 1)
  })

  it('counts them when the node is open, and the shade shifts because of it', () => {
    const open = ContainPaint(nested, { isOpen: () => true })
    expect(open.hidden).toBeDefined()
    expect(open.hidden.slot).toBe(0) // math after sys — a hue change
    // `after` is now the fourth sys-hued pill in visible order: r, closed, (hidden=math), after
    expect(open.after.slot).not.toBe(ContainPaint(nested, { isOpen: (n) => n.id !== 'closed' }).after.slot)
  })

  it('omitting isOpen treats the whole tree as open', () => {
    expect(ContainPaint(nested).hidden).toBeDefined()
  })
})

describe('ContainPaint — the edges of the contract', () => {
  it('an unresolvable topic keeps the anchor fallback at slot 0, never a graded family', () => {
    const paint = ContainPaint(leaf('r', 'not-a-topic'))
    expect(paint.r.hue).toBeNull()
    expect(paint.r.slot).toBe(0)
    expect(paint.r.stroke).toBe(topicPaint('not-a-topic').stroke)
  })

  it('a null root is an empty map, not a throw', () => {
    expect(ContainPaint(null)).toEqual({})
    expect(ContainPaint(undefined)).toEqual({})
  })

  it('every node in the visible tree gets exactly one entry', () => {
    const tree: ContainNode = { ...leaf('r', SYS), children: [leaf('a', MATH), leaf('b', SYS)] }
    expect(Object.keys(ContainPaint(tree)).sort()).toEqual(['a', 'b', 'r'])
  })
})
