One-line: the card that opens when Present is pressed — choose a session on the left, then
where to start (Continue from last presentation, Where I'm reading, Load another walk).
Owner-picked 2026-09-30 (version D of `ideas/present-class-mark.html` §02); filed 2026-10-01.

**It opens only from the app toolbar's ▶**, idle or previewing — never from the palette's Present
preset, never on resume. **It opens with "+ New session" lit** (owner, 2026-10-01): Enter presents with a new, untitled
session. Nothing is created until a start — the choice carries `newSession: true`, `sectionId:
null`, and the host creates the session then. Picking an existing session lights it instead.
Never pre-select the last-used session.

```jsx
<PresentStartCard course="Foundations of Computing"
  sections={[{ id: 'b', name: 'Section B', days: 'Mon/Wed', last: { walkId: 'fwd', walk: 'Forwarding', stop: 3, of: 7 } }]}
  selectedId={sel} onSelectSection={setSel} onAddSection={add} onDeleteSection={del}
  openWalk={{ id: 'rte', title: 'Routing' }} reading={{ walkId: 'rte', walk: 'Routing', stop: 1, stopTitle: 'Link state' }}
  onStart={(c) => host.start(c)} onCancel={close} />
```

**A session belongs to the course, not to a walk.** It remembers one thing: the walk and stop
where it was last presented (`last`). It survives across walks, so one session covers both the
professor who writes one walk per lecture and the one who writes one walk per course.

**The rows never change.** Three, always in this order, each with an icon: Continue from last presentation
("Start from the beginning" on a session never presented)
(walker, Enter), Where I'm reading (locate, R), Load another walk (open folder, `LoadMark`, P) — the key named in
each row's tooltip as "(Enter)", never drawn on the row. Only the grey line
under Continue changes, worded by `StartMath.resolve`:

- never presented → "From start of walk: ‹open walk›, stop 1"
- stopped mid-walk → "‹walk›, stop N of M" — that walk, even if another is open
- finished, another walk open → two lines: "Finished the walk ‹walk›" / "Next: ‹open walk›, the
  walk you have open"
- finished, same walk open → "Finished the walk ‹walk›" / "Choose the next walk"; `onStart`
  gets `from: 'pick-walk'` and the host opens its walk picker

No walk order is stored. The open walk is the guess, because a professor usually opens the
next lecture before teaching it.

**The session is required, and never asked for.** The column is headed "Choose Session" and
shows even with one session. With none, "+ New session" is simply the chosen one; nothing is created
until a lecture starts. "+ New session" also creates one
unnamed and opens it for editing. A pencil on each row opens the row as a small form: the name at
full width, then a day picker (Mo Tu We Th Fr Sa Su toggles) — pick to add a day, pick again to
remove it (`onRenameSection`, `onSetSectionMeets`). Days are stored as numbers, 0 = Monday, and
worded by the card ("Mon/Wed").

**Each session shows when it was last presented** — pass `last.at` (ms or Date, the lecture's
end) and the row prints "Today 14:02", "Mon 14:02", "28 Sep" at the right of the name line
(`StartMath.lastLabel`, 24-hour, the time dropped past a week). Update it with the rest of
`last` when a lecture ends.

**A chosen session scrolled out of view is named at the list's edge** ("↑ Section B"); a click
brings it back. **An open session row closes only on Done, Escape, a press outside it, or the
keyboard moving focus out** — never on a blur with no destination.

**Delete** is a hover-revealed bin per session, berry when shown. It confirms inside the card
(the row becomes "Delete ‹name›?" with Keep and Delete); `onDeleteSection` fires only on
Delete, so the host does not confirm again. "+ New session" hovers with the acorn wash. A session's pencil and bin fade with the row's hover,
with no grace period (`START_CARD_METRICS.pairRecede` false, owner's call).

**"Load another walk" picks a walk and a stop on the open map** (owner, 2026-10-01): the shared
`LoadPicker` at the presenter's depth — the open map's `walks`, each opening its stops in a flat
`StopFinder`. Never a map: that is the toolbar's Load. A pick fires `onStart({ from:
'elsewhere', walkId, stop })`, and the host starts the presenter there — the desk is not touched.

**Presenting never changes the desk** (owner, 2026-10-01). The chosen walk is the presenter's
only: Explore and Plan keep what they had open, the desk's focus does not follow the lecture, and
leaving returns the desk to where it was before ▶. So the card asks nothing about unsaved work.

**"Continue" and "Where I'm reading" emphasise the walk name and the stop.** Draw
`StartMath.resolve(...).lineEm` / `nextEm` and `StartMath.readingRuns(reading, walks)` (runs of
`[text, emphasised]`), not plain strings, or the emphasis is lost.

**Stop numbers are the walk's own addresses** — "stop 2.2" for a stop inside a group. Pass
`address` on each of `walks`' stops (or on `last` / `reading` directly); without one the card
prints `stop + 1`. "of M" is dropped beside a dotted address. The stop finder's dots still show the
flat count.

**The card's body stops at `START_CARD_METRICS.bodyMax` (360).** Many sessions scroll between the
fixed "Choose Session" heading and "+ New session"; the walk list scrolls the same way.

**The title names the walk the highlighted row would start** — "Start presenting — Forwarding"
on Continue, "— Routing" on Where I'm reading — and follows hover and ↑↓. Load another walk, and
a row with no fixed walk, show "Start presenting" alone. `course` is no longer drawn there.

**The card starts nothing.** It hands back a `StartChoice`; navigation, the lecture clock and
updating `last` when the lecture ends are the host's.

**Every wording is a prop.**

---

**Replaces in the app:** the ▶'s idle start in `src/studio/StudioView.tsx` (`pressPresent`, which
starts at once) and `PresenterScreen`'s `lectureStart(play.steps, bus.focus)` — the lecture stops
opening at the Studio's focus and opens where the card says. Read at `4353dca`, 2026-10-01.

**Hosted by:** `src/studio/StudioView.tsx` (read at `4353dca`): opened by `pressPresent` over the
desk, as a modal card; the desk stays mounted under it until a start is chosen. Filed as OB-281
(port), OB-282 (wiring), OB-283 (sessions stored). **The reference wiring is
`templates/studio/StudioApp.jsx`** (2026-10-01): ▶ calls `openStart` (idle or preview; resume does
not), the card sits on `--scrim` with a press outside cancelling, the sessions live in one store
key (`presenter:sessions`), `startFromCard` creates the session for `newSession` and starts a
fresh presenter on the card's walk and stop, and nothing writes the desk's focus while presenting.
