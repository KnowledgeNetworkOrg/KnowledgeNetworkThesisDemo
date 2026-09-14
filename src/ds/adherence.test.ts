import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// DS HOST RULES — the ones no prop can express.
//
// The Design System ships CHROME WITHOUT BODIES: a pane's hat, a group's frame,
// a chip's face. What goes inside is the host's, so the DS cannot make it right
// — it can only write down what the host must do. Those written rules are the
// only thing standing between us and the defect, and on 2026-08-17 we measured
// how well that works: rule 1 below was written down, read, and still broken in
// 5 of the 6 places we had to obey it. A rule in prose has a compliance rate.
//
// These tests are the machine half. They do not replace the prose — the prose
// explains WHY, which is the part worth keeping — they stop it decaying. Every
// rule here is one the DS states in a `.d.ts` we ported; each test cites it.
//
// Source-scanning rather than rendering: vitest runs `environment: 'node'` with
// no jsdom, and — more to the point — these are rules about what the SOURCE may
// say. A rendering test would need the very layout the rule exists to protect.
// ─────────────────────────────────────────────────────────────────────────────

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** each argument is a repo-relative directory to walk, or a single .tsx file */
function tsxUnder(...paths: string[]): string[] {
  const out: string[] = []
  const walk = (p: string) => {
    if (!statSync(p).isDirectory()) {
      if (p.endsWith('.tsx')) out.push(p)
      return
    }
    for (const e of readdirSync(p, { withFileTypes: true })) walk(join(p, e.name))
  }
  for (const p of paths) walk(join(ROOT, p))
  // A SWEEP THAT SWEPT NOTHING PASSES EVERYTHING. Nine rules in this file end in
  // `expect(...).toEqual([])` over a list this returns, and "no violations" is not a
  // claim about the codebase unless something was actually read. A path that does
  // not exist already throws in `statSync`; this covers the quieter case, a
  // directory that survives a restructure with no .tsx left under it.
  if (!out.length) throw new Error(`tsxUnder(${paths.join(", ")}) matched no .tsx files — every rule scanned over it would pass by reading nothing`)
  return out
}

const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/')

