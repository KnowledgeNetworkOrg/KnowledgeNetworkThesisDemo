// THE PURE DOOR — arithmetic only, for `src/model/`. Adding a name here is a
// deliberate edit, and every import in this file must resolve to a `.ts` file
// (layering.test.ts checks). Nothing this file re-exports may drag in a
// component (`.tsx`) or module state: a model module is a node program in most
// tests, and the first `.tsx` pulled through here breaks the whole model suite.

export { familySlots, nestedFamilyPaint, nextTopicSlot, topicSlots, topicHue, HUE_RING, TOPIC_WALK, TOPIC_SEPARATION_MIN } from './graph/hueslots'
export { topicPaintValues } from './graph/topicvalues'
export type { OklchValue } from './graph/topicvalues'
export { clipToRoom, LabelCut, textWidth } from './graph/textFit'
export { WALK_ARROW_DEFAULTS, walkArrow } from './map/walkrecipes'
export type { WalkArrowGeom, WalkBand } from './map/walkrecipes'
