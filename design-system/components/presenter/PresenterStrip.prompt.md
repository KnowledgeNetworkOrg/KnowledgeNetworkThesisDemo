One-line: the presenter strip — breadcrumb row over a rail that grows into a row of named
stops; roaming and the active node as two different facts, covered as a third. Part 3 of the
presenter-mode split (`guidelines/presenter-component-split-plan.md`). Named `RoamingDock`
until 2026-09-02.

```jsx
<PresenterStrip
  steps={walk} activeStop={19} roamingStop={42} flags={[15, 18, 19]} covered={presented}
  onFind={(rect) => setFinder(rect)}   // rect to open StopFinder there, null to close
  finderOpen={!!finder}
  onJumpToActive={() => setRoamingStop(null)}
  onRoamTo={(i) => setRoamingStop(i)}
  onMakeActive={(i) => { setActiveStop(i); setRoamingStop(null); setPresented((p) => [...p, i]) }}
  renderPreview={(s, i) => <SlideThumb step={s} index={i} />}
/>
```

**The column around it must let it push, not float.** The strip is `flex: none`; the panes below
take `flex: 1; min-height: 0`. Opening it shrinks the notes pane — nothing overlaps. A host that
lays out by arithmetic reads `presenterStripHeight({ open, roaming })` (64 / 81 / 107 / 130,
sums of the parts, never retyped). The height moves on two events only — `onOpenChange` and
`roamingStop` going null ↔ a number — both the host's own state.

**Three facts, not one cursor.** `activeStop` is the record: the pill counts it, the fill reaches
it, arrows resume from it. `roamingStop` is provisional: the breadcrumb and the row's centre
follow it, the record does not. `covered` is the host's list of stops actually presented; given,
skipped stops stay unwalked when a far stop is held active, and the fill is per segment — orange only
between two covered stops, a gap across a skip. Only the hold (`onMakeActive`) moves the record.

**The hold ring is its own mark.** Closed: a bare 13px ring, "ROAMING" above, "(hold to make
active)" below. Open: an 18px ring with the number, the same two strings. It fills inward as you
hold; released early it eases back. Not a `StepDot` state, on purpose.

**The open row is a window.** Opening keeps the shown stop at the same horizontal fraction the
closed rail had it, already in place on the first paint; after that the row moves only when the
shown stop reaches its edge — **a STEP slides one pitch, a JUMP re-centres** (owner, 2026-09-04:
re-centring on every edge touch moved the row half a window for a one-stop step, and read as a
jerk). Stops past the window are rendered at opacity 0 so an entering dot slides in and fades up
rather than popping into place; the two rows clip horizontally only. Dots slide (`--dur-move`). It never shows dead space
— the centre is clamped so the walk's ends sit at its edges. The line ends at the last stop on
both rails. **The window's ends PEEK** (owner, 2026-09-04): the row draws one dot fewer per side
than fits so the outermost label stays inside the strip, and that room used to hold bare line —
which read as "the walk stops here" while stops were out of sight on both sides. The stop that
belongs in that room is drawn at `PRESENTER_STRIP_METRICS.peekOpacity` with no label, still a
click to roam; a walk that fits whole has no peeks. Flags are click targets (`onRoamTo`). An edge marker pins the
active node to the side it left, on a 3px paper halo so it masks the dots it sits over.

