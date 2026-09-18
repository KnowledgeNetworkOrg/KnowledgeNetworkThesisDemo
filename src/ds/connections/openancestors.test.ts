// openancestors.test.ts — the force-open set for a moving selection excludes the target itself
// (DS OB-198).
//
// WHY THE EXCLUSION IS THE WHOLE TEST. A force-open map that contains its own target makes that
// node's caret inert: the toggle lands, the next render re-forces it open from the inclusive
// path, and the one pill the reader is looking at becomes the one pill that cannot be collapsed.
// That is invisible to a screenshot — an open-because-forced pill looks identical to an
// open-because-you-opened-it one — so this is arithmetic over a tree, pinned here, the same
// reasoning containpaint.test.ts gives for the sibling function beside it.
//
// The owner met this FIRST against the corpus ROOT (2026-09-16): the root sits on every path, so
// with the old inclusive union it was inert no matter what was selected — reported as "Computer
// Science doesn't collapse/expand... it has a caret" with nothing yet selected at all.

import { describe, expect, it } from 'vitest'

import { OpenAncestors } from './ContainTree'
import type { ContainNode } from './ContainTree'

const leaf = (id: string, children?: ContainNode[]): ContainNode => (children ? { id, title: id, children } : { id, title: id })

const TREE: ContainNode = leaf('root', [
  leaf('a', [leaf('a1', [leaf('a1x')]), leaf('a2')]),
  leaf('b'),
])

describe('OpenAncestors — the target is never in its own force-open set', () => {
  it('the root of the tree opens nothing — it has no ancestor', () => {
    expect(OpenAncestors(TREE, 'root')).toEqual({})
  })

  it('a top-level child opens only the root', () => {
    expect(OpenAncestors(TREE, 'a')).toEqual({ root: 1 })
  })

  it('a deep node opens every ancestor UP TO but NOT INCLUDING itself', () => {
    expect(OpenAncestors(TREE, 'a1x')).toEqual({ root: 1, a: 1, a1: 1 })
    // the fault this guards: an inclusive set would also carry a1x: 1, which force-opens
    // a leaf that has no children and no caret to begin with — harmless there, but the same
    // inclusive read on a CONTAINER (a, a1) is what made a caret inert
    expect(OpenAncestors(TREE, 'a1x')).not.toHaveProperty('a1x')
  })

  it('a node not in the tree opens nothing, rather than throwing', () => {
    expect(OpenAncestors(TREE, 'nowhere')).toEqual({})
  })

  it('a null tree opens nothing', () => {
    expect(OpenAncestors(null, 'a')).toEqual({})
  })

  it('merging over a user\'s own open map: the path wins, the user\'s OTHER choices survive', () => {
    const userOpen = { b: 1 } // the user opened a sibling branch by hand
    const merged = { ...userOpen, ...OpenAncestors(TREE, 'a1x') }
    expect(merged).toEqual({ b: 1, root: 1, a: 1, a1: 1 })
  })

  it('merging over a user\'s CLOSED ancestor still opens it — the path wins', () => {
    // the user closed `a` at some point; the union must reopen it or the selection is hidden
    const userOpen: Record<string, 1> = { root: 1 } // a is absent = closed
    const merged = { ...userOpen, ...OpenAncestors(TREE, 'a1x') }
    expect(merged.a).toBe(1)
  })
})
