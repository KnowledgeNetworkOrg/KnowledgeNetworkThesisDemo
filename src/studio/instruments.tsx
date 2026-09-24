// The instrument registry — what panes exist, and which combinations we ship.
//
// This replaces five hand-maintained parallel structures inside StudioView: an
// InstrumentId union, a CATALOG order array, a LABEL record, a LENS_TYPE lookup,
// and a switch that was NOT exhaustiveness-checked (add an id, forget the case,
// and you got a blank pane at runtime — it compiled fine). Deleting one flat map
// last week took nine edit sites and still left a false string in another file.
//
// Now: an instrument is one entry. Add one, and its sidebar row, its pane, its
// label and its preset eligibility all follow. InstrumentId is DERIVED from the
// array, so a preset cannot name a pane that does not exist; the bus's own
// reveal targets (`BusRevealTarget`) are checked against it through the shell's
// `ensureActive`, so a rename in the registry fails to compile rather than at
// runtime.

import type { CSSProperties, ReactNode } from 'react'

import { EDGE_LABEL } from '../corpus/graph'
import type { EdgeType } from '../corpus/graph'
import { EDGE_TYPES } from '../model/nav'
import type { Bus } from '../state/bus'
import type { Family } from './families'

import ConnectionsPane, { CONNECTIONS_BODY_STYLE, ConnectionsPaneActions } from '../instruments/ConnectionsPane'
import ContoursView from '../instruments/ContoursView'
import ClustersView from '../instruments/ClustersView'
import DocumentPanel from '../instruments/DocumentPanel'
import LensPane from '../instruments/LensPane'
import MapCountReadout from '../instruments/MapCountReadout'
import MapView, { MAP_WATER } from '../instruments/MapView'
import NeighborhoodPanel from '../instruments/NeighborhoodPanel'
import TrailStrip from '../instruments/TrailStrip'
import UnfoldGraphView from '../instruments/UnfoldGraphView'
import UnfoldView from '../instruments/UnfoldView'
import WalkPaletteView from '../instruments/walkdesk/WalkPaletteView'
import WalkEditorView from '../instruments/walkdesk/WalkEditorView'
import WalkActionBar from '../instruments/walkdesk/WalkActionBar'
import WalkUtilityBar from '../instruments/walkdesk/WalkUtilityBar'
import WalkColumnsView from '../instruments/walkdesk/WalkColumnsView'
import WalkStackView from '../instruments/walkdesk/WalkStackView'
import WalkView from '../instruments/WalkView'
import WalkViewer from '../instruments/WalkViewer'

// The members that take a bus are generic over its id on purpose: InstrumentId
// is derived from VIEWS below, so naming Bus<InstrumentId> here would be a
// circular type alias. The shell's call site still infers InstrumentId —
// StudioView passes Bus<InstrumentId> — and that is where the tie is checked.
export interface Instrument {
  id: string
  label: string
  /** which family the sidebar files it under. The palette groups by this, so
   * every instrument must name one — a new view without a family would silently
   * vanish from the list rather than land in a catch-all. */
  family: Family
  /** columns flow left to right; strips pin to the bottom of the stack */
  slot: 'column' | 'strip'
  /** default flex weight (a preset may override it); { fixed } pins a pixel
   * width instead — the tree is a list, not a canvas, and does not want to grow */
  flex?: number | { fixed: number }
  /** a strip that needs working room says how much; one that sizes itself to its
   * content (the trail) leaves this out */
  height?: number
  /** in a STACKED column, whether this pane takes an even share of the height.
   * The default (true) splits the column evenly; false makes the pane size to
   * its own content and hands the slack to its stack-mates — a search pane that
   * is empty most of the time should not reserve half a column of white space. */
  stackGrow?: boolean
  /** which of the two shapes the pane's BODY is (DS `Pane.scroll`). `'y'` (default):
   * the instrument returns bare content and `Pane` supplies its own `PaneScroller`.
   * `'none'`: the instrument owns a chrome row above its own scrolling or cropping
   * region (or has no scroll of its own at all) and renders `PaneScroller` /
   * `PaneCanvas` itself — set this whenever the instrument's root would otherwise
   * be double-wrapped in two nested scrollers. */
  body?: 'y' | 'none'
  /** merged into the pane's BODY box (DS `Pane.bodyStyle`) — padding and flow, never a
   *  background. Only for an instrument whose own root has a layout contract with the box
   *  around it: the connections split publishes `CONNECTIONS_BODY_STYLE` because each of its
   *  columns owns a scroller, so the BODY must not scroll or the scrollbar sits inboard
   *  behind a reserved gutter instead of flush at the pane's inner edge. */
  bodyStyle?: CSSProperties
  /** the pane's OWN actions, docked under its header via `Pane`'s `actionBar` slot
   * (DS `PaneActionBar` — labelled pills, never floating or icon-only). Most
   * instruments have no pane-local actions and leave this out; the shell mounts it
   * as a sibling of `render`'s output, not inside it, so `Pane` can clip its top
   * corners to the frame's own arc. */
  actionBar?<Id extends string>(bus: Bus<Id>): ReactNode
  /** pane-scoped controls beside the TITLE itself (DS `Pane.actions`) — an 18px-
   * tall icon-height slot in the header row, not a separate bar. Most instruments
   * have nothing that belongs there and leave this out. */
  actions?<Id extends string>(bus: Bus<Id>): ReactNode
  /** the pane's own FRAME colour (DS `Pane.face`, OB-066) — a data-driven host
   * names its own (the map's water) so the frame stops relying on its default
   * `--surface-paper` to show around content that doesn't reach every edge.
   * Nearly every instrument leaves this out and gets that default. */
  face?: string
  /** the pane's BODY. The title bar and the ✕ are the shell's job, not the
   * instrument's — which is why an instrument that reads nothing from the bus
   * (Unfold, Contours, EVoC) simply does not take it. */
  render<Id extends string>(bus: Bus<Id>): ReactNode
}

