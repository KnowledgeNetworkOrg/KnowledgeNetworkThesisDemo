// THE HUE RING AND THE SLOT ARITHMETIC, in a plain module (#338 step 4). Split out
// of DomainDot.tsx for the same reason topicvalues.ts was: a model test is a node
// program under tsconfig.node.json, which cannot compile a .tsx import, and the
// model layer must not load the component barrel. DomainDot.tsx imports what it
// renders from here and re-exports every name, so the barrel and every importer
// see one home.

import { GHOST_C, GHOST_L, HUE_DEGREES } from './topicvalues'


/** THE RING, IN HUE ORDER. Sixteen hue names, matching `--hue-<name>` in
 *  tokens/colors.css. This is the READING order — how a person looks at a
 *  palette — and NOT the order hues are handed out in: see `TOPIC_WALK`. */
export const HUE_RING: string[] = ['rose', 'brick', 'clay', 'amber', 'honey', 'olive', 'lime', 'leaf', 'fern', 'jade', 'teal', 'river', 'cobalt', 'iris', 'violet', 'mallow']

/** THE ASSIGNMENT ORDER — indices into `HUE_RING`, and the load-bearing array
 *  of the two. A bit-reversal permutation: the first four topics of a corpus
 *  land 80 degrees or more apart instead of walking round the warm end
 *  together. Assigning by hue order would give a three-topic corpus rose,
 *  brick and clay — three warm reds, which is the fault this palette exists
 *  to fix. Reordering this re-colours every corpus that never overrode a slot
 *  by hand, so treat it as data rather than as a list to tidy.
 *
 *  Sixteen is the honest ceiling of the palette. Past that a corpus wants
 *  grading INSIDE a family rather than a seventeenth stop — `familySlots()` and
 *  `nestedFamilyPaint()` below, which `model/color.ts` feeds with who a region
 *  actually touches (OB-119). */
export const TOPIC_WALK: number[] = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]

/** TOPICS WALK FORWARD, RELATION KINDS WALK BACKWARD, along the one
 *  permutation. So the first EIGHT topics and the first EIGHT relation kinds
 *  of a corpus are hue-disjoint by construction, and the two families meet in
 *  the middle only once both are eight deep; past that they share hues, and
 *  ROLE is the whole of what separates them (a filled mark against a line).
 *  An earlier version started relations four places along the SAME
 *  direction, which reproduced the topic sequence exactly — relation 1 drew
 *  the same clay as topic 5. */
export const RELATION_WALK_REVERSED = true

type HueRole = '' | 'ink' | 'stroke' | 'wash' | 'wash-raised'

/** A ring hue in one of its five roles. `role` is '' (the MARK: a dot, a
 *  1.5px border), 'ink' (a label in the hue, AA on white), 'stroke' (a
 *  hairline; lighter than the mark because a connector is never drawn above
 *  the weight of what it connects), 'wash' (a fill on paper) or
 *  'wash-raised' (the same on a white face, and a step STRONGER — a wash
 *  cannot tint white). */
export function hueToken(name: string, role?: HueRole): string {
  if (!HUE_RING.includes(name)) return 'var(--swatch-anchor-fallback)'
  return `var(--hue-${name}${role ? '-' + role : ''})`
}

/** the nth relation kind's hue name — `TOPIC_WALK` read from the far end */
export function relationHue(n: number): string {
  return HUE_RING[TOPIC_WALK[15 - (((n % 16) + 16) % 16)]]
}

/** the nth topic's hue name, off `TOPIC_WALK`. Wraps: topic 17 shares topic 1's hue, which is
 *  the honest ceiling of the palette rather than a bug to route around — a corpus with more
 *  than sixteen top-level topics wants the arc grading (a family owns a hue, its children take
 *  steps inside its 46deg arc), not a seventeenth slot. */
export function topicHue(n: number): string {
  return HUE_RING[TOPIC_WALK[((n % 16) + 16) % 16]]
}

