One-line: the presenter's notes pane — v4 (owner, 6 Oct). The left column holds the slide's
prepared notes and, under a divider, the slide's flags with the composer at the foot; the right
column is the Class chat, parked until the student app exists.

```jsx
<LectureNotes stopNumber={shown + 1} stopTitle={step.title} roaming={roaming}
  prepared={preparedNotes[step.id]} onPreparedCommit={(text) => savePreparedNote(step.id, text)}
  preparedHeight={prepH} onPreparedHeightChange={setPrepH}
  entries={entries} stop={shown} stops={titles}
  categories={userTypes} onAddCategory={saveUserType}
  draft={draft} onDraftChange={setDraft} category={type} onCategoryChange={setType}
  onSave={({ category, text, stop }) => { add({ stop, category, text, when: clock(), at: Date.now() }); setDraft('') }}
  onEntryCommit={(e, text) => update(e.id, { text })}
  onEntryCategoryChange={(e, category) => update(e.id, { category })}
  onResolveEntry={(e) => update(e.id, { resolvedAt: Date.now() })}
  chatWidth={chatW} onChatWidthChange={setChatW} />
```

**A flag is a row, and every typed note is a flag** (owner, 6 Oct, Q3: "the textbox is just
another way for the prof to flag the slide"). The film roll's chip (`FilmRoll onFlag` →
`FlagChip`) adds a BARE entry — a type, no words; the composer adds one with words and an optional
type. Same row, same list, same store. The old model — an on/off switch per slide (`StopFlag`,
`FlagMath`, the head's `FlagButton`) — is gone from this pane; `flagged` / `onToggleFlag` do
nothing now.

**What the host keeps: ONE list for the lecture**, newest-first, each entry stamped `stop` and
`at` (ms). Pass it whole with `stop` (the shown slide): the pane filters, draws the slide's flags
oldest at the top and newest at the foot beside the composer, and scrolls so the newest always
shows. A slide is "flagged" while it has an entry with no `resolvedAt` — derive it for the film
roll's mark and the recap's count; never store a second bit.

**Delete RESOLVES** (owner, 6 Oct). The bin calls `onResolveEntry`; stamp `resolvedAt` and keep
the entry, so the slide's history survives for the review of flags (to be designed). **The bin
asks first** (owner, 15 Oct): a line opens under the flag, which stays in view: "Delete this flag?" with Keep (focused) and
Delete; Escape or a click outside keeps. Confirmed, the row leaves at once — no strikethrough. A NEW row is washed in its own type's colour (a quarter strength) for 2 seconds, then fades out slowly over 1.5s (`freshFadeMs`; owner, 16 Oct) (owner, 15 Oct; was amber for every type), so the
eye finds what just landed. **There is no undo** (owner, 15 Oct): a new row can be edited or
resolved at once, like any other; `onUndoEntry` and `onRestoreEntry` are deprecated and never
called. Both clocks are `LECTURE_NOTES_METRICS.undoMs` (the name outlived the undo) and run off `at` / `resolvedAt`; the
pane does the arithmetic (`NoteFlagMath`). `onDeleteEntry` is the deprecated old name: a host
still filtering the entry out on it is now erasing history.

**The composer starts on the film roll's usual type** (owner, 15 Oct): pass `usualFlag`, the same key
as `FilmRoll usualFlag` (both default 'fix'). A host's `category` of `undefined` means "not chosen
yet" and shows the usual type; picking "no type" hands back `null`. Its type tag stands in the same
column as the rows' tags: the composer box bleeds 7px left to put it there.

**A row is one line where the words allow**: tag, words, time at the right. A bare flag shows
"enter description" — the open box's own placeholder, italic third ink (owner, 15 Oct); a click on it opens the words. **A row's words are click-to-edit**,
like the prepared notes (owner, 15 Oct): a faint outline and a text cursor under the pointer, a
click opens them in place. No pencil, no "+ why" (owner, 15 Oct). **A note with no type keeps the
tag's place** (owner, 21 Oct): an empty dashed slot, a "+" in it under the pointer, a click opens the
type list; nothing about types sits among the hover actions. The bin leaves with the row's wash, no grace
period, in class as in review (`liveRecede` false).
The actions cover the time under the pointer rather than pushing the words. **Click the tag to
change the type** — the composer's own type list. Only the row's own words select.

**The tally beside "Flags"** counts this slide's flags by type — only the types that have a count
(no faded zeros), untyped notes last as their empty dashed slot and a number (owner, 21 Oct;
it read "N plain") — with "N flags" at the
right. The live head reads "Flagged during lecture" (owner, 15 Oct; the recap's copy keeps "Flags"), and an
opened row's words show "enter description" while empty. Resolved flags count nowhere. Empty: "nothing yet.", and the head is the title alone — no tally
and no "0 flags" until the slide has an open flag (owner, 15 Oct). The review copy does the same
for the whole lecture.

**The prepared notes are plain text, and a click edits them** (owner, 6 Oct, reversing 4 Sep). No
pencil. Under the pointer a faint outline and a text cursor; clicked, editing at once; Esc or a
click outside saves. A stray click only places a cursor — nothing changes until the professor
types, and the projector never shows it. An edit changes the note for every later lecture (Q1: no
per-lecture copies).

**The prepared notes and the flags share the left column, with a divider you drag** (owner, 6
Oct). Default 150px for the prepared notes; floors 60 and 96 so neither side can be dragged shut;
double-click resets. The prepared notes scroll inside their share, so a long note never pushes the
flags out of sight. Persist the height (`onPreparedHeightChange`) the way the column split is
persisted.

**The right column is the Class chat, parked.** It starts at its 220px floor and the column
divider widens it; it stays on screen because it is coming. **Store its width under a NEW key**:
the old `duringWidth` setting (300 by default) would open the parked chat wide. `duringWidth` /
`onDuringWidthChange` are still read, deprecated.

**The composer is today's, moved to the foot of the left column.** It starts on the usual type
(`usualFlag`, owner 15 Oct); its
menu lists the three flag types first, then the user's own, then "no type" and "new type…". ⏎
saves, Shift+⏎ breaks a line, the field grows to four rows. Clearing the draft is the host's.
**The enter button at its right is always drawn** (owner, 16 Oct): washed out and inert while the
field is empty, the save button once there are words. Do not hide it on an empty draft.

**Only today's flags show** (owner, Q6: "we are just presenting today's lecture"). Earlier
lectures' unresolved flags go to the separate review of flags (Q5), not designed yet.

**It fills what is left of the presenter column, under the strip, and never gets shorter than
`LECTURE_NOTES_FIT.minHeight` (340).** Its row is `flex: 1 1 0; min-height: 340`; the presenter
column scrolls (`overflow-y: auto; scrollbar-gutter: stable`) when the window is too short for the
roll, the strip and that floor. That column is the one scrolling ancestor allowed: the pane still
owns its own inner scrolling, and never gets a fixed height. The composer is outside the scroller.
(Until 26 Oct this paragraph said `min-height: 0`, and a faithful port squeezed the pane.)

**Everything here is the professor's own and never shown to the class** (owner, 2026-09-09,
OB-166). The prepared notes are not the stop's audience-facing `note`; they live in the lecture's
store, keyed by stop.

**A type the professor mints is user-wide** — persist it against the user and hand the same list
to this pane and to both chips. `NOTE_CATEGORY_POOL` hands out the glyph and wash; the professor
types only the name.

**`variant="review"` is the recap's copy** (`LectureRecap notes`): "Flags" with the tally and "N
slides · N flags"; slides in walk order, each one's flags oldest-first; hairlines between slides
only. `selectedStop` washes the slide the recap is showing; `onSelectStop` fires on a click on a
slide's head or one of its rows. Rows keep edit, resolve and the type change.

---

**Replaces in the app:** `src/ds/presenter/LectureNotes.tsx` (ported in OB-145), hosted by
`src/present/PresenterScreen.tsx`. The v4 rework is NOT filed yet (owner, 6 Oct: review first).
When filed, OB-290 and OB-291 (both building the old per-slide switch) need amending.

**Hosted by:** `templates/studio/PresenterScreen.jsx`, under `PresenterStrip` and beside
`QuickActionsDeck`, with a `PaneDivider` between them; this pane's side of that clamp is
`LECTURE_NOTES_FIT` (522, derived). **Its `minHeight` (340) is a floor the host must keep**: give
the pane at least that much height and let the presenter column scroll below it — squeezed
shorter, the flags cannot scroll and the composer is clipped (owner, 16 Oct).