// ── The views ───────────────────────────────────────────────────────────────
// `as const satisfies` is doing real work: it keeps the ids as literal types so
// InstrumentId can be derived from them, while still typechecking every entry
// against Instrument.
const VIEWS = [
  {
    id: 'map',
    label: 'Map',
    family: 'maps',
    slot: 'column',
    // MapView renders its own PaneCanvas at its root (the "territory" crop +
    // MAP_WATER face) — without body:'none' Pane ALSO wraps it in a PaneScroller,
    // whose plain block box gives the nested PaneCanvas's flex:1 nothing to fill
    // against, so the map only ever grows to the svg's intrinsic content size
    // (roughly half the pane). Same class of bug 'connections' hit and fixed
    // (OB-054/#143) — one instrument, one canvas, body:'none'.
    body: 'none',
    face: MAP_WATER,
    actions: () => <MapCountReadout />,
    render: (bus) => <MapView bus={bus} />,
  },
  {
    id: 'walk',
    label: 'Walk',
    family: 'walks',
    slot: 'strip',
    height: 240,
    body: 'none',
    render: (bus) => <WalkView bus={bus} />,
  },
  {
    // #21: where stops come FROM — the corpus, filtered. The last of the
    // walk-tiers desk (#11) to become an instrument; the desk itself is gone,
    // having given away its reading views (#20), its writing surface and now
    // its supply. Nothing was lost in the split — every job it did is a pane.
    id: 'walkpalette',
    label: 'Walk·Palette',
    family: 'walks',
    slot: 'column',
    // a search pane hugs its content: empty, it is just the box; searching, it
    // grows to a capped, scrollable list. Either way the document below it takes
    // the room the old even split wasted (#28 feedback).
    stackGrow: false,
    body: 'none',
    render: (bus) => <WalkPaletteView bus={bus} />,
  },
  {
    // #21: the writing surface — the only view in the Studio that ever sees a
    // branch. Its receipt (the projected route) is an on-demand slide-in, not a
    // permanent second lane (#154). Shares one draft with the palette through
    // authordraft.ts's stores.
    id: 'walkeditor',
    label: 'Walk·Editor',
    family: 'walks',
    slot: 'column',
    body: 'none',
    // Two tiers, two categories (#193): WalkUtilityBar (the walk as a whole —
    // view/save/load) on top, WalkActionBar (the draft tree under construction)
    // on the bottom. Both docked in the one actionBar slot, which is what gets
    // them the DS corner-clip neither got as a plain child of the pane body.
    actionBar: () => (
      <>
        <WalkUtilityBar />
        <WalkActionBar />
      </>
    ),
    render: (bus) => <WalkEditorView bus={bus} />,
  },
  {
    // #20: the desk's two reading zones, now instruments in their own right.
    // They present a resolved road and cannot edit it — fed by the desk via
    // walkdesk/presented.ts's usePresentedRoad().
    id: 'walkcolumns',
    label: 'Walk·Columns',
    family: 'walks',
    slot: 'column',
    body: 'none',
    render: (bus) => <WalkColumnsView bus={bus} />,
  },
  {
    // fixed width: the stack's planes are ROTATED, so their footprint is a
    // constant ~357px no matter how much room the pane is given. Growing it
    // would only add empty board (LayerStack.STACK_W).
    id: 'walkstack',
    label: 'Walk·Stack',
    family: 'walks',
    slot: 'column',
    flex: { fixed: 372 },
    body: 'none',
    render: (bus) => <WalkStackView bus={bus} />,
  },
  {
    id: 'unfold',
    label: 'Unfold',
    family: 'maps',
    slot: 'column',
    body: 'none',
    render: () => <UnfoldView />,
  },
  {
    id: 'unfoldgraph',
    label: 'Unfold·Graph',
    family: 'maps',
    slot: 'column',
    body: 'none',
    render: (bus) => <UnfoldGraphView bus={bus} />,
  },
  {
    id: 'contours',
    label: 'Contours',
    family: 'maps',
    slot: 'column',
    body: 'none',
    render: () => <ContoursView />,
  },
  {
    id: 'clusters',
    label: 'Clusters',
    family: 'maps',
    slot: 'column',
    body: 'none',
    render: () => <ClustersView />,
  },
  {
    id: 'connections',
    label: 'Connections',
    family: 'reading',
    slot: 'column',
    body: 'none',
    // #143 (OB-054): ConnectionsPane owns its own PaneCanvas/PaneScroller split
    // internally now — wrapping it in one PaneCanvas here caught its bottom
    // scrolling section in the canvas's own rounded, clipped box.
    // #253: the split's two columns each own a scroller, so the pane BODY must not
    // scroll — that is what CONNECTIONS_BODY_STYLE says, published by the DS beside
    // the component rather than restated here.
    bodyStyle: CONNECTIONS_BODY_STYLE,
    // the split has no chrome row of its own, so back/forward live in the header
    actions: (bus) => <ConnectionsPaneActions bus={bus} />,
    render: (bus) => <ConnectionsPane bus={bus} />,
  },
  {
    id: 'document',
    label: 'Document',
    family: 'reading',
    slot: 'column',
    render: (bus) => <DocumentPanel bus={bus} />,
  },
  {
    id: 'neighborhood',
    label: 'Neighborhood',
    family: 'reading',
    slot: 'column',
    render: (bus) => <NeighborhoodPanel bus={bus} />,
  },
  {
    id: 'trail',
    label: 'Trail',
    family: 'walks',
    slot: 'strip',
    render: (bus) => <TrailStrip bus={bus} />,
  },
  {
    // the walk you'd actually present: a saved walk when one is active
    // (bus.activeWalk), otherwise the draft open on the desk. Distinct from
    // 'walk' (WalkView) — see WalkViewer.tsx's own header.
    id: 'walkviewer',
    label: 'Walk·Viewer',
    family: 'walks',
    slot: 'strip',
    height: 240,
    body: 'none',
    render: (bus) => <WalkViewer bus={bus} />,
  },
] as const satisfies readonly Instrument[]

