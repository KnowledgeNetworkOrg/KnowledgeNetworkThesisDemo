// The presenter screen — THE REFERENCE CALL SHAPE for presenter mode: PresenterHeaderBar, FilmRoll,
// PresenterStrip, StopFinder, ProjectedMap, LectureNotes, QuickActionsDeck and LectureRecap (all
// eight parts of the split) on one store.
// Mounted by the Studio shell as its presenter mode: it takes the whole area under the app header
// (`projecting` true — the toolbar ▶ — hides the toolbar too; the presenter header IS that mode's
// toolbar) or sits framed beside the palette as a PREVIEW (`projecting={false}` — the palette's
// Present: the layout, no clock, nothing on the projector).
//
// PARTS 5, 6 AND 7 LANDED 2026-09-03 and the stand-ins are gone: `LectureNotes` is the flex:1
// min-height:0 pane under the strip (open the strip and it shrinks — the column rule, now
// demonstrated by the real pane), `QuickActionsDeck` is the 360px column beside it, still carrying
// PLACEHOLDER tiles by the owner's call, and `LectureRecap` replaces the roll and the strip once
// the lecture has ended. None of the three is filed to the app side yet.
//
// Loaded as a plain script by the shell's <x-import> chain — nothing here may read a global at
// module scope. Bindings are filled by bindDeps() on the first render that finds both globals.
let NS
let PresenterHeaderBar, FilmRoll, PresenterStrip, StopFinder, ProjectedMap, StepDot, Pane, PillButton, DOMAIN_TOKEN
let LectureNotes, QuickActionsDeck, LectureRecap, swapActions
let DOMAINS, byId, WALKS
let bound = false
function bindDeps() {
  if (bound) return true
  const ns = window.KnowledgeNetworkDesignSystem_0ec749
  const kns = window.KNS
  if (!ns || !kns || !ns.PresenterStrip || !ns.StopFinder || !ns.FilmRoll || !ns.PresenterHeaderBar) return false
  NS = ns
  /* `ProjectedMap` is bound OPTIONALLY: on a bundle one turn behind, `wall(i)` falls back to the
     slide and the presenter still renders — a stale bundle means "no map", never "no presenter" */
  ;({ PresenterHeaderBar, FilmRoll, PresenterStrip, StopFinder, ProjectedMap, StepDot, Pane, PillButton, DOMAIN_TOKEN } = ns)
  /* parts 5–7 are bound OPTIONALLY for the same reason `ProjectedMap` is: on a bundle one turn
     behind, each falls back to a labelled note and the presenter still renders */
  ;({ LectureNotes, QuickActionsDeck, LectureRecap } = ns)
  /* the deck's pure swap; on a bundle one turn behind it is absent, so a shelf drag then leaves the
     lists as they are rather than throwing */
  swapActions = (ns.QuickActionsMath && ns.QuickActionsMath.swap) || ((g, l) => ({ groups: g, library: l }))
  ;({ DOMAINS, byId, WALKS } = kns)
  bound = true
  return true
}

const BOOKED_S = 50 * 60
/* the clock face is the system's (`LectureClock.mmss`, published so it is written once); read at
   call time, which is always after bindDeps() has found the namespace. Was a retyped copy until
   2026-10-01. */
const mmss = (s) => NS.LectureClock.mmss(s)

/* THE LECTURE'S STOPS, from the corpus: every authored walk in order, one lecture. A stop's
   territory is its domain's title; its hue NAME comes off the published `DOMAIN_TOKEN` (the
   example's six `var(--hue-<name>)` strings — `topicPaint` is deliberately lower-case and does not
   reach the namespace a template reads) — the same two fields the strip, the finder and the header
   read. */
const hueOf = (domain) => { const m = /--hue-([a-z]+)/.exec(DOMAIN_TOKEN[domain] || ''); return m ? m[1] : null }
/* ONE WALK when the start card named one (`walkId`, 2026-10-01): a lecture from the card is that
   walk, so a stop's index here IS its index in the walk, which is what the session's `last` records.
   Without one (the palette's preview) it is every walk in order, as before. */
function lectureSteps(walkId) {
  const out = []
  WALKS.filter((w) => walkId == null || w.id === walkId).forEach((w) => w.stops.forEach((s) => {
    const n = byId[s.id]; if (!n) return
    out.push({ id: s.id, title: n.title, territory: byId[n.domain] ? byId[n.domain].title : '', hue: hueOf(n.domain), note: s.note, walk: w.title, walkId: w.id })
  }))
  return out
}

/* ONE SLIDE — the projector's own layout at the 1120×630 reference. `Scaled` fits that reference into
   whatever box the roll, the preview or the full-screen overlay gives it. */
function Scaled({ children }) {
  const ref = React.useRef(null)
  const [w, setW] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver((e) => setW(e[0].contentRect.width)); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1120, height: 630, transform: 'scale(' + (w / 1120) + ')', transformOrigin: '0 0' }}>{children}</div>
    </div>
  )
}
function Slide({ step, index, count }) {
  return (
    <Scaled>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bark-50)', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, padding: '62px 62px 0' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--hue-' + step.hue + '-ink)' }}>{step.territory} · stop {index + 1} of {count}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, lineHeight: 1.12, fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', letterSpacing: 'var(--ls-display)', marginTop: 12 }}>{step.title}</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 21, lineHeight: 1.65, color: 'var(--text-1)', marginTop: 22, maxWidth: 820, textWrap: 'pretty' }}>{step.note}</div>
      </div>
      <div style={{ flex: 'none', height: 32, borderTop: '1px solid var(--border-hair)', background: 'var(--bark-100)', display: 'flex', alignItems: 'center', padding: '0 26px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{step.walk}</div>
    </div>
    </Scaled>
  )
}

