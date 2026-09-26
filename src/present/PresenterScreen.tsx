// THE PRESENTER SCREEN — the professor's own view of a walk while it is taught:
// the header bar, the film roll, the strip and the finder on ONE store (#267,
// DS OB-135/136/137/138, parts 1–4 of the presenter-mode split). Ported from the
// DS's reference host `templates/studio/PresenterScreen.jsx`, with the Studio's
// bindings translated and its wiring kept.
//
// WHERE IT SITS. StudioView mounts it as its presenter MODE (owner, 2026-09-03):
// while a lecture is LIVE (projecting and not ended) it takes the whole area under
// nothing — app header, toolbar and palette are gone and this bar is the chrome;
// as a PREVIEW (the palette's Present, `projecting={false}`) or once ENDED it sits
// framed beside the palette with the chrome kept, so ending is always a way home.
//
// THE STORE — the three facts and the transient UI, all here. `activeStop` is the
// record, `roamingStop` where the professor is looking, `covered` what was
// presented (a stop is covered when the record LEAVES it). Components ask; this
// decides. THE LECTURE IS THE WALK BEING PLAYED — `useWalkPlayback`'s steps, the
// saved walk if one is active and the desk's road otherwise — and it starts at
// the Studio's focus, reporting the shown stop back to the bus so the header's
// focus follows the lecture.
//
// WHAT IS PROJECTED (clause 2): the roll's live card content — the slide — goes
// to the projector window through `useProjectorSender`; the preview projects
// nothing, so the room's window shows dark.
//
// THE PANES ROW (parts 6 and 7): the notes pane and the quick actions deck,
// side by side under the strip, and the deck's column is the same 360 the recap
// keeps for its flagged list — so nothing moves sideways when the lecture ends.
// Both are the DS's components and both store NOTHING: what the professor writes,
// mints and rearranges lives in `lecturenotes.ts` (per walk for the notes, per
// user for the categories and the furniture) and is handed back down as props.
//
// PART 8, THE RECAP, REPLACES THE WHOLE ROW when the lecture ends, with the same
// notes in `review` shape beside what was flagged.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  FilmRoll, LectureNotes, LectureRecap, NOTE_CATEGORIES, Pane, PresenterHeaderBar, PresenterStrip,
  ProjectedMap, QUICK_ACTION_PLACEHOLDERS, QuickActionsDeck, StopFinder, swapActions,
} from '@/ds'
import type { NoteCategory, PresenterState, QuickAction } from '@/ds'

import MapView from '../instruments/MapView'
import { useKeptWallFrame } from './wallframe'
import { useWalkPlayback } from '../state/walk/playback'
import { renderStopPreview } from '../state/walk/stoppreview'
import type { Bus } from '../state/bus'
import { BOOKED_SECONDS, clampStop, coveredBefore, lectureStart, lectureSteps, mmss } from './lecture'
import { LectureSlide } from './LectureSlide'
import {
  addNote, applyDeck, deleteNote, editNote, loadHabits, loadMintedCategories, loadNotebook,
  notebookKey, saveHabits, saveMintedCategories, saveNotebook, serialiseDeck, setPrepared,
} from './lecturenotes'
import type { LectureHabits, LectureNotebook } from './lecturenotes'
import { useProjectorSender } from './projector'
import { WallTransition } from './WallTransition'
import type { ProjectedState } from './projector'

/** WHAT THIS HOST CAN OFFER THE DECK — the tiles' words and marks, with no behaviour attached.
 *  Static, and at module scope on purpose: the saved arrangement is computed FROM this list, and
 *  a list carrying this render's handlers would be a closure passed into a plain function, which
 *  is the one thing a render must not do with anything that reads a ref. Behaviour is bound below,
 *  per render, once the arrangement is known. */
