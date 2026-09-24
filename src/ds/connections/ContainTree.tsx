import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'

import { wrapTip } from '../chrome/IconButton'
import { FAMILY_SLOTS, nestedFamilyPaint, topicPaint } from '../graph/DomainDot'
import { Caret } from '../nav/TreeRow'

/** a node of the containment tree this component draws. The host owns the shape of its corpus;
 *  this is the projection of it the tree reads — an id, a name, and what is inside. */
export interface ContainNode {
  id: string
  title: string
  /** THIS NODE'S OWN TOPIC — a domain code or ring hue name. Its pill's border is this topic's
   *  colour, the same value the map's territory draws. Omit it and the node inherits its nearest
   *  ancestor's (the tree-level `domain` at the root), which is the right reading for a corpus
   *  where only containers carry a topic. A host that HAS a per-node topic and does not pass it
   *  gets a single-coloured column — the fault reported on the running app, DS OB-174. */
  domain?: string
  /** the same field under the newer name; `domain` wins if both are given */
  topic?: string
  /** true ONLY for the corpus's own root — the one node with no topic of its own, because it
   *  contains every topic. Distinct from a pill's `focus` (the top of whatever tree THIS pane
   *  shows, which a re-rooted subtree still carries with a real topic): this flag says the
   *  node is colourless, not merely that it heads the column (owner, 2026-09-15). */
  root?: boolean
  children?: ContainNode[]
}

/** which nodes are open, keyed by id. A truthy value is open; a MISSING key is closed, and the
 *  distinction matters — the subtree shortcut deletes keys rather than setting them false. */
export type OpenMap = Record<string, unknown>

/** THE CONTAINS TREE'S GEOMETRY, published rather than described. `indent` is a level's step in
 *  the wide layout, `indentCompact` in the compact one (scaled by the pill scale); `caretBox` is
 *  the caret's HIT target — the drawn glyph is smaller, and the negative margins inside the pill
 *  keep that hit box from inflating the pill's own height. */
export const CONTAIN_METRICS = { indent: 12, indentCompact: 6, guide: 1, caretBox: 22 } as const

/** IS THIS POINTER EVENT INSIDE A CARET? The caret owns "one level"; the row owns "whole subtree"
 *  on double-click. Handed back as the TEST rather than as the rule, because the rule is one a
 *  host re-implementing the tree gets wrong silently: `stopPropagation` on the caret's CLICK does
 *  not stop the SEPARATE dblclick that bubbles after it, so a row-level dblclick handler fires
 *  inside the caret unless it asks this first. Reads `[data-caret]` — the 22px hit box, not the
 *  drawn glyph — so the carve-out is the whole target a pointer can hit. */
export function CaretHit(e: { target?: EventTarget | null } | null | undefined): boolean {
  const t = e && (e.target as Element | null)
  return !!(t && typeof t.closest === 'function' && t.closest('[data-caret]'))
}

/** every node beneath `node`, itself excluded */
export function subtreeCount(node: ContainNode): number {
  let n = 0
  for (const c of node.children || []) n += 1 + subtreeCount(c)
  return n
}

/** THE CONTAINS COLUMN'S STATISTICS NOTE AS A CALL, NOT A RECIPE — "2 nodes" alone undercounts a
 *  tree with grandchildren, so the total appears ONLY when it says something the direct count
 *  does not (i.e. there is nesting to report). This is the NOTE under the column's header
 *  ("Contains"), the same register as a pill's own "N nodes" line: the header carries the word,
 *  this carries the numbers. Recomputing it at a call site is how the two counts drift. */
export function containsSummary(root: ContainNode): string {
  const direct = root.children ? root.children.length : 0
  const total = subtreeCount(root)
  if (total > direct) return total + ' total · ' + direct + ' direct node' + (direct === 1 ? '' : 's')
  return direct + ' node' + (direct === 1 ? '' : 's')
}

function subtreeIds(n: ContainNode): string[] {
  let ids = [n.id]
  for (const c of n.children || []) ids = ids.concat(subtreeIds(c))
  return ids
}
function markOpenDeep(n: ContainNode, m: Record<string, unknown>) {
  if (n.children && n.children.length) {
    m[n.id] = 1
    n.children.forEach((c) => markOpenDeep(c, m))
  }
}
/* SEARCH prunes to matching nodes plus the ancestors that lead to them — an ancestor with no
   match of its own still has to render, or the hierarchy around a hit makes no sense. Every node
   left in the pruned tree is force-opened, since by construction each one either matches or sits
   on the path to one. */
function filterTree(node: ContainNode, q: string): ContainNode | null {
  const lower = q.toLowerCase()
  const kids = (node.children || []).map((c) => filterTree(c, lower)).filter(Boolean) as ContainNode[]
  const selfMatch = node.title.toLowerCase().indexOf(lower) >= 0
  if (!selfMatch && !kids.length) return null
  return { ...node, children: node.children ? kids : undefined }
}
function collectIds(node: ContainNode, set: Set<string>): Set<string> {
  set.add(node.id)
  for (const c of node.children || []) collectIds(c, set)
  return set
}

