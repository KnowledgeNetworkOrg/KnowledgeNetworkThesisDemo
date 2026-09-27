// The Walk Editor's pane-local actions (#144 — OB-036's "PaneActionBar replaces
// WalkToolbox's floating tray" half). Mounted through the Instrument registry's
// `actionBar` slot (src/studio/instruments.tsx → src/studio/StudioView.tsx's `pane()`),
// not through WalkEditorView's own render tree — that is what lets `Pane` clip the
// bar's top corners to the frame's own arc, which a plain child sitting inside the
// scroller cannot get (see PaneActionBar.prompt.md).
//
// Reads the SAME module-level draft/road stores WalkEditorView does — authordraft.ts's
// own note explains why a singleton is the right shape here — rather than receiving
// state as a prop. The two are siblings under one Pane, not parent/child.
//
// Replaces WalkToolbox.tsx (#54) whole: the FloatingPanel wrapper, its persisted rect
// and its 2-column icon-only grid are gone along with it — a docked, labelled bar has
// no drag/resize/auto-hide of its own to carry.

import { AddNodeMark, NewWalkMark, OptionalMark, PaneActionBar } from '@/ds'
import { clearStoredData, listStoredData } from '../../state/storeddata'
import { parsePath, stopAt, useAuthorDraft, useRoad } from '../../state/walk/authordraft'
import { chosenIdx, isFork } from '../../state/walk/mockwalk'

// TEMPORARY (2026-08-22) — the "Reset data" pill below, and this function with
// it. Both go when the stale-payload question is closed; src/state/storeddata.ts
// carries the same marker and the reasoning.
//
// Reports BEFORE it clears, because the bytes are the diagnosis and clearing
// destroys them: a stale payload cannot say which build wrote it (none of the
// three stored shapes carries a version field), so the only way to learn what
// broke is to look at what is actually there. The console table survives the
// reload — it is printed before navigation, and the devtools console persists
// across a same-document reload.
//
// It clears the draft, the saved walks and panel layout, and KEEPS a presenter's
// lecture notes, categories and deck layout (#331) — storeddata.ts's
// RESET_PREFIXES is the list. The last line says what was kept, so a reset that
// left something behind reads as a decision rather than a failure.
function resetStoredData() {
  const found = listStoredData()
  console.log('[reset] stored before clearing:', found.length ? found : '(nothing stored)')
  for (const entry of found) {
    console.log(`[reset]   ${entry.key} — ${entry.bytes} bytes\n${entry.preview}`)
  }
  const cleared = clearStoredData()
  console.log('[reset] cleared', cleared.length, 'key(s):', cleared)
  const kept = found.map((e) => e.key).filter((key) => !cleared.includes(key))
  console.log('[reset] kept', kept.length, 'key(s):', kept)
  // the stores read their keys once at module load, so nothing on screen changes
  // until the app boots again — see clearStoredData's own note
  location.reload()
}

export default function WalkActionBar() {
  const state = useAuthorDraft()
  const { choices, pickBranch } = useRoad()

  // #70 retired the drag-a-version-tab-out gesture that used to feed extractVariant.
  // This bar is its permanent home (#144, replacing the #70 stopgap note WalkToolbox
  // carried): with a single FORK selected, lift its ACTIVE version into its own group,
  // inserted right after the fork. `choices` (the road's view of "active") lives in
  // useRoad, not the draft, so the pick is resolved here and handed down ready.
  const selPath = state.selected.size === 1 ? parsePath([...state.selected][0]) : null
  const selStop = selPath ? stopAt(state.stops, selPath) : undefined
  const canExtract = !!selPath && !!selStop && isFork(selStop)
  const extractActive = () => {
    if (!selPath || !selStop || !isFork(selStop)) return
    const idx = chosenIdx(selStop, choices)
    const after = [...selPath.slice(0, -1), selPath[selPath.length - 1] + 1]
    state.extractVariant(selPath, idx, after)
    // trimmed container falls back to its first remaining version (#92: by id)
    const firstRemaining = selStop.variants.filter((_, k) => k !== idx)[0]
    if (firstRemaining) pickBranch(selStop.key!, firstRemaining.id)
  }

  return (
    <PaneActionBar
      dense
      actions={[
        { glyph: <NewWalkMark size={13} />, label: 'New walk', title: 'start over with an empty slot', onClick: state.newWalk },
        { glyph: <AddNodeMark size={13} />, label: 'Add node', title: 'add a node at the selection', onClick: state.addSelectionNode },
        { glyph: '⊞', label: 'Group', title: 'group the selected steps', disabled: !state.canGroup, onClick: state.groupSelection },
        /* DS OB-215: a selected group or fork is pressable too, and acts on every leaf inside it
           — the group itself never carries the flag. THREE STATES, because a group can be MIXED
           (press on it, then toggle one leaf back): the pill shows it and the title says what a
           press does from each. From mixed a press makes every leaf optional (the owner's ruling). */
        {
          glyph: <OptionalMark size={13} />,
          label: 'Optional',
          title: state.optionalOn === true
            ? 'make required'
            : state.optionalOn === 'mixed'
              ? 'some of the selection is optional — make all of it optional'
              : 'make optional',
          selected: state.optionalOn,
          disabled: !state.canOptional,
          onClick: state.toggleOptionalSelection,
        },
        { glyph: '⏏', label: 'Extract', title: 'extract the active version into its own group', disabled: !canExtract, onClick: extractActive },
        // TEMPORARY (2026-08-22) — see resetStoredData above. `danger` because it
        // throws away the saved plan AND every saved walk, and the system's rule
        // is that a destructive control says so at rest rather than on hover. The
        // title names what it keeps as well, because lecture notes share the
        // storage namespace and a presenter would otherwise assume they go too.
        {
          glyph: '⟲',
          label: 'Reset data',
          title: 'TEMPORARY: forget the saved draft, saved walks and panel layout, then reload — lecture notes are kept',
          tone: 'danger',
          onClick: resetStoredData,
        },
      ]}
    />
  )
}
