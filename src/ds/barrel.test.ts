import { describe, expect, it } from 'vitest'

import { Bullet, CARET_INK, Caret, CaretStack, TreeRow, CHIP_METRICS, Check, ChipGeometry, EdgeDash, EdgeEntry, EdgeLegend, Grip, ExpandMark, ExplorerRail, ExplorerRailCorner, ExplorerRailMath, explorerRailWidth, FindMark, FIRST_ROW_PAD, FlagButton, FlagMark, IconButton, InlineText, LeafMark, OutlineMark, PANE_DIVIDER_METRICS, PaneDivider, paneFit, clampDesk, deskBounds, PANE_RAIL_METRICS, PRESENTER_STRIP_METRICS, PRESENTER_STRIP_PARTS, PROJECTED_MAP_METRICS, RailCorner, REPLAY_PATH, STOP_CARD_METRICS, RailFrame, RailMath, RailOpenButton, RelationsMark, STOP_FINDER_METRICS, TextInput, filterStops, presenterStripHeight, NESTING, NodeRail, OptionalSuffix, PlayToggle, RailStop, RestoreMark, StopTitle, WalkParts, WalkPinHover, walkBandSpan, walkArrival, walkArrivalLag, walkComplete, walkLook, walkProgress, WALK_LOOK_DEFAULTS, chipSpec, railFloor, railFits, railWidth, segmentWalked, usePaneWidth, usedStroke, walkEase, walkHoverStyle, RelationOrbit, RelationStats, ORBIT_METRICS, orbitWedge, orbitMarks, orbitKinds, OrbitMath, StatsMath, relationStats, statKindRows, RELATION_STATS_METRICS, RelationsRailMath, PANE_PLACEHOLDER_METRICS, PREVIEW_BANNER_METRICS } from '@/ds'

