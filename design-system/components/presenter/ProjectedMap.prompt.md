One-line: the map on the wall, on request — the frame (pond face, "where we are · stop N of M"
caption, the slide's foot) around the host's own map. Part 4 of the presenter-mode split
(`guidelines/presenter-component-split-plan.md`).

```jsx
// the wall's content, on EVERY wall surface — WallTransition owns the up/down motion, not this
const wall = (i, onClose) => (
  <WallTransition up={mapUp} slide={<Slide step={steps[i]} index={i} count={N} />}
    map={<ProjectedMap stop={i + 1} count={N} territory={steps[i].territory} title={steps[i].title}
      map={<LectureMap steps={steps} covered={covered} lit={i} />}
      footer={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{steps[i].walk} · every stop, unbanded</span>}
      onClose={onClose} />} />
)
// M toggles it; nothing else ever does
if (e.key === 'm' || e.key === 'M') setMapUp((v) => !v)
```

**On request only, and a second press takes it down.** M (or the quick action "Project map · M")
puts the map up; nothing automatic — not an advance, not arriving at a stop, not a roam. While it
is up it stays up: stepping moves the lit pin and the caption. Ending the lecture takes it down.

**It goes wherever the slide goes.** The map is the wall's content, so it replaces the slide on
the film roll's live card, in full screen, and on the projector — and nowhere else (neighbours
stay slides). Same 1120:630 box as the slide; it fills it. The roll's live label stays "On the
projector now" — the map is what is on the projector.

**The host draws the map; this is the frame.** `map` is the app's own map — the map pane's drawing
— showing the WHOLE lecture: every stop a pin (`StepDot variant="pin"`, numbered per OB-114), the
covered stops and the stop on the wall joined by the walk line, the stop on the wall lit
(`state="current"`). The pane's recency band (OB-132) does not apply on the wall: the room is
looking at a still picture to see where it has been and where it is going.

**Chrome scales, the map does not.** Caption and foot are laid out at the 1120-wide reference and
`transform: scale()`d to the measured box, so they read at projector proportions in a 340px mirror
and on a wall alike. The `map` slot gets the real pixel box, so a canvas map stays crisp.
`PROJECTED_MAP_METRICS` publishes the reference (1120×630) and the insets: caption at 62 (the
slide's own text inset — the caption and the slide's eyebrow share a line when the wall flips), 44
(clears the roll's corner pill), foot 32 (the slide's, so it does not jump). All chosen.

**The foot's SLOT is fixed; its WORDS shouldn't just repeat the slide's.** Passing the identical
string the slide's own foot just showed reads as if the flip changed nothing. Keep the position
(so nothing jumps) but say something plain the map adds — "· the whole walk" reads to a room;
"unbanded" is this system's own word for it, not theirs. **The band carries
`data-projected-map-foot`** so the equal-band promise can be tested: a check for "the foot does not
move on the flip" has to find the foot, and locating it by structure (`> div:last-child`) rots
silently and in the test's favour. Added 2026-09-14 on the app side's offer (OB-177) — they had
been validating what a structural selector found rather than trusting it, which is worth keeping
either way.

**The caption is the walk's.** Eyebrow in acorn — the hue of movement — title in `--text-1` with
the › in `--text-3` regular so "Territory › Stop" reads as a path. No territory hue in the
caption; the map under it is every hue at once. It sits on its own pond-toned scrim, not directly
on the map, so a busy territory or pin drawn right where the words fall never fights them.

**`onClose` draws a ✕, top right; it is a second M, never more.** Pass a handler and the wall gets
a close button, fixed size regardless of the box so it stays a real target on a 340px mirror and
a full wall alike. Pressing it takes the map down and nothing else — in full screen it leaves the
room looking at the slide, still in full screen; the ✕ never closes full screen itself, that is
the frame's own backdrop/Escape. It fades in on activity over the wall and recedes on the same
clock every hover-revealed control in the system shares (`useRecede`), rather than sitting on
screen permanently. The Studio's `wall(i, onClose)` in `templates/studio/PresenterScreen.jsx`
wires it, on every surface, to a plain "take the map down".

**Showing OR hiding the map is a small pane, top right, not a hard cut.** The Studio's `wall(i)`
wraps the slide and the map in `WallTransition`: coming up, the map grows from a small pane at the
slide's own TOP-RIGHT corner to fill it. Going down is two steps, not the mirror of that one —
it shrinks back to that same small pane and STAYS there a beat, fully visible, an actual small
pane overlaying the slide, before it fades and only then is gone. That transition is the HOST's
(it wraps `ProjectedMap`/the slide from outside), not this component's own concern.

**The ✕ is full screen's alone.** The Studio passes `onClose` on the full-screen wall only — the
roll's live card omits it, because that card's own flag sits in the same top-right corner and the
two would overlap on a much smaller surface with no room for both.

---

**Replaces in the app:** `src/ds/presenter/ProjectedMap.tsx`, ported in OB-139 (`645d7ac`) and hosted there by
`src/present/PresenterScreen.tsx`. (This line read "designed ahead of the app" and was left behind
by that port, the lag `FilmRoll.prompt.md` had; corrected 2026-10-01.) Its `map` slot is `MapView`'s drawing with the walk on it.

**Hosted by:** `templates/studio/PresenterScreen.jsx` (`wall(i)`, the M key, `LectureMap` as the
stand-in for the app's map), mounted by `StudioApp.jsx` as the Studio's presenter mode — the
reference call shape.
