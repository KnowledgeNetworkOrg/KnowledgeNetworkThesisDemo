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

import { OpenAncestors, OpenForVisible, OpenOnSelect } from './ContainTree'
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

/* The TWO SPENDS of that force-open set, pinned beside it (OB-244 + OB-227): the one-shot fold
   that includes the target, and the whole-view fold that excludes what it is shown. */
describe('OpenOnSelect — the one-shot fold, applied when the selection changes', () => {
  it('includes the target itself, so selecting a container opens it', () => {
    expect(OpenOnSelect(TREE, 'a1')).toEqual({ root: 1, a: 1, a1: 1 })
    // the contrast with OpenAncestors is the whole point: the SAME selection, one key more
    expect(OpenOnSelect(TREE, 'a1x')).toEqual({ ...OpenAncestors(TREE, 'a1x'), a1x: 1 })
  })

  it('on the root it opens the root alone — it has no ancestor', () => {
    expect(OpenOnSelect(TREE, 'root')).toEqual({ root: 1 })
  })

  it('an empty id opens nothing', () => {
    expect(OpenOnSelect(TREE, '')).toEqual({})
  })
})

describe('OpenForVisible — what a whole view must open, and never what it shows', () => {
  it('excludes the ids it is handed, so a visible container\'s caret stays live', () => {
    const m = OpenForVisible(TREE, ['a1x', 'b'])
    expect(m).toEqual({ root: 1, a: 1, a1: 1 })
    expect(m).not.toHaveProperty('a1x')
    expect(m).not.toHaveProperty('b')
  })

  it('merges over the user\'s own map — it never closes anything', () => {
    const userOpen = { a2: 1 }
    expect({ ...userOpen, ...OpenForVisible(TREE, ['b']) }).toEqual({ a2: 1, root: 1 })
  })

  it('an id it cannot resolve, or a null tree, answers {} rather than throwing', () => {
    expect(OpenForVisible(TREE, ['nowhere'])).toEqual({})
    expect(OpenForVisible(null, ['a'])).toEqual({})
  })
})
