import { domainToken } from '../graph/DomainDot'

/** The head of a node's document: three different KINDS of string stacked, each
 *  treated as its own kind. `kind` is a category (closed set, the only uppercase
 *  in the app); `title` is a name (verbatim from the corpus, in the domain hue);
 *  `ancestry` is a location (root-first, "/"-joined, never abbreviated). All three
 *  name something real, so none sits at --text-3 — that ink is for the app's own
 *  hints. Typed port of the DS DocHeader.jsx: the title's colour resolves through
 *  `domainToken()`, ring names only. */
export interface DocHeaderProps {
  /** 'topic' | 'container' | 'leaf' — lower case; the component uppercases it */
  kind: string
  title: string
  /** a ring hue name (`'teal'`) — what the corpus stores on a topic (`topicHueOf`); resolved by
   *  `domainToken()`. **Typed `string`**, as the DS's own contract has been since 2026-08-21j: a
   *  closed six-code union was compiled into the adherence lint, and a general corpus passing a
   *  ring hue was reported as an invalid prop (OB-153 retired the union here). The NAME is still
   *  wrong — this is a topic, not a domain — and OB-061 decides the rename on both sides at once. */
  domain: string
  /** containment path, slash-separated, root first */
  ancestry?: string
}

export function DocHeader({ kind, title, domain, ancestry }: DocHeaderProps) {
  /* THE TITLE'S FALLBACK IS THE INK, not the anchor swatch. Every other reader of the palette
     wants a visible dot for an unknown domain; a NAME with no known domain is still a name and
     reads at --text-1, so this one case maps the fallback back to ink. */
  const titleInk = domainToken(domain) === 'var(--swatch-anchor-fallback)' ? 'var(--text-1)' : domainToken(domain)
  return (
    <div style={{ padding: '14px var(--space-5) 12px', borderBottom: '1px solid var(--border-hair)' }}>
      <div
        style={{
          fontSize: 'var(--fs-micro)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-eyebrow)',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--text-2)',
        }}
      >
        {kind}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-head)',
          fontWeight: 'var(--fw-bold)',
          letterSpacing: 'var(--ls-display)',
          lineHeight: 'var(--lh-tight)',
          marginTop: 3,
          color: titleInk,
        }}
      >
        {title}
      </div>
      {ancestry ? <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', marginTop: 5 }}>{ancestry}</div> : null}
    </div>
  )
}
