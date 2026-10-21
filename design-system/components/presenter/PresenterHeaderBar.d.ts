/**
 * The bar at the top of presenter mode: course name, the ONE state chip (Presenting /
 * Roaming / Ended / Preview), the clock, and the ■ control. Part 1 of the presenter-mode split
 * (see `guidelines/presenter-component-split-plan.md`).
 *
 * PREVIEW IS NOT A LECTURE (owner, 2026-09-03). `state === 'preview'` is the presenter LAYOUT
 * shown without anything being projected — a professor looking at how the panes will sit. No
 * clock is drawn (`elapsed`/`bookedLength`/`progressPct` are ignored — nothing is being timed),
 * the chip reads "Preview stop N" in a neutral solid-ring mark with no walk hue and no dash
 * (nothing committed, nothing conditional), and ■ is disabled and faded exactly as when ended —
 * there is nothing to stop. WHAT THE HOST MUST DO: start no clock while in preview; keep its own
 * start control (the Studio's toolbar ▶) PRESSABLE, since pressing it is how a preview becomes
 * the lecture; and on that press, start the clock from zero, not from when the preview opened.
 *
 * THE BAR ENDS; IT NEVER STARTS OR RESUMES (2026-09-03). ■ is always ■. Once `state === 'ended'`
 * it stays a stop button, disabled and faded to 0.4 — there is nothing left to stop — and does
 * NOT become ▶. Starting and resuming a lecture belong to the host's own toolbar (in the Studio,
 * the ▶ at the end of the app toolbar), so the professor has one play button on screen with one
 * meaning. WHAT THE HOST MUST DO: give the ended state a way to resume somewhere else, and word its
 * tooltip to match the chip's ("▶ on the app toolbar resumes it").
 *
 * ONCE ENDED, ■'S PLACE IS THE WAY OUT (owner, 21 Oct). Pass `onClose` and the ended bar draws a
 * "close the presenter" pill (`neutral`, small) where the faded ■ was. It leaves; it does not resume.
 * The recap then carries no close action of its own.
 *
 * TWO MARKS, ONE SENTENCE SHAPE — BUT ONLY ONE OF THEM CARRIES THE WALK HUE. `activeStop`
 * is the lecture's own record — where it actually is, what the class is looking at, what
 * "covered" means later — and it is the state that wears acorn: a filled dot, an
 * acorn-washed chip, `--border-walk` — the exact meaning that token already has ("a
 * walk-tinted control in its active state"). `roamingStop` is only where the professor is
 * currently looking, answering a question; it is provisional, not yet part of the
 * lecture's record, so it wears the system's other standing convention instead — DASHED
 * ALWAYS MEANS CONDITIONAL (`--border-dashed`, the same rule `OptionalMark` follows) — an
 * unfilled dashed ring, a dashed neutral chip, `--text-2` ink. No wash, no hue: a
 * conditional state that looked more emphatic than the committed one would say the wrong
 * thing. Presenting and roaming still share the chip's sentence shape ("<verb> stop N")
 * so a professor re-reads only the dot and the border style, not the whole line — and
 * inside the chip, the stop number is set apart the way `CountBadge` sets its numbers
 * apart: mono, tabular, full ink, with the state word as the softer lead-in.
 *
 * ENDING ASKS FIRST, AND IS NOT DESTRUCTIVE. ■ opens a confirm popover rather than acting
 * immediately — this is CONTROLLED (`confirmOpen`), not internal state, so the host can
 * coordinate it with anything else on screen. Nothing is deleted by ending: notes and
 * flags stay, and the lecture resumes from the same place (from the host's toolbar). That is
 * why the button never goes red
 * or fills — ending a lecture is a normal move, not a dangerous one — and why NEITHER
 * confirm button washes green: it is an ending, not a success.
 *
 * THE CONFIRM'S MESSAGE IS FIXED, NOT PASSED IN. One line, always the same words, so no
 * call site retypes it.
 */
export interface PresenterHeaderBarProps {
  /** the course name, e.g. "Foundations of Computing" */
  course: string
  /** which of the four states the bar is in right now. `preview` = the layout with nothing
   *  projected: no clock, ■ faded, the host's start control stays pressable */
  state: 'presenting' | 'roaming' | 'ended' | 'preview'
  /** the active node's stop number (1-based) — always meaningful, even while roaming */
  activeStop: number
  /** the stop the professor is currently looking at, only while `state === 'roaming'` */
  roamingStop?: number
  /** "18:42" — omitted entirely once `state === 'ended'` (the clock has nothing left to count)
   *  and ignored in `preview` (nothing is being timed) */
  elapsed?: string
  /** "50:00" — when given, the clock adds "of {bookedLength}" over a hairline fill.
   *  Omit to fall back to a bare "{elapsed} elapsed" */
  bookedLength?: string
  /** 0–100, the hairline's fill against `bookedLength`. The caller computes this — the
   *  component reads a number, it does not parse two time strings against each other */
  progressPct?: number
  /** "21:05 total" — shown verbatim in the chip once `state === 'ended'`. The component adds
   *  nothing to it: pass the unit yourself, or a bare "21:05" for none */
  endedTotal?: string
  /** is the "End this lecture?" popover open. Controlled — the host owns this so it can
   *  close the popover on outside-click, escape, or any of its own logic */
  confirmOpen?: boolean
  /** ■ pressed while presenting or roaming — open the confirm popover. Never fires in
   *  `ended` or `preview`: the button is disabled in both */
  onEndClick?: () => void
  /** "End lecture" pressed inside the popover */
  onConfirmEnd?: () => void
  /** "Keep going" pressed inside the popover, or any outside-dismiss the host wires up */
  onCancelEnd?: () => void
  /** @deprecated never fired since 2026-09-03 — the bar has no ▶. Resume from the host's own
   *  toolbar instead; keep the handler there. Accepted and ignored so older call sites compile. */
  onResume?: () => void
  /** ENDED ONLY: the way out (owner, 21 Oct). Pass it and the ended bar draws a "close the presenter"
   *  pill where the faded ■ was. Omit it and the faded ■ stays. Pass the same handler the recap used
   *  to get in its `actions`, and do NOT pass it there too: one way out, one place */
  onClose?: () => void
  /** the pill's words. Default "close the presenter" */
  closeLabel?: string
}
export function PresenterHeaderBar(props: PresenterHeaderBarProps): JSX.Element
