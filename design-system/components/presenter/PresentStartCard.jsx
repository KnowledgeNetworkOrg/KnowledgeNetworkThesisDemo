import React from 'react'
import { IconButton, useRecede } from '../chrome/IconButton.jsx'
import { PillButton } from '../chrome/PillButton.jsx'
import { InlineText } from '../chrome/InlineText.jsx'
import { EditMark } from '../chrome/EditMark.jsx'
import { WalkerMark } from '../chrome/WalkerMark.jsx'
import { LocateMark } from '../chrome/LocateMark.jsx'
import { LoadMark } from '../chrome/LoadMark.jsx'
import { BinMark } from '../sidebar/BinMark.jsx'
import { LoadPicker } from '../nav/LoadPicker.jsx'
import { PaneScroller } from '../chrome/Pane.jsx'
import { Caret, CARET_INK } from '../nav/TreeRow.jsx'

/** The card's numbers. `metaLine` (22) is DERIVED: the height of the line the 22px pencil and
 *  bin sit on — the days line, or the name line on a one-line row. `pairGap` (0) is CHOSEN: the
 *  pencil and bin touch, so they read as one group (owner, 2026-10-01).
 *  The rest are CHOSEN, not derived: `width` 640 fits the session column and a start row
 *  whose grey line ("Forwarding finished · next: Routing, the walk you have open") holds on one
 *  line at 13px; `side` 210 holds a session name plus its days without a cut.
 *  `editRows` (2) is CHOSEN: an open session is two fields, the name then the day picker. The
 *  worded "Meets Mon–Fri" line above the picker is gone (owner, 2026-10-01: the lit toggles
 *  already say it). `bodyMax` (360) is CHOSEN: the tallest the card's body grows (owner,
 *  2026-10-01: many sessions grew it off the screen). It holds the three start rows with room, and
 *  about six sessions; past that the session list scrolls under its fixed heading and "+ New
 *  session", and the walk list scrolls the same way. `pairRecede` (false) is CHOSEN: a session's
 *  pencil and bin fade with the row's instant wash, NOT on the system's grace period (owner,
 *  2026-10-01, after seeing both: "not having delay looks cleaner"). The rows are short and the
 *  pair sits inside the row, so the pointer never crosses a gap to reach it. true restores
 *  `useRecede`. The row reads it, so it is the switch, not a note. */
export const START_CARD_METRICS = { width: 640, side: 210, row: 52, icon: 28, metaLine: 22, pairGap: 0, editRows: 2, bodyMax: 360, pairRecede: false }

/** WHAT "CONTINUE" MEANS, AS CODE (2026-09-30, owner's version D). A session remembers one
 *  thing: the walk and stop where it was last presented. From that and the walk the professor
 *  has open, four cases — and the grey line under "Continue" is the only thing that changes:
 *  - no record yet       → `top`:      the open walk from stop 1
 *  - stopped mid-walk    → `continue`: that walk, that stop (any walk, not only the open one)
 *  - finished, other walk open → `next`: the open walk is the guess for the next lecture
 *  - finished, same walk open  → `choose`: nothing to guess; the host opens its walk picker
 *  `stop` is 0-based throughout; the wording adds 1.
 *  A FINISHED walk takes TWO lines (owner, 2026-10-01): `line` names the walk that was finished,
 *  `next` says what Enter does about it. On one line, "Forwarding finished · next: Routing…" read
 *  as if Forwarding were a stop.
 *  THE NAMES ARE EMPHASISED (owner, 2026-10-01): the walk's name and the stop are what the eye
 *  looks for, so `lineEm` / `nextEm` carry the same words as `line` / `next` as runs,
 *  `[text, emphasised]`; the card draws an emphasised run semibold in the first ink. `line` and
 *  `next` stay plain strings, for a tooltip or a screen reader. A stop's own title shows when the
 *  record carries one (`last.stopTitle`).
 *  STOP NUMBERS ARE ADDRESSES, NOT COUNTS (owner, 2026-10-01): a stop inside a group is "1.2",
 *  the walk's own step path, so the card never prints `stop + 1` when it can find better. In
 *  order: the record's own `address`, then that stop's `address` in `walks`, then `stop + 1`.
 *  "of N" is a COUNT and only reads with a count, so it is dropped when the address is dotted.
 *  THE WORDING (owner, 2026-10-01): every line names a place as "<walk>, stop <n>" — the
 *  never-presented case reads "From start of walk: Routing, stop 1", not "From the top"; and
 *  "Where I'm reading" reads "Routing, stop 2 – Link state" with the same emphasis. A stop's
 *  title follows a DASH, "–", not a "·" (owner, 2026-10-01). */
const plain = (runs) => runs.map((r) => r[0]).join('')
function stopAddress(walks, walkId, stop, own) {
  if (own != null && own !== '') return String(own)
  const w = walks && walkId != null ? walks.find((x) => x.id === walkId) : null
  const s = w && w.stops ? w.stops[stop] : null
  return s && s.address != null && s.address !== '' ? String(s.address) : String(stop + 1)
}
const placeRuns = (walk, address, of, title) => [[walk, true], [', ', false], ['stop ' + address, true]]
  .concat(of != null && address.indexOf('.') < 0 ? [[' of ' + of, false]] : [], title ? [[' – ', false], [title, true]] : [])
