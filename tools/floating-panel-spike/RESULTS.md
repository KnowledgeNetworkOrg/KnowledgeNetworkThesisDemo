# FloatingPanel interaction spike (#76)

2026-09-24 — the component, its rect core and this spike's harness/driver were
removed by #377: nothing has mounted the panel since #144, so there is no spike
left to run. The findings below stand as history.

Proves the parts of `src/ui/FloatingPanel.tsx` that the unit tests in
`src/ui/floatingPanelRect.test.ts` structurally cannot reach: the **seam**
between real pointer input and the pure geometry core. The core math
(drag/resize/clamp/persist arithmetic) is fully unit-tested; this spike drives a
real browser so that `onPointerDown → window pointermove/pointerup → setRect →
repaint`, `localStorage` across a reload, and the auto-hide fade are exercised
against an actual DOM.

## Run

```
node tools/floating-panel-spike/drive.mjs
```

Owns its own vite (port 5199) the same way `tools/studio-spike/shots.mjs` does —
backgrounded dev servers die on this machine, so the script spawns, waits,
drives, and kills. Exits nonzero on any failed assertion or console/page error.
Screenshots land in `out/` (gitignored).

- `harness.html` / `harness.tsx` — a standalone mount (NOT part of the app):
  two bare `position: relative` hosts, one for drag/resize/clamp/persist, one
  for auto-hide. This is the exact host contract `FloatingPanel` documents.
- `drive.mjs` — the Playwright driver and its assertions.

## Verified (all green, 2026-08-03)

| Behavior | Assertion |
| --- | --- |
| Drag | handle drag of +90,+60 moves the panel by exactly that |
| Resize SE | SE-corner drag of +70,+45 grows w/h by that; opposite edges fixed |
| Resize W | W-edge drag moves the left edge/origin; the right edge stays anchored |
| Clamp | dragging past the top-left wall pins the panel to the host corner |
| Persist | the stored rect matches the live panel, and survives a page reload (not the default anchor) |
| Auto-hide | fades (`aria-hidden=true`) after the idle timeout; wakes (`aria-hidden=false`) on host pointer activity |

## Bug this spike caught

The natural import path `@/ui/FloatingPanel` resolved to the **wrong file**. The
core was named `floatingPanel.ts` beside the component `FloatingPanel.tsx`; on a
case-insensitive filesystem those collide, and Vite tries `.ts` before `.tsx`,
so `@/ui/FloatingPanel` imported the core (no `FloatingPanel` export) instead of
the component. This would have broken #54's import too. The unit tests never saw
it because they import `./floatingPanel` directly with exact case.

Fix: renamed the core to `floatingPanelRect.ts` (distinct from the component,
matching the repo convention that core/component pairs get different names —
`lens.ts`+`LensPane.tsx`, `authordraft.ts`+`AuthorRoad.tsx`). `@/ui/FloatingPanel`
now resolves unambiguously to the component.
