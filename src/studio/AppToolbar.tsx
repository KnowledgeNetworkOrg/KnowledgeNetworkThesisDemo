import { CopyMark, LoadMark, NewMapMark, PasteMark, PrintMark, SaveMark, Toolbar } from '@/ds'
import type { ToolbarItemSpec } from '@/ds'

import { redoDraft, undoDraft } from '../state/walk/authordraft'
import { PALETTE_HOOK, PALETTE_TIP, PaletteGlyph } from './PaletteGlyph'
import { PRESENT_HOOK, PRESENT_TITLE } from './presentbutton'
import type { PresentState } from './presentbutton'

/** The application toolbar (#55): universal, app-level operations pinned directly
 *  under the app header — the DS Toolbar's designed slot. Built entirely on the
 *  DS Toolbar / ToolbarItem, glyph-only (OB-064) — the DS shipped the marks that
 *  were missing (NewMapMark/PrintMark/SaveMark/LoadMark/CopyMark/PasteMark),
 *  resolving #55's open "labels vs glyphs" call in favour of glyphs; text pills
 *  were the interim, on-spec choice while those marks didn't exist yet.
 *
 *  Only undo/redo and Present have a command model today. Undo/redo are wired to
 *  the walk-draft history in authordraft.ts (the sole undoable model in the demo
 *  — note it is WALK-scoped, not truly app-global; safe no-ops when the history
 *  is empty). new map / print / save / load / copy / cut / paste have no backing
 *  model yet, so they render disabled, carrying their `Name (Ctrl+X)` tooltip
 *  until an app-level command/clipboard model exists. See #55.
 *
 *  PRESENT (#195, #267) is app-level in the strongest sense — it replaces the
 *  whole screen — so it belongs here rather than on any instrument. THE ▶ IS THE
 *  ONLY START (DS OB-135 rule 1): it starts the lecture at the focus and puts the
 *  live slide on the projector; the palette's Present is only a preview. Its
 *  title reads "present" / "presenting" / "resume" for the three states, it is
 *  unpressable exactly while a lecture is live, and pressing it once a lecture
 *  has ended RESUMES. It carries no keyboard shortcut on purpose: PowerPoint's F5
 *  is the browser's reload, which in a Vite-heavy workflow is a key the author
 *  presses constantly. Shift+F5 is the candidate if one is ever wanted.
 *
 *  THE PALETTE TOGGLE IS THE ONE ITEM HERE THAT IS NOT OPTIONAL CHROME (OB-104):
 *  the palette pane's ✕ closes it, and this is the only thing that brings it back.
 *  Ship one without the other and the pane is a one-way door. */
export function AppToolbar({ present, palette }: { present?: { state: PresentState; onClick: () => void }; palette?: { on: boolean; onToggle: () => void } } = {}) {
  // GROUP ORDER IS THE OBLIGATION, not a preference (OB-105): palette, then the
  // four document-lifecycle actions in the order they are actually used — create,
  // load, save, print (output last) — then editing, then the clipboard. `new map`
  // used to stand alone in front and print/save/load ran backwards.
  const paletteGroup: ToolbarItemSpec[] = palette
    ? [
        {
          glyph: <PaletteGlyph />,
          title: palette.on ? PALETTE_TIP.hide : PALETTE_TIP.show,
          on: palette.on,
          onClick: palette.onToggle,
          // THE ANIMATION'S ANCHOR (OB-124). StudioView measures where the pane
          // should fly to off this button's box, and needs to find it without
          // reading its tooltip — the one thing about it that changes as it
          // toggles. `hook` is the DS's own answer; `paletteanchor.ts` existed
          // only because the component had no such prop.
          hook: PALETTE_HOOK,
        },
      ]
    : []
  const editing: ToolbarItemSpec[] = [
    { glyph: '↶', title: 'Undo (Ctrl+Z)', onClick: undoDraft },
    { glyph: '↷', title: 'Redo (Ctrl+Y)', onClick: redoDraft },
  ]
  const document: ToolbarItemSpec[] = [
    { glyph: <NewMapMark />, title: 'New map', disabled: true },
    { glyph: <LoadMark />, title: 'Load', disabled: true },
    { glyph: <SaveMark />, title: 'Save (Ctrl+S)', disabled: true },
    { glyph: <PrintMark />, title: 'Print (Ctrl+P)', disabled: true },
  ]
  const clipboard: ToolbarItemSpec[] = [
    { glyph: <CopyMark />, title: 'Copy (Ctrl+C)', disabled: true },
    { glyph: <PasteMark />, title: 'Paste (Ctrl+V)', disabled: true },
    { glyph: '✂', title: 'Cut (Ctrl+X)', disabled: true },
  ]
  // ▶ is TrailStrip's own glyph for starting a walk, so entering a deck reads as
  // the same family of act. `walk` is the tone the DS reserves for movement
  // through the corpus, which is what distinguishes this from the file-and-
  // clipboard verbs beside it.
  const state = present?.state ?? 'idle'
  const presentGroup: ToolbarItemSpec[] = [{ glyph: '▶', title: PRESENT_TITLE[state], tone: 'walk', on: state === 'live', disabled: state === 'live', onClick: present?.onClick, hook: PRESENT_HOOK }]
  return (
    <Toolbar
      groups={[
        ...(paletteGroup.length ? [{ items: paletteGroup }] : []),
        { items: document },
        { items: editing },
        { items: clipboard },
        { items: presentGroup },
      ]}
    />
  )
}