// ── The lenses, GENERATED from the corpus's edge types ───────────────────────
// They used to be three hand-written union members, three CATALOG rows, three
// LABEL entries and a LENS_TYPE lookup — four edit sites to add a fourth. The
// corpus has always had four relation types; `implements` simply never got its
// pane, and nobody noticed, because noticing required reading four files. Here a
// new relation type gets its lens for free, and the template-literal type below
// means it lands in InstrumentId for free too.
const LENSES: Instrument[] = EDGE_TYPES.map((t) => ({
  id: `lens-${t}`,
  // the "Lens: " prefix retired with #97: the family heading above these rows
  // already says `lenses`, so the prefix was the group's name repeated four
  // times, eating the label column that FamilyColumn sizes.
  label: EDGE_LABEL[t],
  family: 'lenses',
  slot: 'column',
  render: (bus: Bus) => <LensPane bus={bus} type={t} />,
}))

export type InstrumentId = (typeof VIEWS)[number]['id'] | `lens-${EdgeType}`

/** fixed order: every view, then the lenses. Drives the sidebar and the DOM
 * order of the panes; a preset's own array order drives their visual order. */
export const INSTRUMENTS: Instrument[] = [...VIEWS, ...LENSES]
export const byInstrument = new Map(INSTRUMENTS.map((i) => [i.id, i]))

/** the type a lens pane is about, or undefined for anything else */
export const lensTypeOf = (id: string): EdgeType | undefined =>
  id.startsWith('lens-') ? (id.slice(5) as EdgeType) : undefined

// ── Presets ─────────────────────────────────────────────────────────────────
// A preset is (instrument list + geometry), not an instrument list alone:
// Present wants one or two canvases with room to breathe, Explore wants
// territory and prose side by side on one focus.
//
// A third preset, Coding (tree + three relation lenses in small glanceable
// panes), was removed when this repo narrowed to the teaching domain. Its
// panes all survive as individually pickable instruments — only the curated
// coder-shaped composition is gone.
/** one column of the composition. An ARRAY is a stack: those instruments share
 * one column, split evenly top to bottom. It exists because "the palette above
 * the document" is a real arrangement and the flat list could not say it — the
 * only vertical slot used to be a full-width strip along the bottom, which is a
 * different thing entirely. The column's width weight comes from its FIRST
 * member, so a stack is weighted like the pane that leads it. */
