One-line: the top bar of presenter mode — course name, the Presenting/Roaming/Ended/Preview
state chip, the clock, and ■. Part 1 of the presenter-mode split
(`guidelines/presenter-component-split-plan.md`).

```jsx
<PresenterHeaderBar course="Foundations of Computing" state="roaming"
  activeStop={20} roamingStop={43} elapsed="21:05" bookedLength="50:00" progressPct={42}
  confirmOpen={confirming}
  onEndClick={() => setConfirming(true)}
  onConfirmEnd={endLecture} onCancelEnd={() => setConfirming(false)} />
```

**The bar ends; it never starts or resumes.** ■ is always ■. Once ended it stays a stop button,
disabled and faded — nothing left to stop — and does not turn into ▶. Resume lives on the host's
own toolbar (the Studio's ▶), so there is one play button on screen with one meaning. `onResume`
is accepted and ignored (`@deprecated`). `endedTotal` is shown verbatim — pass "21:05 total",
the component adds no unit.

**Preview is not a lecture.** `state="preview"` is the presenter layout with nothing projected —
the professor looking at how the panes will sit. No clock (the time props are ignored), a neutral
"Preview stop N" chip with a solid unfilled ring (no walk hue, no dash), and ■ disabled and faded
as when ended: there is nothing to stop. The host starts no clock in preview, keeps its own start
control pressable (that press is how a preview becomes the lecture), and starts the clock from
zero on that press.

**Two marks, one sentence shape.** `activeStop` is the lecture's own record; `roamingStop`
is only where the professor is currently looking. Presenting and roaming share the chip's
words ("Presenting stop 20" / "Roaming stop 43") so the eye re-reads the dot and the verb,
not the whole line — the roaming chip is the one hollow mark, everything else in the bar
stays filled or flat.

**One state carries the walk hue; the other is dashed.** Presenting is the lecture's
committed record — acorn wash, `--border-walk`, a filled dot — the same meaning
`--border-walk` already has: "a walk-tinted control in its active state." Roaming is
provisional, so it wears the system's other convention instead: dashed always means
conditional, so it gets an unfilled dashed ring and a dashed neutral chip, no hue at all.
A conditional state that looked louder than the committed one would say the wrong thing.
Inside the chip, the stop number is set apart the way `CountBadge` sets its own numbers
apart — mono, tabular, full ink — so the state word reads as a softer lead-in.

**■ asks first, from a grey wash.** No red, no fill on either state, because ending a
lecture is normal, not dangerous. Neither confirm button washes green either — it is an
ending, not a success — and "end lecture" wears the same grey wash as ■ itself, always
on, not just on hover; both darken one step on hover. The confirm popover
is controlled (`confirmOpen`) so the host decides when it closes (outside click, escape,
the confirm itself).

**The message is fixed:** "You can resume from the same place later on." One line, no
props to fill in — every call site gets the same words.

**The clock never parses time.** Pass `progressPct` yourself; the component only draws the
hairline at that percentage. Omit `bookedLength` for a bar with no lecture length in the
model — it falls back to a bare elapsed reading.

---

**Replaces in the app:** `src/ds/presenter/PresenterHeaderBar.tsx`, ported in OB-135 (`5db0dea`) and hosted there by
`src/present/PresenterScreen.tsx`. (This line read "designed ahead of the app" and was left behind
by that port, the lag `FilmRoll.prompt.md` had; corrected 2026-10-01.)

**Hosted by:** `templates/studio/PresenterScreen.jsx`, mounted by `StudioApp.jsx` as the Studio's
presenter mode — the reference call shape. The Studio's toolbar ▶ is the resume the ended state
points at, and the start the preview state points at (the palette's Present opens the preview;
`PresenterScreen` takes `projecting={false}` for it).
