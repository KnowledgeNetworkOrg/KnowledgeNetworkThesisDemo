// Saved work that holds corpus node ids is kept per corpus, so a stop from one
// dataset is never read back against another. Work saved before there were two
// datasets carries no corpus label and is teaching's, so teaching keeps the
// plain key and every other corpus gets its name appended (the colon style
// `sessionsKey` in present/lecturenotes.ts already uses).

import { CORPUS_NAME } from '../corpus/graph'
import type { CorpusName } from '../corpus/graph'

export function corpusKey(base: string, corpus: CorpusName = CORPUS_NAME): string {
  return corpus === 'teaching' ? base : base + ':' + corpus
}