/** blank out comments so a rule's own prose — which necessarily quotes the thing
 *  it bans — is never read as a violation of itself. Replaced with spaces rather
 *  than removed so line numbers survive. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '))
}

type Hit = { file: string; line: number; text: string }

function scan(files: string[], test: (line: string) => string | null): Hit[] {
  const hits: Hit[] = []
  for (const f of files) {
    stripComments(readFileSync(f, 'utf8'))
      .split(/\r?\n/)
      .forEach((line, i) => {
        const t = test(line)
        if (t !== null) hits.push({ file: rel(f), line: i + 1, text: t })
      })
  }
  return hits
}

const show = (hits: Hit[]) => hits.map((h) => `${h.file}:${h.line}  ${h.text}`)

// ─── rule 1 ──────────────────────────────────────────────────────────────────
// PaneHeader.d.ts rule 2: "THE BODY TAKES NO BACKGROUND OF ITS OWN; the pane's
// --surface-paper shows through."
//
// A pane body is the root an instrument returns — StudioView paints the pane
// (--surface-paper, --radius-lg), mounts a PaneHeader on its border, and renders
// `inst.render(bus)` into the box below. So the rule binds every instrument root.
//
// Identifying one WITHOUT a JSX parser: a pane body fills its pane and is
// therefore `h-full`; a floating legend or overlay chip is `absolute`-positioned
// and is not. That single distinction separates the two cleanly across this app —
// every `bg-white/95` chip floating over a canvas is correctly untouched, and it
// SHOULD keep its background: it is not the body, it sits on top of one.
describe('the sweep itself', () => {
  // EVERY RULE IN THIS FILE ENDS IN `expect(...).toEqual([])`, which is also what an
  // empty scan produces. These two make the rest mean something: one proves the
  // scanner refuses to read nothing, the other proves it finds the app when asked.
  it('refuses to scan nothing, so no rule below can pass by reading no files', () => {
    // src/tokens holds the CSS custom-property files and nothing else — a .tsx will
    // never live there, so this stays a stable stand-in for a path gone empty.
    expect(() => tsxUnder('src/tokens')).toThrow(/matched no \.tsx files/)
  })

  it('and does find the app when asked for it', () => {
    expect(tsxUnder('src').length).toBeGreaterThan(20)
  })
})

describe('DS PaneHeader rule 2 — a pane body paints no background', () => {
  // CLEARED by OB-039 (#126). Every debt this list ever carried is now either a
  // PaneScroller/PaneCanvas body with no face of its own (ContoursView,
  // ClustersView, UnfoldGraphView, UnfoldView, WalkView, WalkColumnsView,
  // WalkStackView) or a PaneCanvas with `face="none"`
  // drawing its own field on purpose (MapView's water, #eef4f8 — the one entry
  // that was never really debt, just a rule this scan could not tell apart from
  // it until PaneCanvas existed to say so explicitly). Kept as an empty ratchet
  // rather than deleted: a future instrument re-introducing a painted `h-full`
  // body will show up here again, at 1, not silently.
  const MIGRATION_DEBT: Record<string, number> = {}

  const BG = /\bbg-(?!transparent\b)[a-z]+(?:-\d{2,3})?(?:\/\d+)?\b/
  // an inline `background` counts too. MapView:530 sets one and carries no
  // bg-* class at all — a className-only scan called that pane clean, and only a
  // computed-style read off the running page caught it.
  // the whitespace lives INSIDE the lookahead on purpose: written as `:\s*(?!…)`
  // the `\s*` backtracks to zero, the exclusion is then tested against the space
  // rather than the value, and `background: 'none'` reads as a violation
  const STYLE_BG = /\bbackground(?:Color)?\s*:(?!\s*['"]?(?:none|transparent)\b)/

  const hits = scan(tsxUnder('src/instruments', 'src/studio/instruments.tsx'), (line) => {
    if (!/\bh-full\b/.test(line)) return null
    const m = line.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/)
    const cls = m?.[1] ?? m?.[2] ?? ''
    if (BG.test(cls)) return `${BG.exec(cls)![0]}   in "${cls}"`
    if (STYLE_BG.test(line)) return `inline background   in ${line.trim().slice(0, 90)}`
    return null
  })

  it('an instrument with no recorded debt paints no background', () => {
    expect(show(hits.filter((h) => !(h.file in MIGRATION_DEBT)))).toEqual([])
  })

  // The ratchet: the debt list must shrink as #69 lands, and a file that quietly
  // grows a second violation under an existing allowance is caught here.
  it('the #69 migration debt is exactly as recorded', () => {
    const counted: Record<string, number> = {}
    for (const h of hits) counted[h.file] = (counted[h.file] ?? 0) + 1
    expect(counted).toEqual(MIGRATION_DEBT)
  })
})

// ─── rule 2 ──────────────────────────────────────────────────────────────────
// PaneHeader.d.ts rule 2, second half: "A body that must clip rounds ALL FOUR
// corners at --radius-lg, never the bottom two alone."
//
// The header is 11px tall, so a body that clips starts INSIDE the pane's 20px
// corner arc. Rounding only the bottom leaves the top two corners square and
// bites two notches out of the pane's rounded top. Shipped exactly that way at
// StudioView.tsx:128 until 78af5b4.
describe('DS PaneHeader rule 2 — a clipping body rounds all four corners', () => {
  const files = tsxUnder('src')

  it('no style rounds the bottom corners alone', () => {
    const bad = scan(files, (line) => {
      if (!/borderBottom(?:Left|Right)Radius/.test(line)) return null
      // the top pair (or a blanket borderRadius) must be set on the same element;
      // these are written one-per-line here, so the whole declaration is in view
      return /borderTop(?:Left|Right)Radius|borderRadius\s*:/.test(line) ? null : line.trim()
    })
    expect(show(bad)).toEqual([])
  })

  it('no className rounds the bottom corners alone', () => {
    const bad = scan(files, (line) => {
      const m = line.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/)
      const cls = m?.[1] ?? m?.[2]
      if (!cls || !/\brounded-b(?:-|\b)/.test(cls)) return null
      // drop the bottom-only tokens FIRST: `\brounded\b` matches inside
      // `rounded-b-lg` (the `-` is a word boundary), so testing the raw string
      // would let every violation clear itself
      const rest = cls.replace(/\brounded-b(?:-[a-z0-9[\]().%-]+)?/g, '')
      return /\brounded-t(?:-|\b)|\brounded(?:-(?:none|sm|md|lg|xl|full|\[))?\b/.test(rest) ? null : cls
    })
    expect(show(bad)).toEqual([])
  })
})

// ─── rule 3 ──────────────────────────────────────────────────────────────────
// TreeRow.d.ts, on `caretStyle`: "If you repeat it, repeat the LONGHANDS.
// `caretStyle` sets `borderRight` and `borderBottom` and nothing else. Writing it
// as `border` plus `borderTop: 'none'` looks equivalent and is not: React diffs
// style objects key by key, so a re-render that changes only the shorthand's
// colour re-sets `border` and never re-sets the two sides that were switched off
// — the mark fills in, and the caret becomes a diamond the first time it is
// hovered."
//
// We comply today because we port from the .jsx. This stops a hand-rolled caret
// — or any switched-off border side — from reintroducing it.
describe('DS TreeRow — a switched-off border side needs longhands, not a shorthand', () => {
  it("no element pairs a `border` shorthand with a `border<Side>: 'none'`", () => {
    const bad: Hit[] = []
    for (const f of tsxUnder('src')) {
      const lines = stripComments(readFileSync(f, 'utf8')).split(/\r?\n/)
      lines.forEach((line, i) => {
        if (!/border(?:Top|Right|Bottom|Left)\s*:\s*['"]none['"]/.test(line)) return
        // the shorthand it would fight sits in the same object literal — look at
        // the few lines either side, which is the whole of any style object here
        const near = lines.slice(Math.max(0, i - 6), i + 7).join('\n')
        // `:` then the whitespace inside the lookahead — see STYLE_BG above for why
        if (/\bborder\s*:(?!\s*['"]none['"])/.test(near)) bad.push({ file: rel(f), line: i + 1, text: line.trim() })
      })
    }
    expect(show(bad)).toEqual([])
  })
})

// ─── rule 4 ──────────────────────────────────────────────────────────────────
// OB-062 (design-sync.md), assertion 1: "No hand-assembled palette token. Walk
// src/instruments, src/studio, src/ui and fail on any string matching --hue-,
// --domain- or --edge- outside src/ds. var() on an undefined property is
// TRANSPARENT, so a typo in one of these draws nothing and reports nothing —
// this is the fault class edgeHue() was rewritten to remove, and the test is
// what stops it coming back through a different door."
//
// Every topic/relation colour reaches a view through a DS component
// (DomainDot, NodeChip, EdgeLegend, EdgeEntry, NodeArrow) or a resolver
// (topicPaint/relationPaint/domainToken/edgeHue) — never a literal token
// string. Currently empty by construction; the value is catching the day
// someone reaches past the resolver for a one-off swatch.
describe('OB-062 — the data palette is never a raw token outside src/ds', () => {
  it('no view under src/instruments, src/studio or src/ui names --hue-/--domain-/--edge- directly', () => {
    const hits = scan(tsxUnder('src/instruments', 'src/studio', 'src/ui'), (line) => {
      const m = line.match(/--(?:hue|domain|edge)-[a-z][a-z0-9-]*/i)
      return m ? m[0] : null
    })
    expect(show(hits)).toEqual([])
  })
})