const DECK_ACTIONS: QuickAction[] = [
  { id: 'map', label: 'Project the map', key: 'm', dot: 'var(--accent-walk)', title: 'put the whole walk on the wall, in place of the slide' },
  { id: 'flag', label: 'Flag this slide', key: 'f', dot: 'var(--acorn-600)', title: 'mark this stop to come back to after the lecture' },
  { id: 'strip', label: 'All stops', key: 'e', dot: 'var(--moss-400)', title: 'open the strip of every stop in the walk' },
  { id: 'finder', label: 'Find a stop', key: 'j', dot: 'var(--moss-400)', title: 'search the walk by name' },
  { id: 'live', label: 'Back to the live stop', dot: 'var(--bark-400)', title: 'stop looking ahead and return to what the class is seeing' },
  { id: 'end', label: 'End the lecture', dot: 'var(--state-danger)', title: 'end the lecture and show the recap' },
]

export interface PresenterScreenProps {
  bus: Bus
  /** is the room watching — the toolbar ▶ (true) or the palette's Present (false, a preview:
   *  no clock, nothing projected). Flipping to true STARTS the lecture here and now. */
  projecting: boolean
  /** bumped by the host's toolbar ▶ once ended — the lecture picks up where the clock stopped */
  resumeToken: number
  /** the lecture ended or resumed — the host hides its chrome for a live lecture and hands it
   *  back the moment the lecture ends */
  onEnded?: (ended: boolean) => void
  /** what the header names the course; the walk's title by default */
  course?: string
  /** FRAMED LIKE A PANE beside the palette (a preview, or an ended lecture — DS OB-135 rule 4),
   *  or bare, the whole window (a live lecture). A prop rather than a wrapper the host puts
   *  around this component: the screen must keep ONE position in the tree across that flip, or
   *  ending a lecture would remount it and lose the record. */
  framed?: boolean
  /** the framed pane's ✕ — leave the mode */
  onLeave?: () => void
}

