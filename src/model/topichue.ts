// A TOPIC'S COLOUR IS A POSITION, NOT AN IDENTITY (DS OB-153, the owner's ruling of
// 2026-09-05). Nothing anywhere maps a topic NAME to a hue. A top-level topic is handed the
// next free hue along the ring's walk the moment it is CREATED, the hue name is written onto
// the topic and travels with it; a rename keeps it, a delete frees it for the next topic
// created. Two unrelated graphs get the same hues for their first three topics because the
// colour means "a distinct topic", not "security".
//
// This module is the mechanism. STORAGE is the graph's: the hue lives on the topic record
// (the corpus fixture carries it on each domain node — `GNode.hue` — which is how the demo
// graph opens the same colours every time), and this file only ever reads the hues already
// in use and chooses the next one. It never recomputes a hue from position: recompute it and
// every colour shifts the moment a sibling is deleted or the tree is reordered.
//
// No screen creates a top-level topic yet — the corpus is authored — so today the only
// caller is the test that proves the rule. The function is the rule, stated once, for the
// day a screen does.
import { nextTopicSlot } from '@/ds'

/** what a graph stores per top-level topic: the id, the name, and the ring hue it was
 *  handed at creation — the hue is data on the topic, never derived from the name */
export interface TopicRecord {
  id: string
  title: string
  hue: string
}

/** the hue names a graph's topics hold, in list order — what `nextTopicSlot` is fed */
export const hueNamesOf = (topics: readonly TopicRecord[]): string[] => topics.map((t) => t.hue)

/** create a top-level topic: the next free hue along the walk is chosen from the hues
 *  ALREADY IN USE and written onto the new record. Past sixteen it wraps — a real answer for
 *  a dot or a chip; the map's touching-twin case is `topicSlots` (OB-171). */
export function createTopic(topics: readonly TopicRecord[], id: string, title: string): TopicRecord[] {
  const { hue } = nextTopicSlot(hueNamesOf(topics))
  return [...topics, { id, title, hue }]
}

/** a rename is not a new topic: the hue stays exactly where it is */
export function renameTopic(topics: readonly TopicRecord[], id: string, title: string): TopicRecord[] {
  return topics.map((t) => (t.id === id ? { ...t, title } : t))
}

/** a delete frees the hue: the next topic created may be handed it again. Reissuing is
 *  correct — never reusing a slot exhausts sixteen. */
export function deleteTopic(topics: readonly TopicRecord[], id: string): TopicRecord[] {
  return topics.filter((t) => t.id !== id)
}
