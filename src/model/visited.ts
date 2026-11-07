// WHICH TRAIL ENTRIES COUNT AS VISITED PLACES. The header's count has always
// meant topics on the topic corpora. A cs2023 route can stop at any depth, so
// its count widens to every real place, areas and deeper included.

export interface VisitedLookup {
  /** the trail entry's node, or undefined when the id is not in this corpus */
  (id: string): { topic?: boolean } | undefined
}

/** the distinct places on a trail that count for this corpus */
export function visitedIds(
  log: readonly { id: string }[],
  corpus: string,
  lookup: VisitedLookup,
): string[] {
  const visited = new Set<string>()
  for (const entry of log) {
    const node = lookup(entry.id)
    if (!node) continue
    if (corpus === 'cs2023' || node.topic) visited.add(entry.id)
  }
  return [...visited]
}
