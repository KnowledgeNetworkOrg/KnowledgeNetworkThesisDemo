import type { CSSProperties, ReactNode } from 'react'
import type { StartSession, PresentStartCardProps } from './PresentStartCard'

export interface RecapStat {
  /** the numeral, verbatim — "6", "21:05". Set at display size, tabular */
  value: string | number
  /** two or three words under it, sentence case: "stops covered", "notes taken" */
  label: string
}


/**
 * The end-of-lecture recap — part 7 of the presenter-mode split
 * (`guidelines/presenter-component-split-plan.md`). Ported (OB-147); its 2026-10-01 changes are in
 * OB-290. The stats row and the closing actions are the parts most likely to move.
 *
 * WHAT IT REPLACES, AND WHERE. It is the whole region the film roll and the strip occupied while
 * the lecture was live — the `flex: 1; min-height: 0` child of the presenter's column, under the
 * header bar, which stays (its chip reads "Lecture ended", its ■ fades). Ending a lecture is not
 * a trapdoor: the presenter stays open, the notes stay readable, and the host's own toolbar ▶ is
 * what resumes.
 *
 * THREE THINGS, IN THE ORDER A PROFESSOR WANTS THEM. The band across the top says what the lecture
 * WAS (course, slot, clock, when it started and ended) and gives the numbers. Under it, the notes from the lecture on the
 * left, and what to do next on the right. Nothing here is a summary the machine wrote.
 *
 * WHAT THE LECTURE WAS RECORDED AGAINST, AND WHERE NEXT TIME STARTS (2026-10-01, with the start
 * card; filed as OB-285, wired by OB-286). `session` — the stored session, after its `last` is written — draws the session
 * beside the course name (read-only; naming is the start card's) and, from its `last`, says back:
 * "Next time, continue picks up at Forwarding, stop 2.2 – Distance vector". THE HOST MUST PASS
 * THE SESSION IT STORED, not rebuild one for the screen.
 *
 * THE STATS ARE THE HOST'S NUMBERS AND THE RECAP'S WORDS (2026-09-04). Pass `counts` —
 * `{ stops, slides, flags }` read off the host's own store (v4; the old `notes`/`flagged` still read) — and the recap prints the three
 * stats, plurals decided (`recapStats`, exported). A component that RECOUNTED them would be a
 * second, disagreeing source, so the numbers stay the host's; `stats` survives as an override for
 * a host composing more. THREE since 2026-09-04: the question count went with the
 * notes pane's "questions" wording (owner) — what gets typed there is not always a question, so a
 * number counting them was counting a category, not a fact about the class. More will fit and
 * will read as a table.
 *
 * WHEN IT STARTED, WHEN IT ENDED (owner, 2026-09-04). Pass `startedAt` / `endedAt` (ms or Date)
 * and the recap prints them directly under the course line (before `when`; owner, 2026-10-01), mono, by ONE rule that lives in code
 * (`LectureClock`, exported): `Fri 4 Sep 2026 13:12 – 13:40`, ONE line, a dash for the duration
 * (no "started" / "ended" words, no "·" before the time; owner, 2026-10-01), 24-hour, no
 * commas, the date on the start always and on the end only when it is another day. `started` / `ended` strings still win where
 * a host has its own clock. Same for the eyebrow: `elapsedS` / `bookedS` in seconds, or the
 * `elapsed` / `booked` strings.
 *
 * THE NOTES SIDE IS A SLOT, NOT A COPY. Pass `LectureNotes variant="review"` as `notes`: the
 * entries belong to the host, and one component owning both the live pane and the recap's version
 * of it is how the two drift apart. The slot is the `flex: 1` child of the row, so give it
 * nothing but the pane.
 *
 * ONE PANE HOLDS THE FLAGS AND THE SLIDE (owner, 21 Oct: in two panes the link between a highlighted
 * slide and the preview was not obvious). The recap passes its preview into the host's `notes`
 * element as `aside` (with `asideLabel` "Preview" and `asideWidth`), so `LectureNotes variant="review"`
 * draws it as its right column. THE HOST PASSES `notes` AS AN ELEMENT and does not pass `aside`
 * itself; a `notes` that is not an element gets the preview in a pane of its own beside it.
 * THE PREVIEW COLUMN IS 360px, the column the quick actions deck stands in during the lecture, so
 * nothing jumps sideways at the moment the lecture ends.
 *
 * THE ASIDE SHOWS ONE SLIDE (v4, owner 6 Oct) — it replaced the "flagged for revision" list, which
 * the notes slot's Flags list now covers. WHAT THE HOST MUST DO:
 *  1. HOLD `shownStop`, starting at 0 — slide 1 of the walk — and pass that slide's picture as
 *     `slide`. Set it from `onShowStop` (‹ ›) AND from the notes slot's `onSelectStop` (a click on
 *     a flag or a slide head), and hand the same index to the slot as `selectedStop`, so the shown
 *     slide's group lights up on the left. One index, read in two places.
 *  2. PASS `stops` (the walk's titles) or `stopCount`. The recap clamps: ‹ › step through the WHOLE
 *     walk, flagged or not, and are disabled at its ends; the legend reads "stop N · Title" and the
 *     line under the slide "stop N of M".
 *  3. PASS `onFlag` to put `FlagChip` at the slide's top right — the film roll's chip: tap for the
 *     usual type, hold for the ring. It must ADD A BARE FLAG to the SHOWN slide (text ''), the same
 *     entry shape the live pane writes; the professor gives it words by clicking its row.
 *     There is no separate "add a flag" link (owner, 6 Oct).
 * The prepared notes are not shown here; they are edited in the live pane.
 *
 * "CLOSE THE PRESENTER" IS NOT HERE (owner, 21 Oct): it is the header bar's, in ■'s place once the
 * lecture has ended (`PresenterHeaderBar onClose`). `actions` stays for anything else after a lecture.
 * THE CLOSING ACTIONS ARE THE HOST'S WORDS AND THE HOST'S ORDER. `actions` is a list of pills at
 * the right end of the head band's foot, on the next-time line (owner, 21 Oct: a band of their own
 * at the screen's foot was awkward), small, at their own width — "close the presenter". NO "email me this
 * recap" (owner, 2026-10-01: not useful enough; v18 had it). None of them is primary by default: ending a lecture is not a success, and a green pill
 * here would say it was. Pass `tone` per action if the host disagrees — `neutral` (a bark grey
 * wash) is the tone for a WAY OUT such as "close the presenter", so it reads as a dismissal and
 * not as one more thing to revise (owner, 2026-09-04). The pills are full-width with the
 * label centred, and space above them separates "what to revise" from "what to do now" (the
 * hairline there was removed, owner, 2026-10-01).
 */
