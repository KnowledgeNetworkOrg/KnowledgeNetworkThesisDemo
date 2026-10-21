import type { CSSProperties, ReactNode } from 'react'
import type { LoadMap, LoadChoice } from './LoadPicker'

/**
 * THE TOOLBAR'S LOAD, as a centred dialog (owner, 2026-10-01). The `LoadPicker` list at the
 * toolbar's depth (a map, then a walk on it; never a stop) on the left, a PREVIEW on the right.
 *
 * SELECT, THEN LOAD (owner, 2026-10-01; this replaced "a click loads" the same day):
 * - a click SELECTS a map or a walk (one blue row). Load loads the selection. It sits in a FOOTER
 *   across the whole dialog, at the right beside Cancel (Cancel = `onClose`; drawn only with
 *   `onClose`). It reads just "Load"; the line under the preview names what is selected. Off
 *   until something is selected.
 * - selecting a MAP loads that map with no walk on it. That is why there is no "Just the map" row.
 * - a double-click on a row loads it at once, the shortcut. On touch, a tap selects; Load loads.
 * - hovering a row, or reaching it with Tab, previews it: a map row shows the map with NO walk on
 *   it, a walk row the map with that walk's path. Nothing pointed at: the selection, else the
 *   unfolded map with no walk.
 * - the title is always "Load a map". Even one map gets its row, unfolded at start.
 *
 * MODAL: on open, focus moves into the dialog (Escape works at once); Tab stays inside; on close,
 * focus returns where it was. Not with `inline`.
 *
 * UNSAVED WORK IS GUARDED HERE, NOT BY THE CALLER: pass `unsaved` and a pick does not load. The
 * dialog's card is REPLACED by `UnsavedWarning` on the same scrim (never a dialog on a dialog);
 * Cancel brings the list back as it was. The answer reaches `onPick(choice, 'save' | 'discard')`.
 *
 * WHAT THE HOST MUST DO:
 * - Draw the preview: `preview({ mapId, walkId? })` returns the app's own map view, small and
 *   READ-ONLY, with the walk's path on it when `walkId` is given. It must not move the app's
 *   focus, camera or selection: it is a look, not a load. It is called on every hover change, so
 *   keep one map instance per map and swap only the walk overlay. Without `preview` the frame
 *   shows a labelled stripe, which is a specimen, not a design.
 * - Act on `onPick`: `how` 'save' means save the open work first, then load; 'discard' means
 *   load without saving; absent means there was nothing to guard. Close the dialog after.
 * - Pass `unsaved` exactly while there is unsaved work, naming what holds it ("Routing").
 */
export interface LoadDialogProps {
  open?: boolean
  maps: LoadMap[]
  /** the map open in the app */
  openMapId?: string | number | null
  /** the walk open in the app */
  openWalkId?: string | number | null
  /** `how` is 'save' or 'discard' only when `unsaved` was set and the warning was answered */
  onPick?: (choice: LoadChoice, how?: 'save' | 'discard') => void
  /** Escape, the ✕, Cancel in the footer, or a click on the scrim */
  onClose?: () => void
  /** the host's map view for the preview frame; see the host rules above */
  preview?: (target: { mapId: string | number; walkId?: string | number }) => ReactNode
  /** the name of what holds unsaved changes; absent = nothing to guard */
  unsaved?: string
  /** specimen only: draw in place, no scrim, no portal */
  inline?: boolean
  style?: CSSProperties
}
export function LoadDialog(props: LoadDialogProps): JSX.Element | null

/** width 760, height 520, list 300, pad 14, footerPadY 10 — all CHOSEN; z is `WARNING_DIALOG_METRICS.z` */
export const LOAD_DIALOG_METRICS: { width: number; height: number; list: number; pad: number; footerPadY: number }