// ─── rule 5 ──────────────────────────────────────────────────────────────────
// OB-062, assertion 2: "No relation drawn in the mark role, and no topic in
// the stroke role. Fail on -stroke reaching a background/fill and on a bare
// --hue-<name> (no suffix) reaching a border-/stroke on an edge component.
// This is the rule that keeps the two data families apart where their hues
// meet, and it is the one topicPaint()/relationPaint() make unnecessary —
// the test catches the sites that have not adopted them yet."
describe('OB-062 — a topic is a filled mark, a relation is a line, and the two never swap', () => {
  it('no -stroke role token reaches a background or fill', () => {
    const hits = scan(tsxUnder('src/ds'), (line) => {
      if (!/--hue-[a-z]+-stroke\b/.test(line)) return null
      if (!/\bbackground(?:Color)?\s*:|\bfill\s*=/.test(line)) return null
      return line.trim().slice(0, 100)
    })
    expect(show(hits)).toEqual([])
  })

  // scoped to the components that draw a RELATION rather than a topic — a
  // topic's own bare mark-role border is correct (NodeChip's `mark="border"`,
  // DomainDot's dot); it is only wrong on the line between two of them.
  it('no bare (mark-role) hue reaches a border or stroke on an edge component', () => {
    const hits = scan(tsxUnder('src/ds/graph/EdgeEntry.tsx', 'src/ds/graph/NodeArrow.tsx', 'src/ds/graph/EdgeLegend.tsx'), (line) => {
      const m = line.match(/--hue-[a-z]+\b(?!-)/)
      if (!m) return null
      if (!/\bborder(?:Color)?\s*:|\bstroke\s*=/.test(line)) return null
      return m[0] + '   in ' + line.trim().slice(0, 90)
    })
    expect(show(hits)).toEqual([])
  })
})