function readingRuns(reading, walks) {
  if (!reading) return [['nothing open', false]]
  return placeRuns(reading.walk, stopAddress(walks, reading.walkId, reading.stop, reading.address), null, reading.stopTitle)
}
/** THE STOP FOLLOWS ITS NODE, NOT ITS NUMBER (2026-10-01): a loaded walk is editable, so a stored
 *  `stop` index can point at a different stop after an insert or a reorder. With `last.stopId` and
 *  that walk's stops carrying `id`, the index is found again; otherwise the stored one stands. */
function placeIndex(walks, walkId, stop, stopId) {
  if (stopId == null || !walks) return stop
  const w = walks.find((x) => x.id === walkId)
  const i = w && w.stops ? w.stops.findIndex((s) => s.id === stopId) : -1
  return i >= 0 ? i : stop
}
function resolveStart(section, openWalk, walks) {
  const raw = section && section.last
  const last = raw && raw.stopId != null ? { ...raw, stop: placeIndex(walks, raw.walkId, raw.stop, raw.stopId) } : raw
  const open = openWalk || {}
  const out = (o, lineEm, nextEm) => ({ ...o, line: plain(lineEm), lineEm, ...(nextEm ? { next: plain(nextEm), nextEm } : {}) })
  if (!last) return out({ kind: 'top', walkId: open.id, stop: 0 }, open.title ? [['From start of walk: ', false]].concat(placeRuns(open.title, stopAddress(walks, open.id, 0))) : [['From start of walk', false]])
  const finished = last.of != null && last.stop >= last.of - 1
  /* WHERE THE PLACE COMES FROM is said by the ROW's title, "Continue from last presentation"
     (owner, 2026-10-01), so the line is the place alone — a "Last presented:" lead-in here
     (round ad) repeated it. */
  if (!finished) return out({ kind: 'continue', walkId: last.walkId, stop: last.stop }, placeRuns(last.walk, stopAddress(walks, last.walkId, last.stop, last.address), last.of, last.stopTitle))
  if (open.id != null && open.id !== last.walkId) return out({ kind: 'next', walkId: open.id, stop: 0 }, [['Finished the walk ', false], [last.walk, true]], [['Next: ', false], [open.title, true], [', the walk you have open', false]])
  return out({ kind: 'choose', walkId: null, stop: null }, [['Finished the walk ', false], [last.walk, true]], [['Choose the next walk', false]])
}
/** a run list drawn: emphasised runs semibold in the first ink, the rest as the line around them */
function Runs({ runs }) {
  return runs.map((r, i) => (r[1] ? <span key={i} style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{r[0]}</span> : <React.Fragment key={i}>{r[0]}</React.Fragment>))
}
/** WHAT A SESSION IS CALLED ON SCREEN. A session is created WITHOUT a name (owner, 2026-10-01:
 *  "auto create a section for them without a name"), so an empty `name` is a legitimate stored
 *  value, never an error; it is drawn as the untitled label, and renamed in place with the pencil. */
const UNTITLED = 'Untitled session'
const displayName = (s, untitled) => (s && s.name ? s.name : untitled || UNTITLED)
/** THE DAYS A SESSION MEETS, PICKED NOT TYPED (owner, 2026-10-01). Stored as day numbers, 0 = Monday
 *  … 6 = Sunday, in any order; the card sorts them. Typed text could not be read back as days, so
 *  nothing could ever use it; numbers can. Monday first because a teaching week starts there. */
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_CHIP = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const meetsLabel = (meets) => {
  const d = Array.from(new Set((meets || []).filter((n) => n >= 0 && n <= 6))).sort((a, b) => a - b)
  if (!d.length) return ''
  if (d.length === 7) return 'Every day'
  /* A RUN OF THREE OR MORE consecutive days is a range, "Mon–Fri": five days spelt out took 120px
     of a 190px line and pushed the time off it. Two in a row stay a pair ("Mon/Tue"). */
  const parts = []
  for (let i = 0; i < d.length;) {
    let j = i
    while (j + 1 < d.length && d[j + 1] === d[j] + 1) j++
    if (j - i >= 2) parts.push(DAY_SHORT[d[i]] + '–' + DAY_SHORT[d[j]])
    else for (let k = i; k <= j; k++) parts.push(DAY_SHORT[d[k]])
    i = j + 1
  }
  return parts.join('/')
}
const toggleDay = (meets, n) => {
  const d = new Set(meets || [])
  if (d.has(n)) d.delete(n); else d.add(n)
  return Array.from(d).sort((a, b) => a - b)
}
/** WHEN A SESSION WAS LAST PRESENTED, worded for a glance (owner, 2026-10-01). Near dates are
 *  relative, far ones absolute; 24-hour, no commas — the lecture clock's rule (`LectureClock`):
 *  - same day        → "Today 14:02"
 *  - the day before  → "Yesterday 14:02"
 *  - within 6 days   → "Mon 14:02"
 *  - this year       → "28 Sep"
 *  - another year    → "28 Sep 2025"
 *  The time is dropped past a week: by then the day is what anyone remembers. `now` is passed in
 *  so a card can draw a fixed date. */