**The open row SPANS the row, and `pitch` is a floor** (owner, 2026-09-21: opening the strip left
"the same walk stops squashed a lot more compared to [the closed rail] where it spans the entire
pane"). The row used to step a constant 68px either side of centre, so its drawn width was a
function of the stop COUNT and the pane's spare width simply went unused — a short walk huddled in
the middle, a clamped window stopped most of a pitch short of the end, and the closed rail beside
it had always spread its ticks edge to edge. Two modes, one walk, one pane, two answers, and the
gap grew with the pane. Now `pitch` answers only *how many stops can this width label without
crowding them*; the row spreads exactly that many across the width, so the drawn pitch is always
at least 68 and grows with the pane. Density is the metric's question and spacing is the width's —
they were one question and should not have been. The ends are inset separately: half a label (36)
where the end stop is labelled, half a dot (9) where it is a peek, because reserving a peek slot
at an end with no peek is the dead space this row is not allowed to draw. Below roughly 340px the
labels crowd whatever the row does; the floor cannot be honoured and the spread is the better of
the two failures.

**It owns none of the three facts.** `activeStop`, `roamingStop`, `covered` are the host's, handed
to the header bar and the panes alike. The strip asks (`onRoamTo`, `onMakeActive`,
`onJumpToActive`) and reports what only it knows (`onStepHover`, `onOpenChange`,
`onMetricChange`). The pill toggles stop number ↔ percent on click (`metric`).

**Built from what exists:** `StepDot`, `walkBand` (with `PRESENTER_STRIP_METRICS.band` floor
0.22 over the map's 0.05), `WalkPreview` + `previewAnchor` for the hover card, `Caret` (down
closed; the open state is `CaretStack`'s up rotation), `FlagMark`, `FindMark`, `IconButton`.
The two small white pills answer hover with `--surface-hover` by hand only because
`PillButton`'s `sm` floor is 24px and this row is 20.

---

**Open calls, not resolved here** (per the plan): is 600ms right (`holdMs`); does a roamed but
never-held stop count as covered in the recap (`covered` is the host's, so the host decides).
The find button fires `onFind(rect)` to open `StopFinder` (part 8) on that rect and, pressed
while `finderOpen`, `onFind(null)` to close it.

**Replaces in the app:** `src/ds/presenter/PresenterStrip.tsx`, ported whole on 2026-09-06 (OB-137,
`5db0dea`) and hosted there by `src/present/PresenterScreen.tsx`. (This line used to read
"designed ahead of the app" and was left behind by that port, the same lag `FilmRoll.prompt.md`
had; corrected 2026-09-17.)

**Hosted by:** `templates/studio/PresenterScreen.jsx`, mounted by `StudioApp.jsx` as the Studio's
presenter mode.

**A drag across the strip selects nothing** (owner, 2026-09-04). The crumbs, the pill and the stop
numerals all label controls, and the row is worked with the pointer — hold to make active, click a
tick to roam. A drag leaving half-selected breadcrumbs behind it reports the wrong gesture.
Refused on the row, since every part of it is furniture.

**The walk line's fill is bounded by the BOX, not by the dot window** (owner, 2026-09-04: "on the
left most line its grey when its walked"). The line spans the strip edge to edge; the dots are a
window of ±half around centre — different spans, and for a week the fill used the second. A segment
whose two dots were both outside the window was skipped even where it crossed the visible line, so
a fully walked walk started with a grey stub: 8px, measured, on a 60-stop walk at 900px, whenever
the first visible tick sits further from the edge than one pitch. `PresenterStripMath.fillBounds`
carries the arithmetic so the next reader asks it rather than re-deriving it.

**The row answers the pointer as a whole, in both modes, and the hovered stop answers louder.**
Two facts, two numbers: `WALK_ROW_HOVER_GROW` (1.08) for every mark while the pointer is anywhere on
the strip, `WALK_HOVER_GROW` (1.18) for the one under it — one factor cannot carry both, because
growing everything equally leaves the hovered stop unmarked (owner, 2026-09-04: "not only the node
in expanded mode should expand, the lines and all the other nodes should as well").

**Every mark grows, the active node's knob included.** The owner's reference is a YouTube progress
bar and it is exactly right: there the track, the played portion and the knob change size as ONE
object, which is why a knob sitting still while the ticks and line moved read as unfinished. Closed:
ticks, line, fill, flags, roaming ring, knob. Open: dots, their flags, the line. The only exemption
is TYPE — labels and the pill hold their size, because scaled text reads as a zoom rather than a
surface lifting toward you.

**It grows the marks, never the row's box.** A full-width strip scaled 8% spills about 40px through
the pane's rounded border, and a `flex: none` row would lift over the pane below it. Positions stay
put, so nothing clips; scale the mark, and never the wrapper that centres it — one `transform`
cannot hold both a `translate(-50%,-50%)` and a hover scale.

**The FORM differs by mode, and that is why the contracted strip looked like it had been skipped.**
It had the same scales; they just could not be seen. Measured: the closed rail's tick is 2×6 and its
line 2px, so 8% gains 0.48px and 0.16px. **A factor is meaningless below about 10px.** The closed
rail steps in whole pixels instead (`tickGrow` 2 / 4, `lineGrow` 1, the line growing about its own
centre); the open row keeps the factors on its 18px dots, where they are 1.4 and 3.2px and a factor
is right for a mark whose size already varies by recency. `WalkStrip` got the same pair in the same
pass.

**The record can be carried, and the old invariant is restated rather than broken** (owner,
2026-09-04). "One gesture commits — the hold on the roaming ring" was the rule; the rule behind it
is **the record moves only by a gesture that starts ON the record**, and that is what the file says
now. A hold on the roaming ring qualifies; so does dragging the active node's own mark — the closed
rail's knob, the open row's current dot. A click on a tick, dot, flag or finder row still only
roams, so the lecture's position cannot move by brushing the rail.

Both commit through `onMakeActive(index)`: same callback, same act. Two details that make it read
as carrying rather than as dragging pixels — the record is drawn at the stop it WILL land on, not at
the pointer, and the drop's own click is swallowed (a carry ends over a tick, whose click would
otherwise roam on top of the record that just landed).