export type Slot = InstrumentId | InstrumentId[]

export const flattenSlots = (slots: readonly Slot[]): InstrumentId[] =>
  slots.flatMap((s) => (Array.isArray(s) ? s : [s]))

export interface Preset {
  id: 'present' | 'explore' | 'plan'
  label: string
  hint: string
  /** column order; strips always sit at the bottom */
  active: Slot[]
  flex?: Partial<Record<InstrumentId, number>>
  /** THE PRESENTER'S PREVIEW (owner, 2026-09-03; DS OB-135 rule 1/5): picking this preset shows
   *  the presenter screen laid out as a lecture would be, projecting NOTHING — no clock runs,
   *  nothing is recorded. The toolbar ▶ turns the preview into the lecture. It is not a toggle:
   *  pressed while previewing, nothing; pressed once a lecture has ended, back to the preview.
   *  Picking any other preset leaves the presenter first. The label stays "Present" although it
   *  is a preview — deferred by the owner; the hint carries the distinction. Do not re-ask. */
  presenter?: true
}

export const PRESETS: Preset[] = [
  {
    // THE OPENING COMPOSITION, and — since #267 — the presenter's PREVIEW when PICKED: the
    // `active` list below is what the desk shows at launch and returns to; picking the button
    // lays out the presenter screen with nothing projected. See `Preset.presenter`.
    id: 'present',
    label: 'Present',
    hint: 'the presenter screen, previewed — nothing projected; ▶ on the toolbar starts the lecture',
    active: ['map', 'unfoldgraph', 'document', 'walkviewer'],
    flex: { map: 2, unfoldgraph: 1.4, document: 1 },
    presenter: true,
  },
  {
    id: 'explore',
    label: 'Explore',
    hint: 'map + connections + document — territory, subtree wheel, and prose on one focus',
    active: ['map', 'connections', 'document'],
    /* THE MAP GIVES UP A LITTLE WIDTH (#295, DS OB-169, owner-ruled 2026-09-09). Was
       1.8 / 1 / 1, which handed the connections pane a box of 325px at 1280 and 386 at
       1512 — a measured content width (the pane's own padding off) of 315 and 376, both
       under the 380 `ConnectionsSplitPane` publishes as the width below which it degrades:
       the split reading the pane exists for could not be reached on a 13" laptop, and the
       15" was under too. The map is the pane that can afford it — a picture reads at any
       size — and the document stays a tall column and is not made smaller: the sum is
       still 3.8, so its share is the same number it was. Measured after: 395 / 472 for the
       connections content, 503 / 598 for the map (`browsertest-deskwidths.mjs`). A ratio,
       so a number that can move again — OB-170's draggable dividers are the real answer. */
    flex: { map: 1.55, connections: 1.25, document: 1 },
  },
  {
    // #20/#21 — the google-maps composition, read left to right as the work
    // flows: SEARCH (palette) over the prose that says what a stop teaches,
    // then the ROAD you are writing with its resolved route beside it, then the
    // TERRITORY on the right with the room to be a territory. The road sits in
    // the middle — the thing you edit is central, flanked by where stops come
    // from (search) and where they live (map).
    //
    // The search column is stacked because both halves are the same gesture at
    // different zoom: "what is there" and "what is this one about". Walk·Columns
    // and Walk·Stack stay one sidebar click away rather than crowding the row.
    id: 'plan',
    label: 'Plan',
    hint: 'palette over document, then the walk editor, then the map',
    active: [['walkpalette', 'document'], 'walkeditor', 'map'],
    flex: { walkpalette: 1, walkeditor: 1.6, map: 2 },
  },
]

// ── Module-load guard ───────────────────────────────────────────────────────
// The same idiom corpus/graph.ts uses for an authoring typo: throw at load, not
// at render. A preset naming a dead instrument used to ship as a silently
// missing pane — the exact failure mode deleting the flat map could have caused.
{
  const ids = new Set(INSTRUMENTS.map((i) => i.id))
  if (ids.size !== INSTRUMENTS.length) throw new Error('duplicate instrument id in the registry')
  for (const p of PRESETS) {
    const flat = flattenSlots(p.active)
    if (new Set(flat).size !== flat.length) throw new Error(`preset "${p.id}" names an instrument twice`)
    for (const i of flat) if (!ids.has(i)) throw new Error(`preset "${p.id}" names an unknown instrument: ${i}`)
    for (const i of Object.keys(p.flex ?? {})) if (!ids.has(i)) throw new Error(`preset "${p.id}" weights an unknown instrument: ${i}`)
  }
}