/** one pill's resolved border: which topic it belongs to, that topic's hue, which slot of the
 *  family ladder it took, and the stroke to draw. `ContainPill` takes an entry whole as `paint`. */
export interface ContainPaintEntry {
  /** the topic this node resolved to — its own, or the nearest ancestor's */
  topic?: string
  /** the ring hue that topic maps to, or null when the code does not resolve */
  hue: string | null
  /** which step of the family ladder this pill took. 0 is the topic's TRUE colour */
  slot: number
  /** the border colour to draw */
  stroke: string
}

/** EVERY PILL'S BORDER COLOUR IN ONE PASS, keyed by node id — a node's OWN topic, never the
 *  tree's. Hand it the root, the tree's fallback `domain`, and `isOpen`; hand each entry to a
 *  `ContainPill` as `paint`.
 *
 *  WHY THIS REPLACED `index % FAMILY_SLOTS` INSIDE THE PILL (DS OB-174). The old resolver graded
 *  ONE tree-level `domain` by sibling position, so every pill in the column drew the same family
 *  and the whole contains tree read as one colour — owner-reported on the running app, on a tree
 *  whose nodes each belong to a different topic on the map. The data was already arriving:
 *  `node.domain` was read one line away for the hover preview and dropped for the border.
 *
 *  A NODE WHOSE HUE IS NOT ITS NEIGHBOUR'S DRAWS ITS TRUE TOPIC COLOUR — slot 0, `topicPaint`,
 *  the same value the map's territory uses. The family ladder is spent only where it is needed: a
 *  run of pills sharing one hue steps down one slot per pill, so two pills that TOUCH are never
 *  the same shade.
 *
 *  THE WALK IS IN VISIBLE ORDER, and a closed node's children are skipped — a hidden pill touches
 *  nothing. That is what makes deriving the slot safe here and NOT on a map: a tree stacks its
 *  pills in one column, so the only pill that touches this one is the one drawn immediately
 *  before it. On a map, who touches whom is geometry, and the host must call `familySlots()`.
 *
 *  An unresolvable topic keeps the anchor fallback at slot 0 rather than being graded into a
 *  family it has no hue for. */
export function ContainPaint(
  root: ContainNode | null | undefined,
  { domain, isOpen }: { domain?: string; isOpen?: (node: ContainNode) => boolean } = {},
): Record<string, ContainPaintEntry> {
  const map: Record<string, ContainPaintEntry> = {}
  if (!root) return map
  let prevHue: string | null = null
  let prevSlot = 0
  const visit = (node: ContainNode, inherited?: string) => {
    const topic = node.domain || node.topic || inherited
    const flat = topicPaint(topic)
    const hue = flat.hue
    const slot = hue && hue === prevHue ? (prevSlot + 1) % FAMILY_SLOTS : 0
    map[node.id] = { topic, hue, slot, stroke: slot ? nestedFamilyPaint(topic, { slot }).stroke : flat.stroke }
    prevHue = hue
    prevSlot = slot
    const kids = node.children || []
    if (kids.length && (!isOpen || isOpen(node))) kids.forEach((c) => visit(c, topic))
  }
  visit(root, domain)
  return map
}

/** THE PATH FROM A TREE'S ROOT DOWN TO `id`, inclusive at both ends — the breadcrumb's input and
 *  the via-children walk's anchor. Null when `id` is not in the tree, so a selection that left
 *  the containment tree renders as a lone pill and never as the stale previous tree. */
export function findTreePath(node: ContainNode, id: string, trail?: ContainNode[]): ContainNode[] | null {
  const path = trail ? trail.concat([node]) : [node]
  if (node.id === id) return path
  if (!node.children) return null
  for (const c of node.children) {
    const found = findTreePath(c, id, path)
    if (found) return found
  }
  return null
}

/** THE ANCESTORS OF `id` AS AN OPEN MAP, AND THE TARGET ITSELF IS NEVER IN IT (DS OB-198). This is
 *  the force-open set a host needs as the selection moves: the path down to where you stand has to
 *  be open, or the column shows a tree with nothing highlighted in it — the one state a "you are
 *  here" column may not be in. `{}` when `id` is not in the tree.
 *
 *  A FORCE-OPEN MAP THAT CONTAINS ITS OWN TARGET MAKES THAT NODE'S CARET INERT, and that is why this
 *  is a function rather than a sentence in a contract. Merge an INCLUSIVE corpus path (which is what
 *  `pathTo()` returns) into a host-owned open map and the selected node is re-forced open on every
 *  render: the toggle lands, the next render undoes it, and the one pill the person is looking at is
 *  the one pill they cannot collapse. Owner-reported on the running app (2026-09-16), FIRST against
 *  the root row, because the root is on every path and was therefore inert whatever was selected.
 *
 *  THE PATH STILL WINS OVER A USER'S CLOSED ANCESTOR, AND THERE ARE TWO WAYS TO SPEND THAT, one
 *  of which the owner reported on 2026-09-20. Spreading this over the host's map ON EVERY RENDER
 *  (`{ ...userOpen, ...OpenAncestors(tree, id) }`) keeps the selection visible and makes every
 *  ANCESTOR of it inert for as long as it stays selected: the toggle lands, the next render
 *  undoes it, and the report is "after I select a node I cannot collapse the tree for a while" —
 *  the while being until something else is selected. **Prefer `OpenOnSelect`, merged ONCE when
 *  the selection changes.** Per-render spreading is still correct where the open set is not the
 *  user's to keep (a driver, a printout, a view that recomputes from scratch each time). What
 *  must never be forced per render is any caret a person can reach.
 *
 *  NOT PORTED: the DS's `ContainMath` alias, which exists so a specimen card can reach lower-case
 *  helpers through `window.<Namespace>`. This app imports the named functions, as the DS's own
 *  contract tells application code to. */
