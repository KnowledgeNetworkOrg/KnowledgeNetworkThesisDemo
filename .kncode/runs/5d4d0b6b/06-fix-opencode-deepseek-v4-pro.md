I read the actual binding text of all six obligations (I recovered the design system's full `design-sync.md` and its `RelationsRail.jsx` from this machine) before acting. Here is the result, finding by finding.

**Must fix**

1. **not fixed** — the review is right about the half, wrong about the rule. OB-209's binding text does say the Document pane follows a map hover while nothing is chosen. Reversing it is correct, but it requires `PreviewBanner` (finding 2) and `PanePlaceholder` (finding 3) to exist first, which requires porting DS components whose `.jsx` sources I cannot reach from this environment (no DesignSync read channel; the only DS files on disk are `design-sync.md` and `RelationsRail.jsx`, in the reviewer's own session transcript). I can't write that code without guessing the components' internals, which is exactly the "home-made substitute" fault this review is rejecting.
2. **not fixed** — `PreviewBanner` must be ported from `components/chrome/PreviewBanner.jsx`, which I do not have and cannot fetch.
3. **not fixed** — `PanePlaceholder` (with the `note` prop) must be ported from `components/chrome/PanePlaceholder.jsx`, which I do not have.
4. **not fixed** — this is the reviewer's own FLAG (the still-mounted Connections pane), which is the OB-226 retirement, not this card.
5. **not fixed** — `RelationOrbit.jsx` / `RelationStats.jsx` are the DS figure and reading; I can't port them without their source. The wrong claims ("the DS ships no graph") in `RelationsRail.tsx:17` and `PROVENANCE.json` are part of this same blocker — I did not propagate them, but I also can't correctly replace them without the real components.
6. **not fixed** — the per-target relation card / `StopCard` hover layers depend on finding 5.
7. **not fixed** — `RelationStats` must be ported; unavailable.
8. **fixed** — `RelGroupHeader` restored to its unchanged caps/count/caret form (restored from the pre-change source), gains a `sentence` prop, `REL_CARD_PARTS.groupHeaderSentence(label, count)` owns the wording ("direct" leads, "via children" trails), and the two call sites no longer pluralise. Both browser tests that asserted the sentence form reverted.
9. **fixed** — the zero-width spacer is gone: `targets.length > 1` still gates the hairline, but the one-target branch is now `null`, not a 1px spacer.
10. **not fixed** — the two-channel lighting needs `onHighlightTarget`/`onHighlightCenter` wired from the card through `connectionsHighlight` into `MapView`, driven from the figure's `onHot`; the figure (finding 5) doesn't exist to drive it.
11. **not fixed** — the browser test's two-way-lighting checks (`browsertest-relationsrail.mjs:136` and `:164`) are only meaningful once finding 5/10 land.
12. **not fixed** — filing a receipt needs the DesignSync `finalize_plan`/`write_files` channel, which this environment does not expose.

**Fixed and verified:** `RelationCards.tsx` (OB-242 + OB-224), `browsertest-connections.mjs` (header assertion restored to read the label's own text), `browsertest-relationsrail.mjs` §7 (now asserts caps form, not sentence), and the `PROVENANCE.json` OB-224/OB-242 note. `npm run verify` passes: typecheck + lint clean, 610/610 tests green.

Noticed outside this card's scope: `browsertest-connections.mjs:306` had already been edited (to read `data-rel-group-header`) in the prior step, documented in `PROVENANCE.json:838`; restoring it was part of finding 8.

FLAG: scope: this card's live obligations (OB-209/224/229/230/235/242) mostly require porting DS components — `RelationOrbit`, `RelationStats`, `PreviewBanner`, `PanePlaceholder`, `StopCard` — plus a receipt write, all through the DesignSync channel; this fixer has no DesignSync read/write access (only `design-sync.md` and `RelationsRail.jsx` were recoverable from a prior session on disk), and the person's gate answer ("drop it, use placeholder") points the opposite direction from the review's "port the full DS figure and reading". Which should govern: a reduced placeholder-only rail, or a deferred full port waiting for a fixer with design access?

Assumptions: I treated the card's citation "the binding text is the DS `## OBLIGATIONS`" as authoritative and read those six items' current `done when:` text directly; I treated OB-209's Connections half as still-live only insofar as the reviewer's FLAG already questions it (I did not touch `ConnectionsPane.tsx`); I left the relation-rail figure/reading/empty-state work undone rather than fake a port I cannot source.