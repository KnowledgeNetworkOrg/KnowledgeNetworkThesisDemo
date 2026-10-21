/**
 * A bin, drawn from plain geometry, for deleting a user-saved thing — and only that; a ✕
 * means "remove from the composition". It is one of the system's drawn marks (the chrome
 * family — `CloseMark`, `EditMark`, `CopyMark` and the rest — is drawn the same way).
 * It carries its own optical centring — `translateY(-1.4px)`, the same lift `EditMark`
 * carries — because its mass hangs under the lid and a box-centred bin reads low; in a
 * row beside the pencil the two now share a line. Never counter-nudge it from outside:
 * `style` is merged UNDER the lift, so a `transform` passed in is ignored. The one way to drop
 * it is `lift={false}`, for a bin ALONE in a round button, where the ring is what the eye
 * centres against (owner, 2026-10-15).
 */
export interface BinMarkProps {
  /** px. Default 11, the size inside a 20px icon button (`PresetButton`, `LectureNotes`) */
  size?: number
  /** placement only (margin, flex); `transform` is overridden by the lift */
  style?: React.CSSProperties
  /** default true: the 1.4px lift that lines the bin up with a pencil beside it. `false` only when
   *  the bin stands alone in a round button (`LectureNotes`' flag row) */
  lift?: boolean
}
export function BinMark(props: BinMarkProps): JSX.Element