const two = (n) => (n < 10 ? '0' : '') + n
const lastLabel = (at, now) => {
  if (at == null) return ''
  const d = new Date(at), n = new Date(now != null ? now : Date.now())
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const ago = Math.round((day(n) - day(d)) / 86400000)
  const time = two(d.getHours()) + ':' + two(d.getMinutes())
  if (ago === 0) return 'Today ' + time
  if (ago === 1) return 'Yesterday ' + time
  if (ago > 1 && ago < 7) return DAY_SHORT[(d.getDay() + 6) % 7] + ' ' + time
  const date = d.getDate() + ' ' + d.toLocaleDateString(undefined, { month: 'short' })
  return d.getFullYear() === n.getFullYear() ? date : date + ' ' + d.getFullYear()
}
/** a start row's tooltip: its name, then its key in brackets, "Continue from last presentation (Enter)" */
const rowTitle = (title, key) => (key ? title + ' (' + key + ')' : title)
export const StartMath = { resolve: resolveStart, placeIndex, rowTitle, readingRuns, stopAddress, displayName, meetsLabel, toggleDay, lastLabel, DAY_SHORT }

/** THE DAY PICKER: seven toggles in one row, two letters each so Tuesday and Thursday never share
 *  a "T". On is the walk's acorn wash and border, like a chosen start row; off is a hairline. It
 *  fits the 210px session column without wrapping: 7 × 22 + 6 × 2 = 166px. */
function DayPicker({ meets, onChange }) {
  const on = new Set(meets || [])
  return (
    <div role="group" aria-label="days this session meets" style={{ display: 'flex', gap: 2 }}>
      {DAY_CHIP.map((label, n) => {
        const sel = on.has(n)
        return (
          /* the toggle takes focus itself: Safari and Firefox on macOS do not focus a clicked
             button, and the open row closes when focus leaves it */
          <button key={n} type="button" aria-pressed={sel} title={DAY_SHORT[n]} onClick={(e) => { e.currentTarget.focus(); onChange(toggleDay(meets, n)) }}
            style={{ width: 22, height: 22, padding: 0, flexShrink: 0, display: 'grid', placeItems: 'center', boxSizing: 'border-box',
              border: '1px solid ' + (sel ? 'var(--border-walk)' : 'var(--border-hair)'), borderRadius: 'var(--radius-sm)',
              background: sel ? 'var(--accent-walk-wash)' : 'var(--surface-raised)', color: sel ? 'var(--text-walk)' : 'var(--text-2)',
              fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: sel ? 'var(--fw-bold)' : 'var(--fw-medium)',
              cursor: 'pointer', transition: 'var(--transition-wash)' }}>{label}</button>
        )
      })}
    </div>
  )
}


/** ONE START CHOICE. An icon tile, a name, a grey line saying where it lands. The chosen
 *  row takes the walk's acorn wash and border — acorn is the hue of MOVEMENT through the corpus,
 *  and every row here starts one. THE KEY IS IN THE TOOLTIP, not on the row (owner, 2026-10-01):
 *  "Continue from last presentation (Enter)". The drawn key chips were removed; the keys still work. */
function StartRow({ icon, title, line, line2, keyLabel, on, disabled, onPick, onHover }) {
  const [hot, setHot] = React.useState(false)
  return (
    <button type="button" disabled={disabled} onClick={onPick} title={rowTitle(title, keyLabel)}
      onMouseEnter={() => { setHot(true); onHover && onHover() }} onMouseLeave={() => setHot(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: START_CARD_METRICS.row,
        padding: '8px 12px', boxSizing: 'border-box', textAlign: 'left',
        border: '1px solid ' + (on ? 'var(--border-walk)' : hot && !disabled ? 'var(--border-strong)' : 'var(--border-hair)'),
        borderRadius: 'var(--radius-md)',
        background: on ? 'var(--accent-walk-wash)' : hot && !disabled ? 'var(--surface-hover-raised)' : 'var(--surface-raised)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'var(--transition-wash)', fontFamily: 'var(--font-ui)',
      }}>
      <span style={{ flexShrink: 0, width: START_CARD_METRICS.icon, height: START_CARD_METRICS.icon, display: 'grid', placeItems: 'center', borderRadius: 'var(--radius-sm)', background: on ? 'var(--surface-raised)' : 'var(--surface-canopy)', color: on ? 'var(--text-walk)' : 'var(--text-2)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', lineHeight: 'var(--lh-snug)' }}>{title}</span>
        {line ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>{line}</span> : null}
        {line2 ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>{line2}</span> : null}
      </span>
    </button>
  )
}

/** ONE SESSION in the column. Two hover-revealed controls, the pencil then the bin — the system's
 *  pair, in the order every note row uses; the bin is berry when it shows. They sit at the right
 *  of the DAYS line, under the time, so they never cover it (owner, 2026-10-01). While the name is
 *  open the row is not a select target: a click in the field places the caret. */