export function OpenAncestors(tree: ContainNode | null | undefined, id: string): Record<string, 1> {
  const m: Record<string, 1> = {}
  const path = tree ? findTreePath(tree, id) : null
  if (!path) return m
  path.slice(0, -1).forEach((n) => { m[n.id] = 1 })
  return m
}

/** WHAT TO OPEN WHEN A SELECTION CHANGES: every ancestor of the node, AND THE NODE ITSELF.
 *  Merge it into the host's own open map ONCE, in response to the selection changing — never
 *  spread it over that map per render.
 *
 *  TWO OWNER REPORTS ON ONE DAY MEET HERE (2026-09-20). "After I select a node I cannot
 *  collapse/expand the nodes in the tree for a while" is the per-render spread of
 *  `OpenAncestors`: the path is re-forced on every render, so every ancestor of the selected
 *  node springs back open the instant it is collapsed. "When I select a node, expand its nodes
 *  as well" asks for the opposite of that rule's other half. A ONE-SHOT resolves both, and it is
 *  why the shape matters more than the contents: applied once, opening the target's own
 *  disclosure costs nothing — the caret is a working control again the moment the fold is done,
 *  and closing it stays closed. Applied per render, the SAME map is the inert-caret fault twice
 *  over.
 *
 *  A selection that does not move does not re-fold, which is deliberate: re-selecting the node
 *  you are already on should not re-open what you have since closed. */
export function OpenOnSelect(tree: ContainNode | null | undefined, id: string): Record<string, 1> {
  const m = OpenAncestors(tree, id)
  if (id) m[id] = 1
  return m
}

/** THE OPEN SET FOR A WHOLE VIEW — every ancestor of every node in `ids`, THE NODES THEMSELVES
 *  EXCLUDED, merged (OB-232). Published for the Explorer rail, whose tree has to follow what the
 *  MAP is showing: as the map zooms or refocuses it hands down the ids it draws, and the column
 *  opens far enough to contain them.
 *
 *  IT IS THE FOLD OF `OpenAncestors`, AND IT IS PUBLISHED BECAUSE THE EXCLUSION IS THE SUBTLE
 *  PART — the same `slice(0, -1)` that rule already turns on. A host folding an INCLUSIVE path
 *  over a list re-forces every visible container open on every render, so a user who collapses
 *  one sees it spring back, and the caret becomes a control that does nothing. One node getting
 *  that wrong is a reported bug; a whole view getting it wrong looks like the tree ignoring the
 *  pointer.
 *
 *  WHAT IT DOES NOT DO, deliberately: it does not CLOSE anything. It answers "what must be open",
 *  and the host merges it over the user's own map (`{ ...userOpen, ...OpenForVisible(...) }`), so
 *  a collapse elsewhere in the tree survives a pan. A host that wants the column to contract as
 *  the map narrows replaces its open map with this result instead of merging — that is a
 *  different product decision, not a different function, and it throws the user's own
 *  disclosures away. */
export function OpenForVisible(tree: ContainNode | null | undefined, ids: string[]): Record<string, 1> {
  const m: Record<string, 1> = {}
  if (!tree || !ids) return m
  for (const id of ids) {
    const path = findTreePath(tree, id)
    if (!path) continue
    for (let i = 0; i < path.length - 1; i++) m[path[i].id] = 1
  }
  return m
}

/** ROVING KEYBOARD NAV over whatever pills are CURRENTLY visible — it reads the DOM instead of
 *  re-deriving the flattened list, so it stays correct across filtering and expand state for
 *  free. Wire it to the scroll container's own `onKeyDown` (the container takes `tabIndex={0}`
 *  and `data-selected-id`); each row's click handler already carries its node, so moving the
 *  selection is finding the row and clicking it. Arrow up/down move, right/left open and close
 *  one level, Enter toggles. */
