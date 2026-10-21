One-line: the toolbar's Load — a centred dialog, the map/walk list on the left, a preview on the right.

```jsx
<LoadDialog open={loading} maps={maps} openMapId={mapId} openWalkId={walkId}
  unsaved={dirty ? walkTitle : undefined}
  preview={({ mapId, walkId }) => <MapView map={mapId} walk={walkId} readOnly />}
  onPick={(c, how) => { if (how === 'save') save(); load(c); setLoading(false) }}
  onClose={() => setLoading(false)} />
```

**Select, then Load** (owner, 2026-10-01). A click selects a map or a walk; Load, in a footer across
the dialog beside Cancel, loads it (it reads just "Load"); a double-click loads at once. Selecting a map
loads it with no walk, so there is no "Just the map" row. Hover previews: a map alone, or the
map with the walk's path; nothing pointed at, the selection. Touch: tap selects, Load loads.

**One blue row at most, and it is the selection.** That rule lives in `LoadPicker`.

**Unsaved work is guarded inside.** Pass `unsaved`; a pick swaps the card for `UnsavedWarning` on
the same scrim, and Cancel returns to the list. `onPick(choice, 'save' | 'discard')`.

**The host draws the preview** (`preview`): its own map view, read-only, never moving the app's
focus or camera. Without it the frame shows a labelled stripe.

---

**Replaces in the app:** the disabled Load item in `src/studio/AppToolbar.tsx` (`{ glyph:
<LoadMark />, title: 'Load', disabled: true }`) — the dialog is what it opens.

**Hosted by:** `src/studio/AppToolbar.tsx` read 2026-10-01 at `4353dca` — the toolbar owns no
layout for it; the dialog is portalled over everything. In this project, the Studio shell's Load
(`templates/studio/StudioApp.jsx`) opens it. The app has no multi-map model yet ("no backing
model" per that file); with one corpus the dialog shows that one map, unfolded, with its
walks; selecting the map row loads the map alone.