function SessionRow({ s, on, editing, untitled, now, onPick, onEdit, onRename, onSetMeets, onStopEdit, onDelete }) {
  const [hot, setHot] = React.useState(false)
  /* THE PAIR RECEDES, THE WASH DOES NOT (2026-10-01, owner: "a fade delay like other icons in
     the app"). `hot` drives the row's wash and follows the pointer instantly; `shown` drives the
     pencil and bin and waits out the system's grace period (`useRecede`, `RECEDE_LEAVE_MS`) so
     they do not vanish under the cursor on its way to them. Two states, one gesture — the rule
     in `IconButton`'s docblock. */
  const [shown, show, hide] = useRecede()
  const pairShown = START_CARD_METRICS.pairRecede ? shown : hot
  const boxRef = React.useRef(null)
  /* THE ROW IS ONE FORM WHILE OPEN: the name, then the days. Enter in the name moves to the
     first day. It closes on Done, on Escape, on a PRESS OUTSIDE the row, or when the keyboard
     moves focus to something outside it — and on nothing else.
     NOT ON A BLUR WITH NOWHERE TO GO (fixed twice, 2026-10-01, owner's reports: a picked day on a
     new session was dropped; then the open row closed after a day was picked and the pointer
     moved on). Safari and Firefox on macOS do not focus a clicked button, so focus "leaves" to
     nothing (`relatedTarget` null) at moments that have nothing to do with leaving. Only a real
     destination outside the row counts; the pointer's case is the outside press below. */
  React.useEffect(() => {
    if (!editing) return undefined
    const away = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) onStopEdit() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [editing])
  const leave = (e) => {
    if (!editing || !e.relatedTarget) return
    if (!(boxRef.current && boxRef.current.contains(e.relatedTarget))) onStopEdit()
  }
  const onFormKey = (e) => { if (editing && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onStopEdit() } }
  const nextField = () => setTimeout(() => {
    const f = boxRef.current && boxRef.current.querySelector('[role="group"] button')
    if (f) f.focus()
  }, 0)
  /* THE NAME SPANS THE ROW (owner, 2026-10-01: the open name hugged its few letters), so the box
     is never narrower than its invitation. */
  const fieldWide = { display: 'block', width: '100%', boxSizing: 'border-box' }
  const days = meetsLabel(s.meets)
  const lastAt = s.last ? lastLabel(s.last.at, now) : ''
  const oneLine = !days && !lastAt
  /* THE PAIR SITS TOGETHER (owner, 2026-10-01: 6px between them read as two loose controls).
     Touching 22px circles: each mark already has 5–6px of air in its own circle, so 0 between
     them reads as one group. The 6px gap stays between the text and the pair. */
  const pair = (onRename || onDelete) ? (
    <span style={{ display: 'flex', gap: START_CARD_METRICS.pairGap, flexShrink: 0 }}>
      {/* the tooltip promises only what the open row will hold: no `onSetSectionMeets`, no day picker */}
      {onRename ? <IconButton size={22} reveal={pairShown} title={onSetMeets ? 'edit name and days' : 'edit name'} onClick={onEdit}><EditMark /></IconButton> : null}
      {onDelete ? <IconButton tone="danger" size={22} reveal={pairShown} title={'delete ' + displayName(s, untitled)} onClick={onDelete}><BinMark size={11} /></IconButton> : null}
    </span>
  ) : null
  const nameStyle = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 'var(--lh-snug)', fontWeight: 'var(--fw-semibold)', color: s.name ? 'var(--text-1)' : 'var(--text-2)', fontStyle: s.name ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
  return (
    <div ref={boxRef} data-session-id={String(s.id)} onKeyDown={onFormKey} onMouseEnter={() => { setHot(true); show() }} onMouseLeave={() => { setHot(false); hide() }} onFocus={() => { setHot(true); show() }} onBlur={(e) => { setHot(false); hide(); leave(e) }}
      style={{ display: 'flex', alignItems: editing ? 'flex-start' : 'center', gap: 2, borderRadius: 'var(--radius-sm)', border: '1px solid ' + (on ? 'var(--border-walk)' : 'transparent'), background: on ? 'var(--surface-raised)' : hot ? 'var(--surface-hover)' : 'transparent', transition: 'var(--transition-wash)' }}>
      {editing ? (
        <div style={{ flex: 1, minWidth: 0, padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <InlineText value={s.name || ''} editing placeholder={untitled} editStyle={fieldWide}
            style={{ ...nameStyle, color: 'var(--text-1)', fontStyle: 'normal', whiteSpace: 'normal' }}
            onCommit={(v) => { if (v !== (s.name || '')) onRename(v); if (onSetMeets) nextField(); else onStopEdit() }} onCancel={onStopEdit} />
          {/* THE DAYS: optional. Pick to add, pick again to remove; none picked is no days. Each
             toggle reports at once — there is nothing to commit. */}
          {onSetMeets ? (
            <DayPicker meets={s.meets} onChange={onSetMeets} />
          ) : days ? <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)' }}>{days}</span> : null}
          {/* OPEN, THE ROW GIVES ITS TRAILING CONTROLS TO THE FIELDS: the pencil and bin kept 48px
             of a 210px column, and the fields need it. "Done" closes, as Enter in the last field does. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PillButton size="sm" onMouseDown={(e) => e.preventDefault()} onClick={onStopEdit}>Done</PillButton>
          </div>
        </div>
      ) : (
        /* TWO LINES, EACH WITH A RIGHT END (owner, 2026-10-01): the NAME with when it was last
           presented at its right, then the DAYS with the pencil and bin at theirs. The controls
           live on the days line so they never cover the time, and they keep their space there, so
           nothing moves when they fade in. A row with NOTHING for a second line — no days and never
           presented — is ONE line, the pair at the right of the name (owner, 2026-10-01: an empty
           second line under a bare name read as a gap). The row is the select target; it cannot
           be a button element because the controls inside it are buttons. */
        <div role="button" tabIndex={0} aria-pressed={on} onClick={onPick}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); onPick() } }}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, padding: oneLine ? '4px 4px 4px 9px' : '6px 4px 4px 9px', cursor: 'pointer', fontFamily: 'var(--font-ui)', outline: 'none' }}>
          {oneLine ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: START_CARD_METRICS.metaLine }}>
              <span title={displayName(s, untitled)} style={{ ...nameStyle, flex: 1, minWidth: 0 }}>{displayName(s, untitled)}</span>
              {pair}
            </span>
          ) : (
            <React.Fragment>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingRight: 5 }}>
                <span title={displayName(s, untitled)} style={{ ...nameStyle, minWidth: 0 }}>{displayName(s, untitled)}</span>
                {/* the time: no word before it, the tooltip says what it is; tabular figures so a
                   column of times lines up */}
                {lastAt ? <span title="last presented" style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-2)', fontVariantNumeric: 'var(--tnum)', whiteSpace: 'nowrap' }}>{lastAt}</span> : null}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: START_CARD_METRICS.metaLine }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-caption)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{days}</span>
                {pair}
              </span>
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  )
}