/** THE NEXT FREE TOPIC HUE, as a call rather than as a sentence. Pass the hue names a corpus has
 *  already used (in any order); get back `{ n, hue }` — the walk position and its hue name.
 *
 *  THE ASSIGNMENT WAS THE LAST THING LEFT IN PROSE, AND IT WAS THE IMPORTANT ONE. `topicHue(n)`
 *  needs an `n` and nothing computed it, so a host was free to assign by corpus index or by
 *  hashing a name — either of which discards the whole point of `TOPIC_WALK`, silently, with
 *  nothing anywhere to report it.
 *
 *  WHAT A HOST STILL OWNS, legitimately: STORAGE. The slot must be written onto the topic when it
 *  is created, not recomputed from position — recompute it and colours shift the moment someone
 *  deletes a sibling or reorders the tree. This function chooses; the host remembers
 *  (`src/model/topichue.ts` is that host, and `GNode.hue` its storage).
 *
 *  Past sixteen it wraps rather than failing, and a wrapped hue is a real answer: a corpus that
 *  deep should be grading inside a family's arc, and returning nothing would only push the caller
 *  into inventing a seventeenth colour. */
export function nextTopicSlot(taken: readonly string[] = []): { n: number; hue: string } {
  const used = new Set(taken)
  for (let n = 0; n < 16; n++) { const hue = topicHue(n); if (!used.has(hue)) return { n, hue } }
  return { n: taken.length % 16, hue: topicHue(taken.length) }
}

/** the fallback is a real answer, not a guard: a topic nobody has a hue for
 *  gets the anchor swatch rather than nothing, so an unknown name draws as a
 *  dot and not as a gap. A RING NAME is the only thing that resolves: the DS's
 *  `.jsx` also accepts its shipped example's six codes (`'net'`, `'sec'`) so
 *  its own cards keep rendering; this app's corpus stores ring names on its
 *  topics (OB-153) and no longer speaks codes, so that branch is not ported —
 *  ★ LOCAL, and the reason is the item's clause (1): nothing in src/ maps a
 *  domain code to a hue. */
export function domainToken(domain?: string | null): string {
  if (!domain) return 'var(--swatch-anchor-fallback)'
  if (HUE_RING.includes(domain)) return `var(--hue-${domain})`
  return 'var(--swatch-anchor-fallback)'
}

/** THE PAINT FOR A TOPIC — every value a caller needs, so no call site
 *  chooses a role. Returns `{ hue, mark, ink, stroke, wash, washRaised, ghost }`.
 *  `hue` is the resolved ring name, or null for an unknown topic (whose
 *  values are all the anchor fallback, so it draws as a grey mark rather
 *  than as nothing).
 *
 *  `stroke` is included deliberately even though a topic does not normally
 *  draw one: a topic's own hairline (a rail's rung, a tree's guide) is the
 *  one case, and leaving it out would send a caller back to assembling a
 *  token name by hand.
 *
 *  `ghost` IS AN OPAQUE COLOUR AND THAT IS THE WHOLE POINT (DS OB-223). It is
 *  the role for a group's name written ACROSS its children — the map's region
 *  heading behind the cells that belong to it. Drawn the obvious way, as the
 *  hue at some alpha over whatever is beneath, it composites differently over
 *  every child and changes value mid-word; the owner's reading of that: "i dont
 *  like how the background text has different shades across different nodes,
 *  that looks weird and it attracts attention to something that should be in
 *  the background" (2026-09-18). So this is ONE resolved value per hue
 *  (`GHOST_L`/`GHOST_C`), painted ABOVE every fill and every selection wash,
 *  never composited through them. A cell name must not depend on it being
 *  light: a name crossing it survives on its paper case (`LabelCut.case`). */
export function topicPaint(topic?: string | null): { hue: string | null; mark: string; ink: string; stroke: string; wash: string; washRaised: string; ghost: string } {
  const hue = topic != null && HUE_RING.includes(topic) ? topic : null
  if (!hue) return { hue: null, mark: 'var(--swatch-anchor-fallback)', ink: 'var(--swatch-ink-fallback)', stroke: 'var(--swatch-anchor-fallback)', wash: 'var(--swatch-fill-fallback)', washRaised: 'var(--swatch-fill-fallback)', ghost: 'var(--swatch-anchor-fallback)' }
  return { hue, mark: `var(--hue-${hue})`, ink: `var(--hue-${hue}-ink)`, stroke: `var(--hue-${hue}-stroke)`, wash: `var(--hue-${hue}-wash)`, washRaised: `var(--hue-${hue}-wash-raised)`, ghost: `oklch(${GHOST_L.toFixed(3)} ${GHOST_C.toFixed(3)} ${HUE_DEGREES[hue].toFixed(1)})` }
}