export interface LectureRecapProps {
  course: string
  /** what was covered — "Arrays & Lists → Hashing & Hash Tables". NO DAY OR TIME in it (owner,
   *  2026-10-01): the clock line under it already says when, and a slot here repeated it */
  when?: string
  /** the caps line above the course name. Composed from `elapsed`/`booked` when omitted */
  eyebrow?: string
  /** "21:05" — the clock as it stopped, verbatim. Prefer `elapsedS` */
  elapsed?: string
  /** "50:00" — the booked length, verbatim. Prefer `bookedS` */
  booked?: string
  /** seconds; printed as mm:ss by `LectureClock.mmss`. Added 2026-09-04 */
  elapsedS?: number
  bookedS?: number
  /** the wall clock when the lecture STARTED, verbatim — an override for `startedAt` */
  started?: string
  /** the wall clock when it ENDED, verbatim — an override for `endedAt` */
  ended?: string
  /** the instant the lecture started (ms or Date); printed with its date. Added 2026-09-04 */
  startedAt?: number | Date
  /** the instant it ended; printed with its date only when that is a different day */
  endedAt?: number | Date
  /** the three numbers, read off the host's store; the recap words them. Added 2026-09-04 */
  counts?: { stops: number; slides?: number; flags?: number; /** @deprecated v4: pass `slides` and `flags` — every note is a flag now */ notes?: number; /** @deprecated v4: pass `slides` */ flagged?: number }
  /** the stats verbatim — an override for `counts`, for a host composing more */
  stats?: RecapStat[]
  /** the notes pane — `<LectureNotes variant="review" … />`, AS AN ELEMENT: the recap adds its preview
   *  to it as `aside`. Do not pass `aside` yourself */
  notes?: ReactNode
  /** THE SHOWN SLIDE'S PICTURE — the host renders it, as it renders the film roll's cards. Drawn
   *  whole at the slide shape (1120:630). v4 */
  slide?: ReactNode
  /** the shown slide's index in the walk. The HOST holds it: 0 until something is clicked. Clamped */
  shownStop?: number
  /** the walk's stop titles by index — gives the legend its title and the step buttons their ends */
  stops?: string[]
  /** the walk's length, when `stops` is not passed */
  stopCount?: number
  /** ‹ › asked for this index (already clamped). Omit and the step buttons are absent */
  onShowStop?: (index: number) => void
  /** the aside's legend verbatim — an override for "preview" (the default since 21 Oct; it was
   *  "stop N · Title") */
  slideLabel?: string
  /** the flag chip on the shown slide made a flag of this type. Add a BARE flag to the shown slide.
   *  Omit and no chip is drawn */
  onFlag?: (category: string) => void
  /** the ring's three types — the first three of the user's type list. Default `NOTE_CATEGORIES` */
  flagTypes?: Array<{ key: string; glyph: string; label: string; short?: string; wash: string }>
  /** the usual type's key — what a tap makes. Default 'fix'. HOST-HELD AND STORED (owner, 15 Oct,
   *  replacing "fixed, changeable in settings"): the same key as `FilmRoll usualFlag` */
  usualFlag?: string
  /** the ring picked a type that is not the usual one: it is now. Store it; the same handler as
   *  `FilmRoll onUsualFlagChange` */
  onUsualFlagChange?: (key: string) => void
  /** the chip's "tap to flag · hold to change flag" tooltip. Default true */
  flagHint?: boolean
  /** the pills at the right of the head band's foot, beside the next-time line, in the host's own order. `neutral` is the grey wash for a
   *  way out ("close the presenter"); `quiet` is the default */
  actions?: Array<{ label: string; tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'neutral'; onSelect?: () => void }>
  /** the preview column's width. Default `LECTURE_RECAP_METRICS.aside` (360) — change it only with the
   *  quick actions deck's column, or the two states stop lining up */
  asideWidth?: number
  style?: CSSProperties
  /** THE SESSION THIS LECTURE WAS RECORDED AGAINST (2026-10-01) — THE `StartSession` THE HOST STORED,
   *  passed AFTER the lecture's end has been written into its `last`. One prop draws both:
   *  - beside the course name, its name and days, read-only ("Untitled session" in the untitled
   *    style when unnamed — the start card's default makes one);
   *  - the band's FOOT, under a hairline, from `session.last`: "Next time, continue picks up at
   *    Forwarding, stop 2.2 – Distance vector", or "Finished the walk Forwarding". Worded by the start
   *    card's own `StartMath.resolve`, so the recap and the card's Continue row cannot disagree.
   *  Pass the stored object, never a copy rebuilt for this screen; passed BEFORE `last` is written,
   *  the foot would promise the previous lecture's place. Omit and neither is drawn */
  session?: StartSession
  /** default "Untitled session" — keep it the start card's `untitledLabel` */
  untitledLabel?: string
  /** the open map's walks, as the start card takes them — only to look up a stop's address ("2.2")
   *  when `last.address` is not given */
  walks?: PresentStartCardProps['walks']
  /** the lead before a mid-walk place. Default "Next time, continue picks up at " */
  nextLead?: string
}
export function LectureRecap(props: LectureRecapProps): JSX.Element

