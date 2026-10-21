One-line: the presenter's flag button — a small chip that makes a flag of the usual type on a
tap, and opens a ring of the OTHER flag types on a hold; a type picked there becomes the usual one.

```jsx
<FlagChip types={userTypes.slice(0, 3)} usual={user.usualFlag || 'fix'} onUsualChange={saveUsualFlag}
  onFlag={(category) => addEntry({ stop: shown, category, text: '', when: clock(), at: Date.now() })} />
```

You rarely mount it yourself: `FilmRoll` draws it on the current frame when given `onFlag`, and
`LectureRecap` draws it on the shown slide when given `onFlag`. Both pass `flagTypes`,
`usualFlag` and `onUsualFlagChange` through.

**Tap = the usual type. Hold (300ms) or right-click = the ring.** The ring has the OTHER types
around it (owner, 15 Oct): the usual one is the tap, so it is left off — with three types, two
petals, up-left and up-right — and a CANCEL mark (✕) in its middle. Held, the professor slides onto a petal and lets go; letting go in the middle, or outside
the ring, makes nothing (owner, 6 Oct: the middle cancels — it used to mean the usual type).
Owner's design, v4 sheet (`ideas/flags-and-notes-v4.html` part 2).

**A flag is a row in the SAME list as a typed note.** `onFlag` must add a bare entry — `text: ''`
— to the lecture's one list, stamped with the slide. The notes pane shows a bare flag beside its type
tag, reading "enter description"; a click on it gives it words. There is no second store and no per-slide
switch (that was the old model: `StopFlag`, `FlagMath`, the shell's per-stop list).

**No key binding.** The F key went (owner, 6 Oct). A focused chip still takes Enter/Space (tap) and
↑ (ring), so it is reachable by keyboard; but nothing global makes a flag, so a stray "f" while
typing is harmless.

**A type picked on the ring becomes the usual one, and it saves** (owner, 15 Oct, reversing the
6 Oct Q2 "a setting, never the last used"). The flag is made and the chip now shows and taps that
type. Store it against the user (`onUsualChange`) and pass the same key to the roll, the recap and
`LectureNotes usualFlag`, so the composer starts on it too. Default "fix this slide".

**The chip IS the type tag: a circle in the type's wash, nothing around it** (owner, 6 Oct — no border, then no white bezel either; round, not square). It sits on a soft shadow and lifts higher under the pointer, so it reads as a control over a slide. The notes pane's row tags stay square. **Holding fills it from the edge to the centre** with a deeper shade of its own wash over exactly the 300ms hold, so the professor sees how long to hold; let go early and the fill vanishes. **Each petal is the type's own circle too**, no bezel; the one under the hand lifts and takes a 2px ring inside its edge, and its word lights in the type's wash. **The wheel has no plate.** Each petal, the ✕ and each word carries its own lifted paper, so it reads over a slide — a see-through disc left it illegible, and a solid one small enough for the compact wheel could not hold its words.

**The ring paints outside its parent.** It is portalled to `document.body` and fixed at the chip's
centre, so the film-roll frame's `overflow: hidden` cannot clip it.

**The tooltip says "tap to flag · hold to change flag".** The sheet shows it only for the first few times;
counting is the host's (`onRingOpen`, then `hint={false}`).

---

**Replaces in the app:** the flag toggle — `FlagButton` on the film roll's cards and on the notes
pane's prepared head, and the F key in `src/present/PresenterScreen.tsx`. Designed ahead of the
app's v4 model; nothing filed yet (owner, 6 Oct: review first).

**Hosted by:** `templates/studio/PresenterScreen.jsx`, through `FilmRoll` (live) and
`LectureRecap` (after class). Read 6 Oct: the roll's current card is `overflow: hidden`, which is
why the ring is portalled.