/* THE FINDER'S MAP ASIDE — the app's is the real map; this one places the six domains as
   territories and lights the selected stop's. It stands in for the drawing, not the rule. */
function TerritoryAside({ steps, index }) {
  const W = 220, H = 280
  const cells = [[0.22, 0.2], [0.68, 0.18], [0.2, 0.52], [0.72, 0.5], [0.28, 0.82], [0.7, 0.82]]
  const step = index != null ? steps[index] : null
  const focus = step ? byId[step.id].domain : null
  return (
    <svg width={W} height={H} style={{ display: 'block', background: 'var(--pond-50)' }}>
      {DOMAINS.map((d, k) => {
        const hot = d.id === focus, hue = hueOf(d.id), cx = cells[k][0] * W, cy = cells[k][1] * H
        return <g key={d.id} style={{ transition: 'transform var(--dur-move) var(--ease-soft)', transform: hot ? 'scale(1.14)' : 'none', transformOrigin: cx + 'px ' + cy + 'px' }}>
          <ellipse cx={cx} cy={cy} rx={48} ry={34} fill={'var(--hue-' + hue + '-wash-raised)'} stroke={'var(--hue-' + hue + '-stroke)'} strokeWidth={hot ? 1.5 : 1} strokeOpacity={hot ? 0.8 : 0.4} opacity={focus && !hot ? 0.5 : 1} />
          <text x={cx} y={cy + 3} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="8.5" fontWeight="700" letterSpacing="0.05em" fill={'var(--hue-' + hue + '-ink)'} style={{ textTransform: 'uppercase' }}>{d.title.length > 18 ? d.title.split(' ')[0] : d.title}</text>
          {hot ? <circle cx={cx + 22} cy={cy - 14} r={5} fill="var(--accent-walk)" /> : null}
        </g>
      })}
      <text x={W / 2} y={H - 10} textAnchor="middle" fontFamily="var(--font-ui)" fontSize="10" fill="var(--text-3)">{step ? (index + 1) + '. ' + step.title : 'hover a stop'}</text>
    </svg>
  )
}

/* THE STAND-IN for the app's map inside `ProjectedMap` (part 4, rule 4 of its contract): the six
   domains as territories, EVERY stop of the lecture a numbered pin, the covered stops and the stop on
   the wall joined by the walk line, that stop `current`. Unbanded — the wall shows the whole walk.
   Drawn at a 1120×598 reference and fitted to the real box the component hands it (it is not
   scaled by the component — a canvas map would stay crisp the same way). */
function LectureMap({ steps, covered, lit }) {
  const ref = React.useRef(null)
  const [box, setBox] = React.useState([0, 0])
  React.useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver((e) => setBox([e[0].contentRect.width, e[0].contentRect.height])); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const RW = 1120, RH = 598
  const cells = [[0.18, 0.3], [0.5, 0.22], [0.82, 0.3], [0.2, 0.72], [0.5, 0.78], [0.82, 0.72]]
  const s = Math.min(box[0] / RW, box[1] / RH), ox = (box[0] - RW * s) / 2, oy = (box[1] - RH * s) / 2
  /* a stop sits inside its domain's territory, fanned by its rank within that domain */
  const perDomain = {}
  const pos = steps.map((st) => {
    const d = byId[st.id].domain, k = Math.max(0, DOMAINS.findIndex((x) => x.id === d))
    const r = (perDomain[d] = (perDomain[d] || 0) + 1) - 1
    const a = r * 2.4 + k, rad = 34 + r * 18
    return [ox + (cells[k][0] * RW + Math.cos(a) * rad) * s, oy + (cells[k][1] * RH + Math.sin(a) * rad * 0.7) * s]
  })
  const onLine = steps.map((_, i) => i).filter((i) => i === lit || covered.indexOf(i) >= 0)
  const d = onLine.map((i, j) => (j ? 'L' : 'M') + pos[i][0] + ' ' + pos[i][1]).join(' ')
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {s ? DOMAINS.map((dm, k) => {
        const hue = hueOf(dm.id), cx = ox + cells[k][0] * RW * s, cy = oy + cells[k][1] * RH * s
        return <React.Fragment key={dm.id}>
          <div style={{ position: 'absolute', left: cx - 150 * s, top: cy - 105 * s, width: 300 * s, height: 210 * s, borderRadius: '46% 54% 50% 44%', background: 'var(--hue-' + hue + '-wash-raised)', border: '1px solid var(--hue-' + hue + '-stroke)', boxSizing: 'border-box', opacity: 0.9 }} />
          <div style={{ position: 'absolute', left: cx, top: cy - 88 * s, transform: 'translate(-50%,-50%)', fontFamily: 'var(--font-ui)', fontSize: Math.max(9, 12 * s), fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--hue-' + hue + '-ink)', whiteSpace: 'nowrap' }}>{dm.title}</div>
        </React.Fragment>
      }) : null}
      <svg width={box[0]} height={box[1]} style={{ position: 'absolute', left: 0, top: 0 }}>
        <path d={d} fill="none" stroke="var(--surface-raised)" strokeWidth={4 * s} strokeOpacity="0.92" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="var(--accent-walk)" strokeWidth={2 * s} strokeLinejoin="round" />
      </svg>
      {s ? pos.map((p, i) => <div key={i} style={{ position: 'absolute', left: p[0], top: p[1], transform: 'translate(-50%,-50%)' }}><StepDot variant="pin" n={i + 1} size={Math.max(14, 26 * s)} state={i === lit ? 'current' : covered.indexOf(i) >= 0 ? 'done' : 'ahead'} /></div>) : null}
    </div>
  )
}