export function treeKeyNav(e: ReactKeyboardEvent, containerEl: HTMLElement | null) {
  if (!containerEl) return
  if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return
  const nav: Record<string, 1> = { ArrowDown: 1, ArrowUp: 1, ArrowRight: 1, ArrowLeft: 1, Enter: 1 }
  if (!nav[e.key]) return
  e.preventDefault()
  const rows = Array.from(containerEl.querySelectorAll<HTMLElement>('[data-node-id]'))
  if (!rows.length) return
  const activeId = containerEl.getAttribute('data-selected-id')
  const idx = rows.findIndex((r) => r.getAttribute('data-node-id') === activeId)
  if (e.key === 'ArrowDown') rows[idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1)].click()
  else if (e.key === 'ArrowUp') rows[idx < 0 ? 0 : Math.max(0, idx - 1)].click()
  else {
    const row = rows[Math.max(idx, 0)]
    const isOpen = row && row.getAttribute('data-open') === '1'
    const caret = row && row.querySelector<HTMLElement>('[data-caret]')
    if (!caret) return
    if (e.key === 'ArrowRight' && !isOpen) caret.click()
    else if (e.key === 'ArrowLeft' && isOpen) caret.click()
    else if (e.key === 'Enter') caret.click()
  }
}

/** THE PILL IS THE COUNT'S CONTAINER: a bordered box with the title on top and "N nodes" as a
 *  second line inside the same border — not text sitting beside a chip, since `NodeChip` has no
 *  second line to give it. The border colour is resolved HERE and never by the caller: depth 0
 *  reads `topicPaint(domain).stroke`, and a nested node reads
 *  `nestedFamilyPaint(domain, { slot }).stroke` — the same family ladder the map's territories
 *  use, so the pane and the map tell one colour story.
 *
 *  THE SLOT IS DERIVED HERE FROM `index`, deliberately, and this is the one place that is safe to
 *  do it: a tree stacks its siblings in a column, so the only pairs that touch are consecutive
 *  ones, and `index % FAMILY_SLOTS` can never give two touching pills the same slot. A MAP cannot
 *  do this — there, which regions touch is geometry, and the host must call `familySlots()` with
 *  its own adjacency. A caller here still passes position; it never passes a colour. */
export interface ContainPillProps {
  /** the node's name */
  title: string
  /** the topic hue this pill's family is drawn from — a ring name or an example-palette code.
   *  Only read when no `paint` is given */
  domain?: string
  /** the entry `ContainPaint` returned for this node — pass it whole, never a colour. Inside a
   *  tree this is always given; without it the pill falls back to resolving a family from
   *  `domain` + `index`, which is a STANDALONE SPECIMEN shape only, because a lone pill has no
   *  visible neighbour to grade itself against */
  paint?: ContainPaintEntry
  /** how deep this node sits. 0 takes the topic's own stroke; anything below takes a family slot */
  depth?: number
  /** this node's position among its SIBLINGS — the slot input, never a colour */
  index?: number
  /** how many siblings there are. Carried for the caller's symmetry; the slot ladder wraps
   *  on `FAMILY_SLOTS` and does not read it */
  of?: number
  /** the tree's own root — bold, the thing the column is about */
  focus?: boolean
  /** THE CORPUS'S OWN ROOT (owner, 2026-09-15) — colourless: the border draws the system's
   *  neutral boundary token instead of a topic's stroke, because this node has no topic of
   *  its own. Distinct from `focus`, which a re-rooted subtree's own top row also carries
   *  while still owning a real topic colour. See `DomainDot`'s `root` for the same
   *  distinction drawn as a hollow ring rather than a bordered pill. */
  root?: boolean
  /** the second line inside the border, the pill's own "N nodes" */
  note?: string
  /** draw a disclosure caret. The pill reserves its 22px hit box; `open` says which way it points */
  caret?: boolean
  /** which way the caret points — down when open, right when closed */
  open?: boolean
  /** this is the node the relations column is aimed at: primary wash and ink */
  selected?: boolean
  /** the pointer is on this node HERE or somewhere else in the pane — a face wash, no ring */
  hovered?: boolean
  /** draw as TEXT, not a pill: no border and no raised fill, at rest or selected (owner,
   *  2026-09-22; the tree passes it for every node with NO CHILDREN — only a container is a
   *  pill). A selected bare row is the accent wash plus bold accent ink and nothing else, and the
   *  border does not come back on select. The border stays in the box as `transparent`, so a bare
   *  row is exactly a pill's size and titles line up — dropping it to save the pixel is the fault
   *  clause 4 of the item measures. What is given up, deliberately: a leaf no longer shows its
   *  topic colour at rest */
  bare?: boolean
  /** one level of disclosure. Stops its own propagation so it never also fires the row's select */
  onCaretClick?: (e: ReactMouseEvent) => void
  /** the dense column form: 11px, full width, scaled padding. The wide form is inline-flex */
  compact?: boolean
  /** the compact form's own scale, driven by how wide the column has been dragged */
  scale?: number
}

