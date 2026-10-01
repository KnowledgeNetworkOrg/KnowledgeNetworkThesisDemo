// Structural predicates shared by the two readers of stored walk payloads
// (#333). `isObj` and `isTopic` were copied verbatim into state/walkstore.ts and
// state/walk/draftpersist.ts; they live here so the two gates cannot drift.
//
// `isObj` is the JSON-object test both readers run before touching a field.
// `isTopic` asks the corpus whether a stored id still names a topic — the same
// gate walks.ts applies at load, asked as a question instead of a throw.

import { byId } from '../corpus/graph'

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export const isTopic = (id: unknown): boolean => typeof id === 'string' && !!byId.get(id)?.topic