/** The recap's numbers. `aside` (360) matches the quick actions deck's column; `statValue` (26) is
 *  the one place in this system a numeral is set at display size, because these numbers ARE the
 *  screen's content. */
export const LECTURE_RECAP_METRICS: {
  aside: number; statValue: number; statPad: number; headPad: string
  /** the ‹ › buttons' diameter (26), a third of it over the slide's edge. CHOSEN on the v4 drawing */
  step: number
}

/** THE CLOCK'S WORDING, published (2026-09-04) so it is written once. `mmss(seconds)` → "21:05";
 *  `clockLabel(t, withDate)` → "Fri 4 Sep 2026 13:12" (24-hour; weekday and month are the
 *  locale's short names, the rest is fixed) or "13:12"; `span(startedAt, endedAt)` →
 *  `{ started, ended }` with the date on `started` always and on `ended` only across a day boundary. */
export const LectureClock: {
  mmss: (seconds: number) => string
  clockLabel: (t: number | Date, withDate?: boolean) => string
  span: (startedAt?: number | Date, endedAt?: number | Date) => { started?: string; ended?: string }
}
/** `counts` → the three stats with their plurals decided. v4 (owner, 6 Oct): `{ stops, slides, flags }`
 *  → "stops covered", "slides flagged", "flags" — every note is a flag now, so "notes taken" went.
 *  The old `{ stops, notes, flagged }` is still read when `flags` is absent. */
export function recapStats(counts: { stops: number; slides?: number; flags?: number; notes?: number; flagged?: number }): RecapStat[]
export const RecapMath: {
  stats: typeof recapStats
  /** `(last, walks?, lead?)` → the next-time line as runs `[text, emphasised][]` (via `StartMath.resolve`),
   *  or null with no `last` */
  nextTime: (last?: StartSession['last'], walks?: PresentStartCardProps['walks'], lead?: string) => Array<[string, boolean]> | null
}
