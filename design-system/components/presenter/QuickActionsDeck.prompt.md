One-line: the presenter's quick actions deck — eight tiles in two named groups, a shelf holding
everything else, and drag-to-swap between them. Part 6 of the presenter-mode split
(`guidelines/presenter-component-split-plan.md`).

```jsx
<QuickActionsDeck                      /* groups defaults to QUICK_ACTION_PLACEHOLDERS */
  library={shelf} on={mapUp ? ['map'] : []}
  libraryOpen={shelfOpen} onLibraryOpenChange={setShelfOpen}
  onSwap={(shelfId, deckId) => exchange(shelfId, deckId)} />
```

**The eight tiles are placeholders, on purpose** (owner, 2026-09-03: "place placeholder buttons
for now, as we're not sure yet what buttons we should have on there"). They live in
`QUICK_ACTION_PLACEHOLDERS`, which is the component's default `groups` and what both the Studio
and the card render — the eight are named in ONE place, so whatever replaces them replaces them
once. The two group names ("Class controls" / "Other actions") are the settled part of v18; the
tiles inside them are not.

**A placeholder is not a disabled action.** `placeholder: true` draws the tile dashed, unlit, with
a dashed dot and a DASHED KEY BOX where a real action prints its shortcut, and says so on hover and
in its tooltip — eight tiles with a blank right edge read as a different design (owner, 2026-09-04:
"what about the shortcuts?"). **Only a `disabled` action
carries the native attribute** — found by review the same day the hover landed: a disabled control
dispatches no mouse events in Chrome or Safari, so a natively-disabled placeholder had no hover
and no tooltip, which had been silently true of the tooltip since the tile was written. A
placeholder is undecided, not refusing, so it stays a hit-test target with a guarded click,
`aria-disabled`, and no tab stop. A greyed-out tile would claim the action
exists and is being withheld; a dashed one says nobody has chosen this slot yet — which is true,
and which is worth being visible on the screen while it stays true.

**Eight is the deck, and the cap is code.** Two columns of four: reachable without reading, and it
fits the 360px column beside the notes pane at a tile height that stays hittable mid-lecture. A
ninth tile is a silent failure — it fits, it looks right, and the deck stops being a deck — so the
component drops the overflow and `console.warn`s the dropped labels rather than stating the rule
in prose and hoping. The drag mechanic is what makes a hard eight liveable.

**`on` is a HELD state, never a press.** The map IS up; the slide IS flagged. Those tiles take the
walk-tinted active face the system reserves for exactly that: acorn wash, `--border-walk`,
`--text-walk` ink, and the dot goes `--accent-walk`. A momentary action never appears in `on`.

**The shelf moves, and where it sits is the host's to remember** (owner, 2026-09-04). Its header
row is the handle and a `Grip` is the affordance — `PaneHeader`'s own split, and the whole row
rather than the mark, because a 9px target is not a target. `shelfPosition` is a **delta** from the
computed beside-placement, never an absolute point: the side is measured on every open, so a
coordinate saved today is wrong the first time the window changes width or the deck flips sides.
The delta is clamped to the viewport when the shelf opens, so one saved on a wide screen cannot
strand the shelf off a narrow one. Persist it against the USER — where a lecturer wants the shelf
is a habit, not a state of the lecture — the same boundary a minted category has, and for the same
reason: the pane stores nothing.

**A drag over this pane selects nothing** (owner, 2026-09-04). Every word on it labels a control or
heads a group of them, so there is no content to protect — and the deck's own gesture is a drag,
which a text selection fights. Refused on the pane body rather than per part. The notes composer
next door is the opposite case and takes the opposite rule.

**The divider between the groups is v18's rule, softened three times** (owner, 2026-09-04).
`dividerInk` is `--bark-200` rather than `--border-hair` — a solid tint, lighter on paper, and no
new alpha token to mirror. `dividerInset` is 0, so it runs the full width of the tile grid and ends
exactly where the buttons do. `dividerBlock` is 18 — 9/8 margins on a 1px line, against v18's 25.
**Ink is how loud it is, extent is what it claims to separate, and the band is how thick it reads:**
the line stays 1px, the thinnest a border renders identically across displays, so "less thick" came
off the margins.

Two earlier attempts, both instructive: **shortening** it (10px inset, hairline ink) made a fragment
of a division, and **deleting** it to buy height answered "too strong" by removing what the plan
has. The height comes from the fit ladder instead.

**It is not label furniture.** It drops AFTER the labels, and only when 28px tiles will not fit
around it — a label costs 21 per group, the rule 18 for the pair, so the rule outlives them. For one
turn it dropped WITH them, which took it off the owner's own 214px pane on the same day they asked
for it back. At 214 it now survives, with the tiles at the 28 floor — and below the floor, where the
scroller is unavoidable, it comes back along with them.

**The key column is the label's budget, and the numbers are measured.** At the 162px tile the
presenter's 360 column gives: 162 − 18 (`tilePadX` 9 a side) − 9 (dot) − 12 (two `tileGap`s) = 123,
so a real `(Q)` at ~22px leaves the label 101 — and v18's longest name, "Take a question", measures
90. The first cut left 89 and truncated it, along with every other 15-character name in the plan
(found by review, 2026-09-04). `keyBox` 14 is the placeholder's dashed stand-in: it has to read as a
column, not as a keycap. `tilePadX` is 9 rather than v18's 10 for the last two px — imperceptible on
the frame, and the difference between 11px of slack and 9. **Measure the PLAN's names, not the
placeholder strings**: "Class control 1" fits where "Take a question" does not.

**The key hint is drawn AND bound.** `action.key` prints as `(M)` in the tile's mono column, and the
deck listens for that bare letter while it is mounted and calls the action's own `onSelect`. A hint
nothing listens for is exactly what the shelf's "esc to close" was, and that took a day to find
because a label is indistinguishable from a feature until you press it. Not bound: a placeholder or
a disabled action (nothing to run), a written chord like `⇧⏎` (drawn only — binding it is the
host's), or anything typed while a field or a contenteditable has focus, because a professor
writing a note must be able to type an M.

**The eight are visible without scrolling at whatever height the host gives**, and the heights are
not hypothetical: 311px is what the presenter row leaves on one machine, **214 on the owner's** —
which is why the deck fits itself rather than trusting a number (asked twice, 2026-09-04; the
second ask is what sent me to measure their pane instead of the card's). It degrades in order:
tile height from 42 down to `tileMin` 28, then the GROUP LABELS — at 214 they are 42px of the 146
available and cannot be fitted around at any legible tile height, and the tiles still say what
they are while a heading only says where a group starts, which `groupGap` goes on saying. Below
the floor the scroller takes over: the net, not the norm.

**The ladder only climbs down while there is something to buy** (owner, 2026-09-05: "the divider is
now gone and also the 8 buttons is causing the scroll bar to appear?"). The rungs exist to avoid
the scroller, so once no rung fits, dropping the headings and the rule buys nothing — the pane
scrolls either way. Both come back there. A scrolling deck that says which group is which reads
better than a scrolling deck that does not, and the height saved by taking them out was never spent
on anything.

**And the scrollbar is the LAST rung, not a middle one** (owner, 2026-09-05: "i want the quick
actions pane to not have a scrollbar, could we make the buttons scale smaller?"). Two rungs went in
under that ask, in the order that gives up the cheapest thing first. The ROW GAP goes from `gap` 8
to `gapMin` 4 BEFORE any words are given up — 8px of air is the cheapest height on the pane, and the
column gap never moves because horizontal room is not what runs out. Then, after the headings and
before the rule, the tiles take a second floor: `tileMin` 28 down to `tileFloor` 22, the smallest
row this system will draw as pressable. At the 206px pane the owner actually has, the deck now lands
on tight gap + rule + no headings with the tiles at 28 and nothing scrolling — measured on their
live Studio, not on this card's frames.

The budget is also why **the rule between the groups went** (owner, 2026-09-03: "the divider is
too strong"): a full-width `--border-hair` plus its 13/11 margins cost 25px, and it was the
heaviest mark on a pane of dashed tiles. The rest came from measuring rather than guessing — the
label's own margin (7 → 5), the legend clearance (8 → 6), the shelf button's lead-in (10 → 8), and
24px of `PaneScroller`'s own vertical insets, which it adds for a scroller under a column head and
which this body's padding already provides.

**The tiles scroll; the shelf button does not.** The deck's body needs about 294px and the
presenter gives it whatever the film roll and the strip leave — and a `scroll="none"` pane with no
scroller crops in silence. The owner's screenshot showed a deck that had lost its last tile row
and the More button with it, no scrollbar anywhere to say so (2026-09-03). The groups take a
`PaneScroller`, the button is pinned beneath it: a short pane is normal, losing the one control
that always works is not. The first group label clears the legend by `headClear` (8) as well —
the same clearance `LectureNotes` needed for the same reason.

**The parts are published so they can be READ**, not rendered: `QUICK_ACTION_PARTS` carries the
same `Tile` and `Library` function objects the deck itself renders. `String(NS.QuickActionsDeck)`
holds only the exported function's own body, so every behaviour that lives in a module-level
helper — the placeholder hover, the pointer-events fix, the shelf's placement, the border ✕ — is
invisible to a specimen card's staleness guard. Six of the card's seven tokens were unreachable or
false at once before this existed (2026-09-03), four of them permanent reds naming changes already
in the build. Where a value can carry the change instead, it does: `tileFill` and `shelfFace` are
on the metrics for the same reason.

**A tile fills its cell** — `QUICK_ACTIONS_METRICS.tileFill` on the button. Both of the owner's shelf complaints
(2026-09-03: "more space between them", "looks off centre from the horizontal") were this one
missing line: a `<button>` at `width: auto` is fit-content even with `display: flex`, and on the
deck the tile is a grid ITEM so it stretched and nobody noticed. In the shelf it sits inside the
draggable span, where fit-content gave a 122px tile in a 148px cell — measured 34px between the
columns against the grid's 8px gap, and 28px of slack on the right against none on the left.
Neither symptom was what it looked like. The value is published on the metrics rather than written
inline, because `Tile` is a module-level helper and `String(NS.QuickActionsDeck)` cannot see
inside it — a literal there is unguardable by a card, the same reason `glyphPanel` exists on
`LectureNotes`.

**The shelf opens BESIDE the pane** (owner, 2026-09-03: "we cant drag the buttons onto the buttons
behind the pane"). It opened above the More button for a week, and the More button is at the pane's
FOOT — so "above the anchor" meant directly over the deck. Measured in the Studio: six of the eight
tiles sat under the popover, and those tiles are every drop target the gesture has. The docblock
said the opposite from the day it was written, which is why nobody caught it by reading. Beside the
pane the deck is whole; the side is measured on open (left when there is room, right when there is
not, so a deck at the window's edge does not open off-screen). The tile under the pointer is NAMED while hovered ("↑ shelf"), not merely highlighted:
eight is fixed, so something has to go, and the professor is entitled to see which. Omit `onSwap`
and the shelf becomes a plain list of actions to RUN — no drag, no instruction line, nothing
suggesting a rearrangement the host cannot perform.

**The shelf button is dashed**, the same thing dashed means everywhere in this system: this is
where the deck is still open to change. It keeps its place while the shelf is open, so the popover
has a fixed anchor.

**Its column, not its height.** The deck is the `flex: 1; min-height: 0` pane of a fixed 360px
column beside the notes pane — the same column the recap's flagged-slides pane occupies, so
nothing moves sideways when the lecture ends.

**The shelf's ✕ sits on its top-right border** and is revealed while the pointer or the keyboard is
inside, fading on `--dur-hover` — a pane's recipe, and `StopFinder`'s (owner, 2026-09-03). Inline
in the header for a turn, it put a control inside the content it dismisses and took a row for
itself. The border LINE is masked by a 1px strip of the popover's own face, not the desk colour: a
popover floats over panes it cannot name.

**The shelf button wears a wash at rest** and has FOUR faces, published as
`QUICK_ACTIONS_METRICS.shelfFace`: `--bark-50` at rest, `--bark-100` hovered, `--bark-100` open,
`--bark-200` hovered while open. Transparent, it read as a caption rather than the one control on
this pane that always works. And open-or-hover on one wash was not enough either: for a turn
"Close the shelf" answered the pointer with nothing, because its open face and its hover face were
the same colour (owner, 2026-09-03). Open is as heavy as hover; hovering an open button goes one
step past it.

**Escape is the component's** (2026-09-03). It used to be a label and nothing else: the shelf
carried an "esc to close" text button and no key was bound anywhere. That button is the house ✕
now, with `Close (esc)` as its tooltip, and a document-level listener makes the tooltip true. The
listener cannot be local — the shelf takes no focus of its own, being a drag target — and a
controlled shelf gets the same key, which calls `onLibraryOpenChange(false)`.

**Every tile that is not refusing hovers.** A live tile takes the face and the strong border; a
PLACEHOLDER takes the strong border alone and keeps its dash and its face, so the pointer can find
a slot nobody has decided without being promised a click; a `disabled` action takes nothing,
because a refusal that lights up invites the click it will swallow. The deck had a hover from the
first version and nobody ever saw it — every tile on it is a placeholder, and placeholders were
shut out of the lit state (owner, 2026-09-03: "could we add a hover effect on the buttons"). The
shelf's own dashed button hovers too; without it, a full-width dashed control read as a caption.

**Still open** (the plan's own note for this part): what the eight actually are, and whether the
drag-to-swap mechanic should generalise to any tile grid in the system rather than living here.

---

**Replaces in the app:** `src/ds/presenter/QuickActionsDeck.tsx`, ported in OB-146 (`33dfa03`) and hosted there by
`src/present/PresenterScreen.tsx`. (This line read "designed ahead of the app" and was left behind
by that port, the lag `FilmRoll.prompt.md` had; corrected 2026-10-01.)

**Hosted by:** `templates/studio/PresenterScreen.jsx`, the reference call shape, in a column beside
`LectureNotes` that stands at 360px untouched and DRAGS (owner, 2026-09-23; OB-254): a `PaneDivider`
between the two, clamped by `QUICK_ACTIONS_FIT` and `LECTURE_NOTES_FIT`. Read the fit; never type
300. **Filed as OB-146** (owner, 2026-09-04). The exchange is
`swapActions`, exported and pure — the host stores the two lists and calls it from `onSwap`. The
eight tiles ship as placeholders; the app is asked to PROPOSE a set in its receipt (owner: "we will
add them later. or they can suggest buttons too").
