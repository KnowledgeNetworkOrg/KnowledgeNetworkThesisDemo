// Studio — the shell. It owns three things and nothing else: the header chrome,
// the COMPOSITION (which panes are on, in what order, at what weight), and the
// flexbox that lays them out.
//
// What it no longer owns: the session state, which is state/bus.ts, and the
// list of what a pane even IS, which is studio/instruments.tsx. It used to own
// both — six useStates, eight closures, an InstrumentId union, a CATALOG order,
// a LABEL record, a LENS_TYPE lookup, and a switch that hand-wired every
// instrument's props and was not exhaustiveness-checked. Adding a channel cost
// an edit in every pane that read it; deleting one flat map cost nine edit sites
// here and still left a false sentence in a file this one never mentions.
//
// The split that fixed it: an instrument is an entry in a registry, and it takes
// ONE prop — the bus. A pane that ignores a channel does not know it exists.
//
// It now owns one more thing, and only one: whether the app is PRESENTING
// (#195). That is a mode, not a composition — it replaces this whole tree with
// the deck, on the same bus, leaving active/mounted/flexMap/presetId untouched
// so exiting restores the exact desk that was there.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { AppHeader, CountBadge, EDGE_TOKEN, FamilyColumn, InstrumentGroup, InstrumentRow, Pane, PresetButton, SectionLabel } from '@/ds'
import type { EdgeKind } from '@/ds'

import { byId, topicHueOf } from '../corpus/graph'
import { platform } from '../platform'
import PresenterScreen from '../present/PresenterScreen'
import { PROJECTOR_QUERY, PROJECTOR_WINDOW } from '../present/projector'
import { AppToolbar } from './AppToolbar'
import type { PresentState } from './presentbutton'
import { PALETTE_HOOK_SELECTOR } from './PaletteGlyph'
import { useStudioBus } from '../state/bus'
import { FAMILIES } from './families'
import type { Family } from './families'
import { byInstrument, flattenSlots, INSTRUMENTS, lensTypeOf, PRESETS } from './instruments'
import type { Instrument, InstrumentId, Preset, Slot } from './instruments'

/** the palette's fly-to-the-toolbar transition, in ms. It MUST equal
 *  `--dur-flight`, the token `paletteStyle` transitions on: the CSS runs the
 *  transition and this only decides when to unmount, so a number below it cuts
 *  the animation off mid-flight and one above it leaves an invisible pane
 *  holding its column open.
 *
 *  `--dur-flight` IS THE DS'S OWN TOP RUNG NOW (OB-125), in
 *  src/tokens/motion.css with the rest of the ladder. It used to be a local
 *  `--dur-palette` declared in src/index.css, because the vendored token file is
 *  fingerprinted and a duration the DS did not carry could not be added to it;
 *  the DS added the rung at the same 400ms and that workaround is gone.
 *
 *  The duration has moved twice, and the reasons are worth keeping. It began at
 *  `--dur-hover` (140ms), which is this system's wash duration — right for the
 *  fade, wrong once the same transition also has to move a 220px column of the
 *  desk. It then went to `--dur-move` (200ms), the token motion.css already
 *  spends on a block changing size and position (`--transition-block` is
 *  left/top/width/height at this duration), the file's own rule being that a
 *  relayout should be legible rather than a teleport. 400ms is the owner's call
 *  on top of that: legible was the right principle and 200ms was still short for
 *  a move this wide. The DS took the value as measured, not re-derived.
 *
 *  ONE ASYMMETRY, DELIBERATE. `--dur-flight` collapses to 1ms under
 *  `prefers-reduced-motion` and this timer does not follow it. That is not drift:
 *  the margin below collapses the column as part of the same transition, so a
 *  pane still mounted after the CSS has finished is invisible AND takes no
 *  space. Nothing waits on the timer except the unmount itself. */
const PALETTE_ANIM_MS = 400

/** where the palette is in its flight. `dir` is which way it is going; `phase` is
 *  which hop of the FLIP it is on — `measuring` and `shrink` exist only for
 *  opening, which has to be measured at rest before it can start shrunk. */
type PaletteAnim = { dir: 'closing' | 'opening'; phase: 'measuring' | 'shrink' | 'grow' | 'go'; dx: number; dy: number }