// ─── rule 6 ──────────────────────────────────────────────────────────────────
// OB-062, assertion 3: "Chrome stays under C 0.09. Fail on any oklch()
// literal in a token file whose chroma is above 0.09 unless its custom
// property starts --hue-. Data runs at 0.14-0.15 and that gap is the ONLY
// thing separating a data green from the moss primary; a new chrome colour
// drifting up is invisible in review and unrecoverable once a screen ships
// on it."
//
// Scoped to tokens/colors.css only, not its tailwind/kn-theme.css mirror:
// that file restates every value as a literal BY POLICY (a var() there would
// be circular against Tailwind v4's @theme namespace — see its own header),
// so every data colour is a literal there on purpose and this rule would
// flag the whole ring. colors.css is the source of truth this rule protects;
// --domain-*/--edge-* there are var() references to a --hue-* line, never
// their own literal, so they are outside what this scan even matches.
//
// The two known exceptions named in the obligation (--acorn-500 ~0.098,
// --berry-500 ~0.11) are authored as hex in this file, not oklch(), so they
// never reach this regex — no exclusion list needed for them.
describe('OB-062 — chrome stays under C 0.09 in tokens/colors.css', () => {
  it('every oklch() literal above C 0.09 is a --hue- token', () => {
    const src = readFileSync(join(ROOT, 'src/tokens/colors.css'), 'utf8')
    const bad: string[] = []
    src.split(/\r?\n/).forEach((line, i) => {
      const m = line.match(/(--[a-z0-9-]+)\s*:\s*oklch\(\s*[\d.]+\s+([\d.]+)\s+[\d.]+/i)
      if (!m) return
      const [, prop, chroma] = m
      if (!prop.startsWith('--hue-') && Number(chroma) > 0.09) bad.push(`colors.css:${i + 1}  ${prop}  C ${chroma}`)
    })
    expect(bad).toEqual([])
  })
})

// ─── our side of the contract ────────────────────────────────────────────────
// The failure we keep reporting upstream, pointed the other way. On 2026-08-17
// our VersionedGroup port carried 50 props and 12 doc comments while the DS's
// own .d.ts documented nearly all of them — so `src/ds/`, the file anyone here
// actually opens, was a WORSE manual than the source it was copied from. The
// 38 missing were ported in the same pass that added this test.
//
// The budget is not zero and should not be: the DS leaves the self-explanatory
// props bare too (`title`, `domain`, `onClick`, the min/max sizes), and a prop
// covered by a shared comment above its sibling — "drag bounds: …" over three of
// them — reads as undocumented to this counter and is not. Checked component by
// component against the DS's .d.ts, the remainder is at DS parity. The number is
// a ratchet against silent regression, not a target to drive to 0.
describe('our DS ports document what the DS documents', () => {
  // +4 for NodeRail.tsx (#127): onToggleStop, onToggleRail, onExpandAll and
  // onCollapseAll are bare in the DS's own NodeRail.d.ts too — checked line by
  // line against it, which is DS parity and not new debt.
  // +3 for the re-ported Pane.tsx (#126): PaneCanvasProps.forwardRef,
  // PaneCanvasProps.children and PaneProps.children are bare in the DS's own
  // Pane.d.ts too — same DS-parity reasoning.
  // +12 for the six new chrome marks (OB-064, #55): NewMapMark, PrintMark,
  // SaveMark, LoadMark, CopyMark, PasteMark — each just `size`/`style`, bare in
  // the DS's own .d.ts for every one of them too. Same DS-parity reasoning.
  // -2 (OB-060): re-syncing DomainDot.tsx/EdgeLegend.tsx for the ring palette
  // documented two props that were bare before this port (DomainDotProps.domain,
  // EdgeDashProps.color) — a real improvement, not new debt, so the ratchet moves
  // down rather than getting a new +N line.
  // -1 (OB-063): EdgeEntry.tsx's `type` prop was bare before the relationPaint() port
  // documented it. Same reasoning as the OB-060 line above.
  // -1 (OB-069): StepDot.tsx's `n` prop was bare before the `pin` variant port
  // documented it (now also explaining the range-label case). `onClick` stays bare —
  // the DS's own StepDot.d.ts leaves it bare too, DS parity like the NodeRail/Pane
  // lines above.
  // +4 for the two new chrome marks (OB-070): NewWalkMark, AddNodeMark — each just
  // `size`/`style`, bare in the DS's own .d.ts for both. Same DS-parity reasoning as
  // the six-mark line above.
  // 2026-08-23 (OB-071): +4 for WalkerMark and LocateMark — each just `size`/`style`,
  // bare in the DS's own .d.ts for both (same DS-parity reasoning; `animated` on
  // WalkerMark IS documented here, matching the DS's own doc comment for it).
  // WalkStrip/WalkStep's own props are fully documented — this port added no other
  // undocumented surface.
  // 2026-08-27 (OB-096): +13 for the five new src/ds/map/** ports (MapFloatingButton,
  // ZoomControl, LevelPicker, VisibilityMark, MapTooltip) — every one of these props
  // is bare in the DS's own .d.ts too (checked line by line against each), same
  // DS-parity reasoning as every +N line above: MapFloatingButton's disabled/label/
  // children/onClick, ZoomControl's onZoomIn/onZoomOut/zoomInDisabled/zoomOutDisabled,
  // LevelPicker's onSelect, VisibilityMark's size/style, MapTooltip's kind/relationsOut.
  // 91 -> 88 on 2026-09-05 (OB-110, #256): VersionedGroup's onRetitle / onDescribe / onSelect
  // took the DS's prose with the edit-mode port.
  // 88 -> 87 on 2026-09-06 (OB-101, #253): NodeChip's `domain` was bare here while the DS's own
  // .d.ts documented it, and the connections rehaul had to widen it from the six-code union to
  // `string` anyway — so it took that prose on the way past. Every prop the three new
  // connections components and the two new shared ones (Breadcrumb, CollapseChevron) added is
  // documented, so the rehaul itself moves this number by nothing.
  // 87 -> 84 on 2026-09-14 (OB-153): TrailChip's, TreeRow's and DocHeader's `domain` were bare
  // here while the DS's .d.ts had documented all three since 2026-08-21j — they took that prose
  // when the six-code union was retired and each widened to `string`.
  const BUDGET = 84

  const undocumented: string[] = []
  for (const f of tsxUnder('src/ds')) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (!/^export interface \w+Props\b/.test(lines[i])) continue
      for (let j = i + 1; j < lines.length && !/^\}/.test(lines[j]); j++) {
        const prop = lines[j].match(/^ {2}(\w+)\??:/)
        if (!prop) continue
        const prev = lines[j - 1].trim()
        if (!(prev.endsWith('*/') || prev.startsWith('*') || prev.startsWith('/**'))) {
          undocumented.push(`${rel(f)}:${j + 1}  ${prop[1]}`)
        }
      }
    }
  }

  // An EXACT count, not a ceiling: porting more prose should fail here once and
  // make you lower the number, the same way the barrel test makes adopting a
  // component a deliberate edit rather than a quiet audit miss.
  it(`leaves exactly ${BUDGET} props undocumented across src/ds`, () => {
    expect(undocumented.length, `\n${undocumented.join('\n')}\n`).toBe(BUDGET)
  })
})