// These components are exported from @/ds but have no direct importer outside
// src/ds/ — ported, but not yet adopted by the app. The list is explicit here
// so that consuming one, or adding a new unconsumed port, requires a deliberate
// edit rather than a quiet audit miss.
//
// To adopt one: import it from '@/ds' in app code and remove it from these
// imports. To add a new unconsumed port: import it here and note why it waits.
//
// Not listed (rendered, but only via a parent DS component):
//   NodeChain  — inside VersionedGroup (consumed by AuthorRoad)
//   BinMark    — inside PresetButton (consumed by StudioView)
//
// GRADUATED — kept here as history so nobody re-adds them:
//   NodeArrow  — was "inside NodeChain". It is now imported DIRECTLY by app code
//                (AuthorRoad.tsx:35), which passes it `joins` so each shaft takes
//                the border weight of what it connects. #109.
//
// A caveat on NodeChain worth having in writing, because the line above is true
// and still misleading. VersionedGroup does import and render it — but only in
// its DEFAULT body, and our only host renders the card in `bodySlot` mode, where
// the caller owns the contents. So that branch is reachable and never reached:
// nothing on any screen draws a NodeChain today. #109 decided to keep it anyway
// — the road applies the same connector rule from the same source (`chipBorder`,
// `shaftFor`, `VersionedGroup.joinBorder`) rather than duplicating its code, so
// the component is the statement of a rule the road is checked against, and the
// DS is still landing work in it. Retiring it stays cheap if that changes.
describe('ported but not adopted DS components', () => {
  it('EdgeLegend — waiting on #69 (strokes + key must re-tint together)', () => {
    expect(typeof EdgeLegend).toBe('function')
  })

  it('EdgeDash — waiting on #69 (used inside EdgeLegend only)', () => {
    expect(typeof EdgeDash).toBe('function')
  })

  // THE WAIT IS OVER, AND THE ANSWER IS NO — 2026-09-06, #253. #97's last open row said
  // EdgeEntry was "waiting on a host: the connections rail that would render it", and
  // #253 said that rail "is either that host or the end of its chances". The rehaul
  // landed and did not use it: the design system's own `RelationCards` composes the two
  // ends out of `NodeChip mark="border-2"` and `NodeArrow fill` DIRECTLY, which is the
  // same drawing EdgeEntry makes and the newer arrangement of it — plus the grouping
  // (one source card, one pill per target, a stack of arrows) that a per-entry component
  // cannot express. So this is no longer a component waiting for a screen; it is a
  // component whose screen arrived and chose the parts it is made of instead.
  //
  // It is KEPT rather than deleted, and that is the owner's call to make rather than a
  // porter's: the DS still ships and maintains it. What changed is that nothing is
  // PENDING on it any more. #97 itself stays open on its other two rows — EdgeLegend,
  // still correctly held behind #69, and LeafMark, still a design call — so do not read
  // this as that issue being finished.
  it('EdgeEntry — its host arrived (#253) and composed the parts instead; nothing pending', () => {
    expect(typeof EdgeEntry).toBe('function')
  })

  // #127 shipped this port (OB-037 for NodeChip's disclosure mark, OB-038 for the rail
  // itself — which also folds in OB-019 and OB-020, both satisfied by construction).
  // SAME ANSWER AS EdgeEntry ABOVE, for the same reason and on the same day: the rail
  // these were waiting for is the connections rehaul, and it draws a `ContainTree` of
  // pills on one side and `RelationCards` on the other. Neither is a NodeRail.
  it('NodeRail / RailStop — its host arrived (#253) and used other components; nothing pending', () => {
    expect(typeof NodeRail).toBe('function')
    expect(typeof RailStop).toBe('function')
  })

  // #89 is CLOSED — it was blocked on an asset channel for leaf-mask.png, and that
  // is resolved (the mask ships, and #112 verified LeafMark points at it). No
  // screen has chosen to draw the mark yet, which is a design call, not a blocker.
  it('LeafMark — ported and unblocked (#89 closed); no screen draws it yet', () => {
    expect(typeof LeafMark).toBe('function')
  })

  // OB-039 (#126) named both of these as exactly the gap this file exists to catch:
  // "Pane, PaneScroller and IconButton all became unconsumed exports the day after
  // this file was written and none was added." Pane/PaneScroller are adopted as of
  // #126 (StudioView, FloatingPanel, AuthorRoad, most instruments); IconButton is
  // still only rendered from inside other DS components (PaneHeader's close
  // control, VersionedGroup's fold/ungroup, NodeRail's expand/collapse acts) and
  // has no app-code importer of its own. Grip is new in #126 and in the same
  // position — Pane and PaneHeader place it, and no host file should render it
  // directly (its own docblock says so).
  it('IconButton — no app-code importer; rendered only from inside other DS components', () => {
    expect(typeof IconButton).toBe('function')
  })

  // OB-110 (#256): the DS split InlineText out of VersionedGroup on 2026-08-28 and this port
  // followed on 2026-09-05. VersionedGroup renders it three times (title, description, version
  // name) from inside src/ds; no app code opens a line of its own yet — the notes pane (#267)
  // will be the first.
  it('InlineText — rendered only from inside VersionedGroup; no app importer', () => {
    expect(typeof InlineText).toBe('function')
  })

  // #267 presenter mode, parts 1–4 (OB-135..138): the four presenter components ARE adopted
  // (src/present/PresenterScreen.tsx renders them); these are the pieces they import from
  // inside src/ds, and the strip's and finder's published numbers, which the host reads
  // through flex rather than arithmetic. `settleRead` is adopted by the app's LectureSlide.
  it('FlagMark / ExpandMark / FindMark / TextInput / FlagButton — drawn only from inside the presenter components', () => {
    expect(typeof FlagMark).toBe('function')
    expect(typeof ExpandMark).toBe('function')
    expect(typeof FindMark).toBe('function')
    expect(typeof TextInput).toBe('function')
    expect(typeof FlagButton).toBe('function')
  })

  it('PRESENTER_STRIP_METRICS / presenterStripHeight / PRESENTER_STRIP_PARTS / STOP_FINDER_METRICS / filterStops — published numbers and rules; the host lets flex lay the column out', () => {
    expect(PRESENTER_STRIP_METRICS.closed).toBe(64)
    expect(PRESENTER_STRIP_METRICS.open).toBe(107)
    expect(presenterStripHeight({ open: true, roaming: true })).toBe(130)
    expect(typeof PRESENTER_STRIP_PARTS.ClosedRail).toBe('function')
    expect(STOP_FINDER_METRICS.minListHeight).toBe(112)
    expect(PROJECTED_MAP_METRICS.refWidth).toBe(1120)
    expect(filterStops([{ title: 'a' }, { title: 'b' }], '2')).toEqual([1])
  })

  it('Grip — ported (#126); Pane/PaneHeader place it, no direct app importer', () => {
    expect(typeof Grip).toBe('function')
  })

  // OB-041 (#129) turned four private style-getters into drawn components so a
  // caller has nothing left to spread (the border-longhand trap). Each mark's
  // only renderer is still inside src/ds itself — TreeRow places Caret,
  // InstrumentRow places Bullet, VersionedGroup places Check and RestoreMark —
  // so none has an app-code importer of its own, same position as Grip above.
  it('Caret / Bullet / Check / RestoreMark — drawn marks, placed only from inside src/ds', () => {
    expect(typeof Caret).toBe('function')
    expect(typeof Bullet).toBe('function')
    expect(typeof Check).toBe('function')
    expect(typeof RestoreMark).toBe('function')
  })

  // NESTING is a number, not a component — grouped here anyway since it crossed
  // the boundary in the same obligation and for the same reason: TreeRow is the
  // reference for nesting, and no app code needs the raw constant yet.
  it('NESTING — the system nesting step; TreeRow and InstrumentGroup are its only readers so far', () => {
    expect(NESTING).toBe(16)
  })

  // OB-052 (#141) — CARET_INK crossed the barrel for the same reason NESTING did:
  // NodeRail's `UP` needed the same ink offset TreeRow's `caretStyle` cancels, so
  // the number is now public rather than a second hand-typed literal. Both
  // consumers are inside src/ds; no app code needs the raw constant yet.
  it('CARET_INK — the caret glyph ink offset; TreeRow and NodeRail are its only readers so far', () => {
    expect(CARET_INK).toBe(0.964)
  })

  // OB-063 (#154's caret question, split into design-sync's OB-063): the nesting pair
  // as an element, replacing NodeRail's hand-rolled stack-of-two-Carets-plus-inline-UP —
  // exactly the shape that let CARET_INK above drift once already. NodeRail is its only
  // reader so far; no app code needs it directly yet.
  it('CaretStack — the expand-all/collapse-all nesting pair, drawn as one element', () => {
    expect(typeof CaretStack).toBe('function')
  })

  // OB-048 (#141) — chipSizeOf is the call a board actually wants and AuthorRoad's
  // leafSize now imports it from here. These four crossed the barrel alongside it
  // per the same obligation but have no direct app importer yet: CHIP_METRICS and
  // usedStroke are read from inside chipSize itself, chipSpec is chipSizeOf's own
  // first step, and ChipGeometry is the DS's bundled reachable-from-window form.
  it('CHIP_METRICS / chipSpec / usedStroke / ChipGeometry — exported with chipSizeOf; no direct app importer yet', () => {
    expect(typeof CHIP_METRICS).toBe('object')
    expect(typeof chipSpec).toBe('function')
    expect(typeof usedStroke).toBe('function')
    expect(typeof ChipGeometry).toBe('object')
  })

  // #246 (OB-130/131/133) — the walk dock arc. WalkDock, WalkPreview and
  // previewAnchor are adopted (MapView). #247 (OB-132) adopted the rest of the
  // band: `walkBand` (MapView's pins), `walkArrow` and WALK_ARROW_DEFAULTS
  // (model/walkarrow.ts), `walkAdvance` (walkdesk/playback.ts's clock). These
  // cross the barrel with them and have no app importer of their own: the
  // WalkParts pieces are read by WalkStrip and WalkDock from inside src/ds;
  // WalkPinHover is the DS's HTML-pin wrapper and our pins are SVG `<g>`s, which
  // bind the same two lines themselves; `segmentWalked` and `walkEase` are read by
  // `walkArrow` and `walkAdvance` from inside src/ds.
  // #345 (OB-196, OB-199) added three more of the same kind: `REPLAY_PATH` and
  // `walkComplete` are read by `PlayToggle` and `WalkDock` from inside src/ds (the map takes
  // the dock's own two-beat restart, so it derives nothing itself), and `STOP_CARD_METRICS`
  // is `StopCard`'s own measure — the app passes `StopCard` strings and never sizes it.
  it('WalkParts pieces — read by WalkStrip and WalkDock from inside src/ds; no app importer', () => {
    expect(typeof StopTitle).toBe('function')
    expect(typeof PlayToggle).toBe('function')
    expect(typeof OptionalSuffix).toBe('function')
    expect(typeof walkHoverStyle).toBe('function')
    expect(typeof WalkParts).toBe('object')
    expect(typeof walkComplete).toBe('function')
    expect(typeof REPLAY_PATH).toBe('string')
    expect(STOP_CARD_METRICS.width).toBe(264)
  })

  it('WalkPinHover — for HTML pins; the map binds the recipe on its SVG pins itself', () => {
    expect(typeof WalkPinHover).toBe('function')
  })

  // Published by the DS on 2026-09-14 and ported with OB-185; each has an item waiting to adopt
  // it: `walkLook` / `WALK_LOOK_DEFAULTS` are OB-179's camera gate, `walkArrival` /
  // `walkArrivalLag` are OB-181's arrival cursor, `walkBandSpan` and `walkProgress` serve the
  // map's merged pins (OB-184). Listed so adopting one is a deliberate edit here.
  it('walkLook / walkArrival / walkArrivalLag / walkBandSpan / walkProgress — published for OB-179, OB-181 and OB-184; no app reader yet', () => {
    expect(typeof walkLook).toBe('function')
    expect(typeof walkArrival).toBe('function')
    expect(typeof walkArrivalLag).toBe('function')
    expect(typeof walkBandSpan).toBe('function')
    expect(typeof walkProgress).toBe('function')
    expect(WALK_LOOK_DEFAULTS.edgeInset).toBe(0.12)
  })

  // TreeRow JOINED THIS LIST ON 2026-09-07 rather than being deleted (#265). Its only
  // renderer was `instruments/TreePanel`, retired because `ContainTree` brings a tree
  // inside the connections pane and two trees of one corpus is one too many. The DS
  // keeps the component — their own contains tree is expected to draw rows — and its
  // PARTS are still adopted everywhere: `Caret`, `CaretStack`, `NESTING` and `CARET_INK`
  // have readers in eight files. It is the assembled ROW that has no screen.
  it('TreeRow — its host was retired with #265; the row keeps no app renderer, its parts do', () => {
    expect(typeof TreeRow).toBe('function')
  })

  it('segmentWalked / walkEase — read by walkArrow and walkAdvance from inside src/ds', () => {
    expect(typeof segmentWalked).toBe('function')
    expect(typeof walkEase).toBe('function')
  })

  // #340 (OB-225, 234, 237, 239, 241, 243) — the dissolution's shared chrome. BOTH RAILS ARE
  // MOUNTED NOW — the map's Explorer rail (#341) and the document's Relations rail (#342) — and
  // they are what render these: `ExplorerRail`/`RelationsRail` wear `RailFrame`, place the marks
  // and hand the closed state to `RailCorner`/`RailOpenButton` through their own `…RailCorner`.
  // So none of them has an app-code importer of its own, which is the design (OB-238 done-when
  // 4: no pane re-implements the frame), not a wait. `FIRST_ROW_PAD` is read by RailFrame
  // itself; it crosses the barrel for #358, which completes OB-249.
  it('RailFrame / RailOpenButton / RailCorner / OutlineMark / RelationsMark — rendered by the two mounted rails from inside src/ds', () => {
    expect(typeof RailFrame).toBe('function')
    expect(typeof RailOpenButton).toBe('function')
    expect(typeof RailCorner).toBe('function')
    expect(typeof OutlineMark).toBe('function')
    expect(typeof RelationsMark).toBe('function')
    expect(FIRST_ROW_PAD).toBe(14)
    expect(PANE_RAIL_METRICS.left.pad.startsWith('14px')).toBe(true)
    // OB-250 — the closed corner is placed at the open head's `top`, so the control does not step
    // between states: 14 on the left, 6 on the right.
    expect(PANE_RAIL_METRICS.left.top).toBe(14)
    expect(PANE_RAIL_METRICS.right.top).toBe(6)
    // OB-253 — a dragged width is a TARGET, capped at `stretch` and still clamped by the pane.
    expect(PANE_RAIL_METRICS.left.stretch).toBe(360)
    expect(railWidth('left', 9999, 500)).toBe(360)
    expect(railWidth('left', 400, 500)).toBe(400 - PANE_RAIL_METRICS.left.keep)
    expect(railFloor('left')).toBe(PANE_RAIL_METRICS.left.min + PANE_RAIL_METRICS.left.keep)
    expect(railFloor('right')).toBe(PANE_RAIL_METRICS.right.min + PANE_RAIL_METRICS.right.keep)
    expect(railFits('left', 0)).toBe(true)
    expect(railWidth('left', 400)).toBe(PANE_RAIL_METRICS.left.max)
    expect(typeof RailMath.width).toBe('function')
    expect(typeof usePaneWidth).toBe('function')
  })

  // #341 (OB-253) — the rail's seam drags, so the desk's drag handle came with the frame it
  // hangs on. No host draws one yet: `RailFrame` is the first reader, and the map pane's seam
  // is the one this port wires.
  it('PaneDivider / PANE_DIVIDER_METRICS / paneFit / clampDesk / deskBounds — the rail seam\'s drag handle (OB-253)', () => {
    expect(typeof PaneDivider).toBe('function')
    expect(PANE_DIVIDER_METRICS.hit).toBe(14)
    expect(paneFit({ narrowBelow: 100 }).floor).toBe(100)
    expect(paneFit({ floor: 80 }).narrowBelow).toBe(80)
    expect(clampDesk({ sizes: [200, 200], index: 0, delta: 50, fits: [{ floor: 150 }, { floor: 150 }] })).toEqual([250, 150])
    expect(deskBounds({ sizes: [200, 200], index: 0, fits: [{ floor: 150 }, { floor: 150 }] })).toEqual({ now: 200, min: 150, max: 250 })
  })

  // #341 (OB-238) — the Explorer rail is a whole component now; the map pane mounts it in this
  // branch, and `ConnectionsRails` carries the hover layer it pairs with.
  it('ExplorerRail / ExplorerRailCorner / explorerRailWidth — the map\'s rail, ported waiting on its mount (#341)', () => {
    expect(typeof ExplorerRail).toBe('function')
    expect(typeof ExplorerRailCorner).toBe('function')
    expect(explorerRailWidth(400, null)).toBe(railWidth('left', 400, null))
    expect(explorerRailWidth(9999, 500)).toBe(PANE_RAIL_METRICS.left.stretch)
    expect(typeof ExplorerRailMath.width).toBe('function')
  })

  // #342 (OB-229, OB-235, OB-209) — the Relations rail's two parts and the numbers published
  // beside them. The rail is MOUNTED (the document pane imports `RelationsRail`, its corner,
  // `orbitBox`, `ORBIT_SELF`, `PanePlaceholder` and `PreviewBanner`), and these are what it
  // renders from inside src/ds: a host that assembled a rail from `RelationOrbit` and
  // `RelationStats` directly is what OB-238 done-when 1 forbids. The math crosses the barrel so
  // a legend or a second drawing can tile the circle the same way the figure does.
  it('RelationOrbit / RelationStats and their math — rendered by RelationsRail; no direct app importer', () => {
    expect(typeof RelationOrbit).toBe('function')
    expect(typeof RelationStats).toBe('function')
    expect(orbitWedge(1)).toBe(180)
    expect(ORBIT_METRICS.minSectors).toBe(2)
    expect(OrbitMath.wedge).toBe(orbitWedge)
    expect(OrbitMath.marks).toBe(orbitMarks)
    expect(OrbitMath.kinds).toBe(orbitKinds)
    expect(StatsMath.of).toBe(relationStats)
    expect(StatsMath.rows).toBe(statKindRows)
    expect(RELATION_STATS_METRICS.trackShare).toBe(52)
    expect(RelationsRailMath.orbitBox(9999, null)).toEqual({ width: PANE_RAIL_METRICS.right.max - 18, height: PANE_RAIL_METRICS.right.max + 6 })
    expect(PANE_PLACEHOLDER_METRICS.minHeight).toBe(120)
    expect(PREVIEW_BANNER_METRICS.height).toBe(16)
  })

  // `nestedFamilyPaint` / `familySlots` / `FAMILY_SLOTS` are NOT listed here because
  // they are ADOPTED: src/model/color.ts feeds the map's territory fill through them
  // (OB-119, #250, 2026-09-05). History worth keeping: the OLD nestedFamilyPaint (a
  // per-node paint keyed on sibling index and depth, OB-086) was deleted by #221 on
  // 2026-08-28 for a measured reason — 94 distinct colours across 711 bordering
  // regions. The DS REWROTE it: the input is now a slot from familySlots(), which
  // the host feeds with real geometric adjacency, so the objection no longer holds.
})
