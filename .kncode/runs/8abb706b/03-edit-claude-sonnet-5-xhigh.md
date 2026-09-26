The Document pane now has a Relations rail, and the six obligations are met. The Connections pane's own "Nothing chosen" state is not done (details below). The rail and its hover card work on the running page, and the full repo gate passes (build, typecheck, lint, 724 unit tests, all 33 browser tests including the new one).

## What is different now

- **Layout:** The Document pane is prose on the left and a Relations rail on the right, centred on whatever node the pane shows. The rail has a circular figure, with angle for kind of relationship and radius for direct versus indirect.
- **Reading (OB-235):** Under the figure is a reading of the neighbourhood: neighbour and relationship totals, a direct/indirect bar, and a bar per kind. There is no card list.
- **Hover card (OB-229, OB-242):** Pointing at a mark opens a card over the prose, never over the figure. Its header reads "1 direct relationship", or "2 relationships via children" for a container.
- **Card bracket (OB-224):** The card's left bracket now follows the number of targets, not the number of relationship kinds.
- **Map lighting (OB-230):**
  - **Mark to map:** A mark lights exactly one road on the map and dims the rest.
  - **Hub to map:** The hub lights only the selected cell, with a heavier glow.
  - **Map to figure:** Hovering a neighbour's cell on the map lights its mark in the figure without opening the card.
  - **Leaving:** Leaving clears both.
  - The centre light needed a new shared signal alongside the existing hover one. Otherwise hovering the centre would light every road.
- **Nothing chosen (OB-209, OB-260):** With nothing selected, the Document pane shows a dashed "Nothing chosen" placeholder, identical on first load and after a de-select. It no longer falls back to the corpus root. A map hover previews that node's document, with an always-present preview row so nothing shifts.
- **Empty and one-kind cases:** On the course corpus, an unconnected course (CPS 714) shows "No relationships / Nothing connects to this node". The one-kind corpus fans its marks over half the circle.
- **New relationships module:** The relationship index moved out of the Connections pane into `src/instruments/relations.ts`, so both read one copy.

## Verified

I drove the real app in a browser on both corpora and looked at screenshots of each state. The new test (`tools/studio-spike/browsertest-relationsrail.mjs`) checks each obligation's "done when". I temporarily broke the hub light and the card sizing on purpose, and the test caught both. The existing Explorer, Connections and map tests still pass unchanged. The seam drag also works and keeps the card clear of the figure.

## Things you should know

- **The Connections pane's own "Nothing chosen" state is not done.** OB-209's text says that half retires with the pane, and I left that pane's preview rule alone as planned. It still shows the old resting node, so "both panes empty" is true only for Document. Say if you want that half done.
- **The rail refuses to open below a 396px pane.** That is its floor, and it shows a "Relations — widen this pane" note instead. At 1750px it opens in Explore (the Document pane is 446px there) but not in the default Present layout (335px) or Plan (367px). The Connections pane is still mounted and takes width, and unmounting it is OB-226.
- **The receipt is not filed.** It needs a commit hash, and I don't commit. It should also mark OB-260 done and report the OB-253 seam drag as driven.
- **I did not run git, `gh` or docker.** I did install packages (root and `desktop/`) and ran builds and tests.

## Departures from the design source (all recorded in the provenance file)

- The design's preview-row attribute is missing at rest, contradicting its own done-when, so it is always present here.
- The mark key can collide when two children share a relationship, so the host feeds one entry per target and kind. The hover card still names every child.
- Native tooltips in the reading are wrapped to satisfy the repo's rule.

Assumptions: Hovering the hub opens the plain node preview card rather than the walk stop card that OB-229 names. That matches the design's own shell wiring, and the walk stop card is for walk stops. With nothing chosen I show only the placeholder, not the rail. The rail starts open, and the seam width is plain in-memory state (persistence is OB-255). "The reverse direction" in OB-230 means a map hover lighting the figure's mark, since the old list filter no longer exists. The hover card lists every child that carries a shared relationship, while the figure draws one mark for it.