// ─── rule 5 ──────────────────────────────────────────────────────────
// IconButton.d.ts: "a native `title` holding a long name draws ONE line the width
// of the screen — the hardest shape there is to read. Fold it at the element that
// sets the attribute." (OB-032 in the DS, OB-034 for the host screens.)
//
// A component port cannot reach this rule: `/design-sync` rewrites `src/ds/**` and
// never opens a screen file, and the screens are exactly where the unbounded
// strings live — a corpus title interpolated into a sentence, a walk's whole
// description. So it is the host's rule, and this is the machine half of it.
//
// A title PROP handed to a DS component is NOT a violation: that one is folded
// inside the component, and `Pane title=` is a pane HEADING rather than a tooltip.
// The two are told apart by the tag name, which is exact rather than a heuristic —
// JSX spells a DOM element lowercase (`button`, `span`) and a component
// capitalised (`PillButton`, `PaneHeader`). So the scan walks back from each
// `title=` to the `<` that opens its tag.
describe('DS IconButton — every tooltip on a DOM element is folded', () => {
  const TREES = ['src/ds', 'src/instruments', 'src/studio', 'src/ui']

  /** the JSX tag whose attribute list contains index `i` */
  function tagAt(src: string, i: number): string | null {
    const open = src.lastIndexOf('<', i)
    if (open < 0) return null
    const m = /^<\s*([A-Za-z][\w.]*)/.exec(src.slice(open, i))
    return m ? m[1] : null
  }

  /** the whole attribute value, brace-matched. Several of these tooltips are
   *  multi-line ternaries, so a fixed-size window would read half a value and
   *  report a folded one as raw. */
  function valueAt(src: string, i: number): string {
    if (src[i] === '"') return src.slice(i, src.indexOf('"', i + 1) + 1)
    let depth = 0
    for (let k = i; k < src.length; k++) {
      if (src[k] === '{') depth++
      else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1)
    }
    return src.slice(i, i + 80)
  }

  const raw: string[] = []
  for (const f of tsxUnder(...TREES)) {
    const src = stripComments(readFileSync(f, 'utf8'))
    // `(?<![-\w])`, NOT a plain word boundary — a HYPHEN IS ONE, so the old pattern matched the tail of
    // `data-pill-title="1"` and reported the DS's own published measurement hook as an unfolded
    // tooltip (2026-09-06, #253). An attribute whose NAME merely ends in "title" is not one.
    for (const m of src.matchAll(/(?<![-\w])title=(["{])/g)) {
      const tag = tagAt(src, m.index)
      if (!tag || tag[0] !== tag[0].toLowerCase()) continue // a prop, not a tooltip
      const value = valueAt(src, m.index + 6)
      // `wrapTip` need not be the OUTERMOST call. A value that only sometimes
      // carries a string folds inside its branch and stays undefined otherwise,
      // which is the right shape rather than a violation.
      if (value.includes('wrapTip(')) continue
      const line = src.slice(0, m.index).split('\n').length
      raw.push(`${rel(f)}:${line}  title=${value.replace(/\s+/g, ' ').slice(0, 70)}`)
    }
  }

  it('sets no raw title= on a DOM element', () => {
    expect(raw).toEqual([])
  })
})
