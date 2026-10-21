One-line: the end-of-lecture recap — the band of numbers with the clock it started and ended on, the lecture's flags grouped by slide,
one slide shown beside them with its flag button, and the closing actions. Part 7 of the presenter-mode split
(`guidelines/presenter-component-split-plan.md`).

```jsx
<LectureRecap course="Foundations of Computing" when="Arrays & Lists → Hashing"
  elapsed="21:05" booked="50:00" started="Thu 4 Sep 2026 14:02" ended="14:23"
  counts={{ stops: 8, slides: 3, flags: 5 }}
  notes={<LectureNotes variant="review" entries={entries} stops={titles}
    selectedStop={shown} onSelectStop={setShown} onEntryCommit={…} onResolveEntry={…} />}
  slide={<Slide stop={shown} />} shownStop={shown} stops={titles} onShowStop={setShown}
  onFlag={(category) => addFlag(shown, category)} flagTypes={userTypes}
  actions={[{ label: 'close the presenter', tone: 'neutral', onSelect: close }]} />
```

**v4 (owner, 6 Oct): the right column shows ONE SLIDE, not a list.** "Flagged for revision" is
gone — the notes slot's Flags list covers it. The host holds `shownStop`: slide 1 of the walk (0)
until the professor clicks a flag or a slide's head in the notes slot (`onSelectStop`); pass the
same index back as `selectedStop` so that slide's group lights up. ‹ › step through the WHOLE
walk, flagged or not, and stop at its ends; "stop 7 of 8" sits under the slide; the legend is
"Preview" (owner, 21 Oct; it read "stop N · Title", which the slide already shows). **The preview is
the notes pane's right column** (owner, 21 Oct): pass `notes` as the `LectureNotes variant="review"`
ELEMENT and the recap adds the preview to it as `aside`; do not pass `aside` yourself. **"Close the presenter" is not passed here**: it is the header bar's (`PresenterHeaderBar onClose`, owner
21 Oct). Any other action sits at the right of the head band's foot, on the next-time line, small. On a short screen
the slide shrinks to fit, keeping its shape. The flag chip at the slide's top right is the film roll's (`FlagChip`): tap for
the usual type, hold for the ring; `onFlag` must add a BARE flag to the shown slide, and the
professor gives it words by clicking its row. No "add a flag" link, no "move into prepared
notes" (owner, 6 Oct). The prepared notes are not shown here.

**The stats are stops covered, slides flagged, flags** (v4): one slide can hold several flags, and
every note is a flag, so "notes taken" went. `counts={{ stops, slides, flags }}`; the old
`{ notes, flagged }` is still read when `flags` is absent.

**Filed and ported (OB-147); its 2026-10-01 changes are in OB-290. The v4 rework is NOT filed (owner, 6 Oct: review first).** The stats row and the closing
actions are still the parts most likely to move.

**It takes the roll's and the strip's place, and the header bar stays.** The recap is the
`flex: 1; min-height: 0` child of the presenter's column; above it the bar reads "Lecture ended"
with its ■ faded. Ending is not a trapdoor: the presenter stays open, the notes stay readable, and
the host's own toolbar ▶ is what resumes.

**Three things, in the order a professor wants them.** The band says what the lecture WAS and
gives the numbers; under it, the notes on the left and what to do next on the right. Nothing
on this screen is a summary the machine wrote.

**When it started and when it ended** (owner, 2026-09-04). Pass `startedAt` / `endedAt` and the
recap prints the two wall-clock readings the elapsed figure cannot give back — mono, directly under
the course line and before `when` (owner, 2026-10-01), as ONE span with a dash — by one rule in code (`LectureClock`): `Fri 4 Sep 2026 13:12 – 13:40`,
no "started"/"ended" words, 24-hour, no commas, the date on the start always and on the end only
when it is another day (owner, 2026-10-01). `started` / `ended` strings
still win for a host with its own clock.

**The session, and where next time starts** (2026-10-01, with the start card; filed as OB-285,
host wiring OB-286). Pass `session` — THE SESSION THE HOST STORED, after the lecture's end is
written into its `last`. One prop draws two things: the name and days beside the course name
(read-only; "Untitled session" in the untitled style), and the band's foot under a hairline: "Next
time, continue picks up at Forwarding, stop 2.2 – Distance vector", or "Finished the walk
Forwarding". The foot is worded by the start card's own `StartMath.resolve`, so the two screens
cannot disagree. Never rebuild the session for this screen.

**The head is a band, not a pane.** It carries no title hat and nothing in it scrolls, so a `Pane`
would put a legend on a thing whose first line already names it. It borrows the pane's frame and
radius so it belongs to the same family of objects.

**The stats are the host's numbers and the recap's words.** Covered stops, notes and flags all
live in the host's store; a component that recounted them would be a second, disagreeing source —
so `counts` come in and `recapStats` words them, plurals decided. It sets them and divides them with hairlines — three since 2026-09-04 (the question count
went with the notes pane's "questions" wording: a number counting a category is not a fact about
the class), and more will fit and read as a table.

**The notes side is a slot, not a copy.** Pass `LectureNotes variant="review"`. One component
owning both the live pane and the recap's version of it is how the two drift apart.

**The aside is 360px** — the same column the quick actions deck stands in during the lecture, so
nothing jumps sideways at the moment the lecture ends. Change one and change the other.

**No closing action is primary.** Ending a lecture is not a success, and a green pill would say it
was — the same reason the header bar's confirm washes grey. The words and the order are the
host's; `tone` is there if it disagrees. **A way out is `neutral`** (owner, 2026-09-04): "close the
presenter" once sat at the foot of a list looking like one more row of it, so it takes a bark
grey wash, the pills are full-width with the label centred (`PillButton block`), and space
above them (no hairline since 2026-10-01) separates "what to revise" from "what to do now".

---

**Replaces in the app:** `src/ds/presenter/LectureRecap.tsx`, ported in OB-147 (`33dfa03`) and hosted there by
`src/present/PresenterScreen.tsx`. (This line read "designed ahead of the app" and was left behind
by that port, the lag `FilmRoll.prompt.md` had; corrected 2026-10-01.)

**Hosted by:** `templates/studio/PresenterScreen.jsx`, which mounts it in place of the roll and
the strip once the lecture has ended, with `session` handed down by `StudioApp.jsx` from its
session store — `last` written by `onRecord` in the same event that ends the lecture. **Filed as OB-147** (owner, 2026-09-04), with `PillButton`'s
`neutral` and `block` as its dependency. Before filing, the clock wording (`LectureClock`) and the
stat wording (`recapStats`) moved into the component: the host passes `startedAt`/`endedAt`,
`elapsedS`/`bookedS` and `counts`, and the strings survive only as overrides.
