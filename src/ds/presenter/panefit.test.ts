// The two fits the presenter's panes row clamps against, pinned to their own arithmetic so the
// host never retypes a number the pane already knows (OB-254, #415).

import { describe, expect, it } from 'vitest'

import { LECTURE_NOTES_FIT, LECTURE_NOTES_METRICS } from './LectureNotes'
import { QUICK_ACTIONS_FIT } from './QuickActionsDeck'

describe('OB-254 - the notes pane and the deck declare their own fits', () => {
  it('the notes floor is both gutters, the chat floor, the divider and the prepared floor', () => {
    const M = LECTURE_NOTES_METRICS
    const derived = M.gutter * 2 + M.chatMin + M.divider + M.preparedMin
    expect(derived).toBe(522)
    expect(LECTURE_NOTES_FIT).toEqual({ narrowBelow: derived, floor: derived, minHeight: 340 })
  })

  it('the deck stops at 300 and opens at the 360 it stood at before the divider', () => {
    expect(QUICK_ACTIONS_FIT).toEqual({ narrowBelow: 300, floor: 300, seed: 360 })
  })
})