/** THE STEP'S HEAD: a back link, then where you are. Back is a link-weight button in the walk's
 *  ink, not a pill — it is a way up, not an act. Escape does the same. Its mark is the system's
 *  caret turned to point left (owner, 2026-10-01: the typed "‹" read too small and off-weight
 *  beside the drawn marks), at body size, with a hover wash so it reads as a button. */
const BACK_CARET = { transform: 'rotate(135deg) translate(-' + CARET_INK + 'px, -' + CARET_INK + 'px)', width: 7, height: 7 }
function StepHead({ back, onBack, label, caps }) {
  const [hot, setHot] = React.useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 0 6px' }}>
      <button type="button" onClick={onBack} onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)} onFocus={() => setHot(true)} onBlur={() => setHot(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: hot ? 'var(--accent-walk-wash)' : 'transparent', padding: '3px 8px 3px 8px', margin: '0 0 0 -8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-walk)', transition: 'var(--transition-wash)' }}>
        <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: 10, height: 14 }}><Caret style={BACK_CARET} /></span>{back}</button>
      <span style={{ ...caps, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

/** THE DELETE CONFIRMATION, in place of the row (owner, 2026-10-01: a delete must confirm). It
 *  says what is lost — where the session got to — because that record is the session's only
 *  content. Keep comes first; while the box is open the card's keys are off, so a stray Enter
 *  starts nothing, and Escape keeps. */
function ConfirmDelete({ name, onKeep, onDelete }) {
  return (
    <div role="alertdialog" aria-label={'delete ' + name}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--state-danger)', background: 'var(--surface-raised)' }}>
      <span style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)' }}>{'Delete ' + name + '?'}</span>
      <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--text-2)', lineHeight: 'var(--lh-snug)', textWrap: 'pretty' }}>It forgets where this session got to. This can't be undone.</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <PillButton size="sm" onClick={onKeep}>Keep</PillButton>
        <PillButton size="sm" tone="danger" onClick={onDelete}>Delete</PillButton>
      </div>
    </div>
  )
}

/**
 * The card that opens when Present is pressed — choose a session, then where to start.
 * Version D of `ideas/present-class-mark.html` §02, owner-picked 2026-09-30, sessions on the left.
 */
