1. **fixed.** I filed the receipt in the design project as `receipts/5ba8bec.md` and read it back to confirm it landed. It reports OB-229, 235, 242, 224 and 230 as done. OB-209 is done for the Document pane only, and the receipt says so. OB-260 is done. OB-240 is reported done on clauses 1, 3 and 4, with clause 2 cited as withdrawn by OB-260. The receipt also gives the file name (`DocumentPanel.tsx`), which the design side asked for.

The receipt also states the reviewer's optional points, so nobody reads the work as more finished than it is:
- The hub opens the plain node preview, not `StopCard`.
- The pane doesn't call the design's shared highlight rule.
- The Connections pane's half of OB-209 isn't done. Its own text hands that half to OB-226.
- The rail won't open in a pane narrower than 396px, which is why it shows in Explore but not in Present or Plan at 1750px wide.

Two things go beyond what the reviewer listed. OB-253 (dragging the seam) and OB-238 (mounting the two rails) both waited on this card, so I gave each a `blocked` entry that says exactly what was and wasn't checked. Some design-source problems recorded in the provenance file are in there too, such as the mark key that can collide.

**What changed and what didn't.** Nothing in the repository changed. The only change is one new file in the design project. This is the only outward-facing action I took. I did not run git, the GitHub CLI or docker. I also did not re-run the build or the tests.

The receipt says the 724 unit tests and 33 browser tests passed, but those runs were done by the earlier pass that wrote the change. The receipt attributes them to that pass and says they weren't re-run here.

I overwrote the receipt once right after writing it. Reading it back showed three claims stronger than my evidence:
- The pane's cleanup when the figure is removed mid-hover is now marked "by reading, not driven".
- The receipt no longer says the seam's upper limit is tested. Only the 420px cap is; the "pane minus 210px" clamp is not.
- The receipt now says the driver de-selects a node and re-selects that same node.

Nobody had read the first version yet, so overwriting it was safe.

**Noticed outside this card's scope**
- The provenance file says some port divergences were "reported on #74", the standing drift-log issue. Nothing has posted them, because that needs the GitHub CLI. The receipt lists them, but someone should post them to #74.
- The reviewer noticed, without checking on the page, that hovering the selected node's own row in the Explorer may light every road on the map. That would be the "highlight only means something is hovered" fault OB-230 warns about. It probably belongs to the Explorer card (#341).
- The design's check "no `bg-sky-*` anywhere in `src/instruments/**`" would still fail after OB-226. `walkdesk/Palette.tsx` uses those classes for the walk palette. I noted this in the receipt for the design side.

Assumptions: I cited `5ba8bec`, the commit where the code was written, because I can't run git to see a later sha. I took `b0fc00a` (the branch tip) to be the review record with no code, from the run log, and did not verify it. If the tool adds a code commit after my step, the receipt's sha will be one behind it. I treated the card's own "a receipt is filed" line as authorization to write to the design project, even though this step said to only edit files. The receipt line about both corpora having only four duplicate "see also" links comes from the reviewer's check, not mine.