export function ContainPill({ title, domain, paint, depth = 0, index = 0, focus, note, caret, open, selected, hovered, bare, onCaretClick, compact, scale = 1, root }: ContainPillProps) {
  const stroke = root ? 'var(--border-rule)' : paint ? paint.stroke : (depth ? nestedFamilyPaint(domain, { slot: index % FAMILY_SLOTS }).stroke : topicPaint(domain).stroke)
  /* `bare` HIDES the border rather than removing it — `transparent` at the same width — so a
     leaf's title starts at the same x as its container siblings' and the row is the same height.
     The rest fill goes too; hover and selected are untouched, because selection never lived in
     the border (see the prop's doc). */
  const edge = bare ? 'transparent' : stroke
  const rest = bare ? 'transparent' : 'var(--surface-raised)'
  const s = compact ? scale : 1
  const B = CONTAIN_METRICS.caretBox
  return (
    <div style={{
      display: compact ? 'flex' : 'inline-flex', width: compact ? '100%' : undefined,
      flex: compact ? '1 1 auto' : undefined, boxSizing: 'border-box', flexDirection: 'column', gap: 1,
      border: (compact ? 1 : 1.5) + 'px solid ' + edge, borderRadius: 'var(--radius-md)',
      padding: compact ? (2 * s) + 'px ' + (6 * s) + 'px' : '4px 11px',
      background: selected ? 'var(--accent-primary-wash)' : (hovered ? 'var(--surface-hover)' : rest),
      minWidth: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 6, minWidth: 0 }}>
        {caret ? (
          /* the negative margins pull the 22px HIT box back inside the pill's own line, so a
             comfortable target costs no row height */
          <span onClick={onCaretClick} data-caret="1" style={{
            color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, cursor: onCaretClick ? 'pointer' : undefined, width: B, height: B,
            margin: '-7px -7px -7px -10px',
          }}>
            <Caret open={open} />
          </span>
        ) : null}
        <span data-pill-title="1" style={{
          fontSize: compact ? 11 : 'var(--fs-body)',
          fontWeight: (focus || selected) ? 'var(--fw-bold)' : 'var(--fw-medium)',
          color: selected ? 'var(--accent-primary-ink)' : 'var(--text-1)', lineHeight: 1.25,
          ...(compact ? { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', minWidth: 0 } : {}),
        }}>{title}</span>
      </span>
      {note ? (
        <span style={{ fontSize: compact ? 8 : 10, color: 'var(--text-3)', lineHeight: 1.25, marginLeft: caret ? (compact ? 10 : 12) : 0 }}>{note}</span>
      ) : null}
    </div>
  )
}

function useOpenState(persistKey: string | null | undefined, fallback: OpenMap): [OpenMap, (fn: OpenMap | ((o: OpenMap) => OpenMap)) => void] {
  const [open, setOpen] = useState<OpenMap>(() => {
    if (persistKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(persistKey) || 'null')
        if (saved && typeof saved === 'object') return saved as OpenMap
      } catch { /* a corrupt or unreadable entry is the same as no entry */ }
    }
    return fallback || {}
  })
  useEffect(() => { if (persistKey) localStorage.setItem(persistKey, JSON.stringify(open)) }, [persistKey, open])
  return [open, setOpen]
}