/** the session a start uses when none is picked: made by the host when the lecture starts */
const NEW_SESSION = { id: null, name: '' }
export function PresentStartCard({
  course, sections = [], selectedId, onSelectSection, onAddSection, onRenameSection, onSetSectionMeets, onDeleteSection,
  openWalk, reading, walks, onStart, onCancel, keys = true, now,
  title = 'Start presenting', sessionsLabel = 'Choose Session', newLabel = '+ New session', untitledLabel = UNTITLED,
  continueLabel = 'Continue from last presentation', beginLabel = 'Start from the beginning', readingLabel = "Where I'm reading", newLitLine = 'untitled · click to name it', elsewhereLabel = 'Load another walk', elsewhereLine = '',
  width = START_CARD_METRICS.width, style,
}) {
  /* A NEW SESSION IS THE DEFAULT (owner, 2026-10-01, replacing "nothing chosen"): the card opens
     with "+ New session" lit, so a professor can present with an untitled session in one key
     press. Nothing is CREATED until a lecture starts: the choice carries `newSession: true` and
     `sectionId: null`, and the host makes the session then — opening the card and cancelling
     leaves no empty sessions behind. Picking an existing session lights it instead; clicking the
     lit "+ New session" again creates it now and opens it for a name. `selectedId` null (or an id
     no session has) means the new session. */
  const real = sections.find((s) => s.id === selectedId) || null
  const isNew = !real
  const sel = real || NEW_SESSION
  const [pick, setPick] = React.useState(0)
  /* "LOAD ANOTHER WALK" uses the app's `LoadPicker` at the PRESENTER's depth (owner, 2026-10-01):
     a walk on the open map, then a stop — never a map. `null` is the three start rows, `'walks'`
     the picker. Without `walks` the card hands the choice to the host, as before. */
  const [step, setStep] = React.useState(null)
  /* THE OPEN MAP ONLY (owner, 2026-10-01): the card picks a walk and a stop on the map already
     open; loading another map is the toolbar's Load. `walks` are that map's walks. */
  const allMaps = walks && walks.length ? [{ id: 'open', title: course || '', walks }] : null
  const canBrowse = !!(allMaps && allMaps.some((m) => m.walks && m.walks.length))
  /* every walk on every map, for naming a stop's address and the walk a switch would load */
  const allWalks = walks
  const back = () => setStep(null)
  /* PRESENTING NEVER CHANGES THE DESK (owner, 2026-10-01, option A): the walk a start names is
     the PRESENTER's walk only. Explore and Plan keep the walk they had open, so nothing open there
     is replaced and there is nothing unsaved to warn about. (An unsaved-changes guard lived here
     for one round; it moved out with this rule.) */
  const start = (c) => { if (onStart) onStart(isNew ? { ...c, sectionId: null, newSession: true } : c) }
  const nameOf = (c) => {
    const w = c && allWalks ? allWalks.find((x) => x.id === c.walkId) : null
    if (w) return w.title
    if (c && reading && c.walkId === reading.walkId) return reading.walk
    if (c && sel.last && c.walkId === sel.last.walkId) return sel.last.walk
    if (c && openWalk && c.walkId === openWalk.id) return openWalk.title
    return ''
  }
  /* which session's delete is being confirmed, which name is open, and whether "+ New session" is hovered */
  const [confirming, setConfirming] = React.useState(null)
  const [editingId, setEditingId] = React.useState(null)
  const [addHot, setAddHot] = React.useState(false)
  /* THE CHOSEN SESSION, OUT OF VIEW (owner, 2026-10-01): with many sessions the lit row can scroll
     off the list. A pill at that edge names it — "↑ Section B" — and a click scrolls it back.
     The Explorer rail's edge label, same look and same rule (it never scrolls by itself). Kept as a
     string so a re-measure finding the same side is a no-op render. */
  const listRef = React.useRef(null)
  const [selEdge, setSelEdge] = React.useState(null)
  const [edgeHot, setEdgeHot] = React.useState(false)
  const selRow = () => {
    const sc = listRef.current
    return sc && real ? sc.querySelector('[data-session-id="' + String(real.id).replace(/["\\]/g, '\\$&') + '"]') : null
  }
  const measureSel = () => {
    const sc = listRef.current
    const row = selRow()
    let side = null
    if (row) {
      const a = sc.getBoundingClientRect(), b = row.getBoundingClientRect()
      if (b.bottom <= a.top + 4) side = 'above'
      else if (b.top >= a.bottom - 4) side = 'below'
    }
    setSelEdge(side)
  }
  React.useLayoutEffect(measureSel)
  /* SUBSCRIBED ONCE: the listener calls the latest `measureSel` through a ref, so a render does not
     tear down and re-add the scroll and resize listeners */
  const measureRef = React.useRef(measureSel)
  measureRef.current = measureSel
  React.useEffect(() => {
    const sc = listRef.current
    if (!sc) return undefined
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => measureRef.current()) }
    sc.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { cancelAnimationFrame(raf); sc.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [])
  const goSel = () => {
    const sc = listRef.current, row = selRow()
    if (!sc || !row) return
    const a = sc.getBoundingClientRect(), b = row.getBoundingClientRect()
    sc.scrollTop += b.top - a.top - (a.height - b.height) / 2
  }
  const edgePill = (pos) => (
    <button type="button" onClick={goSel} onMouseEnter={() => setEdgeHot(true)} onMouseLeave={() => setEdgeHot(false)} title="Scroll to the chosen session"
      style={{ position: 'absolute', left: 0, right: 0, [pos]: 4, display: 'flex', alignItems: 'center', gap: 5, boxSizing: 'border-box', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', textAlign: 'left', padding: '3px 9px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-pill)', background: edgeHot ? 'var(--surface-hover)' : 'var(--surface-raised)', boxShadow: 'var(--lift-1)', color: 'var(--text-1)', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}>
      <span aria-hidden="true" style={{ color: 'var(--text-3)' }}>{selEdge === 'above' ? '↑' : '↓'}</span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{real ? displayName(real, untitledLabel) : ''}</span>
    </button>
  )
  /* "+ NEW SESSION" OPENS THE NEW ROW'S NAME: the card remembers which ids existed when it asked,
     and the first id that appears afterwards is the one to edit, and is selected. */
  const knownRef = React.useRef(null)
  React.useEffect(() => {
    if (!knownRef.current) return
    const fresh = sections.find((s) => !knownRef.current.has(s.id))
    if (fresh) { knownRef.current = null; setEditingId(fresh.id); onSelectSection && onSelectSection(fresh.id) }
  }, [sections])
  const addNew = () => { knownRef.current = new Set(sections.map((s) => s.id)); onAddSection && onAddSection('') }
  /* THE FIRST ROW'S TITLE SAYS WHAT IT RESUMES (owner, 2026-10-01): "Continue from last
     presentation" — the session it belongs to is the one lit on the left, so its name is not
     repeated here. A session NEVER presented has nothing to continue: "Start from the beginning". */
  const target = resolveStart(sel, openWalk, allWalks)
  const readLine = <Runs runs={readingRuns(reading, allWalks)} />
  /* THE TITLE NAMES THE WALK THE HIGHLIGHTED ROW WOULD START (owner, 2026-10-01, option C): it
     follows the highlight, which follows hover and ↑↓, so it always says what Enter or a click is
     about to do. A row with no fixed walk (Load another walk, a finished walk with nothing to
     guess, nothing to read) shows the bare title. In the walk list, the bare title too. */
  const titleWalk = step != null ? '' : pick === 0 ? (target.kind === 'choose' ? '' : nameOf({ walkId: target.walkId })) : pick === 1 ? (reading ? reading.walk : '') : ''
  const fire = (i) => {
    if (!onStart) return
    if (i === 0) {
      /* a finished walk with that walk still open: nothing to guess, so the same walk list opens */
      if (target.kind === 'choose' && canBrowse) { setStep('walks'); return }
      if (target.kind === 'choose') { start({ from: 'pick-walk', sectionId: sel.id, kind: target.kind, walkId: null, stop: null }); return }
      start({ from: 'continue', sectionId: sel.id, kind: target.kind, walkId: target.walkId, stop: target.stop })
    }
    else if (i === 1 && reading) start({ from: 'reading', sectionId: sel.id, walkId: reading.walkId, stop: reading.stop })
    else if (i === 2) { if (canBrowse) setStep('walks'); else start({ from: 'elsewhere', sectionId: sel.id }) }
  }
  /* THE KEYS: Enter starts the chosen row, R / P jump straight to theirs, ↑↓ move the choice,
     Escape cancels. Ignored while a name is open — typing "Rec 1" must not start a lecture. */
  React.useEffect(() => {
    if (!keys) return undefined
    const onKey = (e) => {
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      /* an open session row owns its keys: Enter and Space toggle a day, Escape closes the row
         only. Without this, Enter on a focused day started the lecture and Escape closed the card. */
      if (editingId != null || e.defaultPrevented) return
      if (confirming != null) { if (e.key === 'Escape') { e.preventDefault(); setConfirming(null) } return }
      /* inside "Load another walk" the start keys are off; Escape goes up a step */
      if (step != null) { if (e.key === 'Escape') { e.preventDefault(); back() } return }
      const k = e.key
      if (k === 'Enter') { e.preventDefault(); fire(pick) }
      else if (k === 'r' || k === 'R') { if (reading) { e.preventDefault(); fire(1) } }
      else if (k === 'p' || k === 'P') { e.preventDefault(); fire(2) }
      /* ↑↓ STEP OVER A DISABLED ROW: without a reading place, Enter on "Where I'm reading" did nothing */
      else if (k === 'ArrowDown') { e.preventDefault(); setPick((p) => { const n = Math.min(2, p + 1); return n === 1 && !reading ? 2 : n }) }
      else if (k === 'ArrowUp') { e.preventDefault(); setPick((p) => { const n = Math.max(0, p - 1); return n === 1 && !reading ? 0 : n }) }
      else if (k === 'Escape' && onCancel) { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const caps = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-caps)', textTransform: 'uppercase', color: 'var(--text-2)' }
  return (
    <div role="dialog" aria-label={title}
      style={{ position: 'relative', width, maxWidth: '100%', boxSizing: 'border-box', background: 'var(--surface-paper)', border: '1px solid var(--border-frame)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--lift-3)', overflow: 'hidden', fontFamily: 'var(--font-ui)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px 12px 16px', borderBottom: '1px solid var(--border-hair)' }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--fs-title)', fontWeight: 'var(--fw-bold)', color: 'var(--text-1)', letterSpacing: 'var(--ls-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}{titleWalk ? <span style={{ color: 'var(--text-2)', fontWeight: 'var(--fw-semibold)' }}>{' — ' + titleWalk}</span> : null}
        </div>
        {onCancel ? <IconButton size={24} title="cancel (Esc)" onClick={onCancel} /> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: START_CARD_METRICS.side + 'px minmax(0, 1fr)', alignItems: 'start' }}>
        {/* SESSIONS ON THE LEFT (owner, 2026-09-30): where you start depends on the session, so
           you read the session first. Kept with one session too, so "+ New session" is always
           findable. Headed "Choose Session" so it reads as required, not optional. */}
        {/* THE LIST SCROLLS, the heading and "+ New session" above it do not (owner, 2026-10-01): past
           `bodyMax` the column stops growing. It is stretched to the row's height so its canopy
           and seam run the card's full depth whichever column is taller. */}
        <div style={{ alignSelf: 'stretch', maxHeight: START_CARD_METRICS.bodyMax, boxSizing: 'border-box', background: 'var(--surface-canopy)', borderRight: '1px solid var(--border-hair)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>
          <div style={{ ...caps, padding: '2px 4px 6px', flexShrink: 0 }}>{sessionsLabel}</div>
          {onAddSection ? (
            <button type="button" data-new-session="top" aria-pressed={isNew} onClick={() => (isNew ? addNew() : onSelectSection && onSelectSection(null))} onMouseEnter={() => setAddHot(true)} onMouseLeave={() => setAddHot(false)} onFocus={() => setAddHot(true)} onBlur={() => setAddHot(false)}
              title={isNew ? 'create it now and name it' : 'present with a new, untitled session'}
              /* LIT, IT IS THE CHOSEN SESSION: the walk's border and wash, as a lit session row. The
                 border stays DASHED either way, because dashed means "not made yet" — and it is
                 not, until a lecture starts. AT THE TOP of the list (owner, 2026-10-01al): it is the
                 default choice, so it is the first thing read, and it never scrolls away. */
              style={{ flexShrink: 0, marginBottom: 2, padding: '7px 9px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 1, border: '1px dashed ' + (isNew || addHot ? 'var(--border-walk)' : 'var(--border-dashed)'), borderRadius: 'var(--radius-sm)', background: isNew ? 'var(--surface-raised)' : addHot ? 'var(--accent-walk-wash)' : 'transparent', transition: 'var(--transition-wash)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', fontWeight: isNew ? 'var(--fw-semibold)' : 'var(--fw-medium)', color: 'var(--text-walk)' }}>
              <span>{newLabel}</span>
              {isNew && newLitLine ? <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 'var(--fw-regular)', color: 'var(--text-2)' }}>{newLitLine}</span> : null}
            </button>
          ) : null}
          <PaneScroller forwardRef={listRef} style={{ flex: '0 1 auto', marginTop: 0, marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* zero-height STICKY holders, as the Explorer rail's: the pill rides the list's edge
             without taking a row's room */}
          <div style={{ position: 'sticky', top: 0, height: 0, marginBottom: -4, zIndex: 2, flexShrink: 0 }}>{selEdge === 'above' ? edgePill('top') : null}</div>
          {sections.map((s) => (confirming === s.id
            ? <ConfirmDelete key={s.id} name={displayName(s, untitledLabel)} onKeep={() => setConfirming(null)} onDelete={() => { setConfirming(null); onDeleteSection(s.id) }} />
            : <SessionRow key={s.id} s={s} on={!!real && s.id === real.id} editing={editingId === s.id} untitled={untitledLabel} now={now}
                onPick={() => onSelectSection && onSelectSection(s.id)}
                onEdit={() => setEditingId(s.id)} onStopEdit={() => setEditingId(null)}
                onRename={onRenameSection ? (v) => onRenameSection(s.id, v) : null}
                onSetMeets={onSetSectionMeets ? (v) => onSetSectionMeets(s.id, v) : null}
                onDelete={onDeleteSection ? () => setConfirming(s.id) : null} />
          ))}
          <div style={{ position: 'sticky', bottom: 0, height: 0, marginTop: -4, zIndex: 2, flexShrink: 0 }}>{selEdge === 'below' ? edgePill('bottom') : null}</div>
          </PaneScroller>
        </div>
        {step === 'walks' ? (
          <div style={{ maxHeight: START_CARD_METRICS.bodyMax, boxSizing: 'border-box', padding: '10px 0 0 14px', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            <div style={{ flexShrink: 0, paddingRight: 14 }}><StepHead back="Back" onBack={back} label="Choose a walk, then a stop" caps={caps} /></div>
            <PaneScroller style={{ flex: '0 1 auto', marginTop: 0, marginBottom: 0, paddingRight: 14, paddingBottom: 14 }}>
              {/* THE STOPS' DOTS read the chosen session: in that session's own walk the last stop
                 shown is `current` and the ones before it `done`; in any other walk every stop is ahead. */}
              <LoadPicker maps={allMaps || []} openMapId="open" openWalkId={openWalk ? openWalk.id : null} withStops
                activeStop={(wid) => (sel.last && sel.last.walkId === wid ? sel.last.stop : -1)}
                onPick={(p) => start({ from: 'elsewhere', sectionId: sel.id, walkId: p.walkId, stop: p.stop })} />
            </PaneScroller>
          </div>
        ) : (
        <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ ...caps, padding: '2px 0 6px' }}>Start from</div>
          <StartRow icon={<WalkerMark size={18} />} title={target.kind === 'top' ? beginLabel : continueLabel} line={<Runs runs={target.lineEm} />} line2={target.nextEm ? <Runs runs={target.nextEm} /> : ''} keyLabel="Enter"
            on={pick === 0} onPick={() => fire(0)} onHover={() => setPick(0)} />
          <StartRow icon={<LocateMark size={15} />} title={readingLabel} line={readLine} keyLabel="R"
            on={pick === 1} disabled={!reading} onPick={() => fire(1)} onHover={() => setPick(1)} />
          <StartRow icon={<LoadMark size={15} />} title={elsewhereLabel} line={elsewhereLine} keyLabel="P"
            on={pick === 2} onPick={() => fire(2)} onHover={() => setPick(2)} />
        </div>
        )}
      </div>
    </div>
  )
}
