// Structural predicates shared by the two readers of stored walk payloads
// (#333). `isObj` and `isTopic` were copied verbatim into state/walkstore.ts and
// state/walk/draftpersist.ts; they live here so the two gates cannot drift.
//
// `isObj` is the JSON-object test both readers run before touching a field.
// `isWalkStop` asks the corpus whether a stored id still exists — the same gate
// walks.ts applies at load, asked as a question instead of a throw. A cs2023
// course route may stop at any depth, so there existence is enough; the other
// corpora's stops must still be topics.

import { byId, CORPUS_NAME } from '../corpus/graph'

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const isPlace = (id: unknown): boolean => typeof id === 'string' && byId.has(id)

export const isTopic = (id: unknown): boolean => typeof id === 'string' && !!byId.get(id)?.topic

export const isWalkStop = (id: unknown): boolean => (CORPUS_NAME === 'cs2023' ? isPlace(id) : isTopic(id))
