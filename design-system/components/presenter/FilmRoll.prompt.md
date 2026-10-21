One-line: the live slide with its two whole neighbours — one flag corner rule, full
screen on the live card only. Part 2 of the presenter-mode split
(`guidelines/presenter-component-split-plan.md`).

```jsx
<FilmRoll
  prev={{ content: <Slide stop={19} />, stopLabel: 'stop 20', flagged: true, onNavigate: () => goTo(19) }}
  current={{ content: <Slide stop={20} />, stopIndex: 20, flagged: true, elapsed: '00:19' }}
  next={{ content: <Slide stop={21} />, stopLabel: 'stop 22', onNavigate: () => goTo(21) }}
  onFlag={(category) => addFlag(shown, category)} flagTypes={userTypes}
  onExpand={() => enterFullScreen()}
/>
```

**The roll fills its container, at any width.** `height`/`liveWidth`/`neighborWidth` are
reference sizes at scale 1 — a ResizeObserver scales all three together to match whatever
width the host gives it (clamped `minScale`–`maxScale`). A wider presenter screen gets
bigger cards in the same proportions; it never leaves a dead band inside the frame, which
is what happened when the frame stretched to its container but the fixed-size cards
inside it didn't.

**Whole neighbours are what make one flag corner possible.** Neighbours used to bleed off
the roll's edge, so no single corner survived the clipping reliably — the fix is upstream
of the flag: draw both neighbours whole, smaller, and the flag can just always be top
right.

**The host draws the slide.** `content` on each of the three cards is real slide content
(or a placeholder) — this component only sizes, dims and labels the cards around it.

**v4 (owner, 6 Oct): the roll is for quick flagging; the notes pane is the log.** With `onFlag`
the CURRENT frame wears `FlagChip` at its top right — tap for the usual type, hold or right-click
for the ring of three — and `onFlag(type)` must add a bare flag (a row with a type, no words) to
the shown slide, in the same list the notes pane's composer writes to. Every other frame wears
the plain mark while `flagged`: "this slide has flags", no type, no count, not a control.
`flagged` is derived by the host (an unresolved flag exists). On the current frame the chip takes
the corner, so a flagged current slide shows the chip, not the mark. `onToggleFlag` (the old
per-slide switch) is deprecated and ignored once `onFlag` is passed; the paragraph below
describes that old path.

**(Old path, `onToggleFlag`.) The flag corner appears on hover before it's set, and lingers like the app's own
controls.** Hovering any card — including a neighbour — reveals a quiet outline
`FlagMark` (`chrome/FlagMark.jsx`); clicking fills it. The reveal (and the live card's
expand button, `ExpandMark` from `chrome/ExpandMark.jsx`) runs on the same recede clock
as the app's close button (`useRecede`, `chrome/IconButton`) — it stays for a grace
period after the pointer leaves rather than vanishing under the cursor's heels. Once
flagged, the mark stays, dimmed with its card. **Keyboard focus reveals them too** (2026-10-02):
both corners stay in the tab order at rest, and focus anywhere in the card reveals them until
focus leaves it — so "full screen" always has a keyboard route. **The flag's spoken name is
fixed** ("flag this slide"); `aria-pressed` alone says whether it is set. Both marks are documented in the glyph
vocabulary card (`guidelines/brand-glyphs.html`) — neither is drawn inline here anymore.

**The running clock is folded into the live label — not tied to the flag.**
`current.elapsed` ("00:19") shows in the same pill as "On the projector now", after a
thin divider, whenever it's passed — flag or no flag; time spent on a stop and marking it
for revision are different ideas and used to share one corner, which made the clock
disappear the moment nothing was flagged.

**Preview: nothing on the projector.** `projecting={false}` (the Studio's palette Present) flips
the live label to "Not on the projector" — the same words negated, so the eye compares — swaps
the moss dot for the header bar's hollow preview ring, and hides `current.elapsed`: nothing is
being timed. Pass the same flag to `PresenterHeaderBar` (`state="preview"`) so the two agree.

**A neighbour's whole card is the click target, not its tag — plus an edge chevron.**
"← stop 19" is a label, not a button by itself. `onNavigate` makes the whole card
clickable (it lightens on hover to say so) and also drives a big chevron over that edge
of the roll, for a professor scanning left to right who hasn't noticed the card itself is
live. Both point at the same handler. Omit `onNavigate` and neither appears — a plain
read-only preview.

**Advancing plays one short slide, not a cut** (owner, 2026-09-16). Pressing a chevron used to
swap all three cards' contents between two frames, and nothing in the roll said which way you had
gone — a professor who pressed the wrong side could not tell. Now a stop change starts the row of
cards one step displaced on the side it came from, at half opacity, and settles over `--dur-move`;
the chevron for that direction goes to full weight and leans 3px while it runs. The step is
DERIVED — half the live card, the gap, half a neighbour, the distance the live card actually
travels — so do not re-tune it per direction. It is a cue, not a filmstrip: the cards already hold
their new contents when the slide begins. `--dur-move` is 1ms under `prefers-reduced-motion`,
which returns it to the cut on purpose.

**The move is one `Element.animate()` call, and that is load-bearing.** The first build did it as a
CSS transition — a displaced frame with `transition: none`, then a re-render to rest WITH a
transition — and the transition arrived after the row was already home: a frozen half-opacity hold
followed by a snap, worse than the cut it replaced, plus a `requestAnimationFrame` return racing a
`setTimeout` reset (and rAF stops in a backgrounded window). Web Animations removes both clocks and
both failure modes, and the row's own style stays static. **Be precise about what that buys, since
the obvious stronger claim is false:** a pending or frame-starved animation applies its first
keyframe, so a window getting no frames does hold the row at the displacement until frames resume
(measured 2026-09-16). What is guaranteed is that no React state holds it — a remount, a cancel or
an environment without `animate()` rests — and that no second clock can strip the move halfway. The
duration and curve are read off the computed `--dur-move` and `--ease-settle`; that is what makes
`prefers-reduced-motion` a cut for free.

**Pass `current.stopIndex` or the cue is partial.** With the number the roll reads direction from
its sign, so every route into a new stop animates — keyboard arrows, the strip, the finder, a jump
of several stops — and the roll's own click path switches off, so nothing plays twice. Without it
only a chevron or neighbour-card click animates; a keyboard advance is silent.

---

**`FlagButton` is exported** (2026-09-04): the corner flag on its own. Since v4 (6 Oct) `LectureNotes`
no longer wears it; it is the plain mark on a flagged neighbour frame, and the old switch.
The roll still reveals it by its own card-hover rule; the button has no reveal of its own.

**Replaces in the app:** `src/ds/presenter/FilmRoll.tsx`, ported whole on 2026-09-06 (OB-136,
`5db0dea`) and hosted there by `src/present/PresenterScreen.tsx`. (This line used to read "designed
ahead of the app" and was left behind by that port; corrected 2026-09-16.)

**Hosted by:** `templates/studio/PresenterScreen.jsx`, mounted by `StudioApp.jsx` as the Studio's
presenter mode — the reference call shape (`projecting` follows the shell's: false for the
palette's preview, true from the toolbar ▶).