export default function StudioView() {
  // ── composition: which panes are on screen, and how big ───────────────────
  // `mounted` is a superset of `active`: a benched pane stays mounted at
  // display:none so its internal state (an unfold canvas, a zoom level) survives
  // being toggled off and back on.
  // The opening composition is PRESETS[0] — every field of it, id and geometry
  // included. It used to be spelled out three times over, which let the flex
  // weights silently sit out the first render until you clicked a preset.
  // `active` is a list of SLOTS, not of instruments: an entry may be an array,
  // meaning those panes share one column and split it top to bottom. Everything
  // that only cares "is this pane on screen" reads `onScreen` instead.
  const [active, setActive] = useState<Slot[]>(PRESETS[0].active)
  const [mounted, setMounted] = useState<Set<InstrumentId>>(() => new Set(flattenSlots(PRESETS[0].active)))
  const [presetId, setPresetId] = useState<Preset['id'] | null>(PRESETS[0].id)
  const [flexMap, setFlexMap] = useState<Partial<Record<InstrumentId, number>>>(PRESETS[0].flex ?? {})
  // every family starts OPEN: the sidebar is how you reach an instrument, and a
  // palette that hides its contents on first paint is a worse list than the flat
  // one it replaced. Folding is there for when you know what you want.
  const [openFamilies, setOpenFamilies] = useState<Family[]>([...FAMILIES])
  // ── the palette pane: closable, and re-openable (OB-104) ──────────────────
  // It was an always-on <aside> with no ✕ and no toolbar toggle. The DS pairs
  // the two deliberately — a pane that closes with nothing to reopen it is a
  // one-way door — so both arrive together, along with the transition that ties
  // them: closing shrinks the pane toward the toolbar icon it will live in.
  const [showPalette, setShowPalette] = useState(true)
  const paletteWrapRef = useRef<HTMLDivElement | null>(null)
  const [paletteAnim, setPaletteAnim] = useState<PaletteAnim | null>(null)

  /** WHERE THE PANE IS FLYING TO, MEASURED LIVE — not a fixed corner. The icon's
   *  x moves with the toolbar's own content, so a constant was wrong on the DS's
   *  first pass. Centre to centre, since the pane scales about its own centre.
   *
   *  The button is found by its `data-toolbar-hook` (OB-124). It used to be found
   *  by its tooltip, through a whole module of matching machinery, because the DS
   *  `Toolbar` had no stable handle to offer; it does now, so the machinery is
   *  gone rather than repaired. */
  const paletteDelta = () => {
    const wrap = paletteWrapRef.current
    const icon = document.querySelector(PALETTE_HOOK_SELECTOR)
    if (!wrap || !icon) return { dx: 0, dy: 0 }
    const pr = wrap.getBoundingClientRect()
    const ir = icon.getBoundingClientRect()
    return {
      dx: ir.left + ir.width / 2 - (pr.left + pr.width / 2),
      dy: ir.top + ir.height / 2 - (pr.top + pr.height / 2),
    }
  }
  const closePalette = () => {
    setPaletteAnim({ dir: 'closing', phase: 'go', ...paletteDelta() })
    window.setTimeout(() => {
      setShowPalette(false)
      setPaletteAnim(null)
    }, PALETTE_ANIM_MS)
  }
  const openPalette = () => {
    setShowPalette(true)
    setPaletteAnim({ dir: 'opening', phase: 'measuring', dx: 0, dy: 0 })
  }
  // FLIP, in two hops. Opening cannot animate from a box that does not exist yet,
  // so the pane MOUNTS AT REST and is measured before paint (`useLayoutEffect`),
  // then jumped to the shrunk-at-icon start with transitions OFF, then — one
  // frame later — given its transition back and released to rest. Two renders
  // collapsed into one paint; without the transitions-off hop the browser
  // interpolates the jump too and the pane flies the wrong way first.
  useLayoutEffect(() => {
    if (paletteAnim && paletteAnim.dir === 'opening' && paletteAnim.phase === 'measuring') {
      setPaletteAnim({ dir: 'opening', phase: 'shrink', ...paletteDelta() })
    }
  }, [paletteAnim])
  useEffect(() => {
    if (paletteAnim && paletteAnim.dir === 'opening' && paletteAnim.phase === 'shrink') {
      const id = requestAnimationFrame(() => setPaletteAnim((a) => (a && a.phase === 'shrink' ? { ...a, phase: 'grow' } : a)))
      return () => cancelAnimationFrame(id)
    }
  }, [paletteAnim])
  const paletteAtRest = !paletteAnim || paletteAnim.phase === 'grow'
  const paletteStyle: CSSProperties = {
    flex: 'none',
    width: 'var(--sidebar-w)',
    flexShrink: 0,
    // THE DESK HAS TO MAKE ROOM OVER TIME, NOT IN ONE FRAME — the flight alone
    // was never the stutter. Measured before this line existed: closing flew the
    // pane out smoothly (zero dropped frames) and then every other pane jumped
    // 220px sideways in the single frame the unmount landed on. Opening was the
    // same two beats with the lurch first, because mounting at full width makes
    // the room instantly and only then does the pane fly in. One continuous
    // motion followed by a jump reads as a stutter even though each half is
    // clean.
    //
    // A NEGATIVE MARGIN, not an animated width. The wrapper's own box must not
    // change: `transformOrigin` is its centre, so a shrinking box would drag the
    // origin along under the flight and the pane would stop aiming at the icon.
    // This collapses only the space AFTER the wrapper, so the siblings close up
    // while the flight itself is untouched. `0.75rem` is the row's own `gap-3`,
    // which disappears with the column.
    marginRight: paletteAtRest ? 0 : 'calc((var(--sidebar-w) + 0.75rem) * -1)',
    // and the sibling now grows INTO this box while the pane is still fading
    // through it, so the pane has to stay above it
    position: 'relative',
    zIndex: 1,
    transformOrigin: 'center center',
    transform: paletteAnim && !paletteAtRest ? `translate(${paletteAnim.dx}px,${paletteAnim.dy}px) scale(0.06)` : 'translate(0,0) scale(1)',
    opacity: paletteAtRest ? 1 : 0,
    transition:
      paletteAnim && paletteAnim.phase === 'shrink'
        ? 'none'
        : 'transform var(--dur-flight) var(--ease-settle), opacity var(--dur-flight) var(--ease-settle), margin-right var(--dur-flight) var(--ease-settle)',
  }
  // THE PRESENTER IS A MODE OF THE STUDIO, NOT A COMPOSITION (#195, #267; owner
  // 2026-09-03). Live — projecting and not ended — it takes the whole screen: app
  // header, toolbar and palette go, and the presenter's own bar is the chrome. As
  // a PREVIEW (the palette's Present, `projecting: false`) or once ENDED it sits
  // framed beside the palette with the chrome kept, so ending is always a way
  // home. `returnTo` is the composition to come back to; active/mounted/flexMap
  // stay untouched underneath, so leaving restores exactly the desk that was there.
  // Declared above ensureActive, which reads it.
  const [presenter, setPresenter] = useState<{ projecting: boolean; ended: boolean; resumeToken: number; returnTo: Preset['id'] | null } | null>(null)
  const presenting = presenter !== null && presenter.projecting && !presenter.ended
  const presentState: PresentState = presenter === null ? 'idle' : !presenter.projecting ? 'preview' : presenter.ended ? 'ended' : 'live'
  /* THE ▶ (DS OB-135 rules 1–3): the only start. Idle → the lecture starts at the focus;
     previewing → the same panes start projecting; ended → resume. Always with the projector
     window opened — SYNCHRONOUSLY from the click, the popup blocker's one condition — under a
     fixed name, so a second press re-lands the same window rather than opening another. */
  const pressPresent = () => {
    if (presentState === 'live') return
    platform.openWindow('?' + PROJECTOR_QUERY, PROJECTOR_WINDOW)
    setPresenter((p) => (p === null
      ? { projecting: true, ended: false, resumeToken: 0, returnTo: presetId }
      : p.ended ? { ...p, resumeToken: p.resumeToken + 1 } : { ...p, projecting: true }))
  }
  /* the palette's Present (rule 5): not a toggle. Idle → the preview; previewing → nothing;
     ended → back to the preview (the ended pane goes, nothing projected). */
  const pressPreview = () => {
    setPresenter((p) => (p === null
      ? { projecting: false, ended: false, resumeToken: 0, returnTo: presetId }
      : p.ended ? { ...p, projecting: false, ended: false } : p))
  }
  const leavePresenter = () => setPresenter(null)
  const onLectureEnded = (ended: boolean) => setPresenter((p) => (p === null || p.ended === ended ? p : { ...p, ended }))
  // measured once over ALL family names and given to every group, so the counts
  // form one column instead of each group orphaning its own number
  const familyColumn = FamilyColumn([...FAMILIES])

  const onScreen = flattenSlots(active)

  /** drop an instrument from wherever it sits, collapsing a stack it empties */
  const without = (slots: Slot[], inst: InstrumentId): Slot[] =>
    slots
      .map((s) => (Array.isArray(s) ? s.filter((i) => i !== inst) : s))
      .filter((s) => (Array.isArray(s) ? s.length > 0 : s !== inst))
      .map((s) => (Array.isArray(s) && s.length === 1 ? s[0] : s))

  const toggle = (inst: InstrumentId) => {
    setActive((prev) => (flattenSlots(prev).includes(inst) ? without(prev, inst) : [...prev, inst]))
    setMounted((prev) => new Set(prev).add(inst))
    setPresetId(null) // hand-toggling makes the composition "custom" from now on
  }

  /** an instrument handing off to another one: reveal it WITHOUT disturbing the
   * rest of the composition. This is the bus's `reveal`. */
  const ensureActive = (inst: InstrumentId) => {
    // a pane's bus is typed Bus (default Id = string), so it can hand us any
    // string; the seam's rule is a weak answer, never a throw
    if (!byInstrument.has(inst)) return
    // Nothing is composed while presenting, so revealing a pane is meaningless
    // there — and worse than meaningless: activateWalk reveals 'walkviewer', so
    // one step of a SAVED walk inside a deck would quietly rewrite `active` and
    // null `presetId`, and exiting would drop the user into a "custom
    // composition" they never made (#195).
    if (presenting) return
    setActive((prev) => (flattenSlots(prev).includes(inst) ? prev : [...prev, inst]))
    setMounted((prev) => (prev.has(inst) ? prev : new Set(prev).add(inst)))
    setPresetId((p) => (onScreen.includes(inst) ? p : null))
  }

  const applyPreset = (p: Preset) => {
    // the Present preset is the presenter's PREVIEW (Preset.presenter); any other
    // composition preset leaves the presenter first
    if (p.presenter) { pressPreview(); setPresetId(p.id); return }
    setPresenter(null)
    setActive(p.active)
    setFlexMap(p.flex ?? {})
    setPresetId(p.id)
    setMounted((prev) => {
      const next = new Set(prev)
      for (const inst of flattenSlots(p.active)) next.add(inst)
      return next
    })
  }

  // ── the bus ───────────────────────────────────────────────────────────────
  const bus = useStudioBus<InstrumentId>(ensureActive)

  // ── coming back from the presenter (#214) ─────────────────────────────────
  // The desk's panes are NOT mounted while the presenter is up — one instance of
  // everything, the rule #195 set and #267 kept — so every pane is built fresh on
  // the way back and the map arrives at its default whole-world framing, pointing
  // at nothing in particular. You could have spent forty minutes in there.
  //
  // Everything that answers WHERE AM I survives, because it lives on the bus and
  // the bus is not inside any pane: focus, route, trail, visited, the active walk.
  // So the honest repair is not to preserve pixels but to re-publish the place: a
  // look at the current focus, which flies the map to that node's territory in
  // exactly the way ENTERING already does. The same place, not the same pixels —
  // #195's own rule, applied to the half of the round trip that never had it.
  //
  // Watching `presenter` rather than patching each exit means every way out is
  // covered: the presenter pane's ✕, and picking a different preset (which also
  // clears it). In a rAF frame because writing bus state in an effect body is what
  // `react-hooks/set-state-in-effect` forbids — the shape the deck's own arrival
  // effect uses.
  const wasPresenting = useRef(presenter !== null)
  useEffect(() => {
    const leaving = wasPresenting.current && presenter === null
    wasPresenting.current = presenter !== null
    if (!leaving) return
    const id = bus.focus
    if (!id) return
    const f = requestAnimationFrame(() => bus.peekAt(id))
    return () => cancelAnimationFrame(f)
    // the bus's writers are referentially stable by contract (see bus.ts); this
    // fires on the TRANSITION, and re-running it on every bus change would fight
    // the user for the camera they just took back
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenter])

  // ── layout ────────────────────────────────────────────────────────────────
  // A pane does not decide its own size: where it sits does. A lone column, one
  // half of a stacked column and a bottom strip need three different styles, so
  // the caller supplies them and this only owns the chrome.
  //
  // OB-039: this is now the DS Pane rather than a hand-rolled <section> +
  // PaneHeader + clip div. Pane's own frame defaults to flex:1 (it did not
  // used to have a default at all — sizing was 100% the caller's), so a strip
  // with no explicit flex of its own now needs one passed: see the strips
  // mapping below.
  const pane = (inst: Instrument, on: boolean, style: CSSProperties, extra: string) => (
    <Pane
      key={inst.id}
      aria-label={`studio-pane-${inst.id}`}
      data-slot={on ? 'on' : 'benched'}
      className={extra}
      title={inst.label}
      variant="legend"
      legendBg="var(--surface-canopy)"
      face={inst.face}
      onClose={() => toggle(inst.id as InstrumentId)}
      scroll={inst.body === 'none' ? 'none' : 'y'}
      bodyStyle={inst.bodyStyle}
      actions={inst.actions ? inst.actions(bus) : undefined}
      actionBar={inst.actionBar ? inst.actionBar(bus) : undefined}
      style={{ display: on ? 'flex' : 'none', ...style }}
    >
      {inst.render(bus)}
    </Pane>
  )

  /** how wide a column is: a pinned pixel width, or a flex weight the preset may
   * override. A stack takes its LEAD member's weight. */
  const widthOf = (inst: Instrument): CSSProperties => {
    const fixed = typeof inst.flex === 'object' ? inst.flex.fixed : null
    return fixed !== null
      ? { flex: `0 0 ${fixed}px` }
      : { flex: `${flexMap[inst.id as InstrumentId] ?? (typeof inst.flex === 'number' ? inst.flex : 1)} 1 0%` }
  }

  // `order` is what makes the PRESET's array order the visual order, independent
  // of the registry's (DOM) order — so toggling a pane never remounts another.
  const columnSlots = active
    .map((slot, order) => ({
      order,
      members: (Array.isArray(slot) ? slot : [slot])
        .map((id) => byInstrument.get(id)!)
        .filter((i) => i.slot === 'column'),
    }))
    .filter((s) => s.members.length > 0)

  // mounted but not in the composition: kept in the tree at display:none so an
  // unfold canvas or a zoom level survives being toggled off and back on. That
  // only works because these are rendered in the SAME keyed list as the panes
  // that are on — see the note at the list itself (#296).
  const benchedColumns = INSTRUMENTS.filter(
    (i) => i.slot === 'column' && mounted.has(i.id as InstrumentId) && !onScreen.includes(i.id as InstrumentId),
  )
  const strips = INSTRUMENTS.filter((i) => i.slot === 'strip' && mounted.has(i.id as InstrumentId))

  // THE DECK RENDERS INSTEAD OF THE DESK, NOT OVER IT (#195). An overlay would
  // leave both mounted, which means two MapViews and two DocumentPanels — two
  // window listeners, two camera flights, and duplicate aria-labels that make
  // every driver locator ambiguous. Returning early keeps exactly one instance
  // of everything, on the SAME bus, so focus / route / trail / activeWalk are
  // literally the same values on both sides of the transition.
  // THE LECTURE RENDERS INSTEAD OF THE DESK, NOT OVER IT (#195's rule, kept), and
  // the chrome comes off by not putting it on (DS OB-135 rule 4): while a lecture
  // is live the header, the toolbar and the palette are simply not rendered. Every
  // one of them is a `{cond ? … : null}` SLOT, never an early return — the presenter
  // screen must keep one position in the tree across live ↔ framed, or ending a
  // lecture would remount it and lose the record. The screen draws its own frame.
  const presenterScreen = presenter ? (
    <PresenterScreen bus={bus} projecting={presenter.projecting} resumeToken={presenter.resumeToken} onEnded={onLectureEnded} framed={!presenting} onLeave={leavePresenter} />
  ) : null

  return (
    <div className="h-full flex flex-col bg-canopy">
      {presenting ? null : (
      <>
      {/* The header renders from the DS AppHeader; the live counts are DS
          CountBadges (OB-065 dropped the session-control PillButtons outright,
          not relocated — bus.teach()/bus.reset()/bus.clearRoute() are untouched,
          there is simply no UI path to them from here any more). AppHeader owns
          the VISIBLE focus (dot + title). The machine-readable focus hook the
          shot driver reads — data-focus (the id) plus the title as innerText —
          is not something the DS component carries, so the consumer keeps a
          hidden readout twin beside it. See #74: AppHeader has no focus
          test-hook. */}
      <div aria-label="studio-header" style={{ flexShrink: 0, position: 'relative' }}>
        <AppHeader
          product="thesis-demo"
          corpusLine="instrument palette — toggle views on the sidebar, everything shares one focus / route / trail bus"
          focus={bus.focus ? { title: byId.get(bus.focus)!.title, domain: topicHueOf(bus.focus) ?? '' } : null}
        >
          <span aria-label="studio-visited">
            <CountBadge value={bus.visited.size} label="visited" />
          </span>
          <span aria-label="studio-route">
            <CountBadge value={bus.route.length} label="route" />
          </span>
        </AppHeader>
        {/* hidden readout twin: the shot driver reads focus id + title from here */}
        <span data-focus={bus.focus ?? ''} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          {bus.focus ? byId.get(bus.focus)!.title : ''}
        </span>
      </div>

      {/* #55: app-level operations, pinned directly under the app header */}
      <AppToolbar present={{ state: presentState, onClick: pressPresent }} palette={{ on: showPalette, onToggle: () => (showPalette ? closePalette() : openPalette()) }} />
      </>
      )}

      <div className={presenting ? 'flex-1 min-h-0 flex' : 'flex-1 min-h-0 flex gap-3 p-3'}>
        {/* #96: the palette is a pane — paper face, border-frame hairline,
            rounded-lg, legend header. It was a flat bordered sidebar
            (border-r border-slate-200 bg-white) which read as an unfinished
            migration against the warm panes beside it.
            OB-104: it is the DS `Pane` itself now, not a hand-rolled frame around
            a `PaneHeader` — the ✕ is `Pane`'s `onClose`, and hand-rolling the
            frame is exactly how the app ended up without one. The wrapper div is
            not decoration: it owns the width and the flight transform, so the
            pane inside is free to be a plain full-height pane. */}
        {showPalette && !presenting ? (
        <div ref={paletteWrapRef} style={paletteStyle}>
        <Pane
          as="aside"
          aria-label="studio-sidebar"
          title="palette"
          variant="legend"
          legendBg="var(--surface-canopy)"
          onClose={closePalette}
          scroll="both"
          style={{ height: '100%' }}
        >
            <div className="border-b border-hair p-3 pt-2">
              <SectionLabel>presets</SectionLabel>
              <div className="flex flex-col gap-1">
                {PRESETS.map((p) => (
                  <div key={p.id} aria-label={`studio-preset-${p.id}`}>
                    {/* OB-106: picking a named preset closes the palette through the
                        same transition the ✕ uses. You picked a composition; the
                        chooser has done its job and gets out of the way. */}
                    <PresetButton
                      label={p.label}
                      hint={p.hint}
                      active={presetId === p.id}
                      onClick={() => {
                        applyPreset(p)
                        if (showPalette) closePalette()
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 flex-1">
              <SectionLabel>instruments</SectionLabel>
              {/* #97: the flat INSTRUMENTS.map is now the DS InstrumentGroup, one
                  family per group. FamilyColumn is measured ONCE over every family
                  name and handed to all of them, so the on-screen counts land on a
                  single x instead of each group orphaning its own number. A group
                  reports how many of its members are on screen, so a folded family
                  still says something. */}
              <div className="flex flex-col gap-0.5">
                {FAMILIES.map((fam) => {
                  const members = INSTRUMENTS.filter((i) => i.family === fam)
                  if (members.length === 0) return null
                  return (
                    <InstrumentGroup
                      key={fam}
                      label={fam}
                      labelWidth={familyColumn}
                      open={openFamilies.includes(fam)}
                      onToggle={() => setOpenFamilies((f) => (f.includes(fam) ? f.filter((x) => x !== fam) : [...f, fam]))}
                      count={members.filter((i) => onScreen.includes(i.id as InstrumentId)).length}
                    >
                      {members.map((inst) => {
                        const lensType = lensTypeOf(inst.id)
                        return (
                          <div key={inst.id} aria-label={`studio-inst-${inst.id}`}>
                            <InstrumentRow
                              label={inst.label}
                              on={onScreen.includes(inst.id as InstrumentId)}
                              swatch={lensType ? EDGE_TOKEN[lensType as EdgeKind] : undefined}
                              onClick={() => toggle(inst.id as InstrumentId)}
                            />
                          </div>
                        )
                      })}
                    </InstrumentGroup>
                  )
                })}
              </div>
            </div>
        </Pane>
        </div>
        ) : null}

        {/* #77/#96: the canopy desk. Panes float on it with gap-3 between them;
            the 12px gutter matches the p-3 window inset on the outer flex row.
            Canopy is now on the root div — no inline background needed here. */}
        {presenter ? (
          /* THE PRESENTER — framed like a pane beside the palette while previewing or ended,
             the whole window while live; the screen draws the frame itself so this slot never
             changes shape. The instruments are not mounted meanwhile — one instance of
             everything, the same rule the deck kept. */
          presenterScreen
        ) : (
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* ONE KEYED LIST, on panes and benched panes together (#296). Written as
              two adjacent expressions — `{columns}{benched}` — this was two separate
              child slots, and React matches keys only WITHIN one array. So switching
              a pane off did not flip a flag on a component that stayed put; it moved
              the component from one child slot to the other, which is an unmount and
              a fresh mount. `display:none` never got the chance to do the job the
              comment above credits it with, and an unfold canvas or a map camera was
              thrown away every time the composition changed. Spreading both into a
              SINGLE array is the whole fix: identity now travels with the key, and
              `on` is just a prop.

              STILL TRUE, and deliberately not fixed here: a pane moving in or out of
              a STACK (Plan's palette-over-document) does change parent, because a
              stack is a real wrapper element. Only Plan stacks anything today, and
              what it costs is a scroll position rather than a canvas. Fixing it means
              expressing stacks in CSS instead of nesting, which is a layout rewrite
              and wants its own change. */}
          <div className="flex-1 min-h-0 flex gap-3">
            {[
              ...columnSlots.map(({ order, members }) =>
                members.length === 1 ? (
                  pane(members[0], true, { order, ...widthOf(members[0]) }, '')
                ) : (
                  <div
                    key={members.map((m) => m.id).join('+')}
                    aria-label={`studio-stack-${members.map((m) => m.id).join('-')}`}
                    className="flex flex-col min-w-0 min-h-0 gap-3"
                    style={{ order, ...widthOf(members[0]) }}
                  >
                    {members.map((m) =>
                      pane(
                        m,
                        true,
                        // stackGrow:false sizes the pane to its content and hands the
                        // slack to its stack-mates; the default takes an even share.
                        { flex: m.stackGrow === false ? '0 0 auto' : '1 1 0%' },
                        '',
                      ),
                    )}
                  </div>
                ),
              ),
              ...benchedColumns.map((i) => pane(i, false, {}, '')),
            ]}
          </div>
          {strips.map((i) =>
            pane(
              i,
              onScreen.includes(i.id as InstrumentId),
              {
                order: onScreen.indexOf(i.id as InstrumentId),
                // a strip is never stretched by the desk's own flex column — Pane's
                // frame defaults to flex:1 (the hand-rolled <section> it replaces
                // had no default at all), so an explicit height pins it and a
                // heightless one still hugs its own content instead of growing
                flex: 'none',
                height: i.height ? `${i.height}px` : undefined,
              },
              'w-full',
            ),
          )}
        </div>
        )}
      </div>
    </div>
  )
}