export default function PresenterScreen({ bus, projecting, resumeToken, onEnded, course, framed = false, onLeave }: PresenterScreenProps) {
  const play = useWalkPlayback(bus)
  const steps = useMemo(() => lectureSteps(play.steps, play.title), [play.steps, play.title])
  const N = steps.length
  /* the store — `startAt` is the Studio's focus when the mode opened */
  const [activeStop, setActiveStop] = useState(() => lectureStart(play.steps, bus.focus))
  const [roamingStop, setRoamingStop] = useState<number | null>(null)
  const [covered, setCovered] = useState<number[]>(() => coveredBefore(lectureStart(play.steps, bus.focus)))
  const [flags, setFlags] = useState<number[]>([])
  const [finder, setFinder] = useState<DOMRect | null>(null)
  const [stripOpen, setStripOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [ended, setEnded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  /* THE MAP ON THE WALL (OB-139) — on request only. M puts it up, M takes it down; nothing else
     puts it up. While up, stepping and roaming move the lit pin and the caption, not the map.
     Ending the lecture takes it down. It replaces the slide on every wall surface (the roll's
     live card, full screen, the projector) and on none of the others. */
  const [mapUp, setMapUp] = useState(false)
  /* the clocks: lecture elapsed (stops when ended), and time on the current stop. Four instants,
     all STATE: `now` ticks once a second from the effect below, and the moments the lecture
     started, the stop started and the lecture ended are written from effects and handlers — so
     the render reads state and calls nothing impure. */
  const [now, setNow] = useState(() => Date.now())
  const [startAt, setStartAt] = useState(() => Date.now())
  const [stopStartAt, setStopStartAt] = useState(() => Date.now())
  const [endedAt, setEndedAt] = useState<number | null>(null)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsedS = projecting ? ((endedAt ?? now) - startAt) / 1000 : 0
  const onStopS = (now - stopStartAt) / 1000
  /* PROJECTING OR NOT (owner, 2026-09-03). Flipping to true STARTS the lecture: clocks from zero,
     the record cleared to the stops before the active one, so nothing clicked while previewing
     counts as taught. Back to preview (the palette's Present after an ended lecture): the ended
     pane goes, the layout shows again with nothing projected. */
  const wasProjecting = useRef(projecting)
  const activeRef = useRef(activeStop)
  useEffect(() => { activeRef.current = activeStop }, [activeStop])
  /* the DS reference host's own effect: a prop flipped, the record and the clocks reset once.
     One synchronous cascade on a mode change, never per render — the rule below is about
     cascades on every render, which this is not. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (projecting === wasProjecting.current) return
    wasProjecting.current = projecting
    const t = Date.now()
    if (projecting) {
      setStartAt(t)
      setStopStartAt(t)
      setEndedAt(null)
      setEnded(false)
      setRoamingStop(null)
      setCovered(coveredBefore(activeRef.current))
    } else {
      setEndedAt(null)
      setEnded(false)
      setConfirmOpen(false)
      setRoamingStop(null)
    }
  }, [projecting])
  /* eslint-enable react-hooks/set-state-in-effect */
  const roaming = roamingStop != null
  const shown = roaming ? roamingStop : activeStop
  const cover = (i: number) => setCovered((c) => (c.indexOf(i) >= 0 ? c : c.concat(i)))
  /* ARROWS ADVANCE WHATEVER YOU ARE ON: presenting, → moves the record and covers the stop left
     behind; roaming, → moves only the roam. The active node otherwise moves on a hold alone. */
  const step = useCallback((d: number) => {
    if (ended) return
    if (roaming) { setRoamingStop(clampStop(roamingStop + d, N)); return }
    const to = clampStop(activeStop + d, N)
    if (to === activeStop) return
    cover(activeStop)
    setActiveStop(to)
    setStopStartAt(Date.now())
  }, [ended, roaming, roamingStop, activeStop, N])
  const roamTo = useCallback((i: number) => { if (ended) return; setRoamingStop(i === activeStop ? null : i) }, [ended, activeStop])
  const makeActive = (i: number) => { cover(activeStop); setActiveStop(i); setRoamingStop(null); setStopStartAt(Date.now()) }
  const toggleFlag = useCallback((i: number) => setFlags((f) => (f.indexOf(i) >= 0 ? f.filter((x) => x !== i) : f.concat(i))), [])
  /* THE KEYS, the host's (DS): arrows advance, Backspace ends a roam, F flags, E opens the strip,
     J opens the finder (part 8), Escape closes things. Not while a field has focus. */
  /* THE FINDER HANGS OFF THE STRIP'S OWN FIND BUTTON, so opening it means measuring that button.
     Lifted out of the key handler because the quick actions deck offers the same thing as a tile,
     and two copies of "where does the finder hang" is how the two drift apart.
     IT FINDS THE BUTTON BY THE STRIP'S OWN `data-presenter-strip` ROW rather than through a ref,
     and that is not a style choice: this function ends up inside the deck's action list, which is
     built during render, and a value that can reach `someRef.current` may not be passed to a plain
     function from there. Reading the live document inside an event handler is where a DOM read
     belongs, and the strip already publishes the row as a hook. */
  const toggleFinder = useCallback(() => {
    const btn = document.querySelector<HTMLElement>('[data-presenter-strip] [aria-label="find a stop"], [data-presenter-strip] [aria-label="close the finder"]')
    setFinder((f) => (f ? null : btn ? btn.getBoundingClientRect() : null))
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* THE DECK BINDS THE KEYS IT DRAWS, on the document, and it calls `preventDefault` when it
         acts. So an M whose tile the professor has dragged onto the deck arrives here ALREADY
         HANDLED — without this line it would fire twice and the map would go up and straight back
         down. The deck is the more specific handler; this one yields to it. */
      if (e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.closest('input, textarea, select') || t.isContentEditable)) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Backspace' && roaming) setRoamingStop(null)
      else if (e.key === 'f' || e.key === 'F') toggleFlag(shown)
      else if (e.key === 'e' || e.key === 'E') setStripOpen((o) => !o)
      else if ((e.key === 'm' || e.key === 'M') && !ended) setMapUp((v) => !v)
      else if (e.key === 'j' || e.key === 'J') toggleFinder()
      else if (e.key === 'Escape') { setExpanded(false); setFinder(null); setConfirmOpen(false) }
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, roaming, shown, toggleFlag, ended, toggleFinder])
  /* the shown stop is reported up so the shell's focus (and its visited count) follow the lecture */
  const setFocus = bus.setFocus
  useEffect(() => { const s = steps[shown]; if (s && bus.focus !== s.id) setFocus(s.id, 'walk') }, [shown, steps, setFocus, bus.focus])
  /* ended / resumed is reported up too: the shell hides its chrome for a live lecture and hands it
     back the moment the lecture ends, so ending is always a way home */
  useEffect(() => { if (onEnded) onEnded(ended) }, [ended, onEnded])
  /* RESUME IS THE HOST'S: the bar has no ▶. The host bumps `resumeToken` and an ended lecture picks
     up where the clock stopped. Ignored while live. */
  const lastResume = useRef(resumeToken)
  useEffect(() => {
    if (resumeToken === lastResume.current) return
    lastResume.current = resumeToken
    // the host bumped the token: the pause is added back once, on that one change
    /* eslint-disable react-hooks/set-state-in-effect */
    if (ended && endedAt != null) { const paused = Date.now() - endedAt; setStartAt((s0) => s0 + paused); setEndedAt(null); setEnded(false) }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [resumeToken, ended, endedAt])
  /* WHAT THE ROOM SEES: the live slide while projecting and not ended; dark otherwise */
  const projected = useMemo<ProjectedState>(() => ({
    live: projecting && !ended && N > 0,
    slide: projecting && !ended && steps[shown] ? steps[shown] : null,
    stop: shown + 1,
    count: N,
    mapUp: mapUp && !ended,
    ids: steps.map((st) => st.id),
    // the lecture's stops are `play.steps` one for one, so the flags line up with `ids` (OB-214)
    optional: play.steps.map((st) => st.optional === true),
    covered,
  }), [projecting, ended, steps, play.steps, shown, N, mapUp, covered])
  useProjectorSender(projected)

  /* ── WHAT THE LECTURE WRITES DOWN (parts 6-8) ────────────────────────────────────────────────
     THE NOTEBOOK IS KEYED BY THE WALK and the key travels WITH it in state, so a save can never
     land under a key the book was not loaded from — the two would otherwise disagree for exactly
     one render after the walk changed, and that render would overwrite the new walk's notes with
     the old walk's. The categories and the furniture are user-wide and need no such care. */
  const bookKey = notebookKey(play.source, bus.activeWalk?.walkId)
  const [notebook, setNotebook] = useState<{ key: string; book: LectureNotebook }>(() => ({ key: bookKey, book: loadNotebook(bookKey) }))
  const book = notebook.book
  const setBook = useCallback((f: (b: LectureNotebook) => LectureNotebook) => setNotebook((n) => ({ ...n, book: f(n.book) })), [])
  /* eslint-disable react-hooks/set-state-in-effect -- reading a different notebook off the store
     when the walk changes. It is a load from an external system, not a value derivable during
     render, and it happens once per walk rather than once per render. */
  useEffect(() => { setNotebook((n) => (n.key === bookKey ? n : { key: bookKey, book: loadNotebook(bookKey) })) }, [bookKey])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { saveNotebook(notebook.key, notebook.book) }, [notebook])
  const [minted, setMinted] = useState<NoteCategory[]>(() => loadMintedCategories())
  useEffect(() => { saveMintedCategories(minted) }, [minted])
  const categories = useMemo(() => NOTE_CATEGORIES.concat(minted), [minted])
  const [habits, setHabits] = useState<LectureHabits>(() => loadHabits())
  useEffect(() => { saveHabits(habits) }, [habits])
  const [draft, setDraft] = useState('')
  const [draftCategory, setDraftCategory] = useState<string | undefined>(undefined)
  const stopId = steps[shown]?.id ?? ''
  const stopTitles = useMemo(() => steps.map((st) => st.title), [steps])

  /* ── THE DECK'S ACTIONS ──────────────────────────────────────────────────────────────────────
     THE DECK ITSELF IS STILL EIGHT UNDECIDED SLOTS — which is the design, not an omission: the DS
     ships `QUICK_ACTION_PLACEHOLDERS` precisely because what belongs on a professor's deck has
     not been decided, and a dashed slot says so on screen where a guess would not. What IS
     decided is what this host CAN offer, and those six sit on the shelf behind the More button
     where the professor can drag any of them onto a slot and keep it there.
     THE HELD ONES WEAR THE ACTIVE FACE (`on`, below): the map being up, this stop being flagged,
     the strip and the finder being open are all states, not one-shot actions, and the tile has to
     say which way it is pointing before it is pressed. */
  const deck = useMemo(() => {
    const behaviour: Record<string, { onSelect: () => void; disabled?: boolean }> = {
      map: { onSelect: () => setMapUp((v) => !v) },
      flag: { onSelect: () => toggleFlag(shown) },
      strip: { onSelect: () => setStripOpen((o) => !o) },
      finder: { onSelect: toggleFinder },
      live: { onSelect: () => setRoamingStop(null), disabled: !roaming },
      end: { onSelect: () => setConfirmOpen(true), disabled: !projecting },
    }
    const bind = (a: QuickAction) => (behaviour[a.id] ? { ...a, ...behaviour[a.id] } : a)
    const arranged = applyDeck(habits.deck, QUICK_ACTION_PLACEHOLDERS, DECK_ACTIONS)
    return {
      groups: arranged.groups.map((g) => ({ ...g, actions: g.actions.map(bind) })),
      library: arranged.library.map(bind),
    }
  }, [habits.deck, shown, toggleFlag, toggleFinder, roaming, projecting])
  const deckOn = useMemo(() => {
    const held: string[] = []
    if (mapUp) held.push('map')
    if (flags.indexOf(shown) >= 0) held.push('flag')
    if (stripOpen) held.push('strip')
    if (finder) held.push('finder')
    return held
  }, [mapUp, flags, shown, stripOpen, finder])

  const state: PresenterState = !projecting ? 'preview' : ended ? 'ended' : roaming ? 'roaming' : 'presenting'
  const slideFor = (i: number) => <LectureSlide step={steps[i]} index={i} count={N} />
  /* THE WALL'S FRAME IS THE HOST'S (DS OB-163) — kept with the walk it was fitted for, see
     `useKeptWallFrame`. Keyed on the steps array itself: a new walk is a new array. */
  const wallFrame = useKeptWallFrame(steps)
  /* THE WALL'S CONTENT: the map while it is up, the slide otherwise — the ONE place that decides,
     so every wall surface flips together. The foot keeps the slide's own slot with different
     words (OB-139 rule 6b). `WallTransition` owns the up/down motion. The ✕ is full screen's
     alone (rule 7): the roll's live card has its flag in that corner. */
  const wall = (i: number, onClose?: () => void) => (
    <WallTransition up={mapUp} slide={slideFor(i)}
      map={<ProjectedMap stop={i + 1} count={N} territory={steps[i].territory} title={steps[i].title}
        map={<MapView bus={bus} wall={{ lit: i, covered, ...wallFrame }} />}
        footer={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{steps[i].walk} · the whole walk</span>}
        onClose={onClose} />} />
  )
  const nav = (i: number) => ({ content: slideFor(i), stopLabel: 'stop ' + (i + 1), flagged: flags.indexOf(i) >= 0, onNavigate: () => (roaming ? setRoamingStop(i) : step(i - activeStop)) })
  /* THE PENCIL AND THE BIN BELONG TO BOTH LISTS — the live column and the recap's review copy are
     one notebook read twice, so the two handlers are written once here rather than beside each
     pane. `id` widens to `string | number | undefined` crossing the DS's boundary (its `LectureNote`
     does not insist on ours), so it comes back through `String`. */
  const commitEntry = (n: { id?: string | number }, text: string) => setBook((b) => editNote(b, String(n.id), text))
  const removeEntry = (n: { id?: string | number }) => setBook((b) => deleteNote(b, String(n.id)))
  const courseName = course ?? play.title
  /* THE FRAME: a pane beside the palette while previewing or ended, the whole window while live.
     Both wrap the same body, from the same component, so the record survives the flip. */
  const frame = (body: React.ReactNode) => (framed ? (
    <Pane aria-label="studio-presenter" title="presenter" variant="legend" legendBg="var(--surface-canopy)" onClose={onLeave} scroll="none" style={{ flex: 1, minWidth: 0 }}>{body}</Pane>
  ) : (
    <div aria-label="studio-presenter" style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%' }}>{body}</div>
  ))
  if (N === 0) {
    return frame(
      <div data-presenter-screen="empty" style={{ height: '100%', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--text-3)', background: 'var(--surface-canopy)' }}>
        nothing to present — open a walk on the desk, or play a saved one
      </div>,
    )
  }
  return frame(
    <div data-presenter-screen={state} style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-canopy)' }}>
      <PresenterHeaderBar course={courseName} state={state} activeStop={activeStop + 1} roamingStop={roaming ? roamingStop + 1 : undefined}
        elapsed={ended || !projecting ? undefined : mmss(elapsedS)} bookedLength={ended || !projecting ? undefined : mmss(BOOKED_SECONDS)} progressPct={Math.min(100, (elapsedS / BOOKED_SECONDS) * 100)} endedTotal={ended ? mmss(elapsedS) + ' total' : undefined}
        confirmOpen={confirmOpen} onEndClick={projecting ? () => setConfirmOpen(true) : undefined} onCancelEnd={() => setConfirmOpen(false)}
        onConfirmEnd={() => { setConfirmOpen(false); setEndedAt(Date.now()); setEnded(true); setRoamingStop(null); setMapUp(false) }} />
      {/* THE COLUMN: roll, strip, panes. The strip is `flex: none` (it sets that itself); the pane
          below is `flex: 1; min-height: 0`; the roll is `flex: none` at its own height. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-3)' }}>
        {ended ? (
          /* PART 8 — the recap takes the whole region the roll, the strip and the panes had. The
             notes come back as the SAME notebook in `review` shape (one column, grouped under the
             stop each note was written about), so nothing is re-entered and nothing is a second
             copy. A flagged row is a READOUT here, not a jump: the lecture is over, there is no
             live stop to jump to, and a row that navigates would restart one. */
          <LectureRecap
            course={courseName} when={courseName === play.title ? undefined : play.title}
            elapsedS={elapsedS} bookedS={BOOKED_SECONDS} startedAt={startAt} endedAt={endedAt}
            counts={{ stops: covered.length, notes: book.notes.length, flagged: flags.length }}
            notes={(
              <LectureNotes variant="review" entries={book.notes} stops={stopTitles}
                categories={categories} onEntryCommit={commitEntry} onDeleteEntry={removeEntry}
                style={{ flex: 1, minWidth: 0 }} />
            )}
            flagged={flags.slice().sort((a, b) => a - b).map((i) => ({ id: i, title: steps[i].title, stop: i }))}
            actions={onLeave ? [{ label: 'close the presenter', tone: 'neutral' as const, onSelect: onLeave }] : []} />
        ) : (
          <>
            <div style={{ flex: 'none' }}>
              <FilmRoll height={286} projecting={projecting}
                prev={shown > 0 ? nav(shown - 1) : null}
                current={{ content: wall(shown), flagged: flags.indexOf(shown) >= 0, elapsed: roaming || !projecting ? undefined : mmss(onStopS) }}
                next={shown < N - 1 ? nav(shown + 1) : null}
                onToggleFlag={(which) => toggleFlag(which === 'prev' ? shown - 1 : which === 'next' ? shown + 1 : shown)}
                onExpand={() => setExpanded(true)} />
            </div>
            <div style={{ flex: 'none' }}>
              <PresenterStrip steps={steps} activeStop={activeStop} roamingStop={roamingStop} flags={flags} covered={covered}
                open={stripOpen} onOpenChange={setStripOpen}
                onFind={(rect) => setFinder(rect || null)} finderOpen={!!finder}
                onJumpToActive={() => setRoamingStop(null)}
                onRoamTo={roamTo} onMakeActive={makeActive}
                renderPreview={(_s, i) => renderStopPreview(play.steps[i], i)} />
            </div>
            {/* THE PANES ROW — the notes pane takes what is left, the deck keeps a fixed 360 (the
                width the recap's flagged column also keeps, so ending moves nothing sideways) */}
            <div data-presenter-panes style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--space-3)' }}>
              <LectureNotes
                stop={shown} stopNumber={shown + 1} stopTitle={steps[shown].title} roaming={roaming}
                /* THE LECTERN'S CORRECTION WINS OVER THE AUTHORED NOTE, and it is an OVERLAY: there
                   is no draft op that writes a stop's note, so the pencil stores its text against
                   the stop's id here and the walk itself is left alone. Emptying it puts the
                   authored note back rather than blanking the column. */
                prepared={book.prepared[stopId] ?? steps[shown].note}
                onPreparedCommit={(text) => setBook((b) => setPrepared(b, stopId, text))}
                entries={book.notes} categories={categories}
                draft={draft} onDraftChange={setDraft}
                category={draftCategory} onCategoryChange={setDraftCategory}
                onSave={(n) => {
                  setBook((b) => addNote(b, { category: n.category, text: n.text, stop: n.stop ?? shown, when: mmss(elapsedS), at: Date.now() }))
                  setDraft('')
                }}
                /* A MINTED CATEGORY IS THE PROFESSOR'S, not the stop's or the walk's — it goes to
                   the user-wide store and comes back on every lecture they ever give. */
                onAddCategory={(c) => setMinted((m) => m.concat(c))}
                onEntryCommit={commitEntry} onDeleteEntry={removeEntry}
                duringWidth={habits.duringWidth}
                onDuringWidthChange={(w) => setHabits((h) => ({ ...h, duringWidth: w }))}
                flagged={flags.indexOf(shown) >= 0} onToggleFlag={() => toggleFlag(shown)}
                style={{ flex: 1, minWidth: 0 }} />
              <div style={{ flexShrink: 0, width: 360, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <QuickActionsDeck groups={deck.groups} library={deck.library} on={deckOn}
                  /* THE SHELF IS A MENU AS WELL AS A DRAWER. Its button says "More actions…", so
                     a tile in it has to BE one: clicking runs the action where dragging keeps it.
                     Without this a professor who clicks rather than drags gets nothing back. */
                  onLibrarySelect={(a) => a.onSelect?.()}
                  shelfPosition={habits.shelfPosition}
                  onShelfPositionChange={(o) => setHabits((h) => ({ ...h, shelfPosition: o }))}
                  onSwap={(shelfId, deckId) => {
                    const next = swapActions(deck.groups, deck.library, shelfId, deckId)
                    setHabits((h) => ({ ...h, deck: serialiseDeck(next.groups, next.library) }))
                  }} />
              </div>
            </div>
          </>
        )}
      </div>
      {finder ? (
        <StopFinder steps={steps} activeStop={activeStop} roamingStop={roamingStop} flags={flags} covered={covered}
          anchor={finder} onPick={roamTo} onClose={() => setFinder(null)}
          renderPreview={(_s, i) => renderStopPreview(play.steps[i], i)} />
      ) : null}
      {expanded ? (
        <div data-presenter-fullscreen onClick={() => setExpanded(false)} style={{
          position: 'fixed', inset: 0, zIndex: 80, background: 'var(--bark-900)', display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: 'min(100vw, 177.78vh)', aspectRatio: '1120 / 630', cursor: 'default' }}>{wall(shown, () => setMapUp(false))}</div>
        </div>
      ) : null}
    </div>,
  )
}