function ContainRow({ node, domain, paint, counts, open, setOpen, isRoot, compact, scale = 1, selectedId, hoveredId, onSelect, deselectable, onNodeEnter, onNodeLeave, onRowHover, forceOpenIds, depth = 0, index = 0 }: {
  node: ContainNode
  domain?: string
  paint?: Record<string, ContainPaintEntry>
  counts?: 'hover' | 'pill'
  open: OpenMap
  setOpen: (fn: OpenMap | ((o: OpenMap) => OpenMap)) => void
  isRoot?: boolean
  compact?: boolean
  scale?: number
  /** widened to `| null` alongside `ContainTreeProps.selectedId` (DS OB-198) — a recursive prop,
   *  so ContainRow has to accept whatever the tree's own public contract accepts */
  selectedId?: string | null
  hoveredId?: string | null
  onSelect?: (node: { id: string; title: string; domain?: string } | null) => void
  /** granted by the host — see `ContainTreeProps.deselectable`. A recursive prop, so it travels */
  deselectable?: boolean
  onNodeEnter?: (e: ReactMouseEvent, node: ContainNode) => void
  onNodeLeave?: () => void
  /** the tree's own hover tracking, present only while the hover is UNCONTROLLED — see
   *  `ContainTreeProps.hoveredId`'s three states. The host's `onNodeEnter`/`onNodeLeave` are
   *  called IN ADDITION to this, never instead of it (DS OB-225) */
  onRowHover?: (id: string | null) => void
  forceOpenIds?: Set<string>
  depth?: number
  index?: number
}) {
  const kids = node.children
  /* WHAT A NODE IS, AND HOW MANY OF ITS CHILDREN ARE DRAWN, ARE TWO QUESTIONS. `isContainer`
     reads the node's own shape — the key's presence — because `filterTree` prunes a container's
     children WITHOUT turning it into a leaf (`children: []`) while a leaf never carries the key
     at all. `hasKids` stays the count of what is on screen. Reading pill-ness from `hasKids`
     drew a container filtered down to its own title as plain text — no border, no caret
     (reviewer-measured on #372, 2026-09-24: filtering to "Computer Systems" stripped exactly
     that). Filtering does not change what a node IS. */
  const isContainer = !!kids
  const hasKids = !!(kids && kids.length)
  const isOpen = forceOpenIds ? forceOpenIds.has(node.id) : !!open[node.id]
  /* THE COUNT IS A SECOND LINE ONLY WHEN THE HOST ASKS FOR ONE (DS OB-174, the owner's own
     second ask). By default it is not on the pill at all: "2 nodes" doubled the height of EVERY
     container row for a number that is furniture at rest. The caret already says a node has
     children, and how many is a thing you go and ask for. It is answered on hover instead — the
     host's preview card carries `containsSummary(node)`, the fuller reading with totals — and by
     the pill's own native tooltip when the host draws no preview. NEVER BOTH: the tooltip is
     suppressed the moment an `onNodeEnter` exists, because two answers to one question in the
     same gesture is worse than either. */
  const note = counts === 'pill' && hasKids ? kids!.length + ' node' + (kids!.length === 1 ? '' : 's') : undefined
  const nativeTip = counts !== 'pill' && hasKids && !onNodeEnter ? containsSummary(node) : undefined
  /* CLICKING THE SELECTED ROW CLEARS THE SELECTION when the host grants `deselectable`, and
     `onSelect` is then called with NULL. Owner-reported 2026-09-20: a tree you can select in and
     not out of leaves the user hunting for an empty patch to click, and there is none — every
     pixel of a row belongs to a node. It is a CAPABILITY, not a state, so it is off by default:
     a host whose selection can never be empty (a document pane must read something) would be
     handed a null it has nowhere to put, and absent is the honest way to say "this tree's
     selection is mandatory". */
  const onClick = onSelect ? (e: ReactMouseEvent) => { e.stopPropagation(); if (deselectable && selectedId === node.id) { onSelect(null); return } onSelect({ id: node.id, title: node.title, domain }) } : undefined
  /* double-click expands the node AND every descendant; double-click again contracts the whole
     subtree — the tree's own shortcut, like a folder tree. The caret stays one level.
     THE CARET IS CARVED OUT OF THE GESTURE. `onCaretClick` stops CLICK propagation, but dblclick
     is a SEPARATE event that bubbles on its own, so without this guard a double-click inside the
     caret's 22px hit box ran two one-level toggles AND the subtree shortcut. The caret means
     "this level only" everywhere in the system; two clicks on it are two level toggles and
     nothing more. The test is published as `CaretHit` so a host re-implementing the tree asks
     the same question instead of re-deriving it. */
  const onDbl = isContainer
    ? (e: ReactMouseEvent) => {
        if (CaretHit(e)) { e.stopPropagation(); return }
        e.stopPropagation()
        setOpen((o) => {
          const m = { ...o }
          if (isOpen) subtreeIds(node).forEach((id) => { delete m[id] })
          else markOpenDeep(node, m)
          return m
        })
      }
    : undefined
  /* the caret behaves exactly as it does everywhere else in this system — one level, and it
     stops propagation so it never also fires the row's select. `TreeRow`'s own rule. */
  const onCaretClick = isContainer
    ? (e: ReactMouseEvent) => {
        e.stopPropagation()
        setOpen((o) => {
          const m = { ...o }
          if (isOpen) delete m[node.id]
          else m[node.id] = 1
          return m
        })
      }
    : undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        onClick={onClick} onDoubleClick={onDbl}
        /* ATTACHED UNCONDITIONALLY, and they call the host's handlers IN ADDITION to the tree's
           own tracking — not instead of it. They used to be attached only when `onNodeEnter` was
           passed, which is what made the wash a capability the host had to grant (DS OB-225). */
        onMouseEnter={(e) => { if (onRowHover) onRowHover(node.id); if (onNodeEnter) onNodeEnter(e, node) }}
        onMouseLeave={() => { if (onRowHover) onRowHover(null); if (onNodeLeave) onNodeLeave() }}
        data-node-id={node.id} data-open={isOpen ? '1' : '0'} title={nativeTip ? wrapTip(nativeTip) : undefined}
        style={{ position: 'relative', padding: compact ? '4px 0' : '6px 0', display: 'flex', cursor: onSelect ? 'pointer' : 'default', userSelect: 'none' }}
      >
        <ContainPill
          title={node.title} domain={domain} paint={paint ? paint[node.id] : undefined} depth={depth} index={index} focus={isRoot} root={node.root} note={note}
          caret={isContainer} open={isOpen} compact={compact} scale={scale}
          selected={!!onSelect && selectedId === node.id} hovered={hoveredId === node.id} bare={!isContainer}
          onCaretClick={onCaretClick}
        />
      </div>
      {hasKids && isOpen ? (
        <div style={{
          marginLeft: compact ? CONTAIN_METRICS.indentCompact * scale : CONTAIN_METRICS.indent,
          borderLeft: CONTAIN_METRICS.guide + 'px solid var(--border-hair)',
          paddingLeft: compact ? 4 * scale : 8, display: 'flex', flexDirection: 'column',
        }}>
          {kids!.map((c, i) => (
            <ContainRow
              key={c.id} node={c} domain={domain} paint={paint} counts={counts} open={open} setOpen={setOpen} compact={compact} scale={scale}
              selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} deselectable={deselectable}
              onNodeEnter={onNodeEnter} onNodeLeave={onNodeLeave} onRowHover={onRowHover} forceOpenIds={forceOpenIds}
              depth={depth + 1} index={i}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** THE CONTAINMENT TREE AS PILLS — one `ContainPill` per node, indented under a hairline guide.
 *  Click selects (the host decides what selection MEANS — in the connections pane it re-aims the
 *  relations column and the map follows), the caret opens one level, double-click opens or closes
 *  the whole subtree. `query` prunes to matches plus their ancestors and force-opens what
 *  survives.
 *
 *  Typed port of the DS components/connections/ContainTree.jsx, OB-101 / #253. */
export interface ContainTreeProps {
  /** the tree to draw. Null draws nothing at all — not an empty frame */
  root?: ContainNode | null
  /** the topic hue for the whole tree; the pills derive their family ladder from it */
  domain?: string
  /** which nodes start open when the tree keeps its own state. Defaults to the root alone */
  defaultOpen?: OpenMap
  /** opt the tree's OWN open state into localStorage, so a reload does not read as the tree
   *  forgetting what you just did. Ignored when `open` is given */
  persistKey?: string | null
  /** CONTROLLED open state — for a host with its own layout store. Pass `onOpenUpdate` with it */
  open?: OpenMap
  /** the controlled setter, receiving an UPDATER and never a resolved map. React's own
   *  `setState` is a legal value and is the intended one */
  onOpenUpdate?: (updater: (prev: OpenMap) => OpenMap) => void
  /** @deprecated the older resolved-map setter. It carries a real fault and is kept only for
   *  callers already on it: resolving the next map here resolves it against the map THIS
   *  render was given, so several caret toggles landing in one React batch all compute from
   *  the same base and only the last survives. Use `onOpenUpdate` */
  onOpenChange?: (next: OpenMap) => void
  /** the node drawn as SELECTED — bold, primary wash. `null`/omitted lights nothing, which is the
   *  state to pass when the user has deselected, even if the host still aims the surrounding pane
   *  at that node (DS OB-198). THE EMPTY STATE DRAWS NO MARK AT ALL — owner-ruled 2026-09-16 over
   *  accent ink on the aimed row, a hairline ring, and a gutter tick. Do not add one back */
  selectedId?: string | null
  /** the node currently hovered, when the HOST is tracking it (it usually is, because it draws
   *  the preview) — paints the pill's hover wash, and a host mirroring a hover published by
   *  another pane passes it for that reason. OMIT IT AND THE TREE WASHES ITS OWN ROW (DS OB-225,
   *  #340): the wash is not a capability a host grants, and it used to be — it was reachable only
   *  through this prop, and coupled to a second one, because the pill's native count tooltip is
   *  drawn only when there is no `onNodeEnter`, so a host with no preview card that wired hover
   *  just to get the wash gave up the count line to do it. THE THREE STATES ARE DISTINCT:
   *  `undefined` = the tree owns the hover, `null` = the host says nothing is hovered, an id =
   *  the host says this one is */
  hoveredId?: string | null
  /** a row was clicked. Omit and the tree is a static picture: no pointer cursor, no selection —
   *  the hover wash is NOT part of that list since OB-225: the wash is the tree's own business, so
   *  a row still lights while the pointer is on it whether or not the tree can be selected in.
   *  A host that granted `deselectable` also receives NULL when a click CLEARS the selection */
  onSelect?: (node: { id: string; title: string; domain?: string } | null) => void
  /** LET A CLICK ON THE ALREADY-SELECTED ROW CLEAR THE SELECTION, reported as `onSelect(null)`.
   *  Off by default. Owner-reported 2026-09-20: a tree you can select in and not out of leaves
   *  the user hunting for empty space to click, and a full-width pill list has none.
   *
   *  IT IS A CAPABILITY, NOT A STATE, so absent and false mean the same thing deliberately: a
   *  pane whose selection can never be empty would be handed a null it has nowhere to put, and
   *  not granting it is how that pane says the selection is mandatory. Granting it obliges the
   *  host to decide what empty MEANS — pass `selectedId={null}` when it happens, or the tree
   *  keeps a pill lit that nobody chose (host obligation 6) */
  deselectable?: boolean
  /** the pointer entered a row — the host's hook for a preview card. Carries the event, because
   *  the card is placed at the pointer rather than at the row */
  onNodeEnter?: (e: ReactMouseEvent, node: ContainNode) => void
  /** the pointer left a row */
  onNodeLeave?: () => void
  /** where a container's node count is drawn. Omitted or `'hover'`: NOT on the pill — the host's
   *  hover preview carries `containsSummary(node)`, or the pill's own native tooltip does when
   *  there is no `onNodeEnter`. `'pill'` restores the second line inside every border, for a host
   *  with no hover surface at all */
  counts?: 'hover' | 'pill'
  /** filter to matching titles plus their ancestors, and force-open what survives. Empty shows all */
  query?: string
  /** the dense column form. The wide form is for a tree standing on its own */
  compact?: boolean
  /** the compact form's scale, driven by the column's dragged width */
  scale?: number
}

export function ContainTree({ root, domain, counts, defaultOpen, persistKey, open: openProp, onOpenUpdate, onOpenChange, selectedId, hoveredId, onSelect, deselectable, onNodeEnter, onNodeLeave, query, compact, scale = 1 }: ContainTreeProps) {
  const [openState, setOpenState] = useOpenState(persistKey, defaultOpen || (root ? { [root.id]: 1 } : {}))
  const open = openProp || openState
  /* THE TREE WASHES ITS OWN ROW WHEN NOBODY ELSE IS TRACKING THE HOVER (DS OB-225, #340). The
     wash was reachable only through `hoveredId`, which the pane supplies because it also draws a
     preview card — and the two were coupled through a second prop: the pill's native count
     tooltip is drawn only when there is no `onNodeEnter`, so a host that wired hover purely to
     get the wash lost the count line by doing so. A rail with no preview surface therefore had
     to choose between a tree that does not respond to the pointer and a tree that cannot say
     how many nodes a container holds (owner-reported on the Explorer rail: "the file explorer
     tree is missing wash on hover"). Hover is the component's own business; `hoveredId` still
     WINS when passed, because a host mirroring a hover from another pane is the case it exists
     for. `undefined` means uncontrolled, and `null` from a host still means nothing hovered. */
  const [selfHover, setSelfHover] = useState<string | null>(null)
  const hot = hoveredId !== undefined ? hoveredId : selfHover
  const onRowHover = hoveredId !== undefined ? undefined : setSelfHover
  /* A CONTROLLED TREE HANDS THE UPDATER STRAIGHT OUT, UNRESOLVED (DS OB-167). Calling
     `fn(open)` here resolves it against the map THIS render was handed, so several caret
     toggles dispatched inside one React batch all compute from the same base and only the
     last survives — a person clicks one caret per render and never sees it, a driver does.
     Found by our own `4b637d1` run and adopted upstream as a contract change rather than a
     footnote, which is why the NAME changed with the meaning instead of the same prop
     quietly starting to mean something else.

     `onOpenChange` keeps the old resolved shape AND the old fault, deprecated. The tree only
     ever calls `setOpen` with a function; the non-function branch exists so the published
     signature stays honest rather than throwing at a caller the type would have allowed. */
  const setOpen: (fn: OpenMap | ((o: OpenMap) => OpenMap)) => void = onOpenUpdate
    ? (fn) => onOpenUpdate(typeof fn === 'function' ? fn : () => fn)
    : onOpenChange
      ? (fn) => onOpenChange(typeof fn === 'function' ? fn(open) : fn)
      : setOpenState
  /* THE PAINT PASS IS MEMOISED ON THE INPUTS IT READS (root, domain, open) — nothing else can
     change its result. The self-owned hover (OB-225) re-renders this component on every row
     enter/leave, and the walk has nothing to do with the hover: without the memo a pointer
     crossing an UNCONTROLLED column re-walked the whole visible tree once per row. The query
     branch below computes its own walk over the filtered tree, so the memo stands down there
     rather than paying for a paint nobody draws. */
  const paint = useMemo(
    () => (!root || query ? undefined : ContainPaint(root, { domain, isOpen: (n) => !!open[n.id] })),
    [root, domain, open, query],
  )
  if (!root) return null
  const common = { domain, counts, open, setOpen, compact, scale, selectedId, hoveredId: hot, onSelect, deselectable, onNodeEnter, onNodeLeave, onRowHover }
  /* THE PAINT PASS IS COMPUTED HERE, NOT PER ROW, because a pill's shade depends on the pill
     drawn immediately ABOVE it — which no row can see on its own. It walks the same open set the
     rows read, so the two never disagree about what is visible. */
  if (query) {
    const filtered = filterTree(root, query)
    if (!filtered) return <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '6px 0' }}>No matches for {query}</div>
    /* a filtered tree is entirely force-open, so the paint pass counts every surviving node */
    return <ContainRow node={filtered} isRoot {...common} paint={ContainPaint(filtered, { domain, isOpen: () => true })} forceOpenIds={collectIds(filtered, new Set())} />
  }
  return <ContainRow node={root} isRoot {...common} paint={paint} />
}
