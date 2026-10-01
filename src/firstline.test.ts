// firstline.test.ts — OB-249 (#358): no host restates the shared first line.
//
// WHY THIS EXISTS. Panes docked side by side started their text at four different heights because
// every first row set its own top padding and nothing made them agree. `Pane` now publishes the one
// chosen number (`FIRST_LINE`, 25) and the two pads derived from it, and the item's acceptance test
// says that NO HOST MAY RESTATE 25, 14 OR 2 FOR THIS PURPOSE. That clause cannot be a type, so it is
// this file: the three host places the item names are read as source text and must reach for the
// constant, and nothing outside the two files that own them may declare a copy.
//
// WHAT IS NOT HERE: where the text actually lands. vitest has no layout, so the measuring is
// `tools/studio-spike/browsertest-firstline.mjs`, which opens the panes in a real browser. The
// numbers themselves are pinned beside the code that owns them, in `ds/chrome/pane.test.ts`.
//
// Sits at the top of `src/` because it reads `instruments/` and `studio/`, which `ds/` may not
// import — the same reason `unreachedmodule.test.ts` lives here.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

import mapSource from './instruments/MapView.tsx?raw'
import documentSource from './instruments/DocumentPanel.tsx?raw'
import studioSource from './studio/StudioView.tsx?raw'

const SRC = fileURLToPath(new URL('.', import.meta.url))

/** every non-test source file under src/, as a posix-style relative path and its text */
const sources: { path: string; text: string }[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) { walk(full); continue }
    if (!/\.(ts|tsx)$/.test(name.name) || /\.test\.(ts|tsx)$/.test(name.name)) continue
    sources.push({ path: relative(SRC, full).split(sep).join('/'), text: readFileSync(full, 'utf8') })
  }
}
walk(SRC)

describe('OB-249 — no host restates the shared first line', () => {
  it('the map\'s breadcrumb bar pads its top with FIRST_ROW_PAD itself, not a pixel off it', () => {
    expect(mapSource).toContain("padding: FIRST_ROW_PAD + 'px var(--space-3) 5px'")
    // the old code wrote the subtraction in parentheses; the comment above the bar quotes it without
    // them, and the raw import includes comments, so the pattern is the code shape only
    expect(mapSource).not.toMatch(/\(FIRST_ROW_PAD\s*-\s*1\)/)
  })

  it('the palette\'s presets block pads its top with FIRST_SCROLL_PAD, not the old pt-2', () => {
    expect(studioSource).toContain('style={{ paddingTop: FIRST_SCROLL_PAD }}')
    expect(studioSource).not.toContain('border-hair p-3 pt-2')
  })

  it('the document\'s closed Relations button sits at FIRST_ROW_PAD, not a restated 14', () => {
    expect(documentSource).toContain("margin: FIRST_ROW_PAD + 'px var(--space-3) 0 0'")
    expect(documentSource).not.toContain("margin: '14px")
  })

  it('the four constants are declared in exactly the two files that own them', () => {
    const OWNERS: Record<string, string> = {
      FIRST_LINE: 'ds/chrome/Pane.tsx',
      FIRST_ROW_PAD: 'ds/chrome/Pane.tsx',
      FIRST_SCROLL_PAD: 'ds/chrome/Pane.tsx',
      LEGEND_ROW: 'ds/chrome/PaneHeader.tsx',
    }
    // a self-check, so a walk that found nothing cannot pass for a clean one
    expect(sources.some((s) => s.path === 'ds/chrome/Pane.tsx')).toBe(true)
    for (const [name, owner] of Object.entries(OWNERS)) {
      const declaredIn = sources
        .filter((s) => new RegExp(`\\b(?:const|let|var)\\s+${name}\\b`).test(s.text))
        .map((s) => s.path)
      expect(declaredIn, `${name} must be declared once, in ${owner}`).toEqual([owner])
    }
  })
})
