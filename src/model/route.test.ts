import { describe, expect, it } from 'vitest'
import { routeLeafIds, routeNumbers, routeOfIds, routeOptionals, routeStepIsGroup } from './route'
import type { RouteStep } from './route'

/* #228 (DS OB-114) — the route with its groups intact, and the numbering the map and the
 * hover card read off it. The issue's checkable case, verbatim: a group of 3+ nodes at step 3
 * shows every node at "3" and the step after the group at "4", not "6". */

const leaf = (node: string): RouteStep => ({ node })
const group = (title: string, ...steps: RouteStep[]): RouteStep => ({ title, steps })

describe('routeLeafIds — the flat projection every current reader keeps', () => {
  it('walks groups down to their nodes, in order', () => {
    expect(routeLeafIds([leaf('a'), group('g', leaf('b'), leaf('c')), leaf('d')])).toEqual(['a', 'b', 'c', 'd'])
  })
  it('round-trips a flat list', () => {
    expect(routeLeafIds(routeOfIds(['x', 'y']))).toEqual(['x', 'y'])
    expect(routeOfIds(['x']).map(routeStepIsGroup)).toEqual([false])
  })
})

describe('routeOptionals — one flag per landed-on node, lined up with routeLeafIds (DS OB-214)', () => {
  it('reads each leaf\'s own flag, through groups, in the same order as the ids', () => {
    const steps = [leaf('a'), group('g', { node: 'b', optional: true }, leaf('c')), { node: 'd', optional: true }]
    expect(routeLeafIds(steps)).toEqual(['a', 'b', 'c', 'd'])
    expect(routeOptionals(steps)).toEqual([false, true, false, true])
  })
  it('a flat route of ids has no optional stops', () => {
    expect(routeOptionals(routeOfIds(['x', 'y']))).toEqual([false, false])
  })
})

describe('routeNumbers — a group is ONE step; its nodes number underneath it', () => {
  it('the issue\'s case: a group of three at step 3, and the next top-level step is 4, not 6', () => {
    const r = routeNumbers([leaf('a'), leaf('b'), group('g', leaf('c'), leaf('d'), leaf('e')), leaf('f')])
    expect(r.map((n) => n.step)).toEqual([1, 2, 3, 3, 3, 4])
    expect(r.map((n) => n.path)).toEqual(['1', '2', '3.1', '3.2', '3.3', '4'])
    expect(r.map((n) => n.grouped)).toEqual([false, false, true, true, true, false])
  })
  it('nests: a group inside a group still prints the TOP-LEVEL step, and the path goes all the way down', () => {
    const r = routeNumbers([group('outer', group('inner', leaf('x')), leaf('y')), leaf('z')])
    expect(r.map((n) => [n.id, n.step, n.path])).toEqual([['x', 1, '1.1.1'], ['y', 1, '1.2'], ['z', 2, '2']])
  })
  it('an empty group still takes a number, as it takes a slot in the chain', () => {
    const r = routeNumbers([leaf('a'), group('empty'), leaf('b')])
    expect(r.map((n) => [n.id, n.step])).toEqual([['a', 1], ['b', 3]])
  })
  it('lines up one-to-one with routeLeafIds, in the same order', () => {
    const steps = [leaf('a'), group('g', leaf('b'), group('h', leaf('c')), leaf('d')), leaf('e')]
    expect(routeNumbers(steps).map((n) => n.id)).toEqual(routeLeafIds(steps))
  })
})