/* the ring's degrees live in ./topicvalues (a plain module, so the token-pinning test can be a
   node program); imported back here for the shift arithmetic below */

/** the resolved ring name behind a domain code or a bare ring name — the one lookup
 *  `nestedFamilyPaint` needs and every other export already has a different-shaped version of. */
function resolveHueName(domain?: string | null): string | null {
  if (!domain) return null
  return HUE_RING.includes(domain) ? domain : null
}

/** THE NUMBER OF SLOTS A FAMILY GRADES INTO, and five is DERIVED rather than chosen. A map is a
 *  planar graph, so by the four-colour theorem four colours always suffice to give every pair of
 *  TOUCHING regions different ones; the fifth is head-room for a greedy assignment, which is not
 *  guaranteed to find the optimal four-colouring.
 *
 *  WHY THIS MATTERS MORE THAN IT LOOKS. The ladder this replaces had SIX slots, and six is what
 *  forced them close together: spread across one usable range, more slots means smaller gaps, and
 *  the gaps ARE the separation. Measured on the owner's own level-4 cells
 *  (DS `guidelines/level4-family-options.html`, 2026-08-29), five widely-spaced slots beat six
 *  crowded ones by 29% on the worst shared border — 0.0520 against 0.0404 in OKLab ΔE — while
 *  ALSO holding hue inside ±6° of the family instead of wandering ±42°. Adding a sixth slot back
 *  does not add a colour; it shrinks all five gaps. */
export const FAMILY_SLOTS = 5

/** THE SLOT LADDER. Lightness is the separating channel, chroma co-varies with it, and hue barely
 *  moves — that split is the whole design and it is a claim about READING, not about arithmetic:
 *  a person reads a hue difference as A DIFFERENT FAMILY and a lightness/chroma difference as the
 *  same colour, a bit different. So family identity lives in hue and is pinned there; "which of
 *  my neighbours am I not" lives in lightness and chroma, where the difference reads as related.
 *
 *  This is what the owner's level-4 screenshots were showing: amber sits at 65°, the old ladder
 *  allowed ±42°, and 65 + 42 = 107° is `olive` — two ring stops away. Amber's nearest ring
 *  neighbours are only 23° either side (`clay` 42°, `honey` 88°), so a 42° step could not land
 *  anywhere but inside another family's territory. Password Hashing and Digital Signatures were
 *  not misassigned; they were amber plus the largest step the ladder permitted.
 *
 *  Both numbers below are CHOSEN, not derived, and are not to be re-derived: ±6° is the widest
 *  hue nudge that still reads as one family at these chromas, and the L range's floor of 0.720 is
 *  where a territory fill stops reading as a tint. */
const SLOT_L = [0.900, 0.855, 0.810, 0.765, 0.720]
const SLOT_C = [0.050, 0.070, 0.090, 0.110, 0.130]
const SLOT_H = [0, 6, -6, 4, -4]

/** the distance between two slots, in OKLab, computed once. The hue offsets are small enough that
 *  the base hue barely moves this, so it is a constant table rather than a per-family one. */
