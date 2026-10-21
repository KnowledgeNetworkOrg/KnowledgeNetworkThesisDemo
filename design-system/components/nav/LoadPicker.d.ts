import type { CSSProperties } from 'react'

export interface LoadMap {
  id: string | number
  title: string
  walks: Array<{
    id: string | number
    title: string
    /** `StopFinder` steps; only read with `withStops`, but the count is shown either way */
    stops?: Array<{ title: string; territory?: string; hue?: string; address?: string }>
  }>
}
/** what was picked. `walkId` absent = the map alone (the map row selected); `stop` only with `withStops` */
export interface LoadChoice {
  mapId: string | number
  walkId?: string | number
  stop?: number
}

/**
 * WHAT TO LOAD, at one of two depths — each ONE decision deep (owner, 2026-10-01: map, then walk,
 * then stop in one list was confusing). ONE picker so the two lists cannot drift:
 *   - the TOOLBAR's Load (default): maps, each opening its walks. A map or a walk. NEVER a stop.
 *   - the PRESENTER's (`withStops`): the walks of `openMapId` only, each opening its stops in a flat
 *     `StopFinder`. A walk and a stop. NEVER a map — the professor presents the map they have open;
 *     loading another map is the toolbar's job. Pass the open map in `maps` (others are ignored).
 * One open at a time; the open map and walk are listed first, with no "open" note (owner,
 * 2026-10-01). The toolbar's depth ALWAYS draws the map level, even for one map (unfolded at
 * start), so the map itself can be selected (owner, 2026-10-01). The presenter's depth never
 * draws one.
 *
 * THE TOOLBAR'S DEPTH SELECTS, IT DOES NOT LOAD (owner, 2026-10-01: "select what you want and have
 * a load button"). A click selects a map or a walk (`onSelect`); selecting a map also unfolds it,
 * and clicking the selected, unfolded map folds it. Selecting a map means "load it with no walk",
 * so there is NO "Just the map" row. A double-click is `onPick` at once. The host's Load button
 * acts on the selection (`LoadDialog` is that host). With `withStops` nothing is selected and a
 * stop pick is `onPick`, as before.
 *
 * ONE BLUE ROW AT MOST, AND IT IS THE SELECTION. An unfolded row that is not selected takes the
 * strong outline and a dark caret; pointing is the neutral hover. With `withStops` no row is ever
 * blue (nothing is selected there).
 *
 * WHAT THE HOST MUST DO:
 * - Guard unsaved work before acting on `onPick`: open `UnsavedWarning` when the choice would
 *   replace a map or walk with unsaved changes. The picker loads nothing and guards nothing.
 * - Scroll it. It has no height of its own, and with `withStops` the stop list does not scroll on
 *   its own either (`StopFinder` `flat`), so the host's scroller is the only one.
 * - Load the walk app-wide: a walk loaded here is the walk Explore and Plan show too.
 */
export interface LoadPickerProps {
  maps: LoadMap[]
  /** the map open in the app */
  openMapId?: string | number | null
  /** the walk open in the app */
  openWalkId?: string | number | null
  /** draw each walk's stops and require one. Default `false` */
  withStops?: boolean
  /** with `withStops`: `(walkId, mapId)` → the stop to mark `current` in that walk, or -1 */
  activeStop?: (walkId: string | number, mapId: string | number) => number
  /** the toolbar's depth: a double-click on a row. With `withStops`: a stop pick */
  onPick?: (choice: LoadChoice) => void
  /** the toolbar's depth only: a click SELECTS a map or a walk and reports it here; the host's Load
   *  button acts on it (`LoadDialog`). Selecting a map is loading it with no walk */
  onSelect?: (choice: LoadChoice) => void
  /** the row under the pointer or keyboard focus, or null when it leaves: a map row and "Just the
   *  map" as `{ mapId }`, a walk as `{ mapId, walkId }`. `LoadDialog`'s preview follows it */
  onPoint?: (choice: LoadChoice | null) => void
  /** the map currently unfolded (null when none), fired on mount and on every change */
  onOpenMap?: (mapId: string | number | null) => void
  /** @deprecated 2026-10-01 — the "Just the map" row is gone: selecting the map row is how a map
   *  loads with no walk. Ignored; pass nothing. */
  mapOnlyLabel?: string
  style?: CSSProperties
}
export function LoadPicker(props: LoadPickerProps): JSX.Element

/** `indent` 20 (one level in) and `row` 40, both CHOSEN */
export const LOAD_PICKER_METRICS: { indent: number; row: number }
