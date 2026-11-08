import { PillButton } from '@/ds'

import { CORPUS_NAME, CORPUS_NAMES } from '../corpus/graph'
import type { CorpusName } from '../corpus/graph'

// The corpus is a module-level constant fixed at load (corpus/graph.ts), so
// choosing another one loads the page again with the address naming it.
function load(corpus: CorpusName): void {
  if (corpus === CORPUS_NAME) return
  const query = new URLSearchParams(window.location.search)
  query.set('corpus', corpus)
  window.location.assign('?' + query.toString())
}

export function CorpusSwitch() {
  return (
    <span aria-label="studio-dataset" style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
      {CORPUS_NAMES.map((name) => (
        <PillButton key={name} size="sm" selected={name === CORPUS_NAME} onClick={() => load(name)}>
          {name}
        </PillButton>
      ))}
    </span>
  )
}