const SLOT_DIST: number[][] = SLOT_L.map((_, i) => SLOT_L.map((__, j) => {
  const p = [SLOT_L[i], SLOT_C[i] * Math.cos(SLOT_H[i] * Math.PI / 180), SLOT_C[i] * Math.sin(SLOT_H[i] * Math.PI / 180)]
  const q = [SLOT_L[j], SLOT_C[j] * Math.cos(SLOT_H[j] * Math.PI / 180), SLOT_C[j] * Math.sin(SLOT_H[j] * Math.PI / 180)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}))

/** THE SLOT ASSIGNMENT, as a call — the rule that decides which of two touching regions goes
 *  lighter. Hand it one entry per region: `neighbours[i]` is the list of region indices region `i`
 *  SHARES A BORDER WITH, and `family[i]` is that region's lineage family (a domain code or ring
 *  hue name). Get back one slot number per region, ready for `nestedFamilyPaint`.
 *
 *  WHY THIS IS CODE AND NOT A DOCUMENTED RULE, the same reason `nextTopicSlot()` is: a machine
 *  applies it, per region, at runtime, with nobody looking. And it has a specific failure that no
 *  reviewer would ever catch by reading a call site — A GRAPH COLOURING GUARANTEES TWO TOUCHING
 *  REGIONS GET DIFFERENT SLOTS, AND SAYS NOTHING ABOUT HOW FAR APART THE TWO COLOURS ARE. Take
 *  the lowest free slot, as every textbook greedy does, and the assignment crowds into the low
 *  indices; on a real tessellation that measured a worst border of 0.0269 against 0.0569 for the
 *  same six colours differently distributed (DS `guidelines/nested-depth-probe.html`). So this
 *  picks the free slot FURTHEST from what its neighbours already hold, by `SLOT_DIST`, in DSATUR
 *  order (most-constrained region first).
 *
 *  EDGES BETWEEN DIFFERENT FAMILIES ARE IGNORED, deliberately: two touching regions in different
 *  families are already separated by their hue, so constraining them would spend a slot to say
 *  something the hue has already said. Pass `family` as all-one-value to constrain every edge.
 *
 *  WHAT A HOST STILL OWNS: the topology. Only the host knows which regions touch — geometrically,
 *  from its own tessellation, not from the tree (two cousins can share a border and two siblings
 *  can be nowhere near each other). And STORAGE, if the assignment is to be stable across an
 *  edit: recompute it from a changed tessellation and every colour may move. */
export function familySlots(neighbours: readonly (readonly number[])[] = [], { family = [] as readonly string[] }: { family?: readonly string[] } = {}): number[] {
  const n = neighbours.length
  const slot: number[] = new Array(n).fill(-1)
  const sameFamily = (i: number, j: number) => family.length === 0 || family[i] === family[j]
  const done = new Set<number>()
  for (let step = 0; step < n; step++) {
    /* DSATUR: the region with the most already-painted neighbours, ties to the highest degree */
    let pick = -1
    let bestSat = -1
    let bestDeg = -1
    for (let i = 0; i < n; i++) {
      if (done.has(i)) continue
      let sat = 0
      for (const j of neighbours[i]) if (done.has(j) && sameFamily(i, j)) sat++
      if (sat > bestSat || (sat === bestSat && neighbours[i].length > bestDeg)) { pick = i; bestSat = sat; bestDeg = neighbours[i].length }
    }
    let best = 0
    let bestScore = -1
    for (let k = 0; k < FAMILY_SLOTS; k++) {
      let worst = Infinity
      for (const j of neighbours[pick]) if (slot[j] >= 0 && sameFamily(pick, j)) worst = Math.min(worst, SLOT_DIST[k][slot[j]])
      if (worst === Infinity) worst = 99
      if (worst > bestScore) { bestScore = worst; best = k }
    }
    slot[pick] = best
    done.add(pick)
  }
  return slot
}

/** THE SEPARATION A TOUCHING SAME-HUE PAIR MUST CLEAR, in OKLab, and it is CHOSEN rather than
 *  derived — do not re-derive it. It is calibrated against a number this system already ships and
 *  has looked at: inside a family, the closest touching pair on the real corpus measures 0.0466
 *  and the ladder was judged to be doing its job there. 0.045 sits just under that, so the first
 *  rung of the ladder (slot 0 to slot 1, 0.0496 apart) clears it and a generation-0 twin moves by
 *  one step instead of four. For scale at the other end: the province-tier pass treated anything
 *  under 0.020 as two regions reading as one. */
export const TOPIC_SEPARATION_MIN = 0.045

/** WHICH SHADE OF ITS OWN HUE A TOP-LEVEL TOPIC TAKES, when the palette has wrapped and two
 *  same-hue territories turn out to TOUCH. Hand it the same adjacency `familySlots()` takes plus
 *  the STORED hue name per region; get back one slot per region for `nestedFamilyPaint`.
 *
 *  THE PALETTE'S WRAP IS NOT A BUG AND THIS IS NOT A SEVENTEENTH COLOUR. `nextTopicSlot()` walks
 *  sixteen hues and then wraps, so a corpus's 17th topic is handed the 1st topic's hue exactly.
 *  For a dot or a chip that costs a reader nothing — two chips sharing a hue are never side by
 *  side. A MAP TERRITORY IS DIFFERENT: it is a filled region with neighbours, and two identical
 *  fills that share a border read as ONE region, so a 60-node graph silently draws as a 40-node
 *  one. Nothing reports it, and by the owner's ruling (2026-09-05) nothing may: no prompting to
 *  group topics, no threshold, no notice. It is a picture this system has to draw correctly and
 *  silently at any width, which is why this is a call and not a documented rule.
 *
 *  NOTE THE SHAPE OF THE FAULT — IT DEPENDS ON ADJACENCY, NOT ON THE COUNT. Seventeen topics with
 *  the two same-hue ones far apart is fine and must stay untouched; sixteen plus one, touching, is
 *  not. So a region with no same-hue NEIGHBOUR keeps slot 0, and the guarantee that follows is the
 *  one worth checking a port against: for any map whose twins do not touch — every map of sixteen
 *  topics or fewer included — this returns all zeros and not one territory changes colour.
 *
 *  TWO CLOCKS, AND THIS IS THE HALF THAT IS DERIVED. The owner ruled (2026-09-05) that a topic's
 *  HUE is stored the moment it is assigned, so reopening a map never re-colours it: that is
 *  identity, and identity is stored. The SLOT is not identity — it is a fact about who a region
 *  touches, and it changes when the user adds a node or the layout re-solves. So it is derived at
 *  render time, here, from the same geometry the tessellation came from. A stored slot would be a
 *  saved answer to a question whose inputs had moved.
 *
 *  `hue[i]` is region `i`'s stored ring-hue NAME (what `nextTopicSlot()` returned and the host
 *  wrote down), `neighbours[i]` the region indices it shares a border with — the host's GEOMETRY,
 *  never its tree, for the reason `familySlots()` gives at length. Regions are compared only
 *  against same-hue neighbours: a rose beside a jade is already two families apart and moving
 *  either would spend a lightness step on a difference the hue has already made.
 *
 *  THE NEAREST SLOT THAT CLEARS THE FLOOR, NOT THE FURTHEST — and this is a deliberate departure
 *  from `familySlots()`, which takes the free slot furthest from what its neighbours hold. That
 *  rule is right where it lives: inside a family many regions spread across all five slots, and
 *  maximising the smallest gap is what keeps the whole assignment readable. GENERATION 0 IS A
 *  DIFFERENT PROBLEM WEARING THE SAME CLOTHES. Here every region that is not a touching twin is
 *  pinned at slot 0, so exactly one region moves and "furthest from my neighbour" is always slot 4,
 *  every time. Measured on the DS's specimen (`topic-wrap.card.html`): the graded twin came out at
 *  oklch(0.72 0.13) in a field where every other territory is oklch(0.90 0.05) — the single
 *  saturated cell on an otherwise pastel map. On a map where fill encodes topic identity, the
 *  disambiguated region then also reads as the most important one, which is a meaning nobody asked
 *  it to carry. So this walks the ladder from the top and takes the FIRST slot that clears
 *  `TOPIC_SEPARATION_MIN` against every placed same-hue neighbour, and only falls back to the
 *  furthest if nothing clears. Enough to see the border, not enough to shout.
 *
 *  THE LADDER IS SHARED WITH THE NESTED TIERS, so a fill value alone never identifies a tier: a
 *  generation-0 twin at slot 1 draws exactly what a nested descendant at slot 1 draws. That is not
 *  a collision to design out — depth is carried by the ancestor boundary ladder (thin between
 *  siblings, heavy between groups), never by fill, which is the same reason `nestedFamilyPaint`
 *  dropped depth as a channel. */
export function topicSlots(neighbours: readonly (readonly number[])[] = [], { hue = [] as readonly (string | null | undefined)[] }: { hue?: readonly (string | null | undefined)[] } = {}): number[] {
  const n = neighbours.length
  const slot: number[] = new Array(n).fill(0)
  const nb = (i: number) => neighbours[i] || []
  const twin = (a: number, b: number) => hue[a] != null && hue[a] === hue[b]
  const load = (i: number) => nb(i).filter((j) => twin(i, j)).length
  const order: number[] = []
  for (let i = 0; i < n; i++) if (load(i) > 0) order.push(i)
  /* most-constrained first, index as the tie-break, so one tessellation always gives one answer */
  order.sort((a, b) => (load(b) - load(a)) || (a - b))
  const placed = new Set<number>()
  for (const i of order) {
    const against = nb(i).filter((j) => twin(i, j) && placed.has(j))
    let best = 0
    if (against.length) {
      /* nearest first: the smallest step down the ladder that clears the floor against ALL of
         them. `worst` is this candidate's separation from the neighbour it is closest to. */
      let fallback = 0
      let fallbackScore = -1
      best = -1
      for (let k = 0; k < FAMILY_SLOTS; k++) {
        let worst = Infinity
        for (const j of against) worst = Math.min(worst, SLOT_DIST[k][slot[j]])
        if (worst > fallbackScore) { fallbackScore = worst; fallback = k }
        if (worst >= TOPIC_SEPARATION_MIN) { best = k; break }
      }
      /* nothing clears: a region with same-hue neighbours already spread across the ladder. Take
         the furthest, as `familySlots()` would, rather than returning a value known to be too
         close. Reachable only with three or more mutually touching twins of one hue. */
      if (best < 0) best = fallback
    }
    slot[i] = best
    placed.add(i)
  }
  return slot
}

/** PAINT FOR A NODE NESTED INSIDE A FAMILY'S HUE, arbitrarily deep — a map territory four levels
 *  into one domain, a tree branch several folds deep, anywhere a whole subtree shares one
 *  `topicPaint()` hue and would otherwise read as one undifferentiated blob.
 *
 *  Pass the `slot` `familySlots()` gave this node. That is the whole input: WHICH OF MY NEIGHBOURS
 *  AM I NOT. Hue stays inside ±6° of the family so a descendant always reads as its ancestors'
 *  colour; lightness and chroma carry the separation.
 *
 *  DEPTH IS DELIBERATELY NOT A CHANNEL HERE ANY MORE, and that is a reversal worth reading before
 *  restoring it. The previous version graded L and C by depth (OB-086). It was measured against
 *  the app's real corpus and the finding was that depth is the wrong axis: what decides whether
 *  two regions are confusable is not how deep they are, it is WHO THEY TOUCH — and two siblings at
 *  the same depth very often share a border (`receipts/b656ebc.md`). The depth term also cost
 *  range that the neighbour axis needed, and it is redundant twice over on a map: a child sits
 *  INSIDE its parent's outline, and the host already draws an ancestor boundary ladder (thin
 *  between siblings, heavy between groups — confirmed live, 2026-08-29). A caller that wants depth
 *  legible should spend a boundary weight on it, not a lightness step.
 *
 *  Returns raw `oklch()` strings, not `var()` — a shifted hue has no token to point at; this is a
 *  computed member of the ring's family, not one of its sixteen named stops. `fill` is calibrated
 *  as a map territory; `stroke` is the same hue and slot, darkened for a territory border.
 *
 *  `index`/`of` are the OLD positional arguments and still work, mapped to `slot` by position.
 *  They are deprecated because their MEANING changed, not their name: a position among siblings is
 *  not an adjacency-safe slot, and two siblings that share a border can perfectly well be handed
 *  the same one. Move to `slot`. `depth` is accepted and ignored. */
export function nestedFamilyPaint(domain?: string, { slot, index }: {
  slot?: number
  /** @deprecated positional, not adjacency-safe — pass `slot` from `familySlots()` */
  index?: number
  /** @deprecated no longer read */
  of?: number
  /** @deprecated no longer read — put depth on the boundary weight */
  depth?: number
} = {}): { hue: string | null; fill: string; stroke: string } {
  const name = resolveHueName(domain)
  if (!name) return { hue: null, fill: 'var(--swatch-fill-fallback)', stroke: 'var(--swatch-anchor-fallback)' }
  const k = Math.abs(Math.round(slot != null ? slot : (index || 0))) % FAMILY_SLOTS
  const L = SLOT_L[k]
  const C = SLOT_C[k]
  const h = HUE_DEGREES[name] + SLOT_H[k]
  return {
    hue: name,
    fill: `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)})`,
    stroke: `oklch(${(L - 0.2).toFixed(3)} ${(C + 0.05).toFixed(3)} ${h.toFixed(1)})`,
  }
}