/* THE ONE FALLBACK LEFT. A part that is in the sources but not yet in the LOADED bundle (the
   bundle compiles at the end of the turn that added it) draws a labelled dashed note rather than
   nothing, and never gates the rest of the screen — a stale bundle means "this pane is one turn
   behind", never "no presenter". */
function MissingPart({ part, name, style }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', border: '1px dashed var(--border-dashed)', borderRadius: 'var(--radius-lg)', padding: 16, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 'var(--lh-normal)', color: 'var(--text-2)', textAlign: 'center', ...style }}>
      <span style={{ maxWidth: '48ch' }}>{name} (part {part} of the split) is in the sources but not in the loaded bundle yet — it compiles at the end of this turn. Reload and this note goes away.</span>
    </div>
  )
}

/* THE UP/DOWN MOTION FOR THE WALL (owner, 2026-09-03, revised same day): the map grows from a
   small pane at the slide's own TOP-RIGHT corner into the full box on the way up. Going down is
   NOT one motion — it is two, in sequence: first it shrinks back into that same small pane and
   STAYS a real, fully-opaque small pane overlaying the slide for a beat (so it reads as "put
   away", not as an special-effect wipe), and only THEN fades out and unmounts. `grown` drives the
   scale (`--dur-flight`, top-right anchored via `transformOrigin: '100% 0'`); `visible` drives
   the opacity (`--dur-fade`) and is a SEPARATE, later step on the way down — never simultaneous
   with the shrink the way the way up's grow-and-appear-together is. The double-rAF on the way up
   is so the small starting frame actually PAINTS before the transition to full size begins — a
   single rAF can still land in the same frame the element mounted in, on some browsers, and skip
   straight to the end state. */
function WallTransition({ up, slide, map }) {
  const [mounted, setMounted] = React.useState(up)
  const [grown, setGrown] = React.useState(up)
  const [visible, setVisible] = React.useState(up)
  const timer = React.useRef(null)
  React.useEffect(() => {
    clearTimeout(timer.current)
    if (up) {
      setMounted(true); setVisible(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)))
    } else {
      setGrown(false) // shrink first, staying fully visible as a small pane over the slide
      timer.current = setTimeout(() => {
        timer.current = setTimeout(() => { // held a beat as that small pane, then fades
          setVisible(false)
          timer.current = setTimeout(() => setMounted(false), 260)
        }, 260)
      }, 400)
    }
    return () => clearTimeout(timer.current)
  }, [up])
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {slide}
      {mounted ? (
        <div style={{
          position: 'absolute', inset: 0, transformOrigin: '100% 0', overflow: 'hidden',
          transform: grown ? 'scale(1)' : 'scale(0.3)', opacity: visible ? 1 : 0,
          borderRadius: grown ? 0 : 'var(--radius-md)', boxShadow: grown ? 'none' : 'var(--lift-3)',
          transition: 'transform var(--dur-flight) var(--ease-soft), border-radius var(--dur-flight) var(--ease-soft), opacity var(--dur-fade) var(--ease-soft)',
        }}>{map}</div>
      ) : null}
    </div>
  )
}

