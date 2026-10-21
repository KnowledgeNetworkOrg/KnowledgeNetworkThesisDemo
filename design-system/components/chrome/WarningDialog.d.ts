import type { ReactNode, CSSProperties } from 'react'

/**
 * A WARNING THAT STOPS AN ACT UNTIL IT IS ANSWERED — generic (owner, 2026-10-01). Unsaved changes
 * is the first; others will reuse it. A title stating the problem, one line saying what the
 * choices do, then the choices.
 *
 * WHAT THE HOST MUST DO:
 * - Hold the act that triggered it and run it only from an action's `onSelect`. The dialog
 *   performs nothing; an act already started before it opened cannot be warned about.
 * - Close it in every handler (`open={false}`), including `onCancel`. It does not close itself.
 * - Not open a second one on top. One warning at a time; a host with two questions asks them in turn.
 *
 * MODAL BY DEFAULT: portaled into `document.body` on a `--scrim` at z 80, above every pane and
 * popover. Escape or a click on the scrim calls `onCancel`. Focus starts on the DEFAULT action
 * (the one marked `default`, else the last), so Enter takes it; Tab stays inside; on close,
 * focus returns where it was. Put the SAFE act as the default — never the one that loses work.
 * When the only act cannot be undone, pass `cancelDefault`: focus and Enter go to Cancel.
 *
 * ITS KEYS AND CLICKS ARE ITS OWN: every key pressed in it, and every pointer press, click and
 * double-click on it, stops propagating there. So it may be rendered from inside another overlay's
 * or the board's React tree and its Escape, a click or a drag never reaches what is underneath.
 * The scrim cancels only on a press that BEGAN on the scrim (a selection let go there is not one).
 *
 * Cancel is always drawn, first and alone at the left; the acts follow at the right in `actions`
 * order. `inline` draws the panel in place with no scrim or focus move — for a specimen card only.
 */
export interface WarningAction {
  label: string
  /** `PillButton` tone. `'danger'` for an act that loses something; `'primary'` for the default */
  tone?: 'quiet' | 'primary' | 'walk' | 'danger' | 'ghost' | 'neutral'
  /** the act Enter takes — focus starts here */
  default?: boolean
  onSelect: () => void
}
export interface WarningDialogProps {
  /** default `true`; `false` renders nothing */
  open?: boolean
  /** states the problem: "Routing has unsaved changes" */
  title: ReactNode
  /** one line saying what the choices do */
  body?: ReactNode
  actions?: WarningAction[]
  /** Escape, the scrim, and the Cancel button. Omit and no Cancel is drawn — avoid it */
  onCancel?: () => void
  cancelLabel?: string
  /** focus and Enter start on Cancel, and no action is the default — for a warning whose only act
   *  cannot be undone (2026-10-15). Default `false` */
  cancelDefault?: boolean
  /** specimen only: draw in place, no scrim, no portal, no focus move */
  inline?: boolean
  style?: CSSProperties
}
export function WarningDialog(props: WarningDialogProps): JSX.Element | null

/** width 400, pad 20, z 80 — all CHOSEN (z above `StopFinder`'s 60 and every pane) */
export const WARNING_DIALOG_METRICS: { width: number; pad: number; z: number }

/**
 * THE UNSAVED-CHANGES WARNING, as an element. Use it for EVERY switch away from unsaved work —
 * the toolbar's Load, the start card's three starts, anything later — so the wording and the
 * three choices are one thing (owner, 2026-10-01: "guard any switch"; three choices, owner's pick):
 *   Cancel · "Load without saving" (danger) · "Save and load" (primary, the default).
 * Enter saves, so a hurried key press never loses work. `what` names what holds the changes,
 * `next` what replaces it; `verb` ("load") is the act, for a switch that is not a load.
 */
export interface UnsavedWarningProps {
  open?: boolean
  what?: string
  next?: string
  verb?: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  inline?: boolean
  style?: CSSProperties
}
export function UnsavedWarning(props: UnsavedWarningProps): JSX.Element | null
