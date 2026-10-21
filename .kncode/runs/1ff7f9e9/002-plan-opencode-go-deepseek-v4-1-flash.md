1. Port `design-system/components/chrome/TextInput.jsx` whole to `src/ds/chrome/TextInput.tsx`, adding `LEADING_DROP`, `MatchTitle`, `matchParts`, `leadStart` and `MatchMath`, keeping the repo’s `wrapTip` tooltip adaptation.
2. Port `design-system/components/presenter/StopFinder.jsx` whole to `src/ds/presenter/StopFinder.tsx`, adding its `flat` mode and the `MatchTitle` highlighter so `LoadPicker` can embed it.
3. Re-vendor `design-system/tokens/elevation.css` and `design-system/tailwind/kn-theme.css` into `src/tokens/`, adding `--scrim: rgba(53, 49, 42, 0.32)` and `--color-scrim`, and recording the new hashes/notes in `src/ds/PROVENANCE.json`.
4. Port `WarningDialog.jsx` whole to `src/ds/chrome/WarningDialog.tsx`, including `UnsavedWarning` and `WARNING_DIALOG_METRICS`.
5. Port `LoadPicker.jsx` whole to `src/ds/nav/LoadPicker.tsx`, preserving select-then-load, one blue selected row, double-click load, hover/tab preview reporting, and the collapsed-map rules.
6. Port `LoadDialog.jsx` whole to `src/ds/nav/LoadDialog.tsx`, preserving focus trapping/restore, footer Cancel/Load, the preview frame, and the in-place `UnsavedWarning` swap.
7. Export the new components, types and metrics from `src/ds/index.ts`; update `src/ds/barrel.test.ts` for internally consumed/newly adopted exports.
8. Wire the toolbar: enable Load in `src/studio/AppToolbar.tsx`, open `LoadDialog`, pass one corpus map plus `listWalks()`, clear route/active walk for map-only loads, activate a walk at stop 0 and focus its first stop, and close after `onPick`.
9. Add the unavoidable small host wiring in `src/studio/StudioView.tsx` because the session bus lives there, and add a draft baseline/dirty signal in `src/state/walk/authordraft.ts` (`unsaved` names the draft only while it has edits since restore/save).
10. Omit `preview`, because the app has no read-only map view: `MapView`’s `wall` mode still pans, zooms, clicks and reads the live bus. Ship the dialog with its labelled stripe and report the task blocked on preview, not done.

Files: `src/ds/chrome/TextInput.tsx`, `src/ds/presenter/StopFinder.tsx`, `src/ds/chrome/WarningDialog.tsx` (new), `src/ds/nav/LoadPicker.tsx` (new), `src/ds/nav/LoadDialog.tsx` (new), `src/ds/index.ts`, `src/ds/barrel.test.ts`, `src/ds/PROVENANCE.json`, `src/tokens/elevation.css`, `src/tokens/kn-theme.css`, `src/studio/AppToolbar.tsx`, `src/studio/StudioView.tsx`, `src/state/walk/authordraft.ts`.

Out of scope: `design-system/**` (read-only source copies); Save and New map (they must stay disabled); creating a read-only map view or wiring `preview` (the card says ship without it and report blocked).

Verify: open the app, press Load and confirm the dialog opens; click a walk so only that row turns blue and nothing loads, press Load and see the walk active from its first stop; select the map row and Load to clear the walk; check Escape/✕/Cancel/scrim close, focus enters and returns to Load, and an edited draft shows the warning with Cancel restoring the list. The preview frame will show the labelled stripe, which is the recorded blocked half.
```
npm run build
npm run typecheck
npm run lint
npm run test
npm run verify
```

Assumptions: “unsaved” means draft edits since restore/last save (there is no existing dirty flag, so a baseline is needed); its name will be “the walk draft”; map-only loading means `bus.clearRoute()` while leaving focus alone; saving from the warning uses `saveDraftAsWalk` with a fallback title because the draft has no name; one `StudioView` wiring edit is necessary because the bus is created there, while `AppToolbar` remains the dialog’s host.