function Presenter(props) {
  if (!bindDeps()) return <div style={{ padding: 24, fontFamily: 'var(--font-ui)', color: 'var(--text-3)' }}>loading the design system…</div>
  const steps = React.useMemo(() => lectureSteps(props.walkId), [props.walkId])
  const N = steps.length
  const stepTitles = React.useMemo(() => steps.map((st) => st.title), [steps])
  /* THE STORE — the three facts and the transient UI, all here. Components ask; this decides.
     `startAt` may be a corpus node id (the Studio's focus when Present was chosen) or an index. */
  const startIndex = typeof props.startAt === 'string' ? Math.max(0, steps.findIndex((s) => s.id === props.startAt)) : Math.min(N - 1, props.startAt != null ? props.startAt : 4)
  const [activeStop, setActiveStop] = React.useState(startIndex)
  const [roamingStop, setRoamingStop] = React.useState(null)
  const [covered, setCovered] = React.useState(() => Array.from({ length: Math.min(N, startIndex) }, (_, i) => i))
  const [finder, setFinder] = React.useState(null)
  const [stripOpen, setStripOpen] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [ended, setEnded] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  /* THE MAP ON THE WALL (part 4) — on request only. M puts it up, M takes it down; nothing else puts
     it up. While up, stepping and roaming move the lit pin and the caption, not the map. Ending the
     lecture takes it down. It replaces the slide on every wall surface (the roll's live card, full
     screen) and on none of the others. */
  const [mapUp, setMapUp] = React.useState(false)
  /* THE NOTEBOOK (part 5). One list for the whole lecture, each entry recording the stop it was
     written ABOUT — so an entry made while roaming files against the ROAMED stop, which is the
     one thing only the host knows. The prepared notes are the corpus's (each stop's own note);
     the entries, the draft and the chosen category are all held here so the recap and the
     header's tally read the same three facts. */
  const [entries, setEntries] = React.useState([])
  const [draft, setDraft] = React.useState('')
  /* v4, amended 15 Oct (owner): the composer starts on the film roll's usual type. `undefined` means
     "not chosen yet" and the pane shows the usual type; picking "no type" sets `null` */
  const [noteCat, setNoteCat] = React.useState(undefined)
  /* THE CATEGORY SET IS THE PROFESSOR'S, NOT THE STOP'S (owner, 2026-09-03). The pane hands back
     a finished `NoteCategory` (glyph and wash already spent from `NOTE_CATEGORY_POOL`) and the
     host persists it AGAINST THE USER: it has to survive a stop change, the end of the lecture,
     a reload and a different device. This screen keeps it in `localStorage` because that is as
     far as a design-system reference host can go — the real store is the app's, and that is the
     one piece of part 5 this side cannot finish. The PREPARED notes are the same boundary: the
     pane edits them in place, so `onPreparedCommit` writes into the `noteEdits` override map
     below rather than into the corpus object, which this screen does not own. */
  /* THE USUAL FLAG TYPE IS THE PROFESSOR'S HABIT, stored against the user like the type list (owner,
     15 Oct: a type picked on the ring becomes the default, and it saves). One key for the roll, the
     recap and the composer, so the three agree */
  const USUAL_KEY = 'kn.presenter.usualFlag'
  const [usualFlag, setUsualFlagState] = React.useState(() => { try { return window.localStorage.getItem(USUAL_KEY) || 'fix' } catch (e) { return 'fix' } })
  const setUsualFlag = (k) => { setUsualFlagState(k); try { window.localStorage.setItem(USUAL_KEY, k) } catch (e) {} }
  const CATS_KEY = 'kn.presenter.userNoteCategories'
  const [mintedCats, setMintedCats] = React.useState(() => {
    try { const raw = window.localStorage.getItem(CATS_KEY); const v = raw ? JSON.parse(raw) : null; return Array.isArray(v) ? v : [] } catch (e) { return [] }
  })
  const addCategory = (c) => setMintedCats((l) => {
    const next = l.concat([c])
    try { window.localStorage.setItem(CATS_KEY, JSON.stringify(next)) } catch (e) { /* private mode: the category lasts the session */ }
    return next
  })
  const noteCats = (NS && NS.NOTE_CATEGORIES ? NS.NOTE_CATEGORIES : []).concat(mintedCats)
  /* WHERE THE PROFESSOR PUT THE SHELF is the same kind of fact as a minted category: a habit of
     theirs, not a state of the lecture, so it is stored against the USER and outlives the reload.
     A DELTA, not a point — the shelf is placed beside the pane and the side is measured per open
     (see `shelfPosition` in the contract). `localStorage` is as far as a reference host goes; the
     real store is the app's. */
  const SHELF_KEY = 'kn.presenter.shelfOffset'
  const [shelfPos, setShelfPos] = React.useState(() => {
    try { const v = JSON.parse(window.localStorage.getItem(SHELF_KEY) || 'null'); return v && typeof v.x === 'number' ? v : { x: 0, y: 0 } } catch (e) { return { x: 0, y: 0 } }
  })
  const moveShelf = (p) => {
    setShelfPos(p)
    try { window.localStorage.setItem(SHELF_KEY, JSON.stringify(p)) } catch (e) { /* private mode: the position lasts the session */ }
  }
  /* the shell's store, so every divider in the Studio persists the same way (owner, 2026-09-23).
     The shell mounts this screen, so its file has already run; the fallback is only for a page
     that mounts the presenter alone, where the setting then lasts the session. */
  const useStored = (window.KnStudioStore && window.KnStudioStore.useStoredState) || ((k, fb) => React.useState(fb))
  /* v4: the pane's right column is now the Class chat, so its width is a new setting (a stored During
     width of 300 would open the parked chat wide); the prepared notes' height above the flags is the
     second, stored the same way */
  const [notesSplit, setNotesSplit] = useStored('presenter:chat-width', null)
  const [prepH, setPrepH] = useStored('presenter:prepared-height', null)
  /* THE DIVIDER BETWEEN THE NOTES PANE AND THE DECK (owner, 2026-09-23) — `PaneDivider`'s four
     host obligations, the same as the Studio desk's: (1) the width lives HERE (`deckPref`, px, the
     professor's drag; null = the deck's own seed); (2) the drawn width is DERIVED from the measured
     row every render, so a width chosen on a wide screen cannot push the handle off a narrow one;
     (3) the store is written on release only, with what was dragged to; (4) both panes declare
     their fit — `LECTURE_NOTES_FIT` and `QUICK_ACTIONS_FIT`, the components' own numbers. The
     literals after `||` are those same numbers for a bundle one turn behind, nothing more. */
  const [deckPref, setDeckPref] = useStored('presenter:deck', null)
  const [deckLive, setDeckLive] = React.useState(null)
  const deckStart = React.useRef(null)
  const [paneRowW, setPaneRowBox] = NS.RailMath.usePaneWidth()
  const DM = NS.DeskMath
  const notesFit = NS.LECTURE_NOTES_FIT || { narrowBelow: 522, floor: 522 }
  const deckFit = NS.QUICK_ACTIONS_FIT || { narrowBelow: 300, floor: 300, seed: 360 }
  const rowFits = [notesFit, deckFit]
  const hitW = DM ? DM.METRICS.hit : 14
  const rowAvail = Math.max(0, paneRowW - hitW)
  const deckWant = deckLive != null ? deckLive : (deckPref != null ? deckPref : deckFit.seed)
  const deckW = paneRowW ? Math.max(Math.min(deckFit.floor, rowAvail), Math.min(deckWant, rowAvail - notesFit.floor)) : deckWant
  const rowSizes = [rowAvail - deckW, deckW]
  const deckClamp = (base, d) => DM.clamp({ sizes: base, index: 0, delta: d, fits: rowFits })[1]
  const [noteEdits, setNoteEdits] = React.useState({})
  /* THE DECK (part 6). Its tiles are the component's own PLACEHOLDERS — the contents are still the
     owner's open call (2026-09-03), so the Studio wires the MECHANIC and proposes no actions: the
     shelf holds placeholder tiles too, and a drag exchanges one for another. Held in state because
     the exchange is the host's to perform. */
  const [deckGroups, setDeckGroups] = React.useState(() => (NS.QUICK_ACTION_PLACEHOLDERS || []).map((g) => ({ ...g, actions: g.actions.slice() })))
  const [shelf, setShelf] = React.useState(() => [1, 2, 3, 4].map((n) => ({ id: 'shelf-' + n, label: 'Shelf action ' + n, placeholder: true })))
  const [shelfOpen, setShelfOpen] = React.useState(false)
  /* PROJECTING OR NOT (owner, 2026-09-03). `projecting={false}` is the palette's Present: the same
     layout, nothing on the projector. No clock runs, the header reads "Preview", its ■ is faded,
     End does nothing. Stepping and roaming still work — the point is to see the panes — but nothing
     is the lecture's record. Flipping to `true` (the toolbar ▶) STARTS the lecture here and now:
     clocks from zero, the record cleared to the stops before the active one. Default true. */
  const projecting = props.projecting !== false
  /* the clocks: lecture elapsed (stops when ended), and time on the current stop */
  const start = React.useRef(Date.now() - (props.startElapsed != null ? props.startElapsed : 0) * 1000)
  const stopStart = React.useRef(Date.now())
  const endedAt = React.useRef(null)
  const [, tick] = React.useState(0)
  React.useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id) }, [])
  const elapsedS = projecting ? ((endedAt.current || Date.now()) - start.current) / 1000 : 0
  const wasProjecting = React.useRef(projecting)
  React.useEffect(() => {
    if (projecting && !wasProjecting.current) {
      start.current = Date.now(); stopStart.current = Date.now(); endedAt.current = null
      setEnded(false); setRoamingStop(null); setMapUp(false); setCovered(Array.from({ length: activeStop }, (_, i) => i))
    }
    /* back to preview (the palette's Present after a lecture ended): the ended pane goes, the layout
       shows again with nothing projected */
    if (!projecting && wasProjecting.current) { endedAt.current = null; setEnded(false); setConfirmOpen(false); setRoamingStop(null) }
    wasProjecting.current = projecting
  }, [projecting])
  const roaming = roamingStop != null
  const shown = roaming ? roamingStop : activeStop
  const cover = (i) => setCovered((c) => (c.indexOf(i) >= 0 ? c : c.concat(i)))
  /* ARROWS ADVANCE WHATEVER YOU ARE ON: presenting, → moves the record and covers the stop left
     behind; roaming, → moves only the roam. The active node otherwise moves on a hold alone. */
  const step = (d) => {
    if (ended) return
    if (roaming) { setRoamingStop(Math.max(0, Math.min(N - 1, roamingStop + d))); return }
    const to = Math.max(0, Math.min(N - 1, activeStop + d))
    if (to === activeStop) return
    cover(activeStop); setActiveStop(to); stopStart.current = Date.now()
  }
  const roamTo = (i) => { if (ended) return; setRoamingStop(i === activeStop ? null : i) }
  const makeActive = (i) => { cover(activeStop); setActiveStop(i); setRoamingStop(null); stopStart.current = Date.now() }
  /* v4 (owner, 6 Oct): A FLAG IS A ROW, not a per-slide switch. Every flag and every typed note is
     one entry in `entries` — `{ id, stop, category?, text, when, at, resolvedAt? }` — and a slide is
     "flagged" while it has an unresolved one. The film roll's chip and the recap's chip both call
     `addFlag` (a bare flag of the type picked); the composer calls `saveNote`. DELETE RESOLVES:
     `resolvedAt` is stamped and the row is kept; the 4-second undo clears it again. A FRESH flag's
     undo ERASES it, because a mis-tap should leave no record.
     THE SHELL'S PER-STOP LIST (`StopFlagRecord`, toggled by `onFlagChange`) is the old model and is
     still what the Studio stores; it is reported only when a slide CROSSES between flagged and not,
     so its toggle stays in step. The preview flags nothing: only presenting reports (owner). */
  const openAt = (list, i) => list.some((e) => e.stop === i && !e.resolvedAt)
  const reportCross = (before, after, i) => {
    if (openAt(before, i) === openAt(after, i)) return
    if (projecting && props.onFlagChange && steps[i]) props.onFlagChange({ walkId: steps[i].walkId, stopId: steps[i].id, at: Date.now() })
  }
  const change = (fn, i) => setEntries((l) => { const next = fn(l); if (i != null) reportCross(l, next, i); return next })
  const addFlag = (i, category) => change((l) => [{ id: 'f' + Date.now(), stop: i, category, text: '', when: mmss(elapsedS), at: Date.now() }].concat(l), i)
  const resolveEntry = (e) => change((l) => l.map((x) => (x.id === e.id ? { ...x, resolvedAt: Date.now() } : x)), e.stop)
  const restoreEntry = (e) => change((l) => l.map((x) => (x.id === e.id ? { ...x, resolvedAt: undefined } : x)), e.stop)
  const undoEntry = (e) => change((l) => l.filter((x) => x.id !== e.id), e.stop)
  const retype = (e, category) => setEntries((l) => l.map((x) => (x.id === e.id ? { ...x, category } : x)))
  const flagged = (i) => openAt(entries, i)
  /* the strip and the finder still read flagged stops as an index list; it is derived, never stored */
  const flags = steps.map((_, i) => i).filter(flagged)
  /* the pane hands back `{ category, text }` and nothing else — the stop, the clock and the
     clearing of the draft are the host's, because only the host knows whether the save landed.
     THE STOP IS STORED ON THE ENTRY and `when` carries the TIME ALONE: the During column is the
     shown stop's notes (2026-09-03), so a stop on every row is one fact repeated down the list
     — the recap's cross-stop list is where the stop goes back in. An entry made while roaming files
     against the ROAMED stop, which is the one thing only the host knows. */
  /* THE STOP ARRIVES WITH THE NOTE (2026-09-04): the pane is handed `stop={shown}` and stamps it on
     what it saves, so "an entry made while roaming files against the ROAMED stop" is the pane's
     code, not this host's sentence. `when` and the id stay here — the clock is the host's. */
  const saveNote = ({ category, text, stop }) => {
    const i = stop != null ? stop : shown
    change((list) => [{ id: 'n' + Date.now(), stop: i, category, text, when: mmss(elapsedS), at: Date.now() }].concat(list), i)
    setDraft('')
  }
  /* EDITING A NOTE HAPPENS IN PLACE (owner, 2026-09-04): the pane's pencil opens the row's own words
     as an InlineText and reports the committed text; the host writes it back by id. The composer
     shape this replaced (draft + category, row gone, ⏎ re-files) is gone from the reference host. */
  const commitNote = (e, text) => setEntries((l) => l.map((x) => (x.id === e.id ? { ...x, text } : x)))
  /* THE EXCHANGE IS `swapActions` (2026-09-04) — the deck's own pure function; this host owns the
     two lists and nothing else about the swap. */
  const swapAction = (shelfId, deckId) => {
    const next = swapActions(deckGroups, shelf, shelfId, deckId)
    setDeckGroups(next.groups); setShelf(next.library)
  }
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Backspace' && roaming) setRoamingStop(null)
      else if (e.key === 'e' || e.key === 'E') setStripOpen((o) => !o)
      else if ((e.key === 'm' || e.key === 'M') && !ended) setMapUp((v) => !v)
      else if (e.key === 'Escape') { setExpanded(false); setFinder(null); setShelfOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeStop, roamingStop, ended, shown])
  /* the shown stop is reported up so the shell's focus (and its visited count) follow the lecture */
  React.useEffect(() => { if (props.onShown) props.onShown(steps[shown].id) }, [shown])
  /* ended / resumed is reported up too: the shell hides its chrome for a live lecture and hands it
     back the moment the lecture ends, so ending is always a way home */
  React.useEffect(() => { if (props.onEnded) props.onEnded(ended) }, [ended])
  /* RESUME IS THE HOST'S: the bar has no ▶ (2026-09-03). The host bumps `resumeToken` (any changed
     value) and an ended lecture picks up where the clock stopped. Ignored while live. */
  const lastResume = React.useRef(props.resumeToken)
  React.useEffect(() => {
    if (props.resumeToken === lastResume.current) return
    lastResume.current = props.resumeToken
    if (ended && endedAt.current != null) { start.current += Date.now() - endedAt.current; endedAt.current = null; setEnded(false) }
  }, [props.resumeToken])
  /* THE ENDED SCREEN (part 7). The three numbers are computed HERE, from the same store the live
     panes read — the recap counts nothing itself, so there is one source and it cannot disagree
     with the header. The flagged rows are inert on purpose: the lecture is over, so "open this
     slide" belongs to whatever screen the host goes to next, not to this one. THERE IS NO QUESTION
     STAT (owner, 2026-09-04): the notes pane stopped calling its entries questions the day before,
     and a number counting one category was counting a tag, not a fact about the class. The two
     wall-clock readings — when the lecture started and when it ended — are the host's to format,
     with the date, because a recap can be read the next morning. THE REVIEW LIST IS GROUPED BY
     STOP: the host hands each entry its `stopLabel` and orders them walk-first, then oldest-first
     within a stop, which is how a lecture reads back; the live column stays newest-first. */
  /* THE RECAP DOES ITS OWN WORDING (2026-09-04): instants in (`startedAt`/`endedAt`, seconds for
     the clocks), `counts` in, and `LectureClock` / `recapStats` inside the component print the
     line — 24-hour, no commas, the date said once when it ended the day it started, plurals
     decided. The review list is the SAME `entries` the live pane reads, with `stops` (the walk's
     titles) so the pane groups walk-first and heads each group itself. */
  /* THE SESSION AND ITS RECORD (2026-10-01; OB-283 and OB-286 on the app side). The shell hands in
     the session the start card chose (`session`) and `onRecord`, and keeps the store. `placeAt` is
     what this screen writes into it: the walk the active stop sits in, the stop's index WITHIN that
     walk, the walk's length and the instant — `StartSession.last`'s shape. Written AT THE END, in
     the same event that ends the lecture, so the recap is handed the session with it already in;
     and on leaving mid-lecture (unmount while live), so the card can continue from there.
     Mounted alone (no `onRecord`), it keeps one untitled session of its own and records into that. */
  const placeAt = (at) => {
    const st = steps[Math.max(0, activeStop)]
    if (!st) return undefined
    const inWalk = steps.filter((s) => s.walkId === st.walkId)
    return { walkId: st.walkId, walk: st.walk, stop: inWalk.indexOf(st), stopId: st.id, of: inWalk.length, stopTitle: st.title, at }
  }
  const [ownSession, setOwnSession] = useStored('presenter:session', { id: 's1', name: '', meets: [] })
  const record = (last) => { if (!last) return; if (props.onRecord) props.onRecord(last); else setOwnSession((s) => ({ ...s, last })) }
  const session = props.onRecord ? props.session : ownSession
  const live = React.useRef(null)
  live.current = { record, place: placeAt, on: projecting && !ended }
  React.useEffect(() => () => { const l = live.current; if (l && l.on) l.record(l.place(Date.now())) }, [])
  /* THE RECAP'S SHOWN SLIDE (v4): slide 1 of the walk until a flag or a slide head is clicked */
  const [recapStop, setRecapStop] = React.useState(0)
  const recap = !ended ? null : (typeof LectureRecap !== 'function' || typeof LectureNotes !== 'function' ? (
    <MissingPart part={7} name="LectureRecap" style={{ flex: 1, minHeight: 0 }} />
  ) : (
    <LectureRecap course={props.course || 'Foundations of Computing'} when={steps.length ? (steps[0].walk === steps[Math.max(0, activeStop)].walk ? steps[0].walk : steps[0].walk + ' → ' + steps[Math.max(0, activeStop)].walk) : undefined}
      elapsedS={elapsedS} bookedS={BOOKED_S}
      startedAt={start.current} endedAt={endedAt.current != null ? endedAt.current : undefined}
      counts={{ stops: covered.length + 1, slides: steps.filter((_, i) => flagged(i)).length, flags: entries.filter((e) => !e.resolvedAt).length }}
      notes={<LectureNotes variant="review" entries={entries} stops={stepTitles} categories={noteCats.length ? noteCats : undefined}
        selectedStop={recapStop} onSelectStop={setRecapStop}
        onEntryCommit={commitNote} onEntryCategoryChange={retype} onResolveEntry={resolveEntry} onRestoreEntry={restoreEntry} onUndoEntry={undoEntry} />}
      slide={steps[recapStop] ? <Slide step={steps[recapStop]} index={recapStop} count={N} /> : null} shownStop={recapStop} stops={stepTitles} onShowStop={setRecapStop}
      onFlag={(category) => addFlag(recapStop, category)} flagTypes={noteCats.length ? noteCats : undefined} usualFlag={usualFlag} onUsualFlagChange={setUsualFlag}
      /* NO `actions`: "open the flagged slides" is PAUSED (2026-10-01, the flagged slides get their own
         mode), and "close the presenter" is the header bar's once ended (owner, 21 Oct: `onClose` there) */
      session={session} />
  ))
  const slideFor = (i) => <Slide step={steps[i]} index={i} count={N} />
  /* THE WALL'S CONTENT: the map while it is up, the slide otherwise — the ONE place that decides, so
     every wall surface flips together. The foot is the slide's own, so the flip moves nothing there.
     `WallTransition` owns the up/down motion (owner, 2026-09-03): a small pane grows from the slide's
     own top-left corner into the full map on the way up, and shrinks back into that same small pane
     before disappearing on the way down — symmetric, M or the ✕ either direction. The ✕ is always a
     second M, never a way out of full screen; that stays the frame's own backdrop/Escape below. */
  const wall = (i, onClose) => (
    <WallTransition up={mapUp && typeof ProjectedMap === 'function'} slide={slideFor(i)}
      map={typeof ProjectedMap === 'function' ? (
        <ProjectedMap stop={i + 1} count={N} territory={steps[i].territory} title={steps[i].title}
          map={<LectureMap steps={steps} covered={covered} lit={i} />}
          footer={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{steps[i].walk} · the whole walk</span>}
          onClose={onClose} />
      ) : null} />
  )
  const nav = (i) => ({ content: slideFor(i), stopLabel: 'stop ' + (i + 1), flagged: flagged(i), onNavigate: () => (roaming ? setRoamingStop(i) : step(i - activeStop)) })
  const preview = (s, i) => <div style={{ width: 240, aspectRatio: '1120 / 630', position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: 'var(--lift-2)', border: '1px solid var(--border-hair)' }}><Slide step={s} index={i} count={N} /></div>
  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-canopy)' }}>
      <PresenterHeaderBar course={props.course || 'Foundations of Computing'} state={!projecting ? 'preview' : ended ? 'ended' : roaming ? 'roaming' : 'presenting'} activeStop={activeStop + 1} roamingStop={roaming ? roamingStop + 1 : undefined}
        elapsed={ended || !projecting ? undefined : mmss(elapsedS)} bookedLength={ended || !projecting ? undefined : mmss(BOOKED_S)} progressPct={Math.min(100, (elapsedS / BOOKED_S) * 100)} endedTotal={ended ? mmss(elapsedS) + ' total' : undefined}
        confirmOpen={confirmOpen} onEndClick={projecting ? () => setConfirmOpen(true) : undefined} onCancelEnd={() => setConfirmOpen(false)} onClose={props.onClose}
        onConfirmEnd={() => { setConfirmOpen(false); endedAt.current = Date.now(); record(placeAt(endedAt.current)); setEnded(true); setRoamingStop(null); setMapUp(false) }} />
      {/* THE COLUMN: roll, strip, panes. The strip is `flex: none` (it sets that itself); the pane
          below is `flex: 1; min-height: 0`; the roll is `flex: none` at its own height. */}
      {/* THE COLUMN SCROLLS WHEN THE WINDOW IS TOO SHORT (owner, 16 Oct: the palette's Present keeps
          the app header and toolbar, so the panes row got ~74px and the notes pane overflowed it —
          flags unscrollable, composer clipped off the foot). The panes row keeps a floor instead of
          shrinking past the notes pane's own minimums; below that, this column scrolls. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)', overflowY: 'auto', overflowX: 'hidden', scrollbarGutter: 'stable' }}>
        {ended ? recap : (
          <div style={{ flex: 'none' }}>
            {/* NO ✕ on the roll's live card (owner, same day) — it sat right where the flag
               corner does and the two fought for the same 30px. The full-screen frame below is
               the ✕'s only surface; the roll still has M. */}
            <FilmRoll height={286} projecting={projecting}
              prev={shown > 0 ? nav(shown - 1) : null}
              /* `stopIndex` is what makes the roll's travel frame cover EVERY route into a new
                 stop — the keyboard arrows, the strip, the finder — and not just its own two
                 clicks. It is `shown`, the stop actually on the wall, roaming included.
                 A BARE BLOCK COMMENT, NOT A BRACED ONE: braces around a comment between two
                 ATTRIBUTES are a syntax error, and that had blanked the whole Studio template
                 since this file was written (found 2026-09-20). Inside a tag, comment without
                 braces; between CHILDREN, braces are required. */
              current={{ content: wall(shown), stopIndex: shown, flagged: flagged(shown), elapsed: roaming || !projecting ? undefined : mmss((Date.now() - stopStart.current) / 1000) }}
              next={shown < N - 1 ? nav(shown + 1) : null}
              onFlag={(category) => addFlag(shown, category)} flagTypes={noteCats.length ? noteCats : undefined} usualFlag={usualFlag} onUsualFlagChange={setUsualFlag}
              onExpand={() => setExpanded(true)} />
          </div>
        )}
        {ended ? null : <PresenterStrip steps={steps} activeStop={activeStop} roamingStop={roamingStop} flags={flags} covered={covered}
          open={stripOpen} onOpenChange={setStripOpen}
          onFind={(rect) => setFinder(rect || null)} finderOpen={!!finder}
          onJumpToActive={() => setRoamingStop(null)}
          onRoamTo={roamTo} onMakeActive={makeActive}
          renderPreview={preview} />}
        {/* THE PANES ROW: the notes pane takes what the deck leaves (`flex: 1; min-height: 0`, its own
           two scrollers), and the deck stands in a column the professor can drag — 360px untouched,
           the same column the recap's flagged-slides pane occupies, so an undragged deck does not
           move sideways when the lecture ends. The `PaneDivider` REPLACES the row's gap (the strip
           is 14px against the 12px gap it took over) and draws nothing at rest. */}
        {ended ? null : (
          /* the floor is the notes pane's own (`LECTURE_NOTES_FIT.minHeight`); 340 only on a bundle a turn behind.
             `scrollbarGutter: stable` on the column: the roll scales with the column's WIDTH, so a scrollbar
             that came and went would resize the roll, which would change whether it is needed. */
          <div ref={setPaneRowBox} style={{ flex: '1 1 0', minHeight: notesFit.minHeight || 340, display: 'flex' }}>
            {typeof LectureNotes === 'function' ? (
              <LectureNotes stopNumber={shown + 1} stopTitle={steps[shown].title} roaming={roaming}
                stops={stepTitles}
                prepared={noteEdits[shown] != null ? noteEdits[shown] : steps[shown].note}
                onPreparedCommit={(text) => setNoteEdits((m) => ({ ...m, [shown]: text }))}
                entries={entries} stop={shown}
                categories={noteCats.length ? noteCats : undefined}
                onAddCategory={addCategory}
                chatWidth={notesSplit != null ? notesSplit : undefined} onChatWidthChange={setNotesSplit}
                preparedHeight={prepH != null ? prepH : undefined} onPreparedHeightChange={setPrepH}
                draft={draft} onDraftChange={setDraft} category={noteCat} onCategoryChange={setNoteCat} usualFlag={usualFlag}
                onSave={saveNote} onEntryCommit={commitNote} onEntryCategoryChange={retype}
                onResolveEntry={resolveEntry} onRestoreEntry={restoreEntry} onUndoEntry={undoEntry} />
            ) : <MissingPart part={5} name="LectureNotes" style={{ flex: 1, minHeight: 0 }} />}
            {DM && NS.PaneDivider && paneRowW > 0 ? (
              <NS.PaneDivider label="resize the notes and the quick actions"
                onDrag={(d) => { if (!deckStart.current) deckStart.current = rowSizes.slice(); setDeckLive(deckClamp(deckStart.current, d)) }}
                onDragEnd={(d) => { const base = deckStart.current || rowSizes; deckStart.current = null; setDeckLive(null); setDeckPref(deckClamp(base, d)) }}
                onReset={() => { deckStart.current = null; setDeckLive(null); setDeckPref(null) }}
                {...DM.bounds({ sizes: rowSizes, index: 0, fits: rowFits })} />
            ) : <div style={{ flex: 'none', width: 'var(--space-3)' }} />}
            <div style={{ flexShrink: 0, width: deckW, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {typeof QuickActionsDeck === 'function' ? (
                <QuickActionsDeck groups={deckGroups && deckGroups.length ? deckGroups : undefined} library={shelf}
                  libraryOpen={shelfOpen} onLibraryOpenChange={setShelfOpen} onSwap={swapAction}
                  shelfPosition={shelfPos} onShelfPositionChange={moveShelf} />
              ) : <MissingPart part={6} name="QuickActionsDeck" style={{ flex: 1, minHeight: 0 }} />}
            </div>
          </div>
        )}
      </div>
      {finder ? (
        <StopFinder steps={steps} activeStop={activeStop} roamingStop={roamingStop} flags={flags} covered={covered}
          anchor={finder} onPick={roamTo} onClose={() => setFinder(null)}
          renderAside={(i) => <TerritoryAside steps={steps} index={i} />} />
      ) : null}
      {expanded ? (
        <div onClick={() => setExpanded(false)} title="click or press esc to leave full screen" style={{
          position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bark-900)', display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(100vw, 177.78vh)', aspectRatio: '1120 / 630' }}>{wall(shown, () => setMapUp(false))}</div>
        </div>
      ) : null}
    </div>
  )
}
window.PresenterScreen = Presenter
/* `PresenterLoader` is what the template mounts to get this file evaluated; it draws nothing. */
function PresenterLoader() { return null }
module.exports = { PresenterScreen: Presenter, PresenterLoader }
