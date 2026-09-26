I've completed the implementation. Here is the summary.

## Summary

I built the Document pane's relations rail — step three of the dissolution — and made the two pending fixes to `RelationCards`. What changed, in plain terms:

**The rail (OB-229, OB-235, OB-230, OB-209).** I added a new `RelationsRail` component in `src/ds/connections/RelationsRail.tsx` — the same shared `RailFrame` chrome the Explorer rail wears, but on the right edge with the `RelationsMark` word-and-glyph — and exported it from `src/ds/index.ts`. I adopted it in `src/instruments/DocumentPanel.tsx`, which now measures itself, wraps everything in one `NodePreviewLayer`, and renders the document prose beside the rail. The rail holds:
- **The figure** (OB-229): the app's own relation star (`starFor`/`regionStarFor`), centred on the document's node, drawn with no text labels because the hover card IS the text. Hovering a counterpart raises the shared `NodePreviewCard`, anchored beside the figure via the `avoid` mechanism (`previewPlacement`/`previewGutter`).
- **A reading** (OB-235): a sentence under the figure (`neighbourhoodReading`) — "7 links across 7 neighbours — 1 reach out, 7 come in." — not a re-listed card group.
- **Two-way lighting** (OB-230): the figure publishes `bus.setHover` on hover and lights on `bus.hover`, so figure↔map light each other over the one channel but as two surfaces.
- **Empty / no-follow** (OB-209): the pane reads `bus.focus` only — nothing chosen means empty (no `ROOT_ID` fallback), and a map hover never re-aims it. I moved the shared relations index into `corpustree.ts` (beside the tree/summary that already live there) and changed the `document` instrument to `body:'none'` so the rail's own scroller sits beside the document's.

**The two card fixes (OB-242, OB-224).** In `src/ds/connections/RelationCards.tsx`: the group header now reads as a sentence ("7 direct relationships", count in mono leading a pluralised noun) instead of "DIRECT 1"; and the source bracket keys off `targets.length` instead of `items.length`, so several arrows into one target no longer draw a bracket.

**Verification.** Added `tools/studio-spike/browsertest-relationsrail.mjs` (port 5264), updated the one stale header assertion in `browsertest-connections.mjs`, and recorded the port in `PROVENANCE.json`. I ran `npm install`, `npm run verify` (typecheck + lint + 610 unit tests, all green), and the browser suites: the new `relationsrail` test, plus `connections`, `rules-washes-baselines`, `deskwidths`, and `studiodesk` — all pass, including both directions of OB-230 and the OB-209 empty/no-follow rule.

## Assumptions

- **I could not read the DS's `## OBLIGATIONS` (`design-sync.md`), and I could not file receipts.** The `design-pull`/DesignSync MCP tools (`list_files`, `get_file`, `finalize_plan`, `write_files`) are not available in this environment, so I worked from the card's obligation table and my plan rather than the exact `done when:` clauses, and no `receipts/<sha>.md` was written. This is the biggest gap — the card's "file a receipt" is still outstanding.
- **The exact "via children" sentence wording** was not specified; I chose "42 relationships via children".
- **The reading's phrasing** is my own sentence (counts out/in), since the obligation names intent ("a reading, not a list") without a canonical string.
- **OB-209's "both panes sit empty"** — I applied the Document side (empty on null). The Connections pane still shows its existing `#6` ROOT_ID/cursor fallback; I read that as OB-226's (unmount) territory, per my plan's out-of-scope line.
- **The rail only fits when the document pane is ≥ 396px** wide (the DS's own `PANE_RAIL_METRICS.right` floor of `min 186 + keep 210`). At the default explore preset that needs a window of roughly 1550px or wider; narrower, the pane shows the shared "Relations — widen this pane" refusal. This is the DS's three-state behaviour, not something I changed — but it's worth flagging to the owner, since the document stays at 325–386px in today's default